/**
 * HIPPS (Health Insurance Prospective Payment System) Constants
 *
 * Contains ICD-10 to clinical grouping mappings, comorbidity interaction pairs,
 * and reimbursement rate lookup tables for PDGM (Patient-Driven Groupings Model).
 *
 * Note: This is a simplified implementation for demo/MVP purposes.
 * Real HIPPS grouper is proprietary CMS software.
 * ICD-10 mappings are representative, not exhaustive.
 * Reimbursement rates are approximate FY2024 values.
 */

// =============================================================================
// CLINICAL GROUPING MAPPINGS
// =============================================================================

/**
 * ICD-10 pattern to clinical grouping mappings
 * Based on PDGM clinical groups
 */
export interface ClinicalGroupMapping {
  icd10Pattern: string;
  clinicalGroup: string;
  category: string;
  description: string;
}

export const CLINICAL_GROUPING_MAPPINGS: ClinicalGroupMapping[] = [
  // Neuro/Stroke Group (1)
  { icd10Pattern: '^I6[0-9]', clinicalGroup: '1', category: 'Neuro/Stroke', description: 'Cerebrovascular diseases' },
  { icd10Pattern: '^G20', clinicalGroup: '1', category: 'Neuro/Stroke', description: 'Parkinson disease' },
  { icd10Pattern: '^G35', clinicalGroup: '1', category: 'Neuro/Stroke', description: 'Multiple sclerosis' },
  { icd10Pattern: '^G30', clinicalGroup: '1', category: 'Neuro/Stroke', description: 'Alzheimer disease' },
  { icd10Pattern: '^G40|^G41', clinicalGroup: '1', category: 'Neuro/Stroke', description: 'Epilepsy' },
  { icd10Pattern: '^G80|^G81|^G82|^G83', clinicalGroup: '1', category: 'Neuro/Stroke', description: 'Paralytic syndromes' },

  // Wounds Group (2)
  { icd10Pattern: '^L89', clinicalGroup: '2', category: 'Wounds', description: 'Pressure ulcer' },
  { icd10Pattern: '^L97', clinicalGroup: '2', category: 'Wounds', description: 'Non-pressure chronic ulcer of lower limb' },
  { icd10Pattern: '^L98\\.4', clinicalGroup: '2', category: 'Wounds', description: 'Non-pressure chronic ulcer of skin' },
  { icd10Pattern: '^E08\\.62|^E09\\.62|^E10\\.62|^E11\\.62|^E13\\.62', clinicalGroup: '2', category: 'Wounds', description: 'Diabetic skin ulcer' },
  { icd10Pattern: '^T81\\.3|^T81\\.4', clinicalGroup: '2', category: 'Wounds', description: 'Surgical wound complications' },

  // Complex Medical Group (3)
  { icd10Pattern: '^I50', clinicalGroup: '3', category: 'Complex Medical', description: 'Heart failure' },
  { icd10Pattern: '^J44', clinicalGroup: '3', category: 'Complex Medical', description: 'COPD' },
  { icd10Pattern: '^J96', clinicalGroup: '3', category: 'Complex Medical', description: 'Respiratory failure' },
  { icd10Pattern: '^N18\\.5|^N18\\.6', clinicalGroup: '3', category: 'Complex Medical', description: 'Chronic kidney disease stages 4-5' },
  { icd10Pattern: '^E08|^E09|^E10|^E11|^E13', clinicalGroup: '3', category: 'Complex Medical', description: 'Diabetes mellitus' },

  // Behavioral Health Group (4)
  { icd10Pattern: '^F20|^F21|^F22|^F23|^F24|^F25', clinicalGroup: '4', category: 'Behavioral Health', description: 'Schizophrenia spectrum disorders' },
  { icd10Pattern: '^F30|^F31|^F32|^F33|^F34', clinicalGroup: '4', category: 'Behavioral Health', description: 'Mood disorders' },
  { icd10Pattern: '^F40|^F41|^F42|^F43', clinicalGroup: '4', category: 'Behavioral Health', description: 'Anxiety and stress-related disorders' },

  // Musculoskeletal/Rehab Group (5)
  { icd10Pattern: '^M[0-8][0-9]', clinicalGroup: '5', category: 'MS/Rehab', description: 'Musculoskeletal disorders' },
  { icd10Pattern: '^S[0-9][0-9]', clinicalGroup: '5', category: 'MS/Rehab', description: 'Injuries' },
  { icd10Pattern: '^T84', clinicalGroup: '5', category: 'MS/Rehab', description: 'Joint prosthesis complications' },
  { icd10Pattern: '^Z96\\.6', clinicalGroup: '5', category: 'MS/Rehab', description: 'Joint replacement status' },

  // Medication Management/Teaching/Assessment (MMTA) - Other (6)
  { icd10Pattern: '^I10|^I11|^I12|^I13|^I15', clinicalGroup: '6', category: 'MMTA-Other', description: 'Hypertensive diseases' },
  { icd10Pattern: '^I25', clinicalGroup: '6', category: 'MMTA-Other', description: 'Chronic ischemic heart disease' },
  { icd10Pattern: '^I48', clinicalGroup: '6', category: 'MMTA-Other', description: 'Atrial fibrillation and flutter' },
  { icd10Pattern: '^Z87|^Z89|^Z90|^Z91|^Z92|^Z93|^Z94|^Z95|^Z96', clinicalGroup: '6', category: 'MMTA-Other', description: 'Personal history and status codes' },
];

