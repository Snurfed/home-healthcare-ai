/**
 * SOAP Note Generation Service
 *
 * AI-powered SOAP note generation from OASIS assessments using Claude.
 * Generates comprehensive clinical narratives from assessment data.
 */

import Anthropic from '@anthropic-ai/sdk';
import prisma from '../config/prisma';
import type { OasisResponse, ReferralDocument } from '../generated/prisma';

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

export interface SoapNoteContent {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface GenerationInput {
  assessmentId: string;
  patientId: string;
  assessmentData?: Record<string, unknown>;
  previousNotes?: SoapNoteContent[];
  additionalContext?: string;
}

export interface GenerationResult {
  success: boolean;
  content: SoapNoteContent;
  aiModelUsed?: string;
  generationTimeMs: number;
  confidence?: number;
  suggestions?: string[];
  error?: string;
}

export interface ValidationResult {
  isComplete: boolean;
  missingFields: string[];
  warnings: string[];
  suggestions: string[];
}

export interface RegenerateSectionResult {
  success: boolean;
  section: string;
  content: string;
  aiModelUsed?: string;
  generationTimeMs: number;
  error?: string;
}

interface PatientData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  mrn: string;
  addressCity?: string;
  addressState?: string;
  primaryPhysicianName?: string;
  primaryPhysicianNpi?: string;
}

interface AssessmentData {
  id: string;
  assessmentType: string;
  status: string;
  startOfCareDate?: string;
  completionDate?: string;
  patient: PatientData;
  responses: OasisResponse[];
  referralDocuments?: ReferralDocument[];
}

// ===========================================
// SYSTEM PROMPT
// ===========================================

const SOAP_GENERATION_SYSTEM_PROMPT = `You are an experienced home health clinical documentation specialist. Generate a comprehensive SOAP note from the following OASIS assessment data. Write in professional clinical language appropriate for the medical record. Be concise but thorough. Use standard medical abbreviations where appropriate (pt, c/o, WNL, ROM, etc). Do not fabricate any information not present in the data. If data is missing for a section, note what was not assessed rather than making assumptions.

Return a JSON object with exactly these four keys:
{
  "subjective": "string",
  "objective": "string",
  "assessment": "string",
  "plan": "string"
}

SUBJECTIVE section should include:
- Reason for referral and chief complaint
- Patient-reported symptoms from the assessment
- Pain reports (from J0510, J0520, J0530 and pain assessment items)
- Mood and depression screening results as reported (D0150, D0160)
- Social isolation response (D0700)
- Patient/caregiver reported history and concerns
- Living situation and caregiver availability (M1100)
- Cultural/religious considerations if documented
- Prior level of function as reported (GG0100 items)
- Transportation needs (A1250)
- Health literacy level (B1300)

OBJECTIVE section should include:
- Height and weight (M1060A, M1060B)
- Vision assessment (B1000) and hearing assessment (B0200)
- Cognitive assessment: BIMS score (C0500) with component scores (C0200, C0300A-C, C0400A-C), interpretation, and cognitive functioning level (M1700)
- Confusion frequency (M1710) and anxiety frequency (M1720)
- Delirium screening results (C1310A-D)
- Behavioral symptoms (M1740, M1745)
- Depression screening: PHQ-2/PHQ-9 scores (D0150, D0160)
- Cardiovascular assessment findings
- Respiratory assessment with dyspnea level (M1400)
- GI assessment with bowel incontinence (M1620), ostomy status (M1630)
- GU assessment with UTI history (M1600), urinary status (M1610)
- Nutritional risk score and findings
- Integumentary: Norton score and risk level, pressure ulcer status (M1306, M1322, M1324), stasis ulcer (M1330), surgical wound (M1340)
- Neurological and musculoskeletal findings
- Diabetic assessment findings if applicable
- ADL functional status - for each item state the M-item score AND the GG score:
  * Grooming (M1800, GG0130B1)
  * Dressing upper body (M1810, GG0130F1)
  * Dressing lower body (M1820, GG0130G1)
  * Footwear (GG0130H1)
  * Eating (M1870, GG0130A1)
  * Bathing (M1830, GG0130E1)
  * Toileting hygiene (M1845, GG0130C1)
  * Toilet transferring (M1840, GG0170F1)
  * Transferring (M1850, GG0170E1)
- Mobility functional status:
  * Ambulation level (M1860)
  * Roll left/right (GG0170A1), sit to lying (GG0170B1), lying to sitting (GG0170C1)
  * Sit to stand (GG0170D1), bed to chair (GG0170E1), car transfer (GG0170G1)
  * Walk 10ft (GG0170I1), walk 50ft (GG0170J1), walk 150ft (GG0170K1)
  * Uneven surfaces (GG0170L1), 1 step (GG0170M1), 4 steps (GG0170N1), 12 steps (GG0170O1)
  * Picking up object (GG0170P1), wheelchair use (GG0170Q1)
- Gait deviations observed
- Fall risk: MAHC-10 score with individual risk factors identified
- Prior device use (GG0110)
- Medication management ability (M2020, M2030)
- Drug regimen review findings (M2001)
- High risk medications (N0415)
- Home safety hazards identified
- Environmental assessment findings

ASSESSMENT section should include:
- Primary diagnosis with ICD-10 code
- Secondary diagnoses listed
- Clinical impression paragraph synthesizing key findings across systems
- Homebound status justification combining Criteria 1 and Criteria 2
- Prioritized problem list (number each problem)
- Risk summary: fall risk level, hospitalization risk factors (M1033), pressure injury risk (Norton score), nutritional risk level
- Functional limitation summary comparing current status to prior level (use GG0100 prior functioning data vs current GG scores)
- Cognitive status summary with BIMS interpretation
- Caregiver assessment and support adequacy (M2102F)

PLAN section should include:
- Skilled disciplines and frequency/duration ordered
- Goals organized by short-term and long-term
- Interventions provided this visit with patient/caregiver response
- Patient/caregiver education provided and topics covered
- High risk drug education status (M2010) and plan if not yet provided
- Medication reconciliation status and plan
- Safety plan addressing identified fall risk factors
- DME and supply needs
- Referrals needed (other disciplines, community resources)
- Coordination of care plan with physician and other providers
- Next visit plan and schedule
- Discharge criteria and anticipated timeline
- Any outstanding items that need follow-up (goals not met with exception codes)

Format each section as flowing clinical paragraphs, not bullet points. Use paragraph breaks between distinct topics within each section. Write as if documenting in the official medical record.`;

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Organize assessment responses by item code for easy lookup
 */
