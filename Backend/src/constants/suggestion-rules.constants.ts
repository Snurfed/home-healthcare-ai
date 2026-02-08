/**
 * Smart Suggestion Rules Constants
 *
 * Defines rules for real-time OASIS assessment guidance and optimization suggestions.
 * Rules are organized into 5 categories:
 * 1. Diagnosis-Based Prompts - Required documentation based on diagnosis
 * 2. Comorbidity Optimization - Opportunities to document comorbidities
 * 3. Inconsistency Detection - Detect conflicting responses
 * 4. Functional Assessment Guidance - Verify functional documentation
 * 5. Revenue at Risk - Under-documentation affecting reimbursement
 */

// =============================================================================
// TYPES
// =============================================================================

export type SuggestionType =
  | 'HELP'
  | 'OPTIMIZATION'
  | 'INCONSISTENCY'
  | 'REQUIRED_FOLLOWUP'
  | 'REVENUE_RISK';

export type SuggestionPriority = 'high' | 'medium' | 'low';

export interface SuggestionRule {
  id: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  title: string;
  message: string;
  helpText?: string;
  financialImpact?: {
    estimatedDelta: number;
    direction: 'positive' | 'negative' | 'neutral';
    explanation: string;
  };
  relatedQuestions?: { itemCode: string; itemName: string; action: string }[];
  actionLabel?: string;
  actionTarget?: string;
  dismissible: boolean;
}

export interface RuleCondition {
  /**
   * Question code that triggers evaluation of this rule
   */
  triggerQuestions: string[];

  /**
   * Condition function that determines if the rule applies
   * @param context - Current assessment context
   * @returns true if the rule applies
   */
  evaluate: (context: RuleContext) => boolean;
}

export interface RuleContext {
  currentQuestionCode: string;
  currentValue: string | number | null;
  allResponses: Map<string, string | null>;
  primaryDiagnosis?: string;
  secondaryDiagnoses?: string[];
}

