/**
 * Billing Code Suggestion Service
 *
 * Intelligent billing code suggestions based on OASIS assessment and visit data:
 * - ICD-10 diagnosis code suggestions
 * - HCPCS procedure code suggestions
 * - Upcoding/downcoding risk detection
 * - Confidence scoring and rationale
 *
 * Designed to support accurate coding while identifying compliance risks.
 */

import prisma from '../../config/prisma';
import type {
  BillingCodeSuggestion,
  BillingSuggestionResult,
  CodingWarning,
} from '../../types/compliance.types';

// ===========================================
// ICD-10 CODE MAPPINGS
// ===========================================

interface ICD10Mapping {
  code: string;
  description: string;
  oasisTriggers: { item: string; values: string[]; weight: number }[];
  specificity: 'high' | 'medium' | 'low';
  commonPairings: string[];
}

/**
 * Common ICD-10 codes for home health with OASIS triggers
 */
const ICD10_MAPPINGS: ICD10Mapping[] = [
  // Diabetes
  {
    code: 'E11.9',
    description: 'Type 2 diabetes mellitus without complications',
    oasisTriggers: [
      { item: 'M1021', values: ['E119', 'E11'], weight: 0.9 },
      { item: 'M2020', values: ['1'], weight: 0.3 },
    ],
    specificity: 'low',
    commonPairings: ['E11.65', 'E11.40', 'E11.21'],
  },
  {
    code: 'E11.65',
    description: 'Type 2 diabetes mellitus with hyperglycemia',
    oasisTriggers: [
      { item: 'M1021', values: ['E1165'], weight: 0.95 },
      { item: 'M2020', values: ['1'], weight: 0.3 },
    ],
    specificity: 'high',
    commonPairings: ['E11.9', 'E11.40'],
  },
  {
    code: 'E11.21',
    description: 'Type 2 diabetes mellitus with diabetic nephropathy',
    oasisTriggers: [
      { item: 'M1021', values: ['E1121'], weight: 0.95 },
    ],
    specificity: 'high',
    commonPairings: ['N18.3', 'N18.4'],
  },

  // Heart Failure
  {
    code: 'I50.9',
    description: 'Heart failure, unspecified',
    oasisTriggers: [
      { item: 'M1021', values: ['I509', 'I50'], weight: 0.9 },
      { item: 'M1400', values: ['2', '3', '4'], weight: 0.4 },
    ],
    specificity: 'low',
    commonPairings: ['I50.22', 'I50.32', 'I50.42'],
  },
  {
    code: 'I50.22',
    description: 'Chronic systolic (congestive) heart failure',
    oasisTriggers: [
      { item: 'M1021', values: ['I5022'], weight: 0.95 },
      { item: 'M1400', values: ['2', '3', '4'], weight: 0.3 },
    ],
    specificity: 'high',
    commonPairings: ['I50.9', 'I25.10'],
  },
  {
    code: 'I50.32',
    description: 'Chronic diastolic (congestive) heart failure',
    oasisTriggers: [
      { item: 'M1021', values: ['I5032'], weight: 0.95 },
      { item: 'M1400', values: ['2', '3', '4'], weight: 0.3 },
    ],
    specificity: 'high',
    commonPairings: ['I50.9', 'I10'],
  },

  // COPD
  {
    code: 'J44.9',
    description: 'Chronic obstructive pulmonary disease, unspecified',
    oasisTriggers: [
      { item: 'M1021', values: ['J449', 'J44'], weight: 0.9 },
      { item: 'M1400', values: ['2', '3', '4'], weight: 0.5 },
    ],
    specificity: 'low',
    commonPairings: ['J44.1', 'J44.0'],
  },
  {
    code: 'J44.1',
    description: 'Chronic obstructive pulmonary disease with acute exacerbation',
    oasisTriggers: [
      { item: 'M1021', values: ['J441'], weight: 0.95 },
      { item: 'M1400', values: ['3', '4'], weight: 0.4 },
    ],
    specificity: 'high',
    commonPairings: ['J44.9', 'J96.10'],
  },

  // Hypertension
  {
    code: 'I10',
    description: 'Essential (primary) hypertension',
    oasisTriggers: [
      { item: 'M1021', values: ['I10'], weight: 0.9 },
    ],
    specificity: 'medium',
    commonPairings: ['I25.10', 'E11.9'],
  },

  // Wound Care
  {
    code: 'L89.159',
    description: 'Pressure ulcer of sacral region, unspecified stage',
    oasisTriggers: [
      { item: 'M1306', values: ['1'], weight: 0.7 },
      { item: 'M1307', values: ['1', '2', '3', '4'], weight: 0.8 },
    ],
    specificity: 'low',
    commonPairings: ['L89.152', 'L89.153', 'L89.154'],
  },
  {
    code: 'L89.152',
    description: 'Pressure ulcer of sacral region, stage 2',
    oasisTriggers: [
      { item: 'M1306', values: ['1'], weight: 0.5 },
      { item: 'M1307', values: ['2'], weight: 0.95 },
    ],
    specificity: 'high',
    commonPairings: ['L89.159'],
  },
  {
    code: 'L89.153',
    description: 'Pressure ulcer of sacral region, stage 3',
    oasisTriggers: [
      { item: 'M1306', values: ['1'], weight: 0.5 },
      { item: 'M1307', values: ['3'], weight: 0.95 },
    ],
    specificity: 'high',
    commonPairings: ['L89.159'],
  },
  {
    code: 'L89.154',
    description: 'Pressure ulcer of sacral region, stage 4',
    oasisTriggers: [
      { item: 'M1306', values: ['1'], weight: 0.5 },
      { item: 'M1307', values: ['4'], weight: 0.95 },
    ],
    specificity: 'high',
    commonPairings: ['L89.159'],
  },

  // Surgical Wound
  {
    code: 'T81.4XXA',
    description: 'Infection following a procedure, initial encounter',
    oasisTriggers: [
      { item: 'M1340', values: ['1', '2', '3'], weight: 0.6 },
      { item: 'M1342', values: ['2', '3'], weight: 0.8 },
    ],
    specificity: 'high',
    commonPairings: ['Z96.641', 'Z96.642'],
  },

  // Joint Replacement
  {
    code: 'Z96.641',
    description: 'Presence of right artificial hip joint',
    oasisTriggers: [
      { item: 'M1021', values: ['Z96641'], weight: 0.95 },
    ],
    specificity: 'high',
    commonPairings: ['M16.11', 'Z87.39'],
  },
  {
    code: 'Z96.642',
    description: 'Presence of left artificial hip joint',
    oasisTriggers: [
      { item: 'M1021', values: ['Z96642'], weight: 0.95 },
    ],
    specificity: 'high',
    commonPairings: ['M16.12', 'Z87.39'],
  },
  {
    code: 'Z96.651',
    description: 'Presence of right artificial knee joint',
    oasisTriggers: [
      { item: 'M1021', values: ['Z96651'], weight: 0.95 },
    ],
    specificity: 'high',
    commonPairings: ['M17.11', 'Z87.39'],
  },

  // Stroke/CVA
  {
    code: 'I63.9',
    description: 'Cerebral infarction, unspecified',
    oasisTriggers: [
      { item: 'M1021', values: ['I639', 'I63'], weight: 0.9 },
      { item: 'M1700', values: ['2', '3', '4'], weight: 0.3 },
    ],
    specificity: 'low',
    commonPairings: ['I69.354', 'I69.351'],
  },
  {
    code: 'I69.354',
    description: 'Hemiplegia and hemiparesis following cerebral infarction affecting left non-dominant side',
    oasisTriggers: [
      { item: 'M1021', values: ['I69354'], weight: 0.95 },
      { item: 'GG0170I', values: ['01', '02', '03'], weight: 0.4 },
    ],
    specificity: 'high',
    commonPairings: ['I63.9', 'R47.01'],
  },

  // Depression
  {
    code: 'F32.9',
    description: 'Major depressive disorder, single episode, unspecified',
    oasisTriggers: [
      { item: 'M1730', values: ['3', '4', '5', '6'], weight: 0.7 },
    ],
    specificity: 'low',
    commonPairings: ['F32.1', 'F32.2'],
  },
  {
    code: 'F32.1',
    description: 'Major depressive disorder, single episode, moderate',
    oasisTriggers: [
      { item: 'M1730', values: ['3', '4'], weight: 0.8 },
    ],
    specificity: 'high',
    commonPairings: ['F32.9'],
  },

  // Dementia
  {
    code: 'F03.90',
    description: 'Unspecified dementia without behavioral disturbance',
    oasisTriggers: [
      { item: 'M1700', values: ['3', '4'], weight: 0.8 },
      { item: 'M1710', values: ['0', '1'], weight: 0.3 },
    ],
    specificity: 'low',
    commonPairings: ['G30.9', 'F03.91'],
  },
  {
    code: 'F03.91',
    description: 'Unspecified dementia with behavioral disturbance',
    oasisTriggers: [
      { item: 'M1700', values: ['3', '4'], weight: 0.6 },
      { item: 'M1710', values: ['2', '3', '4', '5'], weight: 0.7 },
    ],
    specificity: 'high',
    commonPairings: ['F03.90', 'G30.9'],
  },

  // Falls
  {
    code: 'R29.6',
    description: 'Repeated falls',
    oasisTriggers: [
      { item: 'M1033', values: ['01'], weight: 0.5 },
      { item: 'GG0170I', values: ['01', '02', '03'], weight: 0.4 },
    ],
    specificity: 'medium',
    commonPairings: ['Z91.81', 'W19.XXXA'],
  },
  {
    code: 'Z91.81',
    description: 'History of falling',
    oasisTriggers: [
      { item: 'M1033', values: ['01'], weight: 0.6 },
    ],
    specificity: 'medium',
    commonPairings: ['R29.6'],
  },
];

