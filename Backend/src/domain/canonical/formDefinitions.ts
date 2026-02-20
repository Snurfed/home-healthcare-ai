/**
 * Canonical Form Definitions
 *
 * Pre-configured form definitions for each discipline × visit type combination.
 * These define which sections appear, in what order, with what rules.
 */

import type {
  CanonicalFormDefinition,
  CanonicalFormSection,
  ModuleToggle,
  Discipline,
  VisitType,
} from './types';
import { CANONICAL_SECTIONS } from './questionBank';

// =============================================================================
// MODULE TOGGLES
// =============================================================================

const WOUND_MODULE: ModuleToggle = {
  id: 'wound_module',
  name: 'Wound Care',
  description: 'Enable wound assessment and documentation',
  icon: 'bandage',
  defaultActive: false,
  activatedBy: [
    { field: 'wound.present', operator: 'equals', value: true },
  ],
};

const IV_MODULE: ModuleToggle = {
  id: 'iv_module',
  name: 'IV Therapy',
  description: 'Enable IV access and infusion documentation',
  icon: 'syringe',
  defaultActive: false,
};

const CATHETER_MODULE: ModuleToggle = {
  id: 'catheter_module',
  name: 'Catheter Care',
  description: 'Enable catheter assessment and care documentation',
  icon: 'tube',
  defaultActive: false,
};

