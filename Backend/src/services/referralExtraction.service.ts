/**
 * Referral Document Extraction Service
 *
 * AI-powered extraction from referral documents that:
 * 1. Extracts text from PDF, DOCX, and images
 * 2. Sends to Claude for intelligent clinical data extraction
 * 3. Maps extracted data to OASIS assessment fields
 */

import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { ReferralDocumentType } from '../generated/prisma';

// ===========================================
// LAZY-LOAD HEAVY MODULES
// ===========================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfParse: ((buffer: Buffer) => Promise<{ text: string; numpages: number }>) | null = null;
let mammoth: typeof import('mammoth') | null = null;
let Tesseract: typeof import('tesseract.js') | null = null;

async function getPdfParse() {
  if (!pdfParse) {
    // pdf-parse has inconsistent exports, use require for compatibility
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;
  }
  return pdfParse;
}

async function getMammoth() {
  if (!mammoth) {
    mammoth = await import('mammoth');
  }
  return mammoth;
}

async function getTesseract() {
  if (!Tesseract) {
    Tesseract = await import('tesseract.js');
  }
  return Tesseract;
}

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export interface ExtractedField {
  itemCode: string;
  fieldName: string;
  value: string | number;
  confidence: number;
  sourceText: string;
  pageNumber?: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PatientInfo {
  firstName?: string;
  lastName?: string;
  dob?: string;
  gender?: string;
  ssn_last4?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
  insurance?: {
    primary?: { name?: string; policyNumber?: string };
    secondary?: { name?: string; policyNumber?: string };
  };
}

export interface PhysicianInfo {
  referringPhysician?: { name?: string; npi?: string; phone?: string; fax?: string };
  pcp?: { name?: string; npi?: string; phone?: string; fax?: string };
  faceToFaceDate?: string;
  faceToFaceProvider?: string;
}

export interface DiagnosisInfo {
  primary?: { icd10?: string; description?: string; onsetDate?: string };
  secondary?: Array<{ icd10?: string; description?: string }>;
}

export interface ClinicalFindings {
  hospitalization?: {
    wasHospitalized?: boolean;
    facilityName?: string;
    admitDate?: string;
    dischargeDate?: string;
    reason?: string;
  };
  surgeries?: Array<{ procedure?: string; date?: string }>;
  allergies?: string[];
  precautions?: string[];
  weightBearingStatus?: string;
  activityRestrictions?: string[];
}

export interface MedicationInfo {
  name: string;
  dose?: string;
  frequency?: string;
  route?: string;
  indication?: string;
}

export interface FunctionalStatus {
  adlAssistanceLevel?: string;
  mobilityLevel?: string;
  transferLevel?: string;
  cognitionLevel?: string;
  fallHistory?: string;
  dmeNeeded?: string[];
  assistiveDevices?: string[];
}

export interface OrdersInfo {
  disciplines?: Array<{ type: string; frequency?: string; duration?: string }>;
  certificationPeriod?: { startDate?: string; endDate?: string };
  specificOrders?: string[];
  labOrders?: string[];
}

export interface OasisMapping {
  value: string;
  valueText?: string;
  confidence: number;
  sourceText: string;
}

export interface AIExtractionResult {
  patient?: PatientInfo;
  physician?: PhysicianInfo;
  diagnoses?: DiagnosisInfo;
  clinicalFindings?: ClinicalFindings;
  medications?: MedicationInfo[];
  functionalStatus?: FunctionalStatus;
  orders?: OrdersInfo;
  homeboundReason?: string;
  oasisMappings?: Record<string, OasisMapping>;
}

export interface ExtractionResult {
  success: boolean;
  documentType: ReferralDocumentType;
  rawText: string;
  extractedFields: ExtractedField[];
  extractedData?: AIExtractionResult;
  patientInfo?: PatientInfo;
  diagnosisCodes?: string[];
  medications?: MedicationInfo[];
  processingTimeMs: number;
  error?: string;
}

export interface ExtractionOptions {
  documentType?: ReferralDocumentType;
  extractDiagnoses?: boolean;
  extractMedications?: boolean;
  extractPatientInfo?: boolean;
  mapToOasisCodes?: boolean;
}

// ===========================================
// CLAUDE CLIENT - LAZY LOADING
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
// AI EXTRACTION PROMPT
// ===========================================

const EXTRACTION_SYSTEM_PROMPT = `You are a clinical data extraction specialist for home health care. Extract all relevant clinical information from this referral document and map it to OASIS-E assessment fields. Return ONLY valid JSON with no other text.

Extract and return this JSON structure:
{
  "patient": {
    "firstName": "string",
    "lastName": "string",
    "dob": "YYYY-MM-DD",
    "gender": "M/F",
    "ssn_last4": "1234",
    "address": "string",
    "city": "string",
    "state": "XX",
    "zip": "12345",
    "phone": "123-456-7890",
    "emergencyContact": { "name": "string", "relationship": "string", "phone": "string" },
    "insurance": {
      "primary": { "name": "string", "policyNumber": "string" },
      "secondary": { "name": "string", "policyNumber": "string" }
    }
  },
  "physician": {
    "referringPhysician": { "name": "string", "npi": "string", "phone": "string", "fax": "string" },
    "pcp": { "name": "string", "npi": "string", "phone": "string", "fax": "string" },
    "faceToFaceDate": "YYYY-MM-DD",
    "faceToFaceProvider": "string"
  },
  "diagnoses": {
    "primary": { "icd10": "X00.0", "description": "string", "onsetDate": "YYYY-MM-DD" },
    "secondary": [{ "icd10": "X00.0", "description": "string" }]
  },
  "clinicalFindings": {
    "hospitalization": { "wasHospitalized": true/false, "facilityName": "string", "admitDate": "YYYY-MM-DD", "dischargeDate": "YYYY-MM-DD", "reason": "string" },
    "surgeries": [{ "procedure": "string", "date": "YYYY-MM-DD" }],
    "allergies": ["string"],
    "precautions": ["string"],
    "weightBearingStatus": "string",
    "activityRestrictions": ["string"]
  },
  "medications": [{ "name": "string", "dose": "string", "frequency": "string", "route": "string", "indication": "string" }],
  "functionalStatus": {
    "adlAssistanceLevel": "string",
    "mobilityLevel": "string",
    "transferLevel": "string",
    "cognitionLevel": "string",
    "fallHistory": "string",
    "dmeNeeded": ["string"],
    "assistiveDevices": ["string"]
  },
  "orders": {
    "disciplines": [{ "type": "SN/PT/OT/ST/MSW/HHA", "frequency": "string", "duration": "string" }],
    "certificationPeriod": { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" },
    "specificOrders": ["string"],
    "labOrders": ["string"]
  },
  "homeboundReason": "string",
  "oasisMappings": {
    "ITEM_CODE": { "value": "code", "valueText": "description", "confidence": 0.0-1.0, "sourceText": "exact quote from document" }
  }
}

For the oasisMappings field, map clinical information to these OASIS items when evidence exists:
- M0100 (reason for assessment), M0150 (payment sources)
- A1005 (ethnicity), A1010 (race), A1110A (language), A1110B (interpreter needed)
- M1000 (inpatient discharge), M1028 (active diagnoses)
- M1033 (hospitalization risk factors)
- M1060A (height), M1060B (weight)
- M1400 (dyspnea), M1600 (UTI), M1610 (urinary incontinence)
- M1620 (bowel incontinence), M1630 (ostomy)
- M1700 (cognitive functioning), M1710 (confused), M1720 (anxious)
- M1740 (behavioral symptoms), M1745 (disruptive behavior frequency)
- M1800 (grooming), M1810 (dress upper), M1820 (dress lower)
- M1830 (bathing), M1840 (toilet transferring), M1845 (toileting hygiene)
- M1850 (transferring), M1860 (ambulation), M1870 (feeding)
- M1306 (pressure ulcers), M1322 (stage 1 pressure injuries)
- M1324 (most problematic pressure ulcer stage)
- M1330 (stasis ulcer), M1340 (surgical wound)
- M2001 (drug regimen review), M2010 (high risk drug education)
- M2020 (oral medication management), M2030 (injectable medication management)
- M1100 (living situation), M2102F (caregiver assistance)
- GG0130 items (self-care: A1 eating, B1 oral hygiene, C1 toileting hygiene, E1 shower/bathe, F1 upper dressing, G1 lower dressing, H1 footwear)
- GG0170 items (mobility: A1 roll, B1 sit to lying, C1 lying to sitting, D1 sit to stand, E1 bed to chair, F1 toilet transfer, G1 car transfer, I1 walk 10ft, J1 walk 50ft, K1 walk 150ft, L1 uneven surfaces, M1 1 step, N1 4 steps, O1 12 steps, P1 picking up object, Q1 wheelchair)
- GG0100 items (prior functioning: A self-care, B indoor mobility, C stairs, D functional cognition)
- GG0110 (prior device use)
- N0415 (high risk drug classes)

Use these mappings for assistance levels:
- Independent/I/Indep = 06 on GG scale, 0 on M items
- Setup/Setup assist/S = 05 on GG scale
- Supervision/SBA/Stand-by assist/Contact guard/CGA = 04 on GG scale, 1 on M items
- Minimal assist/Min A = 04 on GG scale
- Partial assist/Moderate assist/Mod A = 03 on GG scale, 2 on M items
- Substantial assist/Maximal assist/Max A = 02 on GG scale, 2-3 on M items
- Dependent/Total assist/Total A = 01 on GG scale, 3-4 on M items

For each oasisMapping, include:
- confidence: High (>0.9) = explicit statement. Medium (0.7-0.9) = reasonable inference. Low (<0.7) = weak inference.
- sourceText: The exact snippet from the document supporting this mapping.

If information is not present, omit that field entirely. Do not guess or fabricate data.`;

// ===========================================
// TEXT EXTRACTION FUNCTIONS
// ===========================================

/**
 * Extract text from any supported document format
 */
export async function extractTextFromDocument(
  filePath: string,
  fileType: string
): Promise<{ text: string; pageCount?: number }> {
  const normalizedType = fileType.toLowerCase();

  try {
    // Digital PDF
    if (normalizedType === 'pdf') {
      return await extractTextFromPdf(filePath);
    }

    // DOCX
    if (normalizedType === 'docx' || normalizedType === 'doc') {
      return await extractTextFromDocx(filePath);
    }

    // Images - use OCR
    if (['jpg', 'jpeg', 'png', 'tiff', 'tif'].includes(normalizedType)) {
      return await extractTextWithOcr(filePath);
    }

    throw new Error(`Unsupported file type: ${fileType}`);
  } catch (error) {
    console.error(`[Text Extraction Error] ${fileType}:`, error);
    throw error;
  }
}

/**
 * Extract text from PDF using pdf-parse
 * Falls back to OCR if no text content (scanned PDF)
 */
async function extractTextFromPdf(
  filePath: string
): Promise<{ text: string; pageCount?: number }> {
  const pdf = await getPdfParse();
  const buffer = await fs.promises.readFile(filePath);

  try {
    const data = await pdf(buffer);

    // Check if PDF has extractable text
    const text = data.text?.trim() || '';

    // If no text or very little text, likely a scanned PDF - use OCR
    if (text.length < 100) {
      console.log('[PDF] Low text content detected, attempting OCR...');
      return await extractTextWithOcr(filePath);
    }

    return {
      text: cleanExtractedText(text),
      pageCount: data.numpages,
    };
  } catch (pdfError) {
    console.log('[PDF] Parse failed, attempting OCR...', pdfError);
    return await extractTextWithOcr(filePath);
  }
}

/**
 * Extract text from DOCX using mammoth
 */
async function extractTextFromDocx(
  filePath: string
): Promise<{ text: string }> {
  const mammothLib = await getMammoth();
  const buffer = await fs.promises.readFile(filePath);

  const result = await mammothLib.extractRawText({ buffer });
  return {
    text: cleanExtractedText(result.value),
  };
}

/**
 * Extract text from images using Tesseract OCR
 */
async function extractTextWithOcr(
  filePath: string
): Promise<{ text: string }> {
  const tesseract = await getTesseract();

  console.log('[OCR] Starting text recognition...');

  const worker = await tesseract.createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  try {
    const { data } = await worker.recognize(filePath);
    await worker.terminate();

    return {
      text: cleanExtractedText(data.text),
    };
  } catch (error) {
    await worker.terminate();
    throw error;
  }
}

/**
 * Clean and normalize extracted text
 */
function cleanExtractedText(text: string): string {
  return text
    // Normalize whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Remove excessive spaces
    .replace(/ {2,}/g, ' ')
    // Trim each line
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

// ===========================================
// AI EXTRACTION FUNCTIONS
// ===========================================

/**
 * Process referral text with Claude AI for extraction
 */
export async function processReferralWithAI(
  rawText: string,
  documentType: ReferralDocumentType
): Promise<AIExtractionResult> {
  const client = getAnthropicClient();

  const userPrompt = `Document Type: ${documentType}

Please extract all clinical information from the following referral document and return it as JSON:

---
${rawText}
---

Remember to:
1. Extract all patient demographics, physician info, diagnoses, medications, and functional status
2. Map clinical findings to specific OASIS item codes with confidence scores
3. Include the exact source text for each mapping
4. Only include fields where you found evidence in the document`;

  try {
    console.log('[AI Extraction] Calling Claude...');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Extract text content from response
    const content = response.content[0];
    if (!content || content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse JSON, handling markdown code blocks
    const textContent = content as { type: 'text'; text: string };
    let jsonText = textContent.text.trim();
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

    const parsed = JSON.parse(jsonText) as AIExtractionResult;
    console.log('[AI Extraction] Successfully parsed response');

    return parsed;
  } catch (error) {
    console.error('[AI Extraction Error]', error);
    throw new Error(
      `AI extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ===========================================
// VALIDATION FUNCTIONS
// ===========================================

/**
 * Validate extracted ICD-10 codes format
 */
function validateIcd10Code(code: string): boolean {
  // ICD-10 format: Letter followed by 2 digits, optionally a decimal and more digits
  const icd10Regex = /^[A-Z]\d{2}(\.\d{1,4})?$/i;
  return icd10Regex.test(code);
}

/**
 * Validate OASIS GG item values (01-06, 07, 09, 10, 88)
 */
function validateGGValue(value: string): boolean {
  const validValues = ['01', '02', '03', '04', '05', '06', '07', '09', '10', '88'];
  return validValues.includes(value);
}

/**
 * Validate OASIS M item values (typically 0-4 or specific codes)
 */
function validateMValue(itemCode: string, value: string): boolean {
  // Basic range validation - most M items use 0-4 scale
  if (/^[0-4]$/.test(value)) return true;

  // Some items have special values
  const specialValues: Record<string, string[]> = {
    'M1100': ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', 'UK'],
    'M0150': ['01', '02', '03', '04', '05', 'UK'],
  };

  if (specialValues[itemCode]) {
    return specialValues[itemCode].includes(value);
  }

  return true; // Allow if no specific validation
}

/**
 * Validate all extracted OASIS mappings
 */
export function validateOasisMappings(
  mappings: Record<string, OasisMapping>
): { valid: Record<string, OasisMapping>; invalid: string[] } {
  const valid: Record<string, OasisMapping> = {};
  const invalid: string[] = [];

  for (const [itemCode, mapping] of Object.entries(mappings)) {
    let isValid = true;

    // Validate GG items
    if (itemCode.startsWith('GG0130') || itemCode.startsWith('GG0170') || itemCode.startsWith('GG0100')) {
      isValid = validateGGValue(mapping.value);
    }
    // Validate M items
    else if (itemCode.startsWith('M')) {
      isValid = validateMValue(itemCode, mapping.value);
    }

    if (isValid) {
      valid[itemCode] = mapping;
    } else {
      invalid.push(`${itemCode}: invalid value "${mapping.value}"`);
    }
  }

  return { valid, invalid };
}

// ===========================================
// MAIN EXTRACTION FUNCTION
// ===========================================

/**
 * Extract data from a referral document
 */
export async function extractFromDocument(
  filePath: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const startTime = Date.now();
  const fileType = path.extname(filePath).replace('.', '').toLowerCase();

  try {
    // Step 1: Extract raw text
    console.log(`[Referral Extraction] Extracting text from ${fileType}...`);
    const { text: rawText, pageCount } = await extractTextFromDocument(filePath, fileType);

    if (!rawText || rawText.length < 50) {
      return {
        success: false,
        documentType: options.documentType || ReferralDocumentType.OTHER,
        rawText: rawText || '',
        extractedFields: [],
        processingTimeMs: Date.now() - startTime,
        error: 'Insufficient text content extracted from document',
      };
    }

    console.log(`[Referral Extraction] Extracted ${rawText.length} characters, ${pageCount || 'unknown'} pages`);

    // Step 2: Process with AI
    console.log('[Referral Extraction] Processing with AI...');
    const aiResult = await processReferralWithAI(
      rawText,
      options.documentType || ReferralDocumentType.REFERRAL
    );

    // Step 3: Validate OASIS mappings
    let validMappings: Record<string, OasisMapping> = {};
    let invalidMappings: string[] = [];

    if (aiResult.oasisMappings) {
      const validation = validateOasisMappings(aiResult.oasisMappings);
      validMappings = validation.valid;
      invalidMappings = validation.invalid;

      if (invalidMappings.length > 0) {
        console.warn('[Referral Extraction] Invalid mappings:', invalidMappings);
      }
    }

    // Step 4: Convert to ExtractedField format for compatibility
    const extractedFields: ExtractedField[] = Object.entries(validMappings).map(
      ([itemCode, mapping]) => ({
        itemCode,
        fieldName: itemCode,
        value: mapping.value,
        confidence: mapping.confidence,
        sourceText: mapping.sourceText,
      })
    );

    // Step 5: Validate diagnosis codes
    const diagnosisCodes: string[] = [];
    if (aiResult.diagnoses?.primary?.icd10) {
      if (validateIcd10Code(aiResult.diagnoses.primary.icd10)) {
        diagnosisCodes.push(aiResult.diagnoses.primary.icd10);
      }
    }
    if (aiResult.diagnoses?.secondary) {
      for (const dx of aiResult.diagnoses.secondary) {
        if (dx.icd10 && validateIcd10Code(dx.icd10)) {
          diagnosisCodes.push(dx.icd10);
        }
      }
    }

    console.log(`[Referral Extraction] Complete - ${extractedFields.length} fields extracted`);

    return {
      success: true,
      documentType: options.documentType || ReferralDocumentType.REFERRAL,
      rawText,
      extractedFields,
      extractedData: {
        ...aiResult,
        oasisMappings: validMappings,
      },
      patientInfo: aiResult.patient,
      diagnosisCodes,
      medications: aiResult.medications,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[Referral Extraction Error]', error);
    return {
      success: false,
      documentType: options.documentType || ReferralDocumentType.OTHER,
      rawText: '',
      extractedFields: [],
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Map extracted fields to OASIS codes
 */
export async function mapToOasisCodes(
  extractedFields: ExtractedField[]
): Promise<ExtractedField[]> {
  // Fields are already mapped by AI extraction
  return extractedFields;
}

/**
 * Validate extracted data against known patterns
 */
export async function validateExtraction(
  result: ExtractionResult
): Promise<{
  isValid: boolean;
  warnings: string[];
  errors: string[];
}> {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!result.success) {
    errors.push(result.error || 'Extraction failed');
  }

  if (result.rawText.length < 100) {
    warnings.push('Document has very little extractable text');
  }

  if (result.extractedFields.length === 0) {
    warnings.push('No OASIS fields could be mapped from document');
  }

  // Check for low confidence extractions
  const lowConfidenceFields = result.extractedFields.filter((f) => f.confidence < 0.7);
  if (lowConfidenceFields.length > 0) {
    warnings.push(`${lowConfidenceFields.length} fields have low confidence (<0.7)`);
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Extract diagnoses from document text
 */
export async function extractDiagnoses(rawText: string): Promise<string[]> {
  // Simple ICD-10 code pattern matching as fallback
  const icd10Pattern = /[A-Z]\d{2}(?:\.\d{1,4})?/gi;
  const matches = rawText.match(icd10Pattern) || [];

  // Filter and dedupe
  const uniqueCodes = [...new Set(matches.filter(validateIcd10Code))];
  return uniqueCodes;
}

/**
 * Extract medication list from document
 */
export async function extractMedications(
  rawText: string
): Promise<MedicationInfo[]> {
  // Basic medication pattern matching as fallback
  // This will be supplemented by AI extraction
  const medications: MedicationInfo[] = [];

  // Common medication patterns
  const medPatterns = [
    // "Medication 500mg twice daily"
    /([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|units?))\s+(?:(once|twice|three times|four times|daily|bid|tid|qid|prn|qhs|qam|qpm|q\d+h?))?/gi,
  ];

  for (const pattern of medPatterns) {
    let match;
    while ((match = pattern.exec(rawText)) !== null) {
      const name = match[1];
      if (name) {
        medications.push({
          name: name.trim(),
          dose: match[2]?.trim(),
          frequency: match[3]?.trim(),
        });
      }
    }
  }

  return medications;
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  extractFromDocument,
  extractTextFromDocument,
  processReferralWithAI,
  mapToOasisCodes,
  validateExtraction,
  validateOasisMappings,
  extractDiagnoses,
  extractMedications,
};