export interface SuggestionRuleDefinition {
  rule: SuggestionRule;
  condition: RuleCondition;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a diagnosis matches an ICD-10 pattern
 */
function matchesDiagnosis(diagnosis: string | undefined, pattern: RegExp): boolean {
  if (!diagnosis) return false;
  return pattern.test(diagnosis);
}

/**
 * Check if any diagnosis in the list matches a pattern
 */
function anyDiagnosisMatches(diagnoses: string[] | undefined, pattern: RegExp): boolean {
  if (!diagnoses || diagnoses.length === 0) return false;
  return diagnoses.some(d => pattern.test(d));
}

/**
 * Get numeric value from response
 */
function getNumericValue(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Get string value from response map
 */
function getStringValue(responses: Map<string, string | null>, key: string): string | null {
  const value = responses.get(key);
  return value === undefined ? null : value;
}

/**
 * Extract primary diagnosis from M1021 response (first 6 digits)
 */
function extractPrimaryDiagnosis(responses: Map<string, string | null>): string | undefined {
  const m1021 = responses.get('M1021');
  if (!m1021) return undefined;
  // M1021 may store just the code or code with description
  const match = m1021.match(/^([A-Z]\d{2}\.?\d{0,4})/);
  return match ? match[1] : m1021.slice(0, 7).replace('.', '');
}

/**
 * Extract secondary diagnoses from M1023
 */
function extractSecondaryDiagnoses(responses: Map<string, string | null>): string[] {
  const m1023 = responses.get('M1023');
  if (!m1023) return [];
  // M1023 may be comma-separated or JSON array
  try {
    const parsed = JSON.parse(m1023);
    if (Array.isArray(parsed)) {
      return parsed.map(d => typeof d === 'string' ? d : d.code || d.value).filter(Boolean);
    }
  } catch {
    // Fall back to comma-separated
    return m1023.split(',').map(d => d.trim()).filter(Boolean);
  }
  return [];
}

// =============================================================================
// CATEGORY 1: DIAGNOSIS-BASED PROMPTS
// =============================================================================

export const DIAGNOSIS_BASED_RULES: SuggestionRuleDefinition[] = [
  // Pressure Ulcer Documentation
  {
    rule: {
      id: 'pressure-ulcer-section-m',
      type: 'REQUIRED_FOLLOWUP',
      priority: 'high',
      title: 'Pressure Ulcer Documentation Required',
      message: 'Primary diagnosis indicates pressure ulcer. Document wound details in Section M (Skin Conditions).',
      helpText: 'CMS requires complete documentation of pressure ulcer stage, location, and characteristics when this is the primary or active diagnosis.',
      relatedQuestions: [
        { itemCode: 'M1306', itemName: 'Unhealed Pressure Ulcer at Stage 2 or Higher', action: 'Complete' },
        { itemCode: 'M1307', itemName: 'Most Problematic Pressure Ulcer Stage', action: 'Review' },
      ],
      actionLabel: 'Go to Section M',
      actionTarget: 'M1306',
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['M1021', 'M1023'],
      evaluate: (ctx) => {
        const primary = extractPrimaryDiagnosis(ctx.allResponses);
        return matchesDiagnosis(primary, /^L89/);
      },
    },
  },

  // Diabetes Documentation
  {
    rule: {
      id: 'diabetes-foot-check',
      type: 'REQUIRED_FOLLOWUP',
      priority: 'medium',
      title: 'Diabetic Foot Assessment Required',
      message: 'Diabetes diagnosis detected. Ensure foot assessment is documented in Section M.',
      helpText: 'For diabetic patients, document foot condition including any ulcers, neuropathy signs, or vascular issues.',
      relatedQuestions: [
        { itemCode: 'M1306', itemName: 'Skin Conditions', action: 'Review' },
        { itemCode: 'M1311', itemName: 'Current Number of Unhealed Pressure Ulcers', action: 'Verify' },
      ],
      actionLabel: 'Review Skin Section',
      actionTarget: 'M1306',
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['M1021', 'M1023'],
      evaluate: (ctx) => {
        const primary = extractPrimaryDiagnosis(ctx.allResponses);
        const secondary = extractSecondaryDiagnoses(ctx.allResponses);
        return matchesDiagnosis(primary, /^E10|^E11|^E13/) ||
               anyDiagnosisMatches(secondary, /^E10|^E11|^E13/);
      },
    },
  },

  // Heart Failure Documentation
  {
    rule: {
      id: 'chf-functional-assessment',
      type: 'REQUIRED_FOLLOWUP',
      priority: 'high',
      title: 'Heart Failure - Functional Assessment Critical',
      message: 'Heart failure diagnosis detected. Thoroughly document functional limitations in GG section.',
      helpText: 'CHF patients often have significant functional limitations. Document ambulation distance, dyspnea on exertion, and ADL assistance needs.',
      relatedQuestions: [
        { itemCode: 'GG0130', itemName: 'Self-Care', action: 'Complete' },
        { itemCode: 'GG0170', itemName: 'Mobility', action: 'Complete' },
      ],
      actionLabel: 'Go to Functional Abilities',
      actionTarget: 'GG0130A',
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['M1021', 'M1023'],
      evaluate: (ctx) => {
        const primary = extractPrimaryDiagnosis(ctx.allResponses);
        return matchesDiagnosis(primary, /^I50/);
      },
    },
  },

  // Stroke/Neuro Documentation
  {
    rule: {
      id: 'stroke-cognitive-assessment',
      type: 'REQUIRED_FOLLOWUP',
      priority: 'high',
      title: 'Stroke - Cognitive Assessment Required',
      message: 'Stroke diagnosis detected. Complete cognitive and behavioral assessment in Sections C, D, and E.',
      helpText: 'Post-stroke patients require thorough cognitive screening. Document BIMS, memory, and any behavioral changes.',
      relatedQuestions: [
        { itemCode: 'C0100', itemName: 'Should BIMS be Conducted', action: 'Complete' },
        { itemCode: 'C0200', itemName: 'Repetition of Three Words', action: 'Complete' },
        { itemCode: 'D0150', itemName: 'PHQ-2 to 9', action: 'Review' },
      ],
      actionLabel: 'Go to Cognitive Section',
      actionTarget: 'C0100',
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['M1021', 'M1023'],
      evaluate: (ctx) => {
        const primary = extractPrimaryDiagnosis(ctx.allResponses);
        return matchesDiagnosis(primary, /^I6[0-9]/);
      },
    },
  },

  // COPD Documentation
  {
    rule: {
      id: 'copd-respiratory-status',
      type: 'REQUIRED_FOLLOWUP',
      priority: 'medium',
      title: 'COPD - Respiratory Assessment',
      message: 'COPD diagnosis detected. Document respiratory status and oxygen use in Section O.',
      helpText: 'For COPD patients, document O2 therapy, nebulizer treatments, and respiratory symptoms affecting function.',
      relatedQuestions: [
        { itemCode: 'O0110', itemName: 'Special Treatments and Programs', action: 'Complete' },
        { itemCode: 'J0520', itemName: 'Pain Effect on Sleep', action: 'Review' },
      ],
      actionLabel: 'Go to Special Treatments',
      actionTarget: 'O0110',
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['M1021', 'M1023'],
      evaluate: (ctx) => {
        const primary = extractPrimaryDiagnosis(ctx.allResponses);
        return matchesDiagnosis(primary, /^J44|^J43/);
      },
    },
  },
];

// =============================================================================
// CATEGORY 2: COMORBIDITY OPTIMIZATION
// =============================================================================

export const COMORBIDITY_OPTIMIZATION_RULES: SuggestionRuleDefinition[] = [
  // Diabetes with possible complications
  {
    rule: {
      id: 'diabetes-complications-check',
      type: 'OPTIMIZATION',
      priority: 'medium',
      title: 'Consider Diabetes Complications',
      message: 'Diabetes documented. Did you assess for neuropathy, retinopathy, or nephropathy?',
      helpText: 'Documenting diabetes complications can qualify for comorbidity adjustment, increasing reimbursement.',
      financialImpact: {
        estimatedDelta: 250,
        direction: 'positive',
        explanation: 'Documenting complications may increase comorbidity adjustment',
      },
      relatedQuestions: [
        { itemCode: 'M1023', itemName: 'Secondary Diagnoses', action: 'Review' },
      ],
      actionLabel: 'Review Secondary Diagnoses',
      actionTarget: 'M1023',
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['M1021', 'M1023'],
      evaluate: (ctx) => {
        const primary = extractPrimaryDiagnosis(ctx.allResponses);
        const secondary = extractSecondaryDiagnoses(ctx.allResponses);
        const hasDiabetes = matchesDiagnosis(primary, /^E10|^E11/) ||
                           anyDiagnosisMatches(secondary, /^E10|^E11/);
        // Check if complications are documented
        const hasComplications = anyDiagnosisMatches(secondary, /^E10\.[4-6]|^E11\.[4-6]|^G62\.9|^H36/);
        return hasDiabetes && !hasComplications;
      },
    },
  },

  // Heart Failure with potential comorbidities
  {
    rule: {
      id: 'chf-comorbidity-check',
      type: 'OPTIMIZATION',
      priority: 'high',
      title: 'Heart Failure Comorbidity Opportunity',
      message: 'Heart failure documented. Common comorbidities include CKD, COPD, and AFib - are these documented?',
      helpText: 'CHF patients frequently have comorbid conditions. Documenting CKD, COPD, or AFib can qualify for high comorbidity adjustment.',
      financialImpact: {
        estimatedDelta: 400,
        direction: 'positive',
        explanation: 'CHF with CKD or COPD qualifies for High comorbidity (+20%)',
      },
      relatedQuestions: [
        { itemCode: 'M1023', itemName: 'Secondary Diagnoses', action: 'Review' },
      ],
      actionLabel: 'Review Secondary Diagnoses',
      actionTarget: 'M1023',
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['M1021', 'M1023'],
      evaluate: (ctx) => {
        const primary = extractPrimaryDiagnosis(ctx.allResponses);
        const secondary = extractSecondaryDiagnoses(ctx.allResponses);
        const hasHeartFailure = matchesDiagnosis(primary, /^I50/);
        // Check if qualifying comorbidities are documented
        const hasQualifyingComorbidity = anyDiagnosisMatches(secondary, /^N18|^J44|^I48/);
        return hasHeartFailure && secondary.length < 2 && !hasQualifyingComorbidity;
      },
    },
  },

  // Wound with Diabetes
  {
    rule: {
      id: 'wound-diabetes-optimization',
      type: 'OPTIMIZATION',
      priority: 'high',
      title: 'Wound Care - Diabetes Documentation',
      message: 'Wound diagnosis documented. If patient is diabetic, ensure diabetes is listed as secondary diagnosis.',
      helpText: 'Diabetic patients with wounds qualify for high comorbidity adjustment. This is a common under-documentation issue.',
      financialImpact: {
        estimatedDelta: 350,
        direction: 'positive',
        explanation: 'Wound + Diabetes = High comorbidity adjustment',
      },
      relatedQuestions: [
        { itemCode: 'M1023', itemName: 'Secondary Diagnoses', action: 'Add diabetes if applicable' },
      ],
      actionLabel: 'Add Secondary Diagnosis',
      actionTarget: 'M1023',
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['M1021', 'M1023'],
      evaluate: (ctx) => {
        const primary = extractPrimaryDiagnosis(ctx.allResponses);
        const secondary = extractSecondaryDiagnoses(ctx.allResponses);
        const hasWound = matchesDiagnosis(primary, /^L89|^L97|^L98\.4/);
        const hasDiabetes = anyDiagnosisMatches(secondary, /^E10|^E11|^E13/);
        return hasWound && !hasDiabetes;
      },
    },
  },

  // COPD with Heart Failure
  {
    rule: {
      id: 'copd-chf-comorbidity',
      type: 'OPTIMIZATION',
      priority: 'medium',
      title: 'COPD - Check for Cardiac Comorbidities',
      message: 'COPD documented. Assess for heart failure or cor pulmonale, which are common comorbidities.',
      financialImpact: {
        estimatedDelta: 300,
        direction: 'positive',
        explanation: 'COPD with CHF qualifies for High comorbidity adjustment',
      },
      relatedQuestions: [
        { itemCode: 'M1023', itemName: 'Secondary Diagnoses', action: 'Review' },
      ],
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['M1021', 'M1023'],
      evaluate: (ctx) => {
        const primary = extractPrimaryDiagnosis(ctx.allResponses);
        const secondary = extractSecondaryDiagnoses(ctx.allResponses);
        const hasCOPD = matchesDiagnosis(primary, /^J44|^J43/);
        const hasCardiac = anyDiagnosisMatches(secondary, /^I50|^I27/);
        return hasCOPD && !hasCardiac && secondary.length < 2;
      },
    },
  },
];

// =============================================================================
// CATEGORY 3: INCONSISTENCY DETECTION
// =============================================================================

export const INCONSISTENCY_RULES: SuggestionRuleDefinition[] = [
  // Pain level vs interference
  {
    rule: {
      id: 'pain-interference-mismatch',
      type: 'INCONSISTENCY',
      priority: 'high',
      title: 'Potential Inconsistency Detected',
      message: 'Patient reports significant pain but indicates pain rarely/never interferes. Please verify.',
      helpText: 'If pain is rated 7+ on a 0-10 scale, it typically affects daily activities. Review for accuracy.',
      relatedQuestions: [
        { itemCode: 'J0530', itemName: 'Pain Interference with Activities', action: 'Verify' },
      ],
      actionLabel: 'Review Pain Interference',
      actionTarget: 'J0530',
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['J0520', 'J0530'],
      evaluate: (ctx) => {
        const painLevel = getNumericValue(getStringValue(ctx.allResponses, 'J0520'));
        const painInterference = getStringValue(ctx.allResponses, 'J0530');
        // High pain (7+) but rarely/never interferes (00 or 01)
        return painLevel !== null && painLevel >= 7 &&
               painInterference !== null && ['00', '01', '0', '1'].includes(painInterference);
      },
    },
  },

  // Low mobility but no ADL assistance
  {
    rule: {
      id: 'mobility-adl-mismatch',
      type: 'INCONSISTENCY',
      priority: 'medium',
      title: 'ADL Assistance May Be Needed',
      message: 'Patient scores low on mobility/walking but indicates no ADL assistance needed. Review M2102.',
      helpText: 'Low mobility scores typically correlate with ADL assistance needs. Verify the consistency.',
      relatedQuestions: [
        { itemCode: 'M2102', itemName: 'ADL Assistance', action: 'Verify' },
        { itemCode: 'GG0170', itemName: 'Mobility', action: 'Review' },
      ],
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['GG0170I', 'GG0170J', 'M2102'],
      evaluate: (ctx) => {
        // Check walking scores - lower = more impaired
        const walkingRoom = getNumericValue(getStringValue(ctx.allResponses, 'GG0170I'));
        const walkingCorridor = getNumericValue(getStringValue(ctx.allResponses, 'GG0170J'));
        const adlAssistance = getStringValue(ctx.allResponses, 'M2102');

        const lowMobility = (walkingRoom !== null && walkingRoom <= 2) ||
                           (walkingCorridor !== null && walkingCorridor <= 2);
        const noAssistance = adlAssistance === '00' || adlAssistance === '0';

        return lowMobility && noAssistance;
      },
    },
  },

  // Cognitive impairment but no supervision needed
  {
    rule: {
      id: 'cognitive-supervision-mismatch',
      type: 'INCONSISTENCY',
      priority: 'medium',
      title: 'Cognitive Assessment Inconsistency',
      message: 'Cognitive impairment documented but supervision not indicated. Please verify.',
      helpText: 'Moderate to severe cognitive impairment typically requires some level of supervision.',
      relatedQuestions: [
        { itemCode: 'M1740', itemName: 'Cognitive Function', action: 'Verify' },
        { itemCode: 'M1800', itemName: 'Assistance with ADLs', action: 'Review' },
      ],
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['C0500', 'C0600', 'M1740'],
      evaluate: (ctx) => {
        // BIMS score
        const bimsScore = getNumericValue(getStringValue(ctx.allResponses, 'C0500'));
        const cognitiveFunction = getStringValue(ctx.allResponses, 'M1740');

        // Severe cognitive impairment (BIMS 0-7) or M1740 indicates impairment
        const cognitiveImpaired = (bimsScore !== null && bimsScore <= 7) ||
                                  (cognitiveFunction !== null && ['02', '03', '04', '2', '3', '4'].includes(cognitiveFunction));

        // Check if assistance is indicated appropriately
        const m1800 = getStringValue(ctx.allResponses, 'M1800');
        const noAssistance = m1800 === '00' || m1800 === '0';

        return Boolean(cognitiveImpaired && noAssistance);
      },
    },
  },

  // Depression screen positive but no PHQ-9
  {
    rule: {
      id: 'phq2-phq9-followup',
      type: 'INCONSISTENCY',
      priority: 'high',
      title: 'PHQ-9 Follow-up Required',
      message: 'PHQ-2 screen is positive (score 3+). PHQ-9 should be completed per CMS guidelines.',
      helpText: 'A positive PHQ-2 screen requires completion of the full PHQ-9 assessment.',
      relatedQuestions: [
        { itemCode: 'D0160', itemName: 'PHQ-9 Total', action: 'Complete' },
      ],
      actionLabel: 'Complete PHQ-9',
      actionTarget: 'D0160',
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['D0150A1', 'D0150A2', 'D0160'],
      evaluate: (ctx) => {
        // PHQ-2 items
        const phq2a = getNumericValue(getStringValue(ctx.allResponses, 'D0150A1'));
        const phq2b = getNumericValue(getStringValue(ctx.allResponses, 'D0150A2'));
        const phq9 = getStringValue(ctx.allResponses, 'D0160');

        const phq2Total = (phq2a || 0) + (phq2b || 0);
        const phq2Positive = phq2Total >= 3;
        const phq9NotComplete = !phq9 || phq9 === '';

        return phq2Positive && phq9NotComplete;
      },
    },
  },

  // High functional score but complex diagnosis
  {
    rule: {
      id: 'diagnosis-function-mismatch',
      type: 'INCONSISTENCY',
      priority: 'medium',
      title: 'Diagnosis-Function Mismatch',
      message: 'Complex diagnosis with minimal functional impairment documented. Verify functional assessment accuracy.',
      helpText: 'Severe conditions like CHF, COPD exacerbation, or stroke typically impact function significantly.',
      relatedQuestions: [
        { itemCode: 'GG0130', itemName: 'Self-Care', action: 'Review' },
        { itemCode: 'GG0170', itemName: 'Mobility', action: 'Review' },
      ],
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['M1021', 'GG0130A', 'GG0170A'],
      evaluate: (ctx) => {
        const primary = extractPrimaryDiagnosis(ctx.allResponses);
        const isComplexDx = matchesDiagnosis(primary, /^I50|^J44|^J96|^I6[0-9]|^N18\.[5-6]/);

        // Check self-care and mobility - higher = more independent
        const eating = getNumericValue(getStringValue(ctx.allResponses, 'GG0130A'));
        const walking = getNumericValue(getStringValue(ctx.allResponses, 'GG0170I'));

        const highlyIndependent = (eating !== null && eating >= 5) &&
                                  (walking !== null && walking >= 5);

        return isComplexDx && highlyIndependent;
      },
    },
  },
];

// =============================================================================
// CATEGORY 4: FUNCTIONAL ASSESSMENT GUIDANCE
// =============================================================================

export const FUNCTIONAL_GUIDANCE_RULES: SuggestionRuleDefinition[] = [
  // Low functional score near threshold
  {
    rule: {
      id: 'functional-threshold-review',
      type: 'HELP',
      priority: 'medium',
      title: 'Functional Score Near Threshold',
      message: 'Current functional score is near the Medium threshold. Ensure all limitations are accurately documented.',
      helpText: 'Scores at 18-22 are near the Low/Medium boundary. Accurate documentation ensures appropriate reimbursement.',
      financialImpact: {
        estimatedDelta: 200,
        direction: 'positive',
        explanation: 'Moving from Low to Medium functional level increases reimbursement 15-25%',
      },
      relatedQuestions: [
        { itemCode: 'GG0130', itemName: 'Self-Care', action: 'Review accuracy' },
        { itemCode: 'GG0170', itemName: 'Mobility', action: 'Review accuracy' },
      ],
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['GG0130A', 'GG0130B', 'GG0130C', 'GG0170I', 'GG0170J'],
      evaluate: (ctx) => {
        // Calculate approximate functional score from key items
        const items = ['GG0130A', 'GG0130B', 'GG0130C', 'GG0170I', 'GG0170J'];
        let total = 0;
        let count = 0;
        for (const item of items) {
          const val = getNumericValue(getStringValue(ctx.allResponses, item));
          if (val !== null) {
            total += val;
            count++;
          }
        }
        if (count === 0) return false;
        const avgScore = (total / count) * 4; // Rough estimate
        return avgScore >= 15 && avgScore <= 22;
      },
    },
  },

  // Therapy need with low functional documentation
  {
    rule: {
      id: 'therapy-functional-mismatch',
      type: 'HELP',
      priority: 'medium',
      title: 'Therapy Documentation Guidance',
      message: 'Therapy services indicated but functional limitations appear minimal. Document specific deficits needing therapy.',
      helpText: 'For therapy to be justified, functional limitations requiring skilled intervention should be documented in GG items.',
      relatedQuestions: [
        { itemCode: 'GG0130', itemName: 'Self-Care', action: 'Document specific limitations' },
        { itemCode: 'GG0170', itemName: 'Mobility', action: 'Document specific limitations' },
      ],
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['O0110', 'GG0130A', 'GG0170I'],
      evaluate: (ctx) => {
        // Check if therapy is indicated (PT/OT/ST)
        const specialTreatments = getStringValue(ctx.allResponses, 'O0110');
        const hasTherapy = specialTreatments && /therapy|PT|OT|ST/i.test(specialTreatments);

        // Check if functional scores are high (minimal limitations)
        const eating = getNumericValue(getStringValue(ctx.allResponses, 'GG0130A'));
        const walking = getNumericValue(getStringValue(ctx.allResponses, 'GG0170I'));

        const minimalLimitations = (eating === null || eating >= 5) &&
                                   (walking === null || walking >= 5);

        return Boolean(hasTherapy && minimalLimitations);
      },
    },
  },

  // Ambulation distance documentation
  {
    rule: {
      id: 'ambulation-distance-reminder',
      type: 'HELP',
      priority: 'low',
      title: 'Document Ambulation Distance',
      message: 'Consider documenting specific ambulation distances (feet) to support functional level scoring.',
      helpText: 'Quantifiable ambulation data strengthens functional assessment accuracy.',
      relatedQuestions: [
        { itemCode: 'GG0170I', itemName: 'Walk 10 feet', action: 'Verify' },
        { itemCode: 'GG0170J', itemName: 'Walk 50 feet', action: 'Verify' },
      ],
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['GG0170I', 'GG0170J'],
      evaluate: (ctx) => {
        const walk10 = getStringValue(ctx.allResponses, 'GG0170I');
        const walk50 = getStringValue(ctx.allResponses, 'GG0170J');
        // Trigger if one is documented but not the other
        return Boolean((walk10 && !walk50) || (!walk10 && walk50));
      },
    },
  },
];

// =============================================================================
// CATEGORY 5: REVENUE AT RISK
// =============================================================================

export const REVENUE_AT_RISK_RULES: SuggestionRuleDefinition[] = [
  // Complex diagnosis with no comorbidities
  {
    rule: {
      id: 'under-documented-comorbidities',
      type: 'REVENUE_RISK',
      priority: 'high',
      title: 'Revenue at Risk - Under-documentation',
      message: 'Complex primary diagnosis with no secondary diagnoses documented. Most patients have comorbidities.',
      helpText: 'Review patient history for additional diagnoses (HTN, DM, hyperlipidemia, etc.) that should be documented.',
      financialImpact: {
        estimatedDelta: 400,
        direction: 'positive',
        explanation: 'Documenting comorbidities can increase adjustment from None to Low (+10%) or High (+20%)',
      },
      relatedQuestions: [
        { itemCode: 'M1023', itemName: 'Secondary Diagnoses', action: 'Review patient history' },
      ],
      actionLabel: 'Add Secondary Diagnoses',
      actionTarget: 'M1023',
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['M1021', 'M1023'],
      evaluate: (ctx) => {
        const primary = extractPrimaryDiagnosis(ctx.allResponses);
        const secondary = extractSecondaryDiagnoses(ctx.allResponses);
        const isComplex = matchesDiagnosis(primary, /^I50|^J44|^L89|^I6[0-9]|^E10|^E11/);
        return isComplex && secondary.length === 0;
      },
    },
  },

  // MMTA group - lowest reimbursement
  {
    rule: {
      id: 'mmta-group-review',
      type: 'REVENUE_RISK',
      priority: 'high',
      title: 'Low Reimbursement Group - Review Primary',
      message: 'Current diagnosis maps to MMTA-Other (lowest reimbursement group). Verify primary diagnosis reflects the most resource-intensive condition.',
      helpText: 'If patient has wounds, CHF, stroke, or other complex conditions, those should typically be the primary diagnosis.',
      financialImpact: {
        estimatedDelta: 500,
        direction: 'positive',
        explanation: 'Different clinical grouping could increase reimbursement 20-50%',
      },
      relatedQuestions: [
        { itemCode: 'M1021', itemName: 'Primary Diagnosis', action: 'Verify' },
        { itemCode: 'M1023', itemName: 'Secondary Diagnoses', action: 'Review for upgrade' },
      ],
      actionLabel: 'Review Primary Diagnosis',
      actionTarget: 'M1021',
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['M1021'],
      evaluate: (ctx) => {
        const primary = extractPrimaryDiagnosis(ctx.allResponses);
        // MMTA group diagnoses (hypertension, history codes, etc.)
        return matchesDiagnosis(primary, /^I10|^I11|^I12|^I13|^I25|^I48|^Z[0-9]/);
      },
    },
  },

  // Low functional but likely more impaired
  {
    rule: {
      id: 'functional-underscoring-risk',
      type: 'REVENUE_RISK',
      priority: 'medium',
      title: 'Potential Functional Underscoring',
      message: 'Functional scores appear high for this diagnosis type. Verify all assistance needs are documented.',
      helpText: 'Document what assistance is actually provided, not just what patient could potentially do.',
      financialImpact: {
        estimatedDelta: 300,
        direction: 'positive',
        explanation: 'Accurate functional documentation may increase level from Low to Medium',
      },
      relatedQuestions: [
        { itemCode: 'GG0130', itemName: 'Self-Care', action: 'Verify assistance provided' },
        { itemCode: 'GG0170', itemName: 'Mobility', action: 'Verify assistance provided' },
      ],
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['M1021', 'GG0130A', 'GG0170I'],
      evaluate: (ctx) => {
        const primary = extractPrimaryDiagnosis(ctx.allResponses);
        const isHighNeed = matchesDiagnosis(primary, /^L89\.[3-4]|^I50\.2|^I50\.3|^J96/);

        const eating = getNumericValue(getStringValue(ctx.allResponses, 'GG0130A'));
        const walking = getNumericValue(getStringValue(ctx.allResponses, 'GG0170I'));

        const highScores = (eating !== null && eating >= 5) ||
                          (walking !== null && walking >= 5);

        return isHighNeed && highScores;
      },
    },
  },

  // Institutional admission not coded properly
  {
    rule: {
      id: 'institutional-timing-check',
      type: 'REVENUE_RISK',
      priority: 'medium',
      title: 'Verify Admission Source Timing',
      message: 'Patient from institutional setting. Verify "Early" vs "Late" timing for optimal reimbursement.',
      helpText: 'Early timing (within 14 days of institutional discharge) typically has higher case mix weight.',
      financialImpact: {
        estimatedDelta: 200,
        direction: 'positive',
        explanation: 'Early timing from institution has higher reimbursement',
      },
      relatedQuestions: [
        { itemCode: 'M1000', itemName: 'From Where Received Care', action: 'Verify' },
        { itemCode: 'M0030', itemName: 'Start of Care Date', action: 'Compare with discharge date' },
      ],
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['M1000'],
      evaluate: (ctx) => {
        const admissionSource = getStringValue(ctx.allResponses, 'M1000');
        // Institutional sources: hospital, SNF, rehab, LTCH
        return admissionSource !== null && ['02', '03', '04', '05', '2', '3', '4', '5'].includes(admissionSource);
      },
    },
  },
];

// =============================================================================
// COMBINED RULES EXPORT
// =============================================================================

export const ALL_SUGGESTION_RULES: SuggestionRuleDefinition[] = [
  ...DIAGNOSIS_BASED_RULES,
  ...COMORBIDITY_OPTIMIZATION_RULES,
  ...INCONSISTENCY_RULES,
  ...FUNCTIONAL_GUIDANCE_RULES,
  ...REVENUE_AT_RISK_RULES,
];

/**
 * Get rules that should be evaluated for a specific question
 */
export function getRulesForQuestion(questionCode: string): SuggestionRuleDefinition[] {
  return ALL_SUGGESTION_RULES.filter(ruleDef =>
    ruleDef.condition.triggerQuestions.includes(questionCode)
  );
}

/**
 * Get all unique trigger questions across all rules
 */
export function getAllTriggerQuestions(): string[] {
  const triggers = new Set<string>();
  ALL_SUGGESTION_RULES.forEach(ruleDef => {
    ruleDef.condition.triggerQuestions.forEach(q => triggers.add(q));
  });
  return Array.from(triggers);
}