const OSTOMY_MODULE: ModuleToggle = {
  id: 'ostomy_module',
  name: 'Ostomy Care',
  description: 'Enable ostomy assessment and care documentation',
  icon: 'pouch',
  defaultActive: false,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function buildFormSection(
  sectionId: string,
  overrides: Partial<CanonicalFormSection> = {}
): CanonicalFormSection {
  const section = CANONICAL_SECTIONS[sectionId];
  if (!section) {
    throw new Error(`Section ${sectionId} not found in question bank`);
  }

  return {
    id: `form_section_${sectionId}`,
    sectionId: section.sectionId,
    name: section.name,
    description: section.description,
    required: overrides.required ?? true,
    collapsed: overrides.collapsed ?? false,
    aiDraftEnabled: overrides.aiDraftEnabled ?? section.questions.some(q => q.aiDraftEnabled),
    questions: section.questions,
    visibilityRules: overrides.visibilityRules,
    ...overrides,
  };
}

function createFormDefinition(
  id: string,
  discipline: Discipline,
  visitType: VisitType,
  name: string,
  sections: CanonicalFormSection[],
  moduleToggles?: ModuleToggle[]
): CanonicalFormDefinition {
  const now = new Date().toISOString();
  return {
    id,
    discipline,
    visitType,
    version: '1.0.0',
    name,
    sections,
    moduleToggles,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    status: 'published',
  };
}

// =============================================================================
// RN FORM DEFINITIONS
// =============================================================================

export const RN_SOC_FORM: CanonicalFormDefinition = createFormDefinition(
  'rn_soc_v1',
  'RN',
  'SOC',
  'RN Start of Care Assessment',
  [
    buildFormSection('admin', { collapsed: false }),
    buildFormSection('vitals', { required: true }),
    buildFormSection('rn_subjective', { required: true, aiDraftEnabled: true }),
    buildFormSection('rn_objective', { required: true }),
    buildFormSection('rn_medications', { required: true }),
    buildFormSection('wound_care', {
      required: false,
      visibilityRules: [{
        type: 'show_when',
        conditions: [{ field: '_module', operator: 'module_active', value: 'wound_module' }],
        operator: 'AND',
      }],
    }),
    buildFormSection('rn_assessment_plan', { required: true, aiDraftEnabled: true }),
    buildFormSection('interventions', { required: true }),
    buildFormSection('education', { required: true }),
    buildFormSection('signatures', { required: true }),
  ],
  [WOUND_MODULE, IV_MODULE, CATHETER_MODULE, OSTOMY_MODULE]
);

export const RN_ROC_FORM: CanonicalFormDefinition = createFormDefinition(
  'rn_roc_v1',
  'RN',
  'ROC',
  'RN Resumption of Care Assessment',
  [
    buildFormSection('admin', { collapsed: false }),
    buildFormSection('vitals', { required: true }),
    buildFormSection('rn_subjective', { required: true, aiDraftEnabled: true }),
    buildFormSection('rn_objective', { required: true }),
    buildFormSection('rn_medications', { required: true }),
    buildFormSection('wound_care', {
      required: false,
      visibilityRules: [{
        type: 'show_when',
        conditions: [{ field: '_module', operator: 'module_active', value: 'wound_module' }],
        operator: 'AND',
      }],
    }),
    buildFormSection('rn_assessment_plan', { required: true, aiDraftEnabled: true }),
    buildFormSection('interventions', { required: true }),
    buildFormSection('education', { required: true }),
    buildFormSection('signatures', { required: true }),
  ],
  [WOUND_MODULE, IV_MODULE, CATHETER_MODULE, OSTOMY_MODULE]
);

export const RN_RECERT_FORM: CanonicalFormDefinition = createFormDefinition(
  'rn_recert_v1',
  'RN',
  'RECERT',
  'RN Recertification Assessment',
  [
    buildFormSection('admin', { collapsed: false }),
    buildFormSection('vitals', { required: true }),
    buildFormSection('rn_subjective', { required: true, aiDraftEnabled: true }),
    buildFormSection('rn_objective', { required: true }),
    buildFormSection('rn_medications', { required: true }),
    buildFormSection('wound_care', {
      required: false,
      visibilityRules: [{
        type: 'show_when',
        conditions: [{ field: '_module', operator: 'module_active', value: 'wound_module' }],
        operator: 'AND',
      }],
    }),
    buildFormSection('goals', { required: true }),
    buildFormSection('rn_assessment_plan', { required: true, aiDraftEnabled: true }),
    buildFormSection('interventions', { required: true }),
    buildFormSection('education', { required: true }),
    buildFormSection('signatures', { required: true }),
  ],
  [WOUND_MODULE, IV_MODULE, CATHETER_MODULE, OSTOMY_MODULE]
);

export const RN_FOLLOWUP_FORM: CanonicalFormDefinition = createFormDefinition(
  'rn_followup_v1',
  'RN',
  'FOLLOWUP',
  'RN Follow-up Visit',
  [
    buildFormSection('admin', { collapsed: false }),
    buildFormSection('vitals', { required: true }),
    buildFormSection('rn_subjective', {
      required: true,
      aiDraftEnabled: true,
      // Follow-up has simplified subjective - filter to key questions
      questions: CANONICAL_SECTIONS['rn_subjective']!.questions.filter(q =>
        ['rn.subjective.patient_report', 'rn.subjective.symptoms_today', 'rn.subjective.since_last_visit', 'rn.subjective.er_hospitalization'].includes(q.conceptId)
      ),
    }),
    buildFormSection('rn_objective', {
      required: true,
      // Follow-up may have abbreviated objective
      questions: CANONICAL_SECTIONS['rn_objective']!.questions.filter(q =>
        ['rn.objective.general_appearance', 'rn.objective.skin_assessment', 'rn.objective.respiratory', 'rn.objective.cardiac', 'rn.objective.narrative'].includes(q.conceptId) ||
        q.conceptId.includes('edema')
      ),
    }),
    buildFormSection('wound_care', {
      required: false,
      visibilityRules: [{
        type: 'show_when',
        conditions: [{ field: '_module', operator: 'module_active', value: 'wound_module' }],
        operator: 'AND',
      }],
    }),
    buildFormSection('goals', { required: true }),
    buildFormSection('interventions', { required: true }),
    buildFormSection('education', { required: false }),
    buildFormSection('rn_assessment_plan', {
      required: true,
      aiDraftEnabled: true,
      // Follow-up plan is more focused
      questions: CANONICAL_SECTIONS['rn_assessment_plan']!.questions.filter(q =>
        ['rn.assessment.clinical', 'rn.assessment.progress_toward_goals', 'rn.plan.narrative', 'rn.plan.physician_notification', 'rn.plan.physician_notification_reason'].includes(q.conceptId)
      ),
    }),
    buildFormSection('signatures', { required: true }),
  ],
  [WOUND_MODULE]
);

export const RN_DISCHARGE_FORM: CanonicalFormDefinition = createFormDefinition(
  'rn_discharge_v1',
  'RN',
  'DISCHARGE',
  'RN Discharge Summary',
  [
    buildFormSection('admin', { collapsed: false }),
    buildFormSection('vitals', { required: true }),
    buildFormSection('rn_subjective', { required: true, aiDraftEnabled: true }),
    buildFormSection('rn_objective', { required: true }),
    buildFormSection('rn_medications', { required: true }),
    buildFormSection('wound_care', {
      required: false,
      visibilityRules: [{
        type: 'show_when',
        conditions: [{ field: '_module', operator: 'module_active', value: 'wound_module' }],
        operator: 'AND',
      }],
    }),
    buildFormSection('goals', { required: true }),
    buildFormSection('discharge', { required: true, aiDraftEnabled: true }),
    buildFormSection('interventions', { required: true }),
    buildFormSection('education', { required: true }),
    buildFormSection('signatures', { required: true }),
  ],
  [WOUND_MODULE]
);

// =============================================================================
// PT FORM DEFINITIONS
// =============================================================================

export const PT_SOC_FORM: CanonicalFormDefinition = createFormDefinition(
  'pt_soc_v1',
  'PT',
  'SOC',
  'PT Start of Care Evaluation',
  [
    buildFormSection('admin', { collapsed: false }),
    buildFormSection('vitals', { required: true }),
    buildFormSection('pt_subjective', { required: true, aiDraftEnabled: true }),
    buildFormSection('pt_objective', { required: true }),
    buildFormSection('pt_functional', { required: true }),
    buildFormSection('pt_assessment_plan', { required: true, aiDraftEnabled: true }),
    buildFormSection('interventions', { required: true }),
    buildFormSection('education', { required: true }),
    buildFormSection('signatures', { required: true }),
  ]
);

export const PT_ROC_FORM: CanonicalFormDefinition = createFormDefinition(
  'pt_roc_v1',
  'PT',
  'ROC',
  'PT Resumption of Care Evaluation',
  [
    buildFormSection('admin', { collapsed: false }),
    buildFormSection('vitals', { required: true }),
    buildFormSection('pt_subjective', { required: true, aiDraftEnabled: true }),
    buildFormSection('pt_objective', { required: true }),
    buildFormSection('pt_functional', { required: true }),
    buildFormSection('pt_assessment_plan', { required: true, aiDraftEnabled: true }),
    buildFormSection('interventions', { required: true }),
    buildFormSection('education', { required: true }),
    buildFormSection('signatures', { required: true }),
  ]
);

export const PT_RECERT_FORM: CanonicalFormDefinition = createFormDefinition(
  'pt_recert_v1',
  'PT',
  'RECERT',
  'PT Recertification Assessment',
  [
    buildFormSection('admin', { collapsed: false }),
    buildFormSection('vitals', { required: true }),
    buildFormSection('pt_subjective', { required: true, aiDraftEnabled: true }),
    buildFormSection('pt_objective', { required: true }),
    buildFormSection('pt_functional', { required: true }),
    buildFormSection('goals', { required: true }),
    buildFormSection('pt_assessment_plan', { required: true, aiDraftEnabled: true }),
    buildFormSection('interventions', { required: true }),
    buildFormSection('education', { required: true }),
    buildFormSection('signatures', { required: true }),
  ]
);

export const PT_FOLLOWUP_FORM: CanonicalFormDefinition = createFormDefinition(
  'pt_followup_v1',
  'PT',
  'FOLLOWUP',
  'PT Follow-up Visit',
  [
    buildFormSection('admin', { collapsed: false }),
    buildFormSection('vitals', { required: true }),
    buildFormSection('pt_subjective', {
      required: true,
      aiDraftEnabled: true,
      // Follow-up has focused subjective
      questions: CANONICAL_SECTIONS['pt_subjective']!.questions.filter(q =>
        ['pt.subjective.chief_complaint', 'pt.subjective.current_complaints', 'pt.subjective.falls_history', 'pt.subjective.fall_details'].includes(q.conceptId)
      ),
    }),
    buildFormSection('pt_objective', {
      required: true,
      // Focus on key PT metrics for follow-up
      questions: CANONICAL_SECTIONS['pt_objective']!.questions.filter(q =>
        ['pt.objective.rom_upper_extremity', 'pt.objective.rom_lower_extremity', 'pt.objective.strength_upper_extremity', 'pt.objective.strength_lower_extremity', 'pt.objective.balance_standing', 'pt.objective.gait_assessment', 'pt.objective.assistive_device'].includes(q.conceptId)
      ),
    }),
    // No full functional assessment on follow-up - just document interventions
    buildFormSection('goals', { required: true }),
    buildFormSection('interventions', { required: true }),
    buildFormSection('pt_assessment_plan', {
      required: true,
      aiDraftEnabled: true,
      questions: CANONICAL_SECTIONS['pt_assessment_plan']!.questions.filter(q =>
        ['pt.assessment.clinical', 'pt.assessment.progress_toward_goals', 'pt.plan.treatment', 'pt.plan.hep_provided', 'pt.plan.hep_details'].includes(q.conceptId)
      ),
    }),
    buildFormSection('education', { required: false }),
    buildFormSection('signatures', { required: true }),
  ]
);

export const PT_EVAL_FORM: CanonicalFormDefinition = createFormDefinition(
  'pt_eval_v1',
  'PT',
  'EVAL',
  'PT Evaluation Only',
  [
    buildFormSection('admin', { collapsed: false }),
    buildFormSection('vitals', { required: true }),
    buildFormSection('pt_subjective', { required: true, aiDraftEnabled: true }),
    buildFormSection('pt_objective', { required: true }),
    buildFormSection('pt_functional', { required: true }),
    buildFormSection('pt_assessment_plan', { required: true, aiDraftEnabled: true }),
    buildFormSection('signatures', { required: true }),
  ]
);

export const PT_DISCHARGE_FORM: CanonicalFormDefinition = createFormDefinition(
  'pt_discharge_v1',
  'PT',
  'DISCHARGE',
  'PT Discharge Summary',
  [
    buildFormSection('admin', { collapsed: false }),
    buildFormSection('vitals', { required: true }),
    buildFormSection('pt_subjective', { required: true, aiDraftEnabled: true }),
    buildFormSection('pt_objective', { required: true }),
    buildFormSection('pt_functional', { required: true }),
    buildFormSection('goals', { required: true }),
    buildFormSection('discharge', { required: true, aiDraftEnabled: true }),
    buildFormSection('pt_assessment_plan', {
      required: true,
      aiDraftEnabled: true,
      questions: CANONICAL_SECTIONS['pt_assessment_plan']!.questions.filter(q =>
        ['pt.assessment.clinical', 'pt.assessment.rehab_potential', 'pt.plan.hep_provided', 'pt.plan.hep_details', 'pt.plan.dme_recommendations'].includes(q.conceptId)
      ),
    }),
    buildFormSection('education', { required: true }),
    buildFormSection('signatures', { required: true }),
  ]
);

// =============================================================================
// FORM REGISTRY
// =============================================================================

export const FORM_DEFINITIONS: Record<string, CanonicalFormDefinition> = {
  // RN Forms
  'RN_SOC': RN_SOC_FORM,
  'RN_ROC': RN_ROC_FORM,
  'RN_RECERT': RN_RECERT_FORM,
  'RN_FOLLOWUP': RN_FOLLOWUP_FORM,
  'RN_DISCHARGE': RN_DISCHARGE_FORM,
  // PT Forms
  'PT_SOC': PT_SOC_FORM,
  'PT_ROC': PT_ROC_FORM,
  'PT_RECERT': PT_RECERT_FORM,
  'PT_FOLLOWUP': PT_FOLLOWUP_FORM,
  'PT_EVAL': PT_EVAL_FORM,
  'PT_DISCHARGE': PT_DISCHARGE_FORM,
};

/**
 * Get form definition for a discipline and visit type
 */
export function getFormDefinition(
  discipline: Discipline,
  visitType: VisitType
): CanonicalFormDefinition | undefined {
  const key = `${discipline}_${visitType}`;
  return FORM_DEFINITIONS[key];
}

/**
 * Check if a visit type requires OASIS assessment
 */
export function requiresOasis(visitType: VisitType): boolean {
  return ['SOC', 'ROC', 'RECERT', 'DISCHARGE'].includes(visitType);
}

/**
 * Get OASIS-mapped questions from a form definition
 */
export function getOasisMappedQuestions(formDef: CanonicalFormDefinition): Array<{
  conceptId: string;
  oasisItemCode: string;
  label: string;
}> {
  const mapped: Array<{ conceptId: string; oasisItemCode: string; label: string }> = [];

  formDef.sections.forEach(section => {
    section.questions.forEach(q => {
      if (q.oasisItemCode) {
        mapped.push({
          conceptId: q.conceptId,
          oasisItemCode: q.oasisItemCode,
          label: q.label,
        });
      }
    });
  });

  return mapped;
}

export default {
  FORM_DEFINITIONS,
  getFormDefinition,
  requiresOasis,
  getOasisMappedQuestions,
  // Export individual forms
  RN_SOC_FORM,
  RN_ROC_FORM,
  RN_RECERT_FORM,
  RN_FOLLOWUP_FORM,
  RN_DISCHARGE_FORM,
  PT_SOC_FORM,
  PT_ROC_FORM,
  PT_RECERT_FORM,
  PT_FOLLOWUP_FORM,
  PT_EVAL_FORM,
  PT_DISCHARGE_FORM,
};
