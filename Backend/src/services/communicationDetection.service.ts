/**
 * Communication Detection Service
 *
 * Evaluates assessment data against communication rules to detect
 * conditions requiring physician notification.
 */

import prisma from '../config/prisma';
import {
  ALL_COMMUNICATION_RULES,
  getRulesForQuestion,
  type CommunicationRuleContext,
  type CommunicationRuleDefinition,
  type CommunicationTriggerResult,
  type CommunicationType,
  type CommunicationUrgency,
} from '../constants/communication-rules.constants';

// =============================================================================
// TYPES
// =============================================================================

export interface DetectionInput {
  assessmentId: string;
  questionCode?: string;
  allResponses: Map<string, string | null>;
}

export interface DetectionResult {
  triggers: CommunicationTriggerResult[];
  evaluatedRules: number;
  timestamp: string;
}

export interface TriggerWithDismissalStatus extends CommunicationTriggerResult {
  dismissed: boolean;
  dismissedAt?: Date;
  dismissedById?: string;
  dismissReason?: string;
  communicationId?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build rule context from assessment data
 */
async function buildRuleContext(
  assessmentId: string,
  questionCode: string,
  allResponses: Map<string, string | null>
): Promise<CommunicationRuleContext> {
  // Get assessment with episode info
  const assessment = await prisma.oasisAssessment.findUnique({
    where: { id: assessmentId },
    include: {
      episode: {
        select: {
          startDate: true,
          endDate: true,
          certPeriodEnd: true,
        },
      },
    },
  });

  // Extract diagnosis info
  const m1021 = allResponses.get('M1021');
  let primaryDiagnosis: string | undefined;
  if (m1021) {
    const match = m1021.match(/^([A-Z]\d{2}\.?\d{0,4})/);
    primaryDiagnosis = match ? match[1] : m1021.slice(0, 7).replace('.', '');
  }

  // Extract secondary diagnoses
  const m1023 = allResponses.get('M1023');
  let secondaryDiagnoses: string[] = [];
  if (m1023) {
    try {
      const parsed = JSON.parse(m1023);
      if (Array.isArray(parsed)) {
        secondaryDiagnoses = parsed
          .map(d => typeof d === 'string' ? d : d.code || d.value)
          .filter(Boolean);
      }
    } catch {
      secondaryDiagnoses = m1023.split(',').map(d => d.trim()).filter(Boolean);
    }
  }

  // Get current value for the question
  const currentValue = allResponses.get(questionCode) ?? null;

  // Get previous assessment responses for comparison
  let previousResponses: Map<string, string | null> | undefined;
  if (assessment) {
    const previousAssessment = await prisma.oasisAssessment.findFirst({
      where: {
        patientId: assessment.patientId,
        episodeId: assessment.episodeId,
        id: { not: assessmentId },
        status: { in: ['APPROVED', 'SUBMITTED', 'LOCKED'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        responses: true,
      },
    });

    if (previousAssessment) {
      previousResponses = new Map();
      for (const response of previousAssessment.responses) {
        previousResponses.set(
          response.itemCode,
          response.responseValue || response.responseCode || null
        );
      }
    }
  }

  return {
    currentQuestionCode: questionCode,
    currentValue,
    previousValue: previousResponses?.get(questionCode) ?? null,
    allResponses,
    previousResponses,
    primaryDiagnosis,
    secondaryDiagnoses,
    episodeStartDate: assessment?.episode?.startDate,
    episodeEndDate: assessment?.episode?.certPeriodEnd || assessment?.episode?.endDate || undefined,
  };
}

/**
 * Build trigger data for a matched rule
 */
function buildTriggerData(
  rule: CommunicationRuleDefinition,
  context: CommunicationRuleContext
): Record<string, unknown> {
  const triggerData: Record<string, unknown> = {
    questionCode: context.currentQuestionCode,
    currentValue: context.currentValue,
    previousValue: context.previousValue,
  };

  // Add relevant OASIS item values
  for (const itemCode of rule.rule.relatedOasisItems) {
    const value = context.allResponses.get(itemCode);
    if (value !== undefined) {
      triggerData[itemCode] = value;
    }
  }

  // Add diagnosis info if relevant
  if (context.primaryDiagnosis) {
    triggerData['primaryDiagnosis'] = context.primaryDiagnosis;
  }

  return triggerData;
}

// =============================================================================
// MAIN DETECTION FUNCTIONS
// =============================================================================

/**
 * Detect communication triggers for a specific question change
 */
export async function detectTriggersForQuestion(
  input: DetectionInput
): Promise<DetectionResult> {
  const { assessmentId, questionCode, allResponses } = input;

  if (!questionCode) {
    return {
      triggers: [],
      evaluatedRules: 0,
      timestamp: new Date().toISOString(),
    };
  }

  const triggers: CommunicationTriggerResult[] = [];
  const rulesToEvaluate = getRulesForQuestion(questionCode);

  for (const ruleDef of rulesToEvaluate) {
    try {
      const context = await buildRuleContext(assessmentId, questionCode, allResponses);

      if (ruleDef.condition.evaluate(context)) {
        triggers.push({
          ruleId: ruleDef.rule.id,
          type: ruleDef.rule.type,
          urgency: ruleDef.rule.urgency,
          title: ruleDef.rule.title,
          description: ruleDef.rule.description,
          triggerData: buildTriggerData(ruleDef, context),
          relatedOasisItems: ruleDef.rule.relatedOasisItems,
        });
      }
    } catch (error) {
      console.error(`[Communication Detection] Error evaluating rule ${ruleDef.rule.id}:`, error);
    }
  }

  return {
    triggers,
    evaluatedRules: rulesToEvaluate.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Detect all communication triggers for an assessment
 */
export async function detectAllTriggers(
  assessmentId: string
): Promise<DetectionResult> {
  // Get all responses for the assessment
  const responses = await prisma.oasisResponse.findMany({
    where: { assessmentId },
  });

  const allResponses = new Map<string, string | null>();
  for (const response of responses) {
    allResponses.set(
      response.itemCode,
      response.responseValue || response.responseCode || null
    );
  }

  const triggers: CommunicationTriggerResult[] = [];
  const evaluatedRuleIds = new Set<string>();

  // Evaluate all rules
  for (const ruleDef of ALL_COMMUNICATION_RULES) {
    // Skip if already evaluated
    if (evaluatedRuleIds.has(ruleDef.rule.id)) continue;
    evaluatedRuleIds.add(ruleDef.rule.id);

    try {
      // Use first trigger question for context
      const questionCode = ruleDef.condition.triggerQuestions[0] || '';
      const context = await buildRuleContext(assessmentId, questionCode, allResponses);

      if (ruleDef.condition.evaluate(context)) {
        triggers.push({
          ruleId: ruleDef.rule.id,
          type: ruleDef.rule.type,
          urgency: ruleDef.rule.urgency,
          title: ruleDef.rule.title,
          description: ruleDef.rule.description,
          triggerData: buildTriggerData(ruleDef, context),
          relatedOasisItems: ruleDef.rule.relatedOasisItems,
        });
      }
    } catch (error) {
      console.error(`[Communication Detection] Error evaluating rule ${ruleDef.rule.id}:`, error);
    }
  }

  return {
    triggers,
    evaluatedRules: evaluatedRuleIds.size,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get triggers with dismissal status for an assessment
 */
export async function getTriggersWithDismissalStatus(
  assessmentId: string
): Promise<TriggerWithDismissalStatus[]> {
  // Get all triggers
  const detectionResult = await detectAllTriggers(assessmentId);

  // Get dismissal records
  const dismissals = await prisma.communicationTrigger.findMany({
    where: { assessmentId },
  });

  const dismissalMap = new Map(
    dismissals.map(d => [d.ruleId, d])
  );

  // Merge triggers with dismissal status
  return detectionResult.triggers.map(trigger => {
    const dismissal = dismissalMap.get(trigger.ruleId);
    return {
      ...trigger,
      dismissed: dismissal?.dismissed ?? false,
      dismissedAt: dismissal?.dismissedAt ?? undefined,
      dismissedById: dismissal?.dismissedById ?? undefined,
      dismissReason: dismissal?.dismissReason ?? undefined,
      communicationId: dismissal?.communicationId ?? undefined,
    };
  });
}

/**
 * Get active (non-dismissed) triggers for an assessment
 */
export async function getActiveTriggers(
  assessmentId: string
): Promise<CommunicationTriggerResult[]> {
  const triggersWithStatus = await getTriggersWithDismissalStatus(assessmentId);
  return triggersWithStatus
    .filter(t => !t.dismissed)
    .map(({ dismissed, dismissedAt, dismissedById, dismissReason, communicationId, ...trigger }) => trigger);
}

/**
 * Dismiss a trigger
 */
export async function dismissTrigger(
  assessmentId: string,
  ruleId: string,
  userId: string,
  reason: string
): Promise<void> {
  // Get trigger type and urgency for the rule
  const rule = ALL_COMMUNICATION_RULES.find(r => r.rule.id === ruleId);
  if (!rule) {
    throw new Error(`Rule not found: ${ruleId}`);
  }

  await prisma.communicationTrigger.upsert({
    where: {
      assessmentId_ruleId: {
        assessmentId,
        ruleId,
      },
    },
    create: {
      assessmentId,
      ruleId,
      triggerType: rule.rule.type,
      urgency: rule.rule.urgency,
      triggerData: {},
      dismissed: true,
      dismissedAt: new Date(),
      dismissedById: userId,
      dismissReason: reason,
    },
    update: {
      dismissed: true,
      dismissedAt: new Date(),
      dismissedById: userId,
      dismissReason: reason,
    },
  });
}

/**
 * Get summary of triggers by type and urgency
 */
export async function getTriggerSummary(
  assessmentId: string
): Promise<{
  total: number;
  active: number;
  dismissed: number;
  byType: Record<CommunicationType, number>;
  byUrgency: Record<CommunicationUrgency, number>;
  emergent: CommunicationTriggerResult[];
}> {
  const triggersWithStatus = await getTriggersWithDismissalStatus(assessmentId);

  const byType: Record<CommunicationType, number> = {
    CHANGE_IN_CONDITION: 0,
    REQUEST_NEW_ORDERS: 0,
    REFERRAL_REQUEST: 0,
    HOSPITALIZATION_NOTIFICATION: 0,
    ABNORMAL_FINDING: 0,
    POC_UPDATE_REQUEST: 0,
    RECERTIFICATION_SUMMARY: 0,
    DISCHARGE_RECOMMENDATION: 0,
  };

  const byUrgency: Record<CommunicationUrgency, number> = {
    ROUTINE: 0,
    URGENT: 0,
    EMERGENT: 0,
  };

  const emergent: CommunicationTriggerResult[] = [];
  let active = 0;
  let dismissed = 0;

  for (const trigger of triggersWithStatus) {
    if (trigger.dismissed) {
      dismissed++;
    } else {
      active++;
      byType[trigger.type]++;
      byUrgency[trigger.urgency]++;

      if (trigger.urgency === 'EMERGENT') {
        emergent.push(trigger);
      }
    }
  }

  return {
    total: triggersWithStatus.length,
    active,
    dismissed,
    byType,
    byUrgency,
    emergent,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  detectTriggersForQuestion,
  detectAllTriggers,
  getTriggersWithDismissalStatus,
  getActiveTriggers,
  dismissTrigger,
  getTriggerSummary,
};