/**
 * Clinical group letter codes for HIPPS Position 1
 * Maps numeric group to letter code
 */
export const CLINICAL_GROUP_CODES: Record<string, string> = {
  '1': 'A', // Neuro/Stroke - Early
  '2': 'B', // Neuro/Stroke - Late
  '3': 'C', // Wounds - Early
  '4': 'D', // Wounds - Late
  '5': 'E', // Complex Medical - Early
  '6': 'F', // Complex Medical - Late
  '7': 'G', // Behavioral Health - Early
  '8': 'H', // Behavioral Health - Late
  '9': 'I', // MS/Rehab - Early
  '10': 'J', // MS/Rehab - Late
  '11': 'K', // MMTA - Early
  '12': 'L', // MMTA - Late
};

export const CLINICAL_GROUP_DESCRIPTIONS: Record<string, string> = {
  'A': 'Neuro/Stroke (Early)',
  'B': 'Neuro/Stroke (Late)',
  'C': 'Wounds (Early)',
  'D': 'Wounds (Late)',
  'E': 'Complex Medical (Early)',
  'F': 'Complex Medical (Late)',
  'G': 'Behavioral Health (Early)',
  'H': 'Behavioral Health (Late)',
  'I': 'MS/Rehab (Early)',
  'J': 'MS/Rehab (Late)',
  'K': 'MMTA - Other (Early)',
  'L': 'MMTA - Other (Late)',
};

// =============================================================================
// FUNCTIONAL LEVEL MAPPINGS
// =============================================================================

export interface FunctionalLevelMapping {
  code: string;
  label: string;
  description: string;
  minScore: number;
  maxScore: number;
}

export const FUNCTIONAL_LEVELS: FunctionalLevelMapping[] = [
  { code: 'L', label: 'Low', description: 'Low functional impairment', minScore: 0, maxScore: 19 },
  { code: 'M', label: 'Medium', description: 'Medium functional impairment', minScore: 20, maxScore: 39 },
  { code: 'H', label: 'High', description: 'High functional impairment', minScore: 40, maxScore: 100 },
];

export const FUNCTIONAL_LEVEL_DESCRIPTIONS: Record<string, string> = {
  'L': 'Low Impairment',
  'M': 'Medium Impairment',
  'H': 'High Impairment',
};

// =============================================================================
// COMORBIDITY ADJUSTMENT MAPPINGS
// =============================================================================

/**
 * Comorbidity interaction pairs that trigger adjustments
 * Each pair represents a combination that increases case complexity
 */
export interface ComorbidityPair {
  primary: string[];
  secondary: string[];
  adjustment: 'L' | 'H';
  description: string;
}