// ===========================================
// HCPCS CODE MAPPINGS
// ===========================================

interface HCPCSMapping {
  code: string;
  description: string;
  visitTypes: string[];
  oasisTriggers: { item: string; values: string[]; weight: number }[];
  frequency: 'per_visit' | 'per_episode' | 'monthly';
}

/**
 * Common HCPCS codes for home health services
 */
const HCPCS_MAPPINGS: HCPCSMapping[] = [
  // Skilled Nursing
  {
    code: 'G0151',
    description: 'Services of physical therapist in home health setting',
    visitTypes: ['PT'],
    oasisTriggers: [
      { item: 'GG0170I', values: ['01', '02', '03', '04'], weight: 0.7 },
      { item: 'M1860', values: ['01', '02', '03'], weight: 0.6 },
    ],
    frequency: 'per_visit',
  },
  {
    code: 'G0152',
    description: 'Services of occupational therapist in home health setting',
    visitTypes: ['OT'],
    oasisTriggers: [
      { item: 'GG0130A', values: ['01', '02', '03', '04'], weight: 0.6 },
      { item: 'M1800', values: ['01', '02'], weight: 0.5 },
      { item: 'M1810', values: ['01', '02'], weight: 0.5 },
    ],
    frequency: 'per_visit',
  },
  {
    code: 'G0153',
    description: 'Services of speech-language pathologist in home health setting',
    visitTypes: ['SLP'],
    oasisTriggers: [
      { item: 'M1200', values: ['1', '2', '3', '4'], weight: 0.7 },
      { item: 'M1210', values: ['1', '2', '3', '4', '5'], weight: 0.7 },
    ],
    frequency: 'per_visit',
  },
  {
    code: 'G0154',
    description: 'Services of skilled nurse in home health setting',
    visitTypes: ['SN', 'NURSING'],
    oasisTriggers: [
      { item: 'M2001', values: ['01', '02'], weight: 0.6 },
      { item: 'M1306', values: ['1'], weight: 0.7 },
    ],
    frequency: 'per_visit',
  },
  {
    code: 'G0155',
    description: 'Services of clinical social worker in home health setting',
    visitTypes: ['MSW'],
    oasisTriggers: [
      { item: 'M1730', values: ['3', '4', '5', '6'], weight: 0.5 },
      { item: 'M2102', values: ['1'], weight: 0.6 },
    ],
    frequency: 'per_visit',
  },
  {
    code: 'G0156',
    description: 'Services of home health aide in home health setting',
    visitTypes: ['HHA', 'AIDE'],
    oasisTriggers: [
      { item: 'M1800', values: ['01', '02', '03'], weight: 0.5 },
      { item: 'M1830', values: ['01', '02', '03', '04'], weight: 0.6 },
    ],
    frequency: 'per_visit',
  },

  // Wound Care
  {
    code: '97597',
    description: 'Debridement (eg, high pressure waterjet with/without suction), open wound, including topical application(s), wound assessment, use of whirlpool, per session; total wound(s) surface area; first 20 sq cm or less',
    visitTypes: ['SN', 'NURSING'],
    oasisTriggers: [
      { item: 'M1306', values: ['1'], weight: 0.8 },
      { item: 'M1307', values: ['3', '4'], weight: 0.7 },
    ],
    frequency: 'per_visit',
  },
  {
    code: '97598',
    description: 'Debridement, open wound; each additional 20 sq cm',
    visitTypes: ['SN', 'NURSING'],
    oasisTriggers: [
      { item: 'M1306', values: ['1'], weight: 0.6 },
      { item: 'M1307', values: ['3', '4'], weight: 0.6 },
    ],
    frequency: 'per_visit',
  },
];