function organizeResponses(responses: OasisResponse[]): Record<string, OasisResponse> {
  const organized: Record<string, OasisResponse> = {};
  for (const response of responses) {
    organized[response.itemCode] = response;
  }
  return organized;
}

/**
 * Group responses by section
 */
function groupResponsesBySection(responses: OasisResponse[]): Record<string, OasisResponse[]> {
  const grouped: Record<string, OasisResponse[]> = {};
  for (const response of responses) {
    const section = response.section || 'unknown';
    if (!grouped[section]) {
      grouped[section] = [];
    }
    grouped[section].push(response);
  }
  return grouped;
}

/**
 * Format patient data for the prompt
 */
function formatPatientData(patient: PatientData): string {
  const age = calculateAge(patient.dateOfBirth);
  return `
PATIENT DEMOGRAPHICS:
- Name: ${patient.firstName} ${patient.lastName}
- MRN: ${patient.mrn}
- Date of Birth: ${patient.dateOfBirth}
- Age: ${age} years
- Gender: ${patient.gender}
- Location: ${patient.addressCity || 'Unknown'}, ${patient.addressState || 'Unknown'}
- Primary Physician: ${patient.primaryPhysicianName || 'Not specified'} ${patient.primaryPhysicianNpi ? `(NPI: ${patient.primaryPhysicianNpi})` : ''}
`;
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Format assessment responses for the prompt
 */
function formatAssessmentData(
  responses: OasisResponse[],
  assessmentType: string,
  startOfCareDate?: string
): string {
  const organized = organizeResponses(responses);
  const grouped = groupResponsesBySection(responses);

  let output = `
ASSESSMENT INFORMATION:
- Assessment Type: ${assessmentType}
- Start of Care Date: ${startOfCareDate || 'Not specified'}
- Total Items Completed: ${responses.length}

`;

  // Format each section
  const sectionOrder = [
    'administrative',
    'patient_history',
    'hearing_speech_vision',
    'cognitive',
    'mood',
    'behavior',
    'functional_abilities',
    'functional_status',
    'elimination_status',
    'health_conditions',
    'swallowing_nutritional',
    'integumentary_status',
    'skin_conditions',
    'medications',
    'special_treatments',
    'care_management',
  ];

  for (const section of sectionOrder) {
    const sectionResponses = grouped[section];
    if (sectionResponses && sectionResponses.length > 0) {
      output += `\n--- ${section.toUpperCase().replace(/_/g, ' ')} ---\n`;
      for (const response of sectionResponses) {
        const value = response.responseValue || response.responseCode || response.responseText || 'Not answered';
        output += `${response.itemCode}: ${value}\n`;
      }
    }
  }

  // Add diagnosis information if present
  const primaryDx = organized['M1021'];
  const secondaryDx = organized['M1023'];
  if (primaryDx || secondaryDx) {
    output += '\n--- DIAGNOSES ---\n';
    if (primaryDx) {
      output += `Primary Diagnosis (M1021): ${primaryDx.responseValue || primaryDx.responseCode || 'Not specified'}\n`;
    }
    if (secondaryDx) {
      // M1023 may contain multiple diagnoses in JSON format
      const dxValue = secondaryDx.responseJson || secondaryDx.responseValue || secondaryDx.responseCode;
      output += `Secondary Diagnoses (M1023): ${JSON.stringify(dxValue) || 'Not specified'}\n`;
    }
  }

  return output;
}

/**
 * Format referral document data
 */
function formatReferralData(referrals: ReferralDocument[]): string {
  if (!referrals || referrals.length === 0) {
    return '';
  }

  let output = '\n--- REFERRAL DOCUMENT DATA ---\n';
  for (const referral of referrals) {
    if (referral.extractedData) {
      const extracted = referral.extractedData as Record<string, unknown>;
      output += `\nFrom ${referral.documentType} (${referral.originalFileName}):\n`;

      // Include relevant extracted data
      if (extracted['diagnoses']) {
        output += `Diagnoses: ${JSON.stringify(extracted['diagnoses'])}\n`;
      }
      if (extracted['medications']) {
        output += `Medications: ${JSON.stringify(extracted['medications'])}\n`;
      }
      if (extracted['orders']) {
        output += `Orders: ${JSON.stringify(extracted['orders'])}\n`;
      }
    }
  }
  return output;
}

/**
 * Parse JSON response from Claude, handling markdown code blocks
 */
function parseJsonResponse(text: string): SoapNoteContent {
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

  const parsed = JSON.parse(jsonText);

  return {
    subjective: parsed.subjective || '',
    objective: parsed.objective || '',
    assessment: parsed.assessment || '',
    plan: parsed.plan || '',
  };
}

// ===========================================
// MAIN GENERATION FUNCTIONS
// ===========================================

/**
 * Fetch full assessment data with patient and responses
 */
async function fetchAssessmentData(assessmentId: string): Promise<AssessmentData> {
  const assessment = await prisma.oasisAssessment.findUnique({
    where: { id: assessmentId },
    include: {
      patient: {
        select: {
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          gender: true,
          mrn: true,
          addressCity: true,
          addressState: true,
          primaryPhysicianName: true,
          primaryPhysicianNpi: true,
        },
      },
      responses: {
        orderBy: { itemCode: 'asc' },
      },
      referralDocuments: {
        where: {
          extractionStatus: 'COMPLETED',
          deletedAt: null,
        },
      },
    },
  });

  if (!assessment) {
    throw new Error(`Assessment not found: ${assessmentId}`);
  }

  return {
    id: assessment.id,
    assessmentType: assessment.assessmentType,
    status: assessment.status,
    startOfCareDate: assessment.m0030_startOfCareDate?.toISOString().split('T')[0],
    completionDate: assessment.m0090_completionDate?.toISOString().split('T')[0],
    patient: {
      firstName: assessment.patient.firstName,
      lastName: assessment.patient.lastName,
      dateOfBirth: assessment.patient.dateOfBirth.toISOString().split('T')[0],
      gender: assessment.patient.gender,
      mrn: assessment.patient.mrn,
      addressCity: assessment.patient.addressCity || undefined,
      addressState: assessment.patient.addressState || undefined,
      primaryPhysicianName: assessment.patient.primaryPhysicianName || undefined,
      primaryPhysicianNpi: assessment.patient.primaryPhysicianNpi || undefined,
    },
    responses: assessment.responses,
    referralDocuments: assessment.referralDocuments,
  };
}

/**
 * Generate a complete SOAP note from assessment data
 */
export async function generateSoapNote(
  input: GenerationInput
): Promise<GenerationResult> {
  const startTime = Date.now();
  const modelUsed = MODELS.GENERATION;

  try {
    // Fetch assessment data
    const assessmentData = await fetchAssessmentData(input.assessmentId);

    // Build the user prompt with all data
    let userPrompt = formatPatientData(assessmentData.patient);
    userPrompt += formatAssessmentData(
      assessmentData.responses,
      assessmentData.assessmentType,
      assessmentData.startOfCareDate
    );

    // Add referral data if available
    if (assessmentData.referralDocuments && assessmentData.referralDocuments.length > 0) {
      userPrompt += formatReferralData(assessmentData.referralDocuments);
    }

    // Add additional context if provided
    if (input.additionalContext) {
      userPrompt += `\n--- ADDITIONAL CONTEXT ---\n${input.additionalContext}\n`;
    }

    // Add previous notes context if provided (for consistency)
    if (input.previousNotes && input.previousNotes.length > 0) {
      userPrompt += '\n--- PREVIOUS SOAP NOTES FOR REFERENCE (maintain consistency) ---\n';
      for (let i = 0; i < Math.min(input.previousNotes.length, 2); i++) {
        const prevNote = input.previousNotes[i];
        userPrompt += `Previous Note ${i + 1} Plan Summary: ${prevNote.plan.substring(0, 500)}...\n`;
      }
    }

    console.log('[SOAP Generation] Sending request to Claude...');

    // Call Claude API
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: modelUsed,
      max_tokens: 8192,
      system: SOAP_GENERATION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Parse response
    const content = response.content[0];
    if (!content || content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const textContent = content as { type: 'text'; text: string };
    const soapContent = parseJsonResponse(textContent.text);

    console.log('[SOAP Generation] Successfully generated SOAP note');

    return {
      success: true,
      content: soapContent,
      aiModelUsed: modelUsed,
      generationTimeMs: Date.now() - startTime,
      confidence: 0.9, // High confidence for direct generation
      suggestions: [],
    };
  } catch (error) {
    console.error('[SOAP Generation Error]', error);
    return {
      success: false,
      content: {
        subjective: '',
        objective: '',
        assessment: '',
        plan: '',
      },
      aiModelUsed: modelUsed,
      generationTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Failed to generate SOAP note',
    };
  }
}

/**
 * Regenerate a specific section of a SOAP note
 */
export async function regenerateSection(
  soapNoteId: string,
  section: 'subjective' | 'objective' | 'assessment' | 'plan',
  instructions?: string
): Promise<RegenerateSectionResult> {
  const startTime = Date.now();
  const modelUsed = MODELS.GENERATION;

  try {
    // Fetch existing SOAP note with assessment data
    const soapNote = await prisma.soapNote.findUnique({
      where: { id: soapNoteId },
      include: {
        assessment: {
          include: {
            patient: true,
            responses: {
              orderBy: { itemCode: 'asc' },
            },
          },
        },
      },
    });

    if (!soapNote) {
      throw new Error(`SOAP note not found: ${soapNoteId}`);
    }

    // Build context for regeneration
    const assessmentData = await fetchAssessmentData(soapNote.assessmentId);

    let userPrompt = formatPatientData(assessmentData.patient);
    userPrompt += formatAssessmentData(
      assessmentData.responses,
      assessmentData.assessmentType,
      assessmentData.startOfCareDate
    );

    // Add current SOAP note sections for context
    userPrompt += `\n--- CURRENT SOAP NOTE ---\n`;
    userPrompt += `SUBJECTIVE:\n${soapNote.subjective || '(not yet written)'}\n\n`;
    userPrompt += `OBJECTIVE:\n${soapNote.objective || '(not yet written)'}\n\n`;
    userPrompt += `ASSESSMENT:\n${soapNote.assessmentContent || '(not yet written)'}\n\n`;
    userPrompt += `PLAN:\n${soapNote.plan || '(not yet written)'}\n\n`;

    // Build section-specific prompt
    const sectionPrompt = `Please regenerate ONLY the ${section.toUpperCase()} section of this SOAP note.
${instructions ? `\nSpecific instructions: ${instructions}` : ''}

Return ONLY the text content for the ${section.toUpperCase()} section, not JSON. Write in flowing clinical paragraphs appropriate for the medical record.`;

    console.log(`[SOAP Regeneration] Regenerating ${section} section...`);

    // Call Claude API
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: modelUsed,
      max_tokens: 4096,
      system: SOAP_GENERATION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt + '\n\n' + sectionPrompt,
        },
      ],
    });

    // Parse response
    const content = response.content[0];
    if (!content || content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const textContent = content as { type: 'text'; text: string };
    const regeneratedContent = textContent.text.trim();

    console.log(`[SOAP Regeneration] Successfully regenerated ${section} section`);

    return {
      success: true,
      section,
      content: regeneratedContent,
      aiModelUsed: modelUsed,
      generationTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[SOAP Regeneration Error]', error);
    return {
      success: false,
      section,
      content: '',
      aiModelUsed: modelUsed,
      generationTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Failed to regenerate section',
    };
  }
}

