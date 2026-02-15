/**
 * Physician Communication Detection Rules
 *
 * AI-powered rules for detecting conditions that require physician notification.
 * Rules are organized into categories for different communication types:
 * 1. Change in Condition - Significant clinical changes
 * 2. Hospitalization/ER - Recent inpatient events
 * 3. New Orders Needed - Therapy referrals, medication issues
 * 4. Discharge/Recertification - Episode milestones
 */

// =============================================================================
// TYPES
// =============================================================================

export type CommunicationType =
  | 'CHANGE_IN_CONDITION'
  | 'REQUEST_NEW_ORDERS'
  | 'REFERRAL_REQUEST'
  | 'HOSPITALIZATION_NOTIFICATION'
  | 'ABNORMAL_FINDING'
  | 'POC_UPDATE_REQUEST'
  | 'RECERTIFICATION_SUMMARY'
  | 'DISCHARGE_RECOMMENDATION';

export type CommunicationUrgency = 'ROUTINE' | 'URGENT' | 'EMERGENT';

export interface CommunicationRule {
  id: string;
  type: CommunicationType;
  urgency: CommunicationUrgency;
  title: string;
  description: string;
  notificationTemplate: string;
  relatedOasisItems: string[];
  dismissible: boolean;
}

export interface CommunicationRuleCondition {
  /**
   * OASIS question codes that trigger evaluation of this rule
   */
  triggerQuestions: string[];

  /**
   * Condition function that determines if the rule applies
   * @param context - Current assessment context
   * @returns true if communication should be triggered
   */
  evaluate: (context: CommunicationRuleContext) => boolean;
}

export interface CommunicationRuleContext {
  currentQuestionCode: string;
  currentValue: string | number | null;
  previousValue?: string | number | null;
  allResponses: Map<string, string | null>;
  previousResponses?: Map<string, string | null>;
  primaryDiagnosis?: string;
  secondaryDiagnoses?: string[];
  episodeStartDate?: Date;
  episodeEndDate?: Date;
}

export interface CommunicationRuleDefinition {
  rule: CommunicationRule;
  condition: CommunicationRuleCondition;
}