// ===========================================
// MAIN SERVICE FUNCTION
// ===========================================

/**
 * Generate billing code suggestions for a visit
 */
export async function generateBillingSuggestions(
  visitId: string
): Promise<BillingSuggestionResult> {
  const diagnosisCodes: BillingCodeSuggestion[] = [];
  const procedureCodes: BillingCodeSuggestion[] = [];
  const codingWarnings: CodingWarning[] = [];

  // Fetch visit
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
  });

  if (!visit) {
    return {
      entityId: visitId,
      diagnosisCodes: [],
      procedureCodes: [],
      overallConfidence: 0,
      codingWarnings: [{
        code: 'VISIT_NOT_FOUND',
        type: 'consistency',
        message: 'Visit not found',
        recommendation: 'Verify visit ID',
      }],
      analyzedAt: new Date().toISOString(),
    };
  }

  // Fetch latest assessment for this episode
  const assessment = await prisma.oasisAssessment.findFirst({
    where: { episodeId: visit.episodeId },
    orderBy: { createdAt: 'desc' },
    include: { responses: true },
  });

  const responses = assessment?.responses || [];

  // Build response map
  const responseMap: Record<string, string | null> = {};
  for (const response of responses) {
    responseMap[response.itemCode] = response.responseCode || response.responseValue;
  }

  // Generate ICD-10 suggestions
  const icd10Suggestions = generateICD10Suggestions(responseMap, visit.visitType);
  diagnosisCodes.push(...icd10Suggestions.codes);
  codingWarnings.push(...icd10Suggestions.warnings);

  // Generate HCPCS suggestions
  const hcpcsSuggestions = generateHCPCSSuggestions(responseMap, visit.visitType);
  procedureCodes.push(...hcpcsSuggestions.codes);
  codingWarnings.push(...hcpcsSuggestions.warnings);

  // Check for coding consistency issues
  const consistencyWarnings = checkCodingConsistency(diagnosisCodes, procedureCodes, responseMap);
  codingWarnings.push(...consistencyWarnings);

  // Calculate overall confidence
  const avgDiagConfidence = diagnosisCodes.length > 0
    ? diagnosisCodes.reduce((sum, c) => sum + c.confidence, 0) / diagnosisCodes.length
    : 0;
  const avgProcConfidence = procedureCodes.length > 0
    ? procedureCodes.reduce((sum, c) => sum + c.confidence, 0) / procedureCodes.length
    : 0;
  const overallConfidence = (avgDiagConfidence + avgProcConfidence) / 2;

  return {
    entityId: visitId,
    diagnosisCodes,
    procedureCodes,
    overallConfidence: Math.round(overallConfidence * 100) / 100,
    codingWarnings,
    analyzedAt: new Date().toISOString(),
  };
}