export const COMORBIDITY_PAIRS: ComorbidityPair[] = [
  // High comorbidity interactions
  {
    primary: ['^I50'], // Heart failure
    secondary: ['^N18\\.4|^N18\\.5|^N18\\.6', '^J44'], // CKD 4-6 or COPD
    adjustment: 'H',
    description: 'Heart failure with CKD or COPD',
  },
  {
    primary: ['^E10|^E11'], // Diabetes Type 1 or 2
    secondary: ['^N18', '^E78', '^I25'], // CKD, hyperlipidemia, CAD
    adjustment: 'H',
    description: 'Diabetes with renal disease or cardiac comorbidities',
  },
  {
    primary: ['^L89\\.2|^L89\\.3|^L89\\.4'], // Stage 2-4 pressure ulcers
    secondary: ['^E10|^E11', '^I73'], // Diabetes or PAD
    adjustment: 'H',
    description: 'Advanced pressure ulcer with diabetes or PAD',
  },
  {
    primary: ['^J44'], // COPD
    secondary: ['^I50', '^F17'], // Heart failure or tobacco dependence
    adjustment: 'H',
    description: 'COPD with heart failure or active tobacco use',
  },

  // Low comorbidity interactions
  {
    primary: ['^I10'], // Hypertension
    secondary: ['^E78', '^E11'], // Hyperlipidemia, Type 2 diabetes
    adjustment: 'L',
    description: 'Hypertension with metabolic comorbidities',
  },
  {
    primary: ['^M17|^M16'], // Knee or hip osteoarthritis
    secondary: ['^E66', '^G89'], // Obesity, chronic pain
    adjustment: 'L',
    description: 'Osteoarthritis with obesity or chronic pain',
  },
  {
    primary: ['^I25'], // Chronic ischemic heart disease
    secondary: ['^I10', '^E78'], // Hypertension, hyperlipidemia
    adjustment: 'L',
    description: 'Cardiac disease with hypertension or hyperlipidemia',
  },
];

export const COMORBIDITY_DESCRIPTIONS: Record<string, string> = {
  'N': 'No Comorbidity Adjustment',
  'L': 'Low Comorbidity Adjustment',
  'H': 'High Comorbidity Adjustment',
};

// =============================================================================
// SERVICE UTILIZATION MAPPINGS
// =============================================================================

export interface ServiceUtilizationLevel {
  code: string;
  label: string;
  description: string;
  minTherapyVisits: number;
  maxTherapyVisits: number;
}

export const SERVICE_UTILIZATION_LEVELS: ServiceUtilizationLevel[] = [
  { code: 'A', label: 'Minimal', description: '0-5 therapy visits', minTherapyVisits: 0, maxTherapyVisits: 5 },
  { code: 'B', label: 'Low', description: '6-9 therapy visits', minTherapyVisits: 6, maxTherapyVisits: 9 },
  { code: 'C', label: 'Moderate', description: '10-13 therapy visits', minTherapyVisits: 10, maxTherapyVisits: 13 },
  { code: 'D', label: 'High', description: '14-19 therapy visits', minTherapyVisits: 14, maxTherapyVisits: 19 },
  { code: 'E', label: 'Very High', description: '20+ therapy visits', minTherapyVisits: 20, maxTherapyVisits: 999 },
];

// =============================================================================
// ADMISSION SOURCE MAPPINGS
// =============================================================================

export interface AdmissionSource {
  code: string;
  label: string;
  isInstitutional: boolean;
}

export const ADMISSION_SOURCES: AdmissionSource[] = [
  { code: '01', label: 'Community (not from institution)', isInstitutional: false },
  { code: '02', label: 'Acute care hospital', isInstitutional: true },
  { code: '03', label: 'Skilled nursing facility', isInstitutional: true },
  { code: '04', label: 'Inpatient rehabilitation facility', isInstitutional: true },
  { code: '05', label: 'Long-term care hospital', isInstitutional: true },
  { code: '06', label: 'Psychiatric hospital', isInstitutional: true },
  { code: '07', label: 'Other', isInstitutional: false },
];

// =============================================================================
// CASE MIX WEIGHTS
// =============================================================================

/**
 * Case mix weights by clinical group, functional level, and comorbidity
 * These are approximate FY2024 values for demonstration
 */
export interface CaseMixWeight {
  clinicalGroup: string;
  functionalLevel: string;
  comorbidityAdjustment: string;
  admissionSource: 'institutional' | 'community';
  weight: number;
}

