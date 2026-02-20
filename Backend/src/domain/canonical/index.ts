/**
 * Canonical Domain Module
 *
 * EMR-agnostic data models and form engine.
 */

// Types
export * from './types';

// Question Bank
export {
  CANONICAL_SECTIONS,
  getSectionsForVisit,
  getQuestionByConceptId,
  getQuestionsByPrefix,
  YES_NO_OPTIONS,
  YES_NO_NA_OPTIONS,
  PAIN_SCALE_OPTIONS,
  FUNCTIONAL_SCORE_OPTIONS,
  ADHERENCE_OPTIONS,
  WOUND_HEALING_OPTIONS,
  GOAL_STATUS_OPTIONS,
  INTERVENTION_RESPONSE_OPTIONS,
  PATIENT_TOLERANCE_OPTIONS,
  EDUCATION_RESPONSE_OPTIONS,
} from './questionBank';

// Form Definitions
export {
  FORM_DEFINITIONS,
  getFormDefinition,
  requiresOasis,
  getOasisMappedQuestions,
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
} from './formDefinitions';

// Form Engine
export {
  buildForm,
  validateVisitNote,
  getNextIncompleteSection,
  getUnansweredRequired,
  extractOasisResponses,
} from './formEngine.service';

export type { BuiltForm, BuiltSection, BuiltQuestion, FormValidationState } from './formEngine.service';