// ===========================================
// ICD-10 SUGGESTION LOGIC
// ===========================================

/**
 * Generate ICD-10 diagnosis code suggestions
 */
function generateICD10Suggestions(
  responseMap: Record<string, string | null>,
  _visitType: string | null
): { codes: BillingCodeSuggestion[]; warnings: CodingWarning[] } {
  const codes: BillingCodeSuggestion[] = [];
  const warnings: CodingWarning[] = [];
  const scoredCodes: Map<string, { score: number; mapping: ICD10Mapping; matchedItems: string[] }> = new Map();

  // Score each ICD-10 code based on OASIS triggers
  for (const mapping of ICD10_MAPPINGS) {
    let score = 0;
    const matchedItems: string[] = [];

    for (const trigger of mapping.oasisTriggers) {
      const responseValue = responseMap[trigger.item];
      if (responseValue && trigger.values.some((v) => responseValue.includes(v) || v.includes(responseValue))) {
        score += trigger.weight;
        matchedItems.push(`${trigger.item}=${responseValue}`);
      }
    }

    if (score > 0) {
      scoredCodes.set(mapping.code, { score, mapping, matchedItems });
    }
  }

  // Sort by score and generate suggestions
  const sortedCodes = Array.from(scoredCodes.entries())
    .sort((a, b) => b[1].score - a[1].score);

  let isPrimary = true;
  for (const [code, data] of sortedCodes.slice(0, 6)) { // Top 6 codes
    const confidence = Math.min(data.score, 1);
    const suggestion: BillingCodeSuggestion = {
      code,
      codeType: 'ICD10',
      description: data.mapping.description,
      confidence,
      rationale: `Matched OASIS items: ${data.matchedItems.join(', ')}`,
      isPrimary: isPrimary && confidence > 0.7,
      specificity: data.mapping.specificity,
      supportingEvidence: data.matchedItems,
      relatedOasisItems: data.mapping.oasisTriggers.map((t) => t.item),
    };

    // Check for specificity issues
    if (data.mapping.specificity === 'low' && data.mapping.commonPairings.length > 0) {
      const moreSpecificOptions = data.mapping.commonPairings.filter((p) =>
        scoredCodes.has(p) && scoredCodes.get(p)!.mapping.specificity === 'high'
      );

      if (moreSpecificOptions.length > 0) {
        suggestion.codingRisk = {
          type: 'downcoding',
          severity: 'medium',
          explanation: `More specific code available: ${moreSpecificOptions[0]}`,
          alternativeCode: moreSpecificOptions[0],
        };

        warnings.push({
          code: code,
          type: 'specificity',
          message: `${code} is a non-specific code. Consider using more specific code if documentation supports it.`,
          recommendation: `Review documentation for specificity to support: ${moreSpecificOptions.join(', ')}`,
        });
      }
    }

    codes.push(suggestion);
    isPrimary = false;
  }

  // Check for primary diagnosis from M1021
  const m1021 = responseMap['M1021'];
  if (m1021) {
    const existingPrimary = codes.find((c) => c.isPrimary && c.code.replace('.', '') === m1021.replace('.', ''));
    if (!existingPrimary) {
      // M1021 code not in top suggestions - flag for review
      warnings.push({
        code: m1021,
        type: 'consistency',
        message: `M1021 primary diagnosis (${m1021}) differs from highest confidence suggestion`,
        recommendation: 'Verify primary diagnosis aligns with current clinical findings',
      });
    }
  }

  return { codes, warnings };
}