export const CASE_MIX_WEIGHTS: CaseMixWeight[] = [
  // Neuro/Stroke Early - Institutional
  { clinicalGroup: 'A', functionalLevel: 'L', comorbidityAdjustment: 'N', admissionSource: 'institutional', weight: 1.0234 },
  { clinicalGroup: 'A', functionalLevel: 'L', comorbidityAdjustment: 'L', admissionSource: 'institutional', weight: 1.1258 },
  { clinicalGroup: 'A', functionalLevel: 'L', comorbidityAdjustment: 'H', admissionSource: 'institutional', weight: 1.2537 },
  { clinicalGroup: 'A', functionalLevel: 'M', comorbidityAdjustment: 'N', admissionSource: 'institutional', weight: 1.2341 },
  { clinicalGroup: 'A', functionalLevel: 'M', comorbidityAdjustment: 'L', admissionSource: 'institutional', weight: 1.3576 },
  { clinicalGroup: 'A', functionalLevel: 'M', comorbidityAdjustment: 'H', admissionSource: 'institutional', weight: 1.5112 },
  { clinicalGroup: 'A', functionalLevel: 'H', comorbidityAdjustment: 'N', admissionSource: 'institutional', weight: 1.5234 },
  { clinicalGroup: 'A', functionalLevel: 'H', comorbidityAdjustment: 'L', admissionSource: 'institutional', weight: 1.6758 },
  { clinicalGroup: 'A', functionalLevel: 'H', comorbidityAdjustment: 'H', admissionSource: 'institutional', weight: 1.8654 },

  // Neuro/Stroke Early - Community
  { clinicalGroup: 'A', functionalLevel: 'L', comorbidityAdjustment: 'N', admissionSource: 'community', weight: 0.8187 },
  { clinicalGroup: 'A', functionalLevel: 'L', comorbidityAdjustment: 'L', admissionSource: 'community', weight: 0.9006 },
  { clinicalGroup: 'A', functionalLevel: 'L', comorbidityAdjustment: 'H', admissionSource: 'community', weight: 1.0030 },
  { clinicalGroup: 'A', functionalLevel: 'M', comorbidityAdjustment: 'N', admissionSource: 'community', weight: 0.9873 },
  { clinicalGroup: 'A', functionalLevel: 'M', comorbidityAdjustment: 'L', admissionSource: 'community', weight: 1.0861 },
  { clinicalGroup: 'A', functionalLevel: 'M', comorbidityAdjustment: 'H', admissionSource: 'community', weight: 1.2090 },
  { clinicalGroup: 'A', functionalLevel: 'H', comorbidityAdjustment: 'N', admissionSource: 'community', weight: 1.2187 },
  { clinicalGroup: 'A', functionalLevel: 'H', comorbidityAdjustment: 'L', admissionSource: 'community', weight: 1.3406 },
  { clinicalGroup: 'A', functionalLevel: 'H', comorbidityAdjustment: 'H', admissionSource: 'community', weight: 1.4923 },

  // Complex Medical Early - Institutional (Group E)
  { clinicalGroup: 'E', functionalLevel: 'L', comorbidityAdjustment: 'N', admissionSource: 'institutional', weight: 1.1456 },
  { clinicalGroup: 'E', functionalLevel: 'L', comorbidityAdjustment: 'L', admissionSource: 'institutional', weight: 1.2602 },
  { clinicalGroup: 'E', functionalLevel: 'L', comorbidityAdjustment: 'H', admissionSource: 'institutional', weight: 1.4030 },
  { clinicalGroup: 'E', functionalLevel: 'M', comorbidityAdjustment: 'N', admissionSource: 'institutional', weight: 1.3821 },
  { clinicalGroup: 'E', functionalLevel: 'M', comorbidityAdjustment: 'L', admissionSource: 'institutional', weight: 1.5203 },
  { clinicalGroup: 'E', functionalLevel: 'M', comorbidityAdjustment: 'H', admissionSource: 'institutional', weight: 1.6926 },
  { clinicalGroup: 'E', functionalLevel: 'H', comorbidityAdjustment: 'N', admissionSource: 'institutional', weight: 1.7062 },
  { clinicalGroup: 'E', functionalLevel: 'H', comorbidityAdjustment: 'L', admissionSource: 'institutional', weight: 1.8768 },
  { clinicalGroup: 'E', functionalLevel: 'H', comorbidityAdjustment: 'H', admissionSource: 'institutional', weight: 2.0893 },

  // Complex Medical Early - Community (Group E)
  { clinicalGroup: 'E', functionalLevel: 'L', comorbidityAdjustment: 'N', admissionSource: 'community', weight: 0.9165 },
  { clinicalGroup: 'E', functionalLevel: 'L', comorbidityAdjustment: 'L', admissionSource: 'community', weight: 1.0082 },
  { clinicalGroup: 'E', functionalLevel: 'L', comorbidityAdjustment: 'H', admissionSource: 'community', weight: 1.1224 },
  { clinicalGroup: 'E', functionalLevel: 'M', comorbidityAdjustment: 'N', admissionSource: 'community', weight: 1.1057 },
  { clinicalGroup: 'E', functionalLevel: 'M', comorbidityAdjustment: 'L', admissionSource: 'community', weight: 1.2163 },
  { clinicalGroup: 'E', functionalLevel: 'M', comorbidityAdjustment: 'H', admissionSource: 'community', weight: 1.3541 },
  { clinicalGroup: 'E', functionalLevel: 'H', comorbidityAdjustment: 'N', admissionSource: 'community', weight: 1.3650 },
  { clinicalGroup: 'E', functionalLevel: 'H', comorbidityAdjustment: 'L', admissionSource: 'community', weight: 1.5015 },
  { clinicalGroup: 'E', functionalLevel: 'H', comorbidityAdjustment: 'H', admissionSource: 'community', weight: 1.6715 },

  // MS/Rehab Early - Institutional (Group I)
  { clinicalGroup: 'I', functionalLevel: 'L', comorbidityAdjustment: 'N', admissionSource: 'institutional', weight: 1.2341 },
  { clinicalGroup: 'I', functionalLevel: 'L', comorbidityAdjustment: 'L', admissionSource: 'institutional', weight: 1.3575 },
  { clinicalGroup: 'I', functionalLevel: 'L', comorbidityAdjustment: 'H', admissionSource: 'institutional', weight: 1.5113 },
  { clinicalGroup: 'I', functionalLevel: 'M', comorbidityAdjustment: 'N', admissionSource: 'institutional', weight: 1.4891 },
  { clinicalGroup: 'I', functionalLevel: 'M', comorbidityAdjustment: 'L', admissionSource: 'institutional', weight: 1.6380 },
  { clinicalGroup: 'I', functionalLevel: 'M', comorbidityAdjustment: 'H', admissionSource: 'institutional', weight: 1.8236 },
  { clinicalGroup: 'I', functionalLevel: 'H', comorbidityAdjustment: 'N', admissionSource: 'institutional', weight: 1.8387 },
  { clinicalGroup: 'I', functionalLevel: 'H', comorbidityAdjustment: 'L', admissionSource: 'institutional', weight: 2.0226 },
  { clinicalGroup: 'I', functionalLevel: 'H', comorbidityAdjustment: 'H', admissionSource: 'institutional', weight: 2.2516 },

  // MS/Rehab Early - Community (Group I)
  { clinicalGroup: 'I', functionalLevel: 'L', comorbidityAdjustment: 'N', admissionSource: 'community', weight: 0.9873 },
  { clinicalGroup: 'I', functionalLevel: 'L', comorbidityAdjustment: 'L', admissionSource: 'community', weight: 1.0860 },
  { clinicalGroup: 'I', functionalLevel: 'L', comorbidityAdjustment: 'H', admissionSource: 'community', weight: 1.2090 },
  { clinicalGroup: 'I', functionalLevel: 'M', comorbidityAdjustment: 'N', admissionSource: 'community', weight: 1.1913 },
  { clinicalGroup: 'I', functionalLevel: 'M', comorbidityAdjustment: 'L', admissionSource: 'community', weight: 1.3104 },
  { clinicalGroup: 'I', functionalLevel: 'M', comorbidityAdjustment: 'H', admissionSource: 'community', weight: 1.4589 },
  { clinicalGroup: 'I', functionalLevel: 'H', comorbidityAdjustment: 'N', admissionSource: 'community', weight: 1.4710 },
  { clinicalGroup: 'I', functionalLevel: 'H', comorbidityAdjustment: 'L', admissionSource: 'community', weight: 1.6181 },
  { clinicalGroup: 'I', functionalLevel: 'H', comorbidityAdjustment: 'H', admissionSource: 'community', weight: 1.8013 },

  // Wounds Early - Institutional (Group C)
  { clinicalGroup: 'C', functionalLevel: 'L', comorbidityAdjustment: 'N', admissionSource: 'institutional', weight: 1.3124 },
  { clinicalGroup: 'C', functionalLevel: 'L', comorbidityAdjustment: 'L', admissionSource: 'institutional', weight: 1.4436 },
  { clinicalGroup: 'C', functionalLevel: 'L', comorbidityAdjustment: 'H', admissionSource: 'institutional', weight: 1.6072 },
  { clinicalGroup: 'C', functionalLevel: 'M', comorbidityAdjustment: 'N', admissionSource: 'institutional', weight: 1.5835 },
  { clinicalGroup: 'C', functionalLevel: 'M', comorbidityAdjustment: 'L', admissionSource: 'institutional', weight: 1.7419 },
  { clinicalGroup: 'C', functionalLevel: 'M', comorbidityAdjustment: 'H', admissionSource: 'institutional', weight: 1.9393 },
  { clinicalGroup: 'C', functionalLevel: 'H', comorbidityAdjustment: 'N', admissionSource: 'institutional', weight: 1.9548 },
  { clinicalGroup: 'C', functionalLevel: 'H', comorbidityAdjustment: 'L', admissionSource: 'institutional', weight: 2.1503 },
  { clinicalGroup: 'C', functionalLevel: 'H', comorbidityAdjustment: 'H', admissionSource: 'institutional', weight: 2.3938 },

  // Wounds Early - Community (Group C)
  { clinicalGroup: 'C', functionalLevel: 'L', comorbidityAdjustment: 'N', admissionSource: 'community', weight: 1.0499 },
  { clinicalGroup: 'C', functionalLevel: 'L', comorbidityAdjustment: 'L', admissionSource: 'community', weight: 1.1549 },
  { clinicalGroup: 'C', functionalLevel: 'L', comorbidityAdjustment: 'H', admissionSource: 'community', weight: 1.2858 },
  { clinicalGroup: 'C', functionalLevel: 'M', comorbidityAdjustment: 'N', admissionSource: 'community', weight: 1.2668 },
  { clinicalGroup: 'C', functionalLevel: 'M', comorbidityAdjustment: 'L', admissionSource: 'community', weight: 1.3935 },
  { clinicalGroup: 'C', functionalLevel: 'M', comorbidityAdjustment: 'H', admissionSource: 'community', weight: 1.5514 },
  { clinicalGroup: 'C', functionalLevel: 'H', comorbidityAdjustment: 'N', admissionSource: 'community', weight: 1.5638 },
  { clinicalGroup: 'C', functionalLevel: 'H', comorbidityAdjustment: 'L', admissionSource: 'community', weight: 1.7202 },
  { clinicalGroup: 'C', functionalLevel: 'H', comorbidityAdjustment: 'H', admissionSource: 'community', weight: 1.9150 },

  // MMTA-Other Early - Institutional (Group K)
  { clinicalGroup: 'K', functionalLevel: 'L', comorbidityAdjustment: 'N', admissionSource: 'institutional', weight: 0.8234 },
  { clinicalGroup: 'K', functionalLevel: 'L', comorbidityAdjustment: 'L', admissionSource: 'institutional', weight: 0.9058 },
  { clinicalGroup: 'K', functionalLevel: 'L', comorbidityAdjustment: 'H', admissionSource: 'institutional', weight: 1.0083 },
  { clinicalGroup: 'K', functionalLevel: 'M', comorbidityAdjustment: 'N', admissionSource: 'institutional', weight: 0.9938 },
  { clinicalGroup: 'K', functionalLevel: 'M', comorbidityAdjustment: 'L', admissionSource: 'institutional', weight: 1.0932 },
  { clinicalGroup: 'K', functionalLevel: 'M', comorbidityAdjustment: 'H', admissionSource: 'institutional', weight: 1.2172 },
  { clinicalGroup: 'K', functionalLevel: 'H', comorbidityAdjustment: 'N', admissionSource: 'institutional', weight: 1.2268 },
  { clinicalGroup: 'K', functionalLevel: 'H', comorbidityAdjustment: 'L', admissionSource: 'institutional', weight: 1.3495 },
  { clinicalGroup: 'K', functionalLevel: 'H', comorbidityAdjustment: 'H', admissionSource: 'institutional', weight: 1.5024 },

  // MMTA-Other Early - Community (Group K)
  { clinicalGroup: 'K', functionalLevel: 'L', comorbidityAdjustment: 'N', admissionSource: 'community', weight: 0.6587 },
  { clinicalGroup: 'K', functionalLevel: 'L', comorbidityAdjustment: 'L', admissionSource: 'community', weight: 0.7246 },
  { clinicalGroup: 'K', functionalLevel: 'L', comorbidityAdjustment: 'H', admissionSource: 'community', weight: 0.8067 },
  { clinicalGroup: 'K', functionalLevel: 'M', comorbidityAdjustment: 'N', admissionSource: 'community', weight: 0.7950 },
  { clinicalGroup: 'K', functionalLevel: 'M', comorbidityAdjustment: 'L', admissionSource: 'community', weight: 0.8745 },
  { clinicalGroup: 'K', functionalLevel: 'M', comorbidityAdjustment: 'H', admissionSource: 'community', weight: 0.9738 },
  { clinicalGroup: 'K', functionalLevel: 'H', comorbidityAdjustment: 'N', admissionSource: 'community', weight: 0.9814 },
  { clinicalGroup: 'K', functionalLevel: 'H', comorbidityAdjustment: 'L', admissionSource: 'community', weight: 1.0796 },
  { clinicalGroup: 'K', functionalLevel: 'H', comorbidityAdjustment: 'H', admissionSource: 'community', weight: 1.2019 },
];