export interface CommunicationTriggerResult {
  ruleId: string;
  type: CommunicationType;
  urgency: CommunicationUrgency;
  title: string;
  description: string;
  triggerData: Record<string, unknown>;
  relatedOasisItems: string[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

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
 * Compare two numeric values and check if increased by threshold
 */
function hasIncreasedBy(
  current: number | null,
  previous: number | null,
  threshold: number
): boolean {
  if (current === null || previous === null) return false;
  return current - previous >= threshold;
}

/**
 * Check if a diagnosis matches an ICD-10 pattern
 */
function matchesDiagnosis(diagnosis: string | undefined, pattern: RegExp): boolean {
  if (!diagnosis) return false;
  return pattern.test(diagnosis);
}

/**
 * Extract primary diagnosis from M1021 response
 */
function extractPrimaryDiagnosis(responses: Map<string, string | null>): string | undefined {
  const m1021 = responses.get('M1021');
  if (!m1021) return undefined;
  const match = m1021.match(/^([A-Z]\d{2}\.?\d{0,4})/);
  return match ? match[1] : m1021.slice(0, 7).replace('.', '');
}

/**
 * Check if value indicates "Yes" response
 */
function isYesResponse(value: string | null): boolean {
  if (!value) return false;
  return ['1', '01', 'YES', 'Y', 'true'].includes(value.toUpperCase());
}

/**
 * Calculate days until date
 */
function daysUntil(targetDate: Date | undefined): number | null {
  if (!targetDate) return null;
  const now = new Date();
  const diffTime = targetDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// =============================================================================
// CATEGORY 1: CHANGE IN CONDITION RULES
// =============================================================================

export const CHANGE_IN_CONDITION_RULES: CommunicationRuleDefinition[] = [
  // Significant Pain Increase
  {
    rule: {
      id: 'pain-increase',
      type: 'CHANGE_IN_CONDITION',
      urgency: 'URGENT',
      title: 'Significant Pain Increase',
      description: 'Patient pain level has increased by 3+ points or new pain reported at 7+/10.',
      notificationTemplate: 'Patient reports significant increase in pain level. Current pain: {{currentPain}}/10. {{painDetails}}',
      relatedOasisItems: ['J0520', 'J0530'],
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['J0520', 'J0530'],
      evaluate: (ctx) => {
        const currentPain = getNumericValue(getStringValue(ctx.allResponses, 'J0520'));
        const previousPain = ctx.previousResponses
          ? getNumericValue(getStringValue(ctx.previousResponses, 'J0520'))
          : null;

        // High pain threshold (7+) or significant increase (3+ points)
        if (currentPain !== null && currentPain >= 7) return true;
        if (hasIncreasedBy(currentPain, previousPain, 3)) return true;

        return false;
      },
    },
  },

  // Fall Occurrence
  {
    rule: {
      id: 'fall-occurrence',
      type: 'CHANGE_IN_CONDITION',
      urgency: 'URGENT',
      title: 'Patient Fall Reported',
      description: 'Patient has experienced a fall since last assessment.',
      notificationTemplate: 'Patient has experienced a fall. {{fallDetails}} Recommend physician review for fall assessment and intervention modifications.',
      relatedOasisItems: ['J1800', 'J1900A', 'J1900B', 'J1900C'],
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['J1800'],
      evaluate: (ctx) => {
        const fallOccurred = getStringValue(ctx.allResponses, 'J1800');
        return isYesResponse(fallOccurred);
      },
    },
  },

  // Wound Deterioration
  {
    rule: {
      id: 'wound-deterioration',
      type: 'CHANGE_IN_CONDITION',
      urgency: 'URGENT',
      title: 'Wound Status Deterioration',
      description: 'Pressure ulcer has worsened or new wound identified.',
      notificationTemplate: 'Wound deterioration noted. {{woundDetails}} Current stage: {{currentStage}}. Previous stage: {{previousStage}}.',
      relatedOasisItems: ['M1306', 'M1307', 'M1311', 'M1322', 'M1324'],
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['M1306', 'M1307', 'M1311', 'M1322', 'M1324'],
      evaluate: (ctx) => {
        // Check for unhealed pressure ulcer
        const hasUlcer = getStringValue(ctx.allResponses, 'M1306');
        if (isYesResponse(hasUlcer)) {
          // Check if stage worsened
          const currentStage = getNumericValue(getStringValue(ctx.allResponses, 'M1307'));
          const previousStage = ctx.previousResponses
            ? getNumericValue(getStringValue(ctx.previousResponses, 'M1307'))
            : null;

          if (currentStage !== null && previousStage !== null && currentStage > previousStage) {
            return true;
          }

          // New ulcer if no previous ulcer
          const hadUlcer = ctx.previousResponses
            ? isYesResponse(getStringValue(ctx.previousResponses, 'M1306'))
            : false;
          if (!hadUlcer) return true;
        }

        // Check for new surgical wound problems
        const woundStatus = getStringValue(ctx.allResponses, 'M1342');
        const previousWoundStatus = ctx.previousResponses
          ? getStringValue(ctx.previousResponses, 'M1342')
          : null;

        // Status indicating problems (2 = compromised healing, 3 = not healing)
        if (woundStatus && ['2', '3', '02', '03'].includes(woundStatus)) {
          if (!previousWoundStatus || !['2', '3', '02', '03'].includes(previousWoundStatus)) {
            return true;
          }
        }

        return false;
      },
    },
  },

  // Mental Status Change
  {
    rule: {
      id: 'mental-status-change',
      type: 'CHANGE_IN_CONDITION',
      urgency: 'EMERGENT',
      title: 'Significant Mental Status Change',
      description: 'BIMS score dropped 3+ points or new confusion/disorientation noted.',
      notificationTemplate: 'Significant change in mental status. Current BIMS: {{currentBims}}. {{mentalStatusDetails}} Recommend immediate physician evaluation.',
      relatedOasisItems: ['C0500', 'C1310A', 'C1310B', 'C1310C', 'C1310D', 'M1710'],
      dismissible: false,
    },
    condition: {
      triggerQuestions: ['C0500', 'C1310A', 'C1310B', 'C1310C', 'C1310D', 'M1710'],
      evaluate: (ctx) => {
        // Check BIMS score decline
        const currentBims = getNumericValue(getStringValue(ctx.allResponses, 'C0500'));
        const previousBims = ctx.previousResponses
          ? getNumericValue(getStringValue(ctx.previousResponses, 'C0500'))
          : null;

        if (hasIncreasedBy(previousBims, currentBims, 3)) return true;

        // Check for new acute confusion (delirium symptoms)
        const deliriumA = getStringValue(ctx.allResponses, 'C1310A'); // Acute onset
        const deliriumB = getStringValue(ctx.allResponses, 'C1310B'); // Inattention
        const deliriumC = getStringValue(ctx.allResponses, 'C1310C'); // Disorganized thinking
        const deliriumD = getStringValue(ctx.allResponses, 'C1310D'); // Altered LOC

        // Any positive delirium sign
        if (isYesResponse(deliriumA) || isYesResponse(deliriumB) ||
            isYesResponse(deliriumC) || isYesResponse(deliriumD)) {
          return true;
        }

        // Check for increased confusion frequency
        const confusionFreq = getNumericValue(getStringValue(ctx.allResponses, 'M1710'));
        const prevConfusionFreq = ctx.previousResponses
          ? getNumericValue(getStringValue(ctx.previousResponses, 'M1710'))
          : null;

        if (confusionFreq !== null && prevConfusionFreq !== null &&
            confusionFreq > prevConfusionFreq) {
          return true;
        }

        return false;
      },
    },
  },

  // Dyspnea Worsening
  {
    rule: {
      id: 'dyspnea-worsening',
      type: 'CHANGE_IN_CONDITION',
      urgency: 'URGENT',
      title: 'Respiratory Status Decline',
      description: 'Dyspnea has worsened by 2+ levels on M1400 scale.',
      notificationTemplate: 'Worsening respiratory status. Current dyspnea level: {{currentDyspnea}}. Previous: {{previousDyspnea}}. {{respiratoryDetails}}',
      relatedOasisItems: ['M1400'],
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['M1400'],
      evaluate: (ctx) => {
        const currentDyspnea = getNumericValue(getStringValue(ctx.allResponses, 'M1400'));
        const previousDyspnea = ctx.previousResponses
          ? getNumericValue(getStringValue(ctx.previousResponses, 'M1400'))
          : null;

        // M1400: 0=none, 1=walking, 2=moderate, 3=minimal, 4=at rest
        // Higher = worse
        return hasIncreasedBy(currentDyspnea, previousDyspnea, 2);
      },
    },
  },

  // Depression Screen Positive
  {
    rule: {
      id: 'depression-positive',
      type: 'CHANGE_IN_CONDITION',
      urgency: 'ROUTINE',
      title: 'Depression Screening Positive',
      description: 'PHQ-2 score >= 3 or PHQ-9 score >= 10 indicates possible depression.',
      notificationTemplate: 'Positive depression screening. PHQ-2: {{phq2Score}}, PHQ-9: {{phq9Score}}. Recommend evaluation for depression treatment.',
      relatedOasisItems: ['D0150A1', 'D0150A2', 'D0160'],
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['D0150A1', 'D0150A2', 'D0160'],
      evaluate: (ctx) => {
        // PHQ-2 items
        const phq2a = getNumericValue(getStringValue(ctx.allResponses, 'D0150A1'));
        const phq2b = getNumericValue(getStringValue(ctx.allResponses, 'D0150A2'));
        const phq2Total = (phq2a || 0) + (phq2b || 0);

        if (phq2Total >= 3) return true;

        // PHQ-9 total
        const phq9 = getNumericValue(getStringValue(ctx.allResponses, 'D0160'));
        if (phq9 !== null && phq9 >= 10) return true;

        return false;
      },
    },
  },
];

// =============================================================================
// CATEGORY 2: HOSPITALIZATION / ER RULES
// =============================================================================

export const HOSPITALIZATION_RULES: CommunicationRuleDefinition[] = [
  // Recent Hospitalization/ER Visit
  {
    rule: {
      id: 'hospitalization-since-last-visit',
      type: 'HOSPITALIZATION_NOTIFICATION',
      urgency: 'URGENT',
      title: 'Hospitalization/ER Visit Since Last Assessment',
      description: 'Patient has been hospitalized or visited ER since last home health visit.',
      notificationTemplate: 'Patient has had {{hospitalizationType}} since last visit. {{hospitalizationDetails}} Recommend plan of care review.',
      relatedOasisItems: ['M2301'],
      dismissible: false,
    },
    condition: {
      triggerQuestions: ['M2301'],
      evaluate: (ctx) => {
        const emergentCare = getStringValue(ctx.allResponses, 'M2301');
        // M2301: 0=No, 1=Hospital, 2=ER
        return emergentCare !== null && ['1', '2', '01', '02'].includes(emergentCare);
      },
    },
  },
];

// =============================================================================
// CATEGORY 3: NEW ORDERS NEEDED RULES
// =============================================================================

export const NEW_ORDERS_RULES: CommunicationRuleDefinition[] = [
  // Therapy Referral Needed
  {
    rule: {
      id: 'therapy-referral-needed',
      type: 'REFERRAL_REQUEST',
      urgency: 'ROUTINE',
      title: 'Therapy Referral Recommended',
      description: 'Functional assessment indicates potential benefit from PT/OT/ST services.',
      notificationTemplate: 'Based on functional assessment, patient may benefit from {{therapyType}}. {{functionalDetails}}',
      relatedOasisItems: ['GG0130A', 'GG0130B', 'GG0170I', 'GG0170J', 'M1860'],
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['GG0130A', 'GG0130B', 'GG0170I', 'GG0170J', 'M1860'],
      evaluate: (ctx) => {
        // Low self-care scores (under 3 = needs assistance)
        const eating = getNumericValue(getStringValue(ctx.allResponses, 'GG0130A'));
        const grooming = getNumericValue(getStringValue(ctx.allResponses, 'GG0130B'));
        const lowSelfCare = (eating !== null && eating <= 3) ||
                           (grooming !== null && grooming <= 3);

        // Low mobility scores
        const walk10 = getNumericValue(getStringValue(ctx.allResponses, 'GG0170I'));
        const walk50 = getNumericValue(getStringValue(ctx.allResponses, 'GG0170J'));
        const lowMobility = (walk10 !== null && walk10 <= 3) ||
                            (walk50 !== null && walk50 <= 3);

        // Ambulation issues
        const ambulation = getNumericValue(getStringValue(ctx.allResponses, 'M1860'));
        const ambulationIssues = ambulation !== null && ambulation >= 2;

        // TODO: Check if therapy is already ordered (not available in current context)
        // For now, trigger if functional limitations present

        return lowSelfCare || lowMobility || ambulationIssues;
      },
    },
  },

  // Medication Issue Identified
  {
    rule: {
      id: 'medication-issue',
      type: 'REQUEST_NEW_ORDERS',
      urgency: 'URGENT',
      title: 'Drug Regimen Issue Identified',
      description: 'Medication review indicates clinically significant issue requiring physician attention.',
      notificationTemplate: 'Drug regimen review identified: {{medicationIssue}}. Recommend physician review of medication regimen.',
      relatedOasisItems: ['M2001', 'M2003', 'M2005', 'M2010'],
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['M2001', 'M2003', 'M2005'],
      evaluate: (ctx) => {
        // M2001: Drug regimen review - did clinically significant issue occur?
        const drugReviewIssue = getStringValue(ctx.allResponses, 'M2001');
        // 1 = Yes, issues identified that required communication with physician
        if (drugReviewIssue === '1' || drugReviewIssue === '01') {
          return true;
        }

        // M2003: Medication follow-up
        const medFollowUp = getStringValue(ctx.allResponses, 'M2003');
        if (isYesResponse(medFollowUp)) return true;

        // M2005: Medication intervention
        const medIntervention = getStringValue(ctx.allResponses, 'M2005');
        if (isYesResponse(medIntervention)) return true;

        return false;
      },
    },
  },

  // High Risk Medication Alert
  {
    rule: {
      id: 'high-risk-medication',
      type: 'ABNORMAL_FINDING',
      urgency: 'ROUTINE',
      title: 'High Risk Medication Monitoring',
      description: 'Patient on high-risk medications requiring enhanced monitoring.',
      notificationTemplate: 'Patient taking high-risk medications. {{medicationList}} Recommend monitoring for adverse effects.',
      relatedOasisItems: ['N0415'],
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['N0415'],
      evaluate: (ctx) => {
        // N0415: High risk drug classes
        const highRiskDrugs = getStringValue(ctx.allResponses, 'N0415');
        // Multiple options indicating high-risk meds
        return highRiskDrugs !== null && highRiskDrugs !== '0' && highRiskDrugs !== '00';
      },
    },
  },
];

// =============================================================================
// CATEGORY 4: DISCHARGE / RECERTIFICATION RULES
// =============================================================================

export const DISCHARGE_RECERT_RULES: CommunicationRuleDefinition[] = [
  // Discharge Ready
  {
    rule: {
      id: 'discharge-ready',
      type: 'DISCHARGE_RECOMMENDATION',
      urgency: 'ROUTINE',
      title: 'Patient Approaching Discharge Readiness',
      description: 'High functional scores indicate patient may be ready for discharge.',
      notificationTemplate: 'Patient functional status indicates potential discharge readiness. Current functional level: {{functionalLevel}}. Goals status: {{goalsStatus}}.',
      relatedOasisItems: ['GG0130A', 'GG0130B', 'GG0170I', 'M1860'],
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['GG0130A', 'GG0130B', 'GG0170I', 'GG0170J', 'M1860'],
      evaluate: (ctx) => {
        // High self-care scores (5+ = mostly independent)
        const eating = getNumericValue(getStringValue(ctx.allResponses, 'GG0130A'));
        const grooming = getNumericValue(getStringValue(ctx.allResponses, 'GG0130B'));
        const highSelfCare = (eating !== null && eating >= 5) &&
                            (grooming !== null && grooming >= 5);

        // High mobility scores
        const walk10 = getNumericValue(getStringValue(ctx.allResponses, 'GG0170I'));
        const walk50 = getNumericValue(getStringValue(ctx.allResponses, 'GG0170J'));
        const highMobility = (walk10 !== null && walk10 >= 5) &&
                             (walk50 !== null && walk50 >= 5);

        // Independent ambulation
        const ambulation = getNumericValue(getStringValue(ctx.allResponses, 'M1860'));
        const independentAmbulation = ambulation !== null && ambulation <= 1;

        return highSelfCare && highMobility && independentAmbulation;
      },
    },
  },

  // Recertification Due
  {
    rule: {
      id: 'recert-due',
      type: 'RECERTIFICATION_SUMMARY',
      urgency: 'ROUTINE',
      title: 'Episode Recertification Approaching',
      description: 'Episode certification period ending soon. Recertification summary needed.',
      notificationTemplate: 'Episode certification ending {{daysUntilEnd}} days. Patient status: {{patientStatus}}. {{recertDetails}}',
      relatedOasisItems: [],
      dismissible: true,
    },
    condition: {
      triggerQuestions: [], // Special case - triggered by episode dates, not OASIS items
      evaluate: (ctx) => {
        const daysRemaining = daysUntil(ctx.episodeEndDate);
        // Trigger when within 14 days of episode end
        return daysRemaining !== null && daysRemaining <= 14 && daysRemaining > 0;
      },
    },
  },
];

// =============================================================================
// CATEGORY 5: ABNORMAL FINDINGS RULES
// =============================================================================

export const ABNORMAL_FINDING_RULES: CommunicationRuleDefinition[] = [
  // Vital Signs Abnormal
  {
    rule: {
      id: 'vital-signs-abnormal',
      type: 'ABNORMAL_FINDING',
      urgency: 'URGENT',
      title: 'Abnormal Vital Signs',
      description: 'Vital signs outside normal parameters requiring physician notification.',
      notificationTemplate: 'Abnormal vital signs: {{vitalsDetails}}. Recommend physician evaluation.',
      relatedOasisItems: ['M1060A', 'M1060B'],
      dismissible: false,
    },
    condition: {
      triggerQuestions: ['M1060A', 'M1060B'], // Weight items as proxy - actual vitals from visit record
      evaluate: (ctx) => {
        // Weight change check
        const currentWeight = getNumericValue(getStringValue(ctx.allResponses, 'M1060B'));
        const previousWeight = ctx.previousResponses
          ? getNumericValue(getStringValue(ctx.previousResponses, 'M1060B'))
          : null;

        if (currentWeight !== null && previousWeight !== null) {
          const weightChange = Math.abs(currentWeight - previousWeight);
          const weightChangePercent = (weightChange / previousWeight) * 100;
          // 5%+ weight change in short period is significant
          if (weightChangePercent >= 5) return true;
        }

        return false;
      },
    },
  },

  // Diabetic Finding
  {
    rule: {
      id: 'diabetic-abnormal-finding',
      type: 'ABNORMAL_FINDING',
      urgency: 'URGENT',
      title: 'Diabetic Complication Concern',
      description: 'Finding in diabetic patient requiring physician attention.',
      notificationTemplate: 'Diabetic patient - abnormal finding: {{diabeticDetails}}. Current glucose management: {{glucoseDetails}}.',
      relatedOasisItems: ['M1021', 'M1023', 'M1306'],
      dismissible: true,
    },
    condition: {
      triggerQuestions: ['M1021', 'M1023', 'M1306'],
      evaluate: (ctx) => {
        // Check if diabetic
        const primary = extractPrimaryDiagnosis(ctx.allResponses);
        const isDiabetic = matchesDiagnosis(primary, /^E10|^E11|^E13/);

        if (!isDiabetic) return false;

        // Check for new wound in diabetic patient
        const hasWound = isYesResponse(getStringValue(ctx.allResponses, 'M1306'));
        const hadWound = ctx.previousResponses
          ? isYesResponse(getStringValue(ctx.previousResponses, 'M1306'))
          : false;

        return hasWound && !hadWound;
      },
    },
  },
];

// =============================================================================
// COMBINED RULES EXPORT
// =============================================================================

export const ALL_COMMUNICATION_RULES: CommunicationRuleDefinition[] = [
  ...CHANGE_IN_CONDITION_RULES,
  ...HOSPITALIZATION_RULES,
  ...NEW_ORDERS_RULES,
  ...DISCHARGE_RECERT_RULES,
  ...ABNORMAL_FINDING_RULES,
];

/**
 * Get rules that should be evaluated for a specific question
 */
export function getRulesForQuestion(questionCode: string): CommunicationRuleDefinition[] {
  return ALL_COMMUNICATION_RULES.filter(ruleDef =>
    ruleDef.condition.triggerQuestions.includes(questionCode)
  );
}

/**
 * Get all unique trigger questions across all rules
 */
export function getAllTriggerQuestions(): string[] {
  const triggers = new Set<string>();
  ALL_COMMUNICATION_RULES.forEach(ruleDef => {
    ruleDef.condition.triggerQuestions.forEach(q => triggers.add(q));
  });
  return Array.from(triggers);
}

/**
 * Get rules by communication type
 */
export function getRulesByType(type: CommunicationType): CommunicationRuleDefinition[] {
  return ALL_COMMUNICATION_RULES.filter(ruleDef => ruleDef.rule.type === type);
}

/**
 * Get rules by urgency level
 */
export function getRulesByUrgency(urgency: CommunicationUrgency): CommunicationRuleDefinition[] {
  return ALL_COMMUNICATION_RULES.filter(ruleDef => ruleDef.rule.urgency === urgency);
}