// ===========================================
// HCPCS SUGGESTION LOGIC
// ===========================================

/**
 * Generate HCPCS procedure code suggestions
 */
function generateHCPCSSuggestions(
  responseMap: Record<string, string | null>,
  visitType: string | null
): { codes: BillingCodeSuggestion[]; warnings: CodingWarning[] } {
  const codes: BillingCodeSuggestion[] = [];
  const warnings: CodingWarning[] = [];

  for (const mapping of HCPCS_MAPPINGS) {
    // Check if visit type matches
    const visitTypeMatch = !visitType || mapping.visitTypes.some((vt) =>
      visitType.toUpperCase().includes(vt.toUpperCase())
    );

    if (!visitTypeMatch) continue;

    let score = 0;
    const matchedItems: string[] = [];

    // Base score for visit type match
    if (visitType && mapping.visitTypes.some((vt) => visitType.toUpperCase() === vt.toUpperCase())) {
      score += 0.5;
    }

    // Score based on OASIS triggers
    for (const trigger of mapping.oasisTriggers) {
      const responseValue = responseMap[trigger.item];
      if (responseValue && trigger.values.includes(responseValue)) {
        score += trigger.weight;
        matchedItems.push(`${trigger.item}=${responseValue}`);
      }
    }

    if (score > 0.3) {
      const confidence = Math.min(score, 1);
      codes.push({
        code: mapping.code,
        codeType: 'HCPCS',
        description: mapping.description,
        confidence,
        rationale: `Visit type: ${visitType || 'Unknown'}, matched items: ${matchedItems.join(', ')}`,
        specificity: 'high',
        supportingEvidence: matchedItems,
        relatedOasisItems: mapping.oasisTriggers.map((t) => t.item),
      });
    }
  }

  // Sort by confidence
  codes.sort((a, b) => b.confidence - a.confidence);

  return { codes, warnings };
}