// =============================================================================
// REIMBURSEMENT RATES
// =============================================================================

/**
 * CMS National Standardized 30-Day Payment Amount (approximate FY2024)
 * This is multiplied by case mix weight to get the payment amount
 */
export const NATIONAL_STANDARDIZED_PAYMENT_30DAY = 1815.95;

/**
 * CMS National Standardized 60-Day Payment Amount (approximate FY2024)
 * Under PDGM, payment is per 30-day period, so 60-day = 2 x 30-day
 */
export const NATIONAL_STANDARDIZED_PAYMENT_60DAY = 3631.90;

/**
 * Low Utilization Payment Adjustment (LUPA) threshold
 * Episodes below this visit count get per-visit payment instead
 */
export const LUPA_THRESHOLD_VISITS = 2;

/**
 * LUPA per-visit rate (approximate)
 */
export const LUPA_PER_VISIT_RATE = 165.85;

/**
 * Default wage index for calculations when not specified
 */
export const DEFAULT_WAGE_INDEX = 1.0;

// =============================================================================
// HIPPS CODE STRUCTURE
// =============================================================================

export interface HIPPSPosition {
  position: number;
  name: string;
  description: string;
  validValues: string[];
}

export const HIPPS_CODE_STRUCTURE: HIPPSPosition[] = [
  {
    position: 1,
    name: 'Clinical Grouping',
    description: 'Primary diagnosis clinical category with timing',
    validValues: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
  },
  {
    position: 2,
    name: 'Functional Level',
    description: 'Patient functional impairment level',
    validValues: ['L', 'M', 'H'],
  },
  {
    position: 3,
    name: 'Comorbidity Adjustment',
    description: 'Comorbidity interaction adjustment level',
    validValues: ['N', 'L', 'H'],
  },
  {
    position: 4,
    name: 'Service Utilization',
    description: 'Expected therapy service utilization',
    validValues: ['A', 'B', 'C', 'D', 'E'],
  },
  {
    position: 5,
    name: 'Admission Source & Timing',
    description: 'Source of admission and episode timing',
    validValues: ['1', '2', '3', '4'],
  },
];