/**
 * Generate subjective section from patient statements
 */
export async function generateSubjective(
  patientStatements: string[],
  chiefComplaints?: string[]
): Promise<string> {
  const client = getAnthropicClient();

  const prompt = `Generate a SUBJECTIVE section for a SOAP note based on:
Patient statements: ${patientStatements.join('; ')}
${chiefComplaints ? `Chief complaints: ${chiefComplaints.join('; ')}` : ''}

Write in clinical paragraphs, not bullet points.`;

  const response = await client.messages.create({
    model: MODELS.GENERATION,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (!content || content.type !== 'text') {
    throw new Error('Unexpected response type');
  }
  return (content as { type: 'text'; text: string }).text.trim();
}

/**
 * Generate objective section from assessment findings
 */
export async function generateObjective(
  assessmentData: Record<string, unknown>,
  vitals?: Record<string, number | string>
): Promise<string> {
  const client = getAnthropicClient();

  const prompt = `Generate an OBJECTIVE section for a SOAP note based on:
Assessment data: ${JSON.stringify(assessmentData)}
${vitals ? `Vital signs: ${JSON.stringify(vitals)}` : ''}

Include all measurable findings. Write in clinical paragraphs.`;

  const response = await client.messages.create({
    model: MODELS.GENERATION,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (!content || content.type !== 'text') {
    throw new Error('Unexpected response type');
  }
  return (content as { type: 'text'; text: string }).text.trim();
}

/**
 * Generate assessment section from diagnoses and findings
 */
export async function generateAssessment(
  diagnoses: string[],
  clinicalFindings: string[]
): Promise<string> {
  const client = getAnthropicClient();

  const prompt = `Generate an ASSESSMENT section for a SOAP note based on:
Diagnoses: ${diagnoses.join('; ')}
Clinical findings: ${clinicalFindings.join('; ')}

Synthesize findings into a clinical impression. Include problem list.`;

  const response = await client.messages.create({
    model: MODELS.GENERATION,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (!content || content.type !== 'text') {
    throw new Error('Unexpected response type');
  }
  return (content as { type: 'text'; text: string }).text.trim();
}

/**
 * Generate plan section from goals and interventions
 */
export async function generatePlan(
  goals: string[],
  interventions: string[]
): Promise<string> {
  const client = getAnthropicClient();

  const prompt = `Generate a PLAN section for a SOAP note based on:
Goals: ${goals.join('; ')}
Interventions: ${interventions.join('; ')}

Include treatment plan, education, and follow-up. Write in clinical paragraphs.`;

  const response = await client.messages.create({
    model: MODELS.GENERATION,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (!content || content.type !== 'text') {
    throw new Error('Unexpected response type');
  }
  return (content as { type: 'text'; text: string }).text.trim();
}

/**
 * Validate SOAP note completeness
 */
export async function validateSoapNote(
  content: SoapNoteContent
): Promise<ValidationResult> {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check for missing sections
  if (!content.subjective?.trim()) missingFields.push('subjective');
  if (!content.objective?.trim()) missingFields.push('objective');
  if (!content.assessment?.trim()) missingFields.push('assessment');
  if (!content.plan?.trim()) missingFields.push('plan');

  // Check for minimum content length
  if (content.subjective && content.subjective.length < 100) {
    warnings.push('Subjective section may be too brief');
    suggestions.push('Consider adding more detail about patient-reported symptoms and history');
  }
  if (content.objective && content.objective.length < 200) {
    warnings.push('Objective section may be too brief');
    suggestions.push('Ensure all assessment findings are documented');
  }
  if (content.assessment && content.assessment.length < 100) {
    warnings.push('Assessment section may be too brief');
    suggestions.push('Include clinical impression and problem list');
  }
  if (content.plan && content.plan.length < 100) {
    warnings.push('Plan section may be too brief');
    suggestions.push('Include specific interventions, goals, and follow-up plan');
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    warnings,
    suggestions,
  };
}

/**
 * Suggest improvements to SOAP note
 */
export async function suggestImprovements(
  content: SoapNoteContent
): Promise<string[]> {
  const suggestions: string[] = [];

  // Check subjective
  if (content.subjective) {
    if (!content.subjective.toLowerCase().includes('pain')) {
      suggestions.push('Consider documenting pain assessment findings in subjective section');
    }
    if (!content.subjective.toLowerCase().includes('report')) {
      suggestions.push('Include patient-reported symptoms and concerns');
    }
  }

  // Check objective
  if (content.objective) {
    if (!content.objective.toLowerCase().includes('vital')) {
      suggestions.push('Consider including vital signs in objective section');
    }
    if (!content.objective.match(/\d+/)) {
      suggestions.push('Include specific measurements and scores in objective findings');
    }
  }

  // Check assessment
  if (content.assessment) {
    if (!content.assessment.toLowerCase().includes('icd')) {
      suggestions.push('Include ICD-10 diagnosis codes in assessment');
    }
    if (!content.assessment.toLowerCase().includes('problem')) {
      suggestions.push('Add a prioritized problem list to assessment');
    }
  }

  // Check plan
  if (content.plan) {
    if (!content.plan.toLowerCase().includes('goal')) {
      suggestions.push('Include specific goals in the plan');
    }
    if (!content.plan.toLowerCase().includes('education')) {
      suggestions.push('Document patient/caregiver education provided');
    }
  }

  return suggestions;
}

/**
 * Check for compliance with documentation standards
 */
export async function checkCompliance(
  content: SoapNoteContent
): Promise<{
  isCompliant: boolean;
  issues: Array<{ section: string; issue: string; severity: 'error' | 'warning' }>;
}> {
  const issues: Array<{ section: string; issue: string; severity: 'error' | 'warning' }> = [];

  // Check for required elements
  if (!content.subjective) {
    issues.push({
      section: 'subjective',
      issue: 'Subjective section is required',
      severity: 'error',
    });
  }

  if (!content.objective) {
    issues.push({
      section: 'objective',
      issue: 'Objective section is required',
      severity: 'error',
    });
  }

  if (!content.assessment) {
    issues.push({
      section: 'assessment',
      issue: 'Assessment section is required',
      severity: 'error',
    });
  }

  if (!content.plan) {
    issues.push({
      section: 'plan',
      issue: 'Plan section is required',
      severity: 'error',
    });
  }

  // Check for homebound status (required for Medicare)
  if (content.assessment && !content.assessment.toLowerCase().includes('homebound')) {
    issues.push({
      section: 'assessment',
      issue: 'Homebound status justification may be missing',
      severity: 'warning',
    });
  }

  // Check for skilled care justification
  if (content.plan && !content.plan.toLowerCase().includes('skilled')) {
    issues.push({
      section: 'plan',
      issue: 'Skilled care justification may be missing',
      severity: 'warning',
    });
  }

  return {
    isCompliant: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
  };
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  generateSoapNote,
  regenerateSection,
  generateSubjective,
  generateObjective,
  generateAssessment,
  generatePlan,
  validateSoapNote,
  suggestImprovements,
  checkCompliance,
};
