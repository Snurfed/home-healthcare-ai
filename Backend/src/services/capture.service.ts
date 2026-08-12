/**
 * Capture Service
 *
 * Orchestrates the voice capture workflow:
 * 1. Audio transcription via Whisper
 * 2. Clinical entity extraction via Claude
 * 3. EMR field mapping
 * 4. SOAP note generation
 */

import Anthropic from '@anthropic-ai/sdk';
import { whisperService, type TranscriptionResult } from './whisper.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { MODELS } from '../config/models';
// ===========================================
// LAZY-LOAD ANTHROPIC CLIENT
// ===========================================

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export interface CaptureInput {
  audioBuffer?: Buffer;
  audioPath?: string;
  documentTexts?: string[];
  patientContext?: {
    name?: string;
    dateOfBirth?: string;
    diagnoses?: string[];
  };
  visitType?: string;
  discipline?: string;
}

export interface ExtractedEntities {
  diagnoses: Array<{
    code?: string;
    description: string;
    confidence: number;
  }>;
  medications: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    route?: string;
    confidence: number;
  }>;
  vitals: Array<{
    type: string;
    value: string | number;
    unit?: string;
    confidence: number;
  }>;
  symptoms: Array<{
    description: string;
    severity?: string;
    duration?: string;
    confidence: number;
  }>;
  functionalStatus: Array<{
    activity: string;
    level: string;
    confidence: number;
  }>;
  wounds: Array<{
    location: string;
    type?: string;
    stage?: string;
    measurements?: string;
    confidence: number;
  }>;
  painAssessments: Array<{
    location?: string;
    level: number;
    description?: string;
    confidence: number;
  }>;
}

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  interventions?: string;
  patientEducation?: string;
  coordinationOfCare?: string;
  homeboundStatus?: string;
  skilledNeed?: string;
}

export interface EmrFieldAnswer {
  fieldId: string;
  fieldLabel: string;
  section: string;
  type: string;
  required: boolean;
  proposedAnswer: string | number | boolean | string[];
  proposedAnswerLabel?: string;
  confidence: number;
  sources: Array<{
    type: 'audio' | 'document' | 'manual';
    text: string;
    audioTimestamp?: number;
    documentId?: string;
  }>;
}

export interface CaptureResult {
  success: boolean;
  transcription?: TranscriptionResult;
  transcript?: string;
  extractedEntities?: ExtractedEntities;
  soapNote?: SoapNote;
  emrAnswers?: EmrFieldAnswer[];
  visitNarrative?: string;
  processingTimeMs: number;
  error?: string;
}

// ===========================================
// ENTITY EXTRACTION PROMPT
// ===========================================

const ENTITY_EXTRACTION_PROMPT = `You are a clinical documentation specialist analyzing a home health visit. Extract all clinical entities from the transcript and any referral document text provided.

CRITICAL: CROSS-REFERENCE AUDIO AND DOCUMENTS
- Referral documents (marked "REFERRAL DOCUMENT CONTENT") contain verified physician orders, diagnoses, and medications
- Audio transcript captures what was discussed during the visit
- When conflicts exist, PREFER the referral document for:
  * Diagnoses (use ICD-10 codes from referral, not verbal mentions)
  * Medications (only include meds listed in the referral unless explicitly stated as NEW)
  * Medical history
- Use audio transcript primarily for:
  * Vitals taken during visit
  * Current symptoms and pain levels
  * Functional status observations
  * Patient's verbal reports

Return a JSON object with these exact keys:
{
  "diagnoses": [{"code": "ICD-10 from referral if available", "description": "diagnosis description", "confidence": 0.0-1.0}],
  "medications": [{"name": "drug name", "dosage": "amount", "frequency": "schedule", "route": "route", "confidence": 0.0-1.0}],
  "vitals": [{"type": "BP/HR/RR/Temp/SpO2/Weight/Pain", "value": "measured value", "unit": "unit", "confidence": 0.0-1.0}],
  "symptoms": [{"description": "symptom", "severity": "mild/moderate/severe", "duration": "timeframe", "confidence": 0.0-1.0}],
  "functionalStatus": [{"activity": "ADL/IADL activity", "level": "independent/supervision/minimal assist/moderate assist/maximal assist/dependent", "confidence": 0.0-1.0}],
  "wounds": [{"location": "body location", "type": "wound type", "stage": "staging if pressure ulcer", "measurements": "L x W x D", "confidence": 0.0-1.0}],
  "painAssessments": [{"location": "body area", "level": 0-10, "description": "quality/character", "confidence": 0.0-1.0}]
}

IMPORTANT: Do NOT fabricate medications or diagnoses not present in the source data. If the audio mentions a condition but the referral document shows a different diagnosis, use the referral's ICD-10 code.

Set confidence based on data source:
- 0.95+ : From referral document with ICD-10 code
- 0.85-0.94: Clearly stated in audio with supporting document context
- 0.70-0.84: From audio only, not in referral
- Below 0.70: Uncertain or conflicting data`;