// ===========================================
// CODING CONSISTENCY CHECKS
// ===========================================

/**
 * Check for coding consistency issues
 */
function checkCodingConsistency(
  diagnosisCodes: BillingCodeSuggestion[],
  procedureCodes: BillingCodeSuggestion[],
  responseMap: Record<string, string | null>
): CodingWarning[] {
  const warnings: CodingWarning[] = [];

  // Check for wound codes without wound procedure codes
  const hasWoundDiagnosis = diagnosisCodes.some((c) =>
    c.code.startsWith('L89') || c.code.startsWith('L97') || c.code.startsWith('T81')
  );
  const hasWoundProcedure = procedureCodes.some((c) =>
    c.code === '97597' || c.code === '97598'
  );

  if (hasWoundDiagnosis && !hasWoundProcedure && responseMap['M1307']) {
    const stage = responseMap['M1307'];
    if (stage && ['3', '4'].includes(stage)) {
      warnings.push({
        code: 'WOUND_PROCEDURE',
        type: 'consistency',
        message: 'Stage 3/4 wound diagnosis present but no debridement procedure code suggested',
        recommendation: 'If debridement performed, add appropriate procedure code (97597/97598)',
      });
    }
  }

  // Check for diabetes without education codes
  const hasDiabetes = diagnosisCodes.some((c) => c.code.startsWith('E11') || c.code.startsWith('E10'));
  const hasHighRiskDrugEducation = responseMap['M2010'] === '1';

  if (hasDiabetes && !hasHighRiskDrugEducation) {
    warnings.push({
      code: 'DIABETES_EDUCATION',
      type: 'consistency',
      message: 'Diabetes diagnosis present but M2010 (high-risk drug education) not documented',
      recommendation: 'Document patient education on diabetes medications if provided',
    });
  }

  // Check for upcoding patterns
  const highSpecificityCount = diagnosisCodes.filter((c) => c.specificity === 'high').length;
  const totalDiagCodes = diagnosisCodes.length;

  if (totalDiagCodes > 4 && highSpecificityCount / totalDiagCodes > 0.8) {
    warnings.push({
      code: 'UPCODING_PATTERN',
      type: 'upcoding_risk',
      message: 'High proportion of very specific diagnosis codes may indicate upcoding risk',
      recommendation: 'Ensure documentation supports the specificity of each diagnosis code',
    });
  }

  // Check for excessive diagnoses
  if (diagnosisCodes.filter((c) => c.confidence > 0.5).length > 6) {
    warnings.push({
      code: 'EXCESSIVE_DIAGNOSES',
      type: 'frequency',
      message: 'Large number of active diagnoses may warrant review',
      recommendation: 'Verify all diagnoses are current and relevant to home health plan of care',
    });
  }

  // Check for therapy without functional deficits
  const hasTherapy = procedureCodes.some((c) => ['G0151', 'G0152', 'G0153'].includes(c.code));
  const hasFunctionalDeficit = diagnosisCodes.some((c) =>
    c.code.startsWith('R26') || c.code.startsWith('R29') || c.code.startsWith('R47')
  );

  if (hasTherapy && !hasFunctionalDeficit) {
    const ggScore = responseMap['GG0170I'];
    if (!ggScore || parseInt(ggScore, 10) >= 5) {
      warnings.push({
        code: 'THERAPY_NECESSITY',
        type: 'consistency',
        message: 'Therapy services without documented functional deficit codes',
        recommendation: 'Add functional deficit diagnosis (R26.x, R29.x) if appropriate',
      });
    }
  }

  return warnings;
}