// =============================================================================
// OPTIMIZATION SUGGESTIONS
// =============================================================================

export interface OptimizationRule {
  id: string;
  condition: (data: OptimizationContext) => boolean;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
  category: 'documentation' | 'clinical' | 'coding';
  potentialImpact: string;
}

export interface OptimizationContext {
  clinicalGroup: string;
  functionalLevel: string;
  comorbidityAdjustment: string;
  primaryDiagnosis?: string;
  secondaryDiagnoses?: string[];
  functionalScore: number;
  admissionSource?: string;
  hasWoundCare?: boolean;
  hasTherapyNeed?: boolean;
}

export const OPTIMIZATION_RULES: OptimizationRule[] = [
  {
    id: 'low-func-review',
    condition: (ctx) => ctx.functionalLevel === 'L' && ctx.functionalScore > 15,
    suggestion: 'Functional score is near Medium threshold. Review GG items for accuracy - some functional limitations may not be fully documented.',
    priority: 'medium',
    category: 'documentation',
    potentialImpact: 'Medium functional level increases reimbursement by 15-25%',
  },
  {
    id: 'no-comorbidity',
    condition: (ctx) => ctx.comorbidityAdjustment === 'N' && (ctx.secondaryDiagnoses?.length ?? 0) >= 2,
    suggestion: 'Multiple secondary diagnoses present but no comorbidity adjustment applied. Review diagnosis coding for qualifying comorbidity interactions.',
    priority: 'high',
    category: 'coding',
    potentialImpact: 'Low comorbidity adds 10%, High adds 20%',
  },
  {
    id: 'wound-with-diabetes',
    condition: (ctx) => Boolean(ctx.hasWoundCare) && Boolean(ctx.primaryDiagnosis?.match(/^L89|^L97/)) &&
                        !ctx.secondaryDiagnoses?.some(d => d.match(/^E10|^E11/)),
    suggestion: 'Wound care patient without documented diabetes. If diabetic, adding diabetes as secondary diagnosis may trigger comorbidity adjustment.',
    priority: 'medium',
    category: 'clinical',
    potentialImpact: 'Could upgrade to High comorbidity (+20%)',
  },
  {
    id: 'mmta-upgrade',
    condition: (ctx) => Boolean(ctx.clinicalGroup.match(/^K|^L/)),
    suggestion: 'Currently in MMTA-Other group (lowest reimbursement). Review if primary diagnosis reflects most resource-intensive condition.',
    priority: 'high',
    category: 'coding',
    potentialImpact: 'Different clinical group could increase reimbursement 20-50%',
  },
  {
    id: 'therapy-documentation',
    condition: (ctx) => Boolean(ctx.hasTherapyNeed) && ctx.functionalLevel === 'L',
    suggestion: 'Therapy need indicated but functional level is Low. Ensure therapy-relevant functional limitations are fully documented.',
    priority: 'medium',
    category: 'documentation',
    potentialImpact: 'Better functional documentation supports therapy necessity',
  },
  {
    id: 'institutional-timing',
    condition: (ctx) => Boolean(ctx.admissionSource) && ['02', '03', '04', '05'].includes(ctx.admissionSource || ''),
    suggestion: 'Patient admitted from institution. Verify "Early" vs "Late" timing is correctly applied based on 14-day threshold from institutional discharge.',
    priority: 'low',
    category: 'documentation',
    potentialImpact: 'Early timing typically has higher case mix weight',
  },
];