// ===========================================
// SOAP NOTE GENERATION PROMPT
// ===========================================

const SOAP_GENERATION_PROMPT = `You are an experienced home health clinical documentation specialist. Generate a comprehensive SOAP note from the following visit transcript, referral documents, and extracted clinical data.

CRITICAL: Use referral document diagnoses and medications as the source of truth. If the audio mentions different conditions than what's in the referral, document what's in the referral and note any relevant observations from the visit.

Write in professional clinical language appropriate for the medical record. Be concise but thorough. Use standard medical abbreviations where appropriate (pt, c/o, WNL, ROM, etc). Do not fabricate any information not present in the data.

Return a JSON object with these exact keys:
{
  "subjective": "Patient-reported symptoms, complaints, and history. What the patient says.",
  "objective": "Measurable findings: vital signs, physical exam findings, functional assessments, wound measurements, etc.",
  "assessment": "Clinical impression using diagnoses FROM THE REFERRAL DOCUMENT, problem list, risk assessment, homebound status justification.",
  "plan": "Interventions performed, patient education provided, goals, next visit plan, referrals needed.",
  "interventions": "Specific skilled nursing/therapy interventions performed this visit.",
  "patientEducation": "Topics taught and patient/caregiver understanding.",
  "coordinationOfCare": "Communication with physicians, other disciplines, or services.",
  "homeboundStatus": "Two-criteria justification for homebound status.",
  "skilledNeed": "Justification for skilled care necessity."
}

Write each section as flowing clinical paragraphs, not bullet points.`;

// ===========================================
// EMR FIELD MAPPING PROMPT
// ===========================================

const EMR_FIELD_MAPPING_PROMPT = `You are mapping clinical data to EMR form fields. Based on the transcript, extracted entities, and SOAP note, propose answers for the following EMR fields.

For each field, determine the most appropriate answer based on the clinical data. If there's no data to support an answer, mark confidence as 0.

Return a JSON array of field answers:
[
  {
    "fieldId": "field identifier",
    "proposedAnswer": "the proposed value (string, number, boolean, or array)",
    "proposedAnswerLabel": "human-readable label for coded values",
    "confidence": 0.0-1.0,
    "sourceText": "relevant text from transcript supporting this answer"
  }
]

EMR Fields to map:`;

// ===========================================
// STANDARD EMR FIELDS
// ===========================================