// ===========================================
// ASSESSMENT-BASED SUGGESTIONS
// ===========================================

/**
 * Generate billing suggestions based on a full OASIS assessment
 */
export async function generateAssessmentBillingSuggestions(
  assessmentId: string
): Promise<BillingSuggestionResult> {
  const diagnosisCodes: BillingCodeSuggestion[] = [];
  const procedureCodes: BillingCodeSuggestion[] = [];
  const codingWarnings: CodingWarning[] = [];

  const assessment = await prisma.oasisAssessment.findUnique({
    where: { id: assessmentId },
    include: {
      responses: true,
    },
  });

  if (!assessment) {
    return {
      entityId: assessmentId,
      diagnosisCodes: [],
      procedureCodes: [],
      overallConfidence: 0,
      codingWarnings: [{
        code: 'ASSESSMENT_NOT_FOUND',
        type: 'consistency',
        message: 'Assessment not found',
        recommendation: 'Verify assessment ID',
      }],
      analyzedAt: new Date().toISOString(),
    };
  }

  // Fetch visits for the episode
  const visits = await prisma.visit.findMany({
    where: { episodeId: assessment.episodeId },
    orderBy: { scheduledDate: 'desc' },
    take: 5,
  });

  // Build response map
  const responseMap: Record<string, string | null> = {};
  for (const response of assessment.responses) {
    responseMap[response.itemCode] = response.responseCode || response.responseValue;
  }

  // Generate ICD-10 suggestions
  const icd10Suggestions = generateICD10Suggestions(responseMap, null);
  diagnosisCodes.push(...icd10Suggestions.codes);
  codingWarnings.push(...icd10Suggestions.warnings);

  // Generate HCPCS suggestions for each visit type in episode
  const visitTypes = new Set(visits.map((v) => v.visitType).filter(Boolean));
  for (const visitType of visitTypes) {
    const hcpcsSuggestions = generateHCPCSSuggestions(responseMap, visitType);
    // Avoid duplicates
    for (const code of hcpcsSuggestions.codes) {
      if (!procedureCodes.some((c) => c.code === code.code)) {
        procedureCodes.push(code);
      }
    }
    codingWarnings.push(...hcpcsSuggestions.warnings);
  }

  // Check consistency
  const consistencyWarnings = checkCodingConsistency(diagnosisCodes, procedureCodes, responseMap);
  codingWarnings.push(...consistencyWarnings);

  // Calculate overall confidence
  const avgDiagConfidence = diagnosisCodes.length > 0
    ? diagnosisCodes.reduce((sum, c) => sum + c.confidence, 0) / diagnosisCodes.length
    : 0;
  const avgProcConfidence = procedureCodes.length > 0
    ? procedureCodes.reduce((sum, c) => sum + c.confidence, 0) / procedureCodes.length
    : 0;
  const overallConfidence = (avgDiagConfidence + avgProcConfidence) / 2;

  return {
    entityId: assessmentId,
    diagnosisCodes,
    procedureCodes,
    overallConfidence: Math.round(overallConfidence * 100) / 100,
    codingWarnings,
    analyzedAt: new Date().toISOString(),
  };
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  generateBillingSuggestions,
  generateAssessmentBillingSuggestions,
  ICD10_MAPPINGS,
  HCPCS_MAPPINGS,
};