// =============================================================================
// HELPER FUNCTIONS FOR CONSTANTS
// =============================================================================

/**
 * Get case mix weight for given parameters
 */
export function lookupCaseMixWeight(
  clinicalGroup: string,
  functionalLevel: string,
  comorbidityAdjustment: string,
  admissionSource: 'institutional' | 'community'
): number {
  const weight = CASE_MIX_WEIGHTS.find(
    w => w.clinicalGroup === clinicalGroup &&
         w.functionalLevel === functionalLevel &&
         w.comorbidityAdjustment === comorbidityAdjustment &&
         w.admissionSource === admissionSource
  );

  if (weight) {
    return weight.weight;
  }

  // Fallback calculation if specific weight not found
  const baseWeights: Record<string, number> = {
    A: 1.1, B: 1.0, C: 1.3, D: 1.2, E: 1.2, F: 1.1,
    G: 1.0, H: 0.9, I: 1.4, J: 1.3, K: 0.8, L: 0.7,
  };

  const funcMultipliers: Record<string, number> = { L: 0.85, M: 1.0, H: 1.25 };
  const comorbMultipliers: Record<string, number> = { N: 1.0, L: 1.1, H: 1.2 };
  const sourceMultiplier = admissionSource === 'institutional' ? 1.25 : 1.0;

  const base = baseWeights[clinicalGroup] || 1.0;
  const func = funcMultipliers[functionalLevel] || 1.0;
  const comorb = comorbMultipliers[comorbidityAdjustment] || 1.0;

  return Math.round(base * func * comorb * sourceMultiplier * 1000) / 1000;
}

/**
 * Calculate estimated reimbursement
 */
export function calculateEstimatedReimbursement(
  caseMixWeight: number,
  wageIndex: number = DEFAULT_WAGE_INDEX,
  periodDays: 30 | 60 = 30
): number {
  const basePayment = periodDays === 60
    ? NATIONAL_STANDARDIZED_PAYMENT_60DAY
    : NATIONAL_STANDARDIZED_PAYMENT_30DAY;

  // Labor portion is approximately 76.1% of payment, adjusted by wage index
  const laborPortion = 0.761;
  const nonLaborPortion = 1 - laborPortion;

  const adjustedPayment = basePayment * caseMixWeight *
    ((laborPortion * wageIndex) + nonLaborPortion);

  return Math.round(adjustedPayment * 100) / 100;
}