const STANDARD_EMR_FIELDS = [
  { fieldId: 'visit_date', label: 'Visit Date', section: 'Administrative', type: 'date', required: true },
  { fieldId: 'visit_time_in', label: 'Time In', section: 'Administrative', type: 'time', required: true },
  { fieldId: 'visit_time_out', label: 'Time Out', section: 'Administrative', type: 'time', required: true },
  { fieldId: 'visit_location', label: 'Visit Location', section: 'Administrative', type: 'select', required: true },

  // Vitals
  { fieldId: 'bp_systolic', label: 'Blood Pressure - Systolic', section: 'Vital Signs', type: 'number', required: true },
  { fieldId: 'bp_diastolic', label: 'Blood Pressure - Diastolic', section: 'Vital Signs', type: 'number', required: true },
  { fieldId: 'heart_rate', label: 'Heart Rate', section: 'Vital Signs', type: 'number', required: true },
  { fieldId: 'respiratory_rate', label: 'Respiratory Rate', section: 'Vital Signs', type: 'number', required: false },
  { fieldId: 'temperature', label: 'Temperature', section: 'Vital Signs', type: 'number', required: false },
  { fieldId: 'spo2', label: 'Oxygen Saturation (SpO2)', section: 'Vital Signs', type: 'number', required: false },
  { fieldId: 'weight', label: 'Weight (lbs)', section: 'Vital Signs', type: 'number', required: false },
  { fieldId: 'pain_level', label: 'Pain Level (0-10)', section: 'Vital Signs', type: 'scale', required: true },
  { fieldId: 'pain_location', label: 'Pain Location', section: 'Vital Signs', type: 'text', required: false },

  // Assessment
  { fieldId: 'chief_complaint', label: 'Chief Complaint', section: 'Assessment', type: 'textarea', required: true },
  { fieldId: 'general_appearance', label: 'General Appearance', section: 'Assessment', type: 'textarea', required: true },
  { fieldId: 'mental_status', label: 'Mental Status', section: 'Assessment', type: 'select', required: true },
  { fieldId: 'respiratory_assessment', label: 'Respiratory Assessment', section: 'Assessment', type: 'textarea', required: false },
  { fieldId: 'cardiovascular_assessment', label: 'Cardiovascular Assessment', section: 'Assessment', type: 'textarea', required: false },
  { fieldId: 'skin_assessment', label: 'Skin/Wound Assessment', section: 'Assessment', type: 'textarea', required: false },
  { fieldId: 'mobility_status', label: 'Mobility Status', section: 'Assessment', type: 'select', required: true },
  { fieldId: 'fall_risk', label: 'Fall Risk Level', section: 'Assessment', type: 'select', required: true },

  // Functional Status
  { fieldId: 'adl_bathing', label: 'ADL - Bathing', section: 'Functional Status', type: 'select', required: false },
  { fieldId: 'adl_dressing', label: 'ADL - Dressing', section: 'Functional Status', type: 'select', required: false },
  { fieldId: 'adl_toileting', label: 'ADL - Toileting', section: 'Functional Status', type: 'select', required: false },
  { fieldId: 'adl_eating', label: 'ADL - Eating', section: 'Functional Status', type: 'select', required: false },
  { fieldId: 'adl_transfers', label: 'ADL - Transfers', section: 'Functional Status', type: 'select', required: false },
  { fieldId: 'adl_ambulation', label: 'ADL - Ambulation', section: 'Functional Status', type: 'select', required: false },

  // Medications
  { fieldId: 'medication_changes', label: 'Medication Changes', section: 'Medications', type: 'textarea', required: false },
  { fieldId: 'medication_compliance', label: 'Medication Compliance', section: 'Medications', type: 'select', required: true },

  // Plan
  { fieldId: 'interventions_performed', label: 'Interventions Performed', section: 'Plan', type: 'multi_select', required: true },
  { fieldId: 'patient_education', label: 'Patient Education Topics', section: 'Plan', type: 'multi_select', required: true },
  { fieldId: 'patient_response', label: 'Patient Response to Interventions', section: 'Plan', type: 'textarea', required: true },
  { fieldId: 'goals_progress', label: 'Progress Toward Goals', section: 'Plan', type: 'textarea', required: false },
  { fieldId: 'next_visit_plan', label: 'Plan for Next Visit', section: 'Plan', type: 'textarea', required: true },

  // Homebound Status
  { fieldId: 'homebound_criteria_1', label: 'Homebound Criteria 1', section: 'Homebound Status', type: 'textarea', required: true },
  { fieldId: 'homebound_criteria_2', label: 'Homebound Criteria 2', section: 'Homebound Status', type: 'textarea', required: true },
  { fieldId: 'skilled_need_justification', label: 'Skilled Need Justification', section: 'Homebound Status', type: 'textarea', required: true },
];

// ===========================================
// MAIN CAPTURE PROCESSING
// ===========================================

/**
 * Process a voice capture - full pipeline
 */
export async function processCapture(input: CaptureInput): Promise<CaptureResult> {
  const startTime = Date.now();

  try {
    let transcript = '';
    let transcriptionResult: TranscriptionResult | undefined;

    // Step 1: Transcribe audio if provided
    if (input.audioBuffer || input.audioPath) {
      console.log('[Capture] Step 1: Transcribing audio...');

      let audioPath = input.audioPath;
      let tempFile: string | undefined;

      // If buffer provided, write to temp file
      if (input.audioBuffer && !audioPath) {
        tempFile = path.join(os.tmpdir(), `capture_${Date.now()}.webm`);
        fs.writeFileSync(tempFile, input.audioBuffer);
        audioPath = tempFile;
      }

      if (audioPath) {
        transcriptionResult = await whisperService.transcribeAudio(audioPath, {
          medicalVocabulary: true,
        });
        transcript = transcriptionResult.text;

        // Cleanup temp file
        if (tempFile && fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    }

    // Add document text to context
    if (input.documentTexts && input.documentTexts.length > 0) {
      const docContent = input.documentTexts.join('\n\n');
      transcript += '\n\n--- REFERRAL DOCUMENT CONTENT ---\n' + docContent;
      console.log('[Capture] Added document content to transcript:', {
        docCount: input.documentTexts.length,
        totalDocChars: docContent.length,
        transcriptTotalChars: transcript.length,
      });
    } else {
      console.log('[Capture] No document texts to add - audio only');
    }

    if (!transcript.trim()) {
      return {
        success: false,
        processingTimeMs: Date.now() - startTime,
        error: 'No audio or document content provided',
      };
    }

    console.log('[Capture] Step 2: Extracting clinical entities...');
    const extractedEntities = await extractEntities(transcript, input.patientContext);

    console.log('[Capture] Step 3: Generating SOAP note...');
    const soapNote = await generateSoapNote(transcript, extractedEntities, input.patientContext);

    console.log('[Capture] Step 4: Mapping to EMR fields...');
    const emrAnswers = await mapToEmrFields(transcript, extractedEntities, soapNote);

    // Generate visit narrative (summary)
    const visitNarrative = generateVisitNarrative(extractedEntities, soapNote);

    console.log('[Capture] Processing complete');

    return {
      success: true,
      transcription: transcriptionResult,
      transcript,
      extractedEntities,
      soapNote,
      emrAnswers,
      visitNarrative,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[Capture Error]', error);
    return {
      success: false,
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Capture processing failed',
    };
  }
}

/**
 * Extract clinical entities from transcript
 */
async function extractEntities(
  transcript: string,
  patientContext?: CaptureInput['patientContext']
): Promise<ExtractedEntities> {
  const client = getAnthropicClient();

  let userPrompt = ENTITY_EXTRACTION_PROMPT + '\n\n--- TRANSCRIPT ---\n' + transcript;

  if (patientContext) {
    userPrompt += '\n\n--- PATIENT CONTEXT ---\n';
    if (patientContext.name) userPrompt += `Patient: ${patientContext.name}\n`;
    if (patientContext.dateOfBirth) userPrompt += `DOB: ${patientContext.dateOfBirth}\n`;
    if (patientContext.diagnoses) userPrompt += `Known Diagnoses: ${patientContext.diagnoses.join(', ')}\n`;
  }

  const response = await client.messages.create({
    model: MODELS.REALTIME,
    max_tokens: 4096,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const content = response.content[0];
  if (!content || content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const jsonText = extractJsonFromResponse(content.text);

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (parseError) {
    console.error('[Entity Extraction] JSON parse error:', parseError);
    console.error('[Entity Extraction] Raw response (first 500 chars):', content.text.substring(0, 500));
    console.error('[Entity Extraction] Extracted JSON (first 500 chars):', jsonText.substring(0, 500));
    // Return empty entities instead of failing
    return {
      diagnoses: [],
      medications: [],
      vitals: [],
      symptoms: [],
      functionalStatus: [],
      wounds: [],
      painAssessments: [],
    };
  }

  return {
    diagnoses: parsed.diagnoses || [],
    medications: parsed.medications || [],
    vitals: parsed.vitals || [],
    symptoms: parsed.symptoms || [],
    functionalStatus: parsed.functionalStatus || [],
    wounds: parsed.wounds || [],
    painAssessments: parsed.painAssessments || [],
  };
}

/**
 * Generate SOAP note from transcript and entities
 */
async function generateSoapNote(
  transcript: string,
  entities: ExtractedEntities,
  patientContext?: CaptureInput['patientContext']
): Promise<SoapNote> {
  const client = getAnthropicClient();

  let userPrompt = SOAP_GENERATION_PROMPT;
  userPrompt += '\n\n--- TRANSCRIPT ---\n' + transcript;
  userPrompt += '\n\n--- EXTRACTED ENTITIES ---\n' + JSON.stringify(entities, null, 2);

  if (patientContext) {
    userPrompt += '\n\n--- PATIENT CONTEXT ---\n';
    if (patientContext.name) userPrompt += `Patient: ${patientContext.name}\n`;
    if (patientContext.diagnoses) userPrompt += `Known Diagnoses: ${patientContext.diagnoses.join(', ')}\n`;
  }

  const response = await client.messages.create({
    model: MODELS.REALTIME,
    max_tokens: 8192,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const content = response.content[0];
  if (!content || content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const jsonText = extractJsonFromResponse(content.text);
  const parsed = JSON.parse(jsonText);

  return {
    subjective: parsed.subjective || '',
    objective: parsed.objective || '',
    assessment: parsed.assessment || '',
    plan: parsed.plan || '',
    interventions: parsed.interventions || '',
    patientEducation: parsed.patientEducation || '',
    coordinationOfCare: parsed.coordinationOfCare || '',
    homeboundStatus: parsed.homeboundStatus || '',
    skilledNeed: parsed.skilledNeed || '',
  };
}

/**
 * Map extracted data to EMR fields
 */
async function mapToEmrFields(
  transcript: string,
  entities: ExtractedEntities,
  soapNote: SoapNote
): Promise<EmrFieldAnswer[]> {
  const client = getAnthropicClient();

  // Build field list for prompt
  const fieldList = STANDARD_EMR_FIELDS.map(f =>
    `- ${f.fieldId}: "${f.label}" (${f.type}, ${f.required ? 'required' : 'optional'}) [Section: ${f.section}]`
  ).join('\n');

  const userPrompt = EMR_FIELD_MAPPING_PROMPT + '\n' + fieldList +
    '\n\n--- TRANSCRIPT ---\n' + transcript +
    '\n\n--- EXTRACTED ENTITIES ---\n' + JSON.stringify(entities, null, 2) +
    '\n\n--- SOAP NOTE ---\n' + JSON.stringify(soapNote, null, 2);

  const response = await client.messages.create({
    model: MODELS.REALTIME,
    max_tokens: 8192,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const content = response.content[0];
  if (!content || content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const jsonText = extractJsonFromResponse(content.text);

  let mappedFields: Array<{ fieldId: string; proposedAnswer?: string; proposedAnswerLabel?: string; confidence?: number; sourceText?: string }> = [];
  try {
    mappedFields = JSON.parse(jsonText);
    // Ensure it's an array
    if (!Array.isArray(mappedFields)) {
      console.error('[EMR Mapping] Expected array but got:', typeof mappedFields);
      mappedFields = [];
    }
  } catch (parseError) {
    console.error('[EMR Mapping] JSON parse error:', parseError);
    console.error('[EMR Mapping] Raw response (first 500 chars):', content.text.substring(0, 500));
    console.error('[EMR Mapping] Extracted JSON (first 500 chars):', jsonText.substring(0, 500));
    // Continue with empty mappings instead of crashing
  }

  // Merge with field definitions
  const answers: EmrFieldAnswer[] = STANDARD_EMR_FIELDS.map(field => {
    const mapped = mappedFields.find((m) => m.fieldId === field.fieldId);

    return {
      fieldId: field.fieldId,
      fieldLabel: field.label,
      section: field.section,
      type: field.type,
      required: field.required,
      proposedAnswer: mapped?.proposedAnswer ?? '',
      proposedAnswerLabel: mapped?.proposedAnswerLabel,
      confidence: mapped?.confidence ?? 0,
      sources: mapped?.sourceText ? [{
        type: 'audio' as const,
        text: mapped.sourceText,
      }] : [],
    };
  });

  return answers;
}

/**
 * Generate a brief visit narrative summary
 */
function generateVisitNarrative(entities: ExtractedEntities, soapNote: SoapNote): string {
  const parts: string[] = [];

  // Chief complaint from symptoms
  if (entities.symptoms.length > 0) {
    const mainSymptom = entities.symptoms[0];
    parts.push(`Patient presents with ${mainSymptom.description}${mainSymptom.severity ? ` (${mainSymptom.severity})` : ''}.`);
  }

  // Vitals summary
  const vitals = entities.vitals;
  if (vitals.length > 0) {
    const vitalStrings = vitals.map(v => `${v.type}: ${v.value}${v.unit || ''}`);
    parts.push(`Vitals: ${vitalStrings.join(', ')}.`);
  }

  // Pain
  if (entities.painAssessments.length > 0) {
    const pain = entities.painAssessments[0];
    parts.push(`Pain level ${pain.level}/10${pain.location ? ` (${pain.location})` : ''}.`);
  }

  // Key assessment findings
  if (soapNote.assessment) {
    const firstSentence = soapNote.assessment.split('.')[0];
    if (firstSentence && firstSentence.length < 200) {
      parts.push(firstSentence + '.');
    }
  }

  return parts.join(' ') || 'Visit documentation captured via voice recording.';
}

/**
 * Extract JSON from Claude response (handles markdown code blocks)
 */
function extractJsonFromResponse(text: string): string {
  let jsonText = text.trim();

  // Remove markdown code blocks
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.slice(7);
  }
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.slice(3);
  }
  if (jsonText.endsWith('```')) {
    jsonText = jsonText.slice(0, -3);
  }

  jsonText = jsonText.trim();

  // Try to find JSON boundaries - handle both objects {} and arrays []
  const firstBrace = jsonText.indexOf('{');
  const firstBracket = jsonText.indexOf('[');
  const lastBrace = jsonText.lastIndexOf('}');
  const lastBracket = jsonText.lastIndexOf(']');

  // Determine if it's an array or object based on which comes first
  const isArray = firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace);

  if (isArray && firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    jsonText = jsonText.substring(firstBracket, lastBracket + 1);
  } else if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonText = jsonText.substring(firstBrace, lastBrace + 1);
  }

  // Log for debugging
  if (jsonText.length < 500) {
    console.log('[JSON Extract] Extracted:', jsonText);
  } else {
    console.log('[JSON Extract] Extracted JSON of length:', jsonText.length, 'starts with:', jsonText.substring(0, 20));
  }

  return jsonText;
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  processCapture,
};
