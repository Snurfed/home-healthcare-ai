/**
 * Visit Form Configuration
 *
 * Frontend copy of discipline × visit type configuration matrix.
 * This mirrors the backend constants for client-side form rendering.
 */

// Re-export types from visitNote.types for convenience
export type {
  Discipline,
  VisitPurpose,
  ResponseType,
  VisitFormQuestion,
  VisitFormSection,
  VisitFormConfig,
} from '../types/visitNote.types';

import type {
  Discipline,
  VisitPurpose,
  VisitFormConfig,
  VisitFormSection,
  VisitFormQuestion,
} from '../types/visitNote.types';

// =============================================================================
// LABELS
// =============================================================================

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  RN: 'Registered Nurse',
  LVN: 'Licensed Vocational Nurse',
  PT: 'Physical Therapist',
  OT: 'Occupational Therapist',
  SLP: 'Speech Language Pathologist',
  MSW: 'Medical Social Worker',
  HHA: 'Home Health Aide',
};

export const VISIT_PURPOSE_LABELS: Record<VisitPurpose, string> = {
  SOC: 'Start of Care',
  ROC: 'Resumption of Care',
  RECERT: 'Recertification',
  FOLLOWUP: 'Follow-up Visit',
  DISCHARGE: 'Discharge',
  EVALUATION: 'Evaluation',
};

// =============================================================================
// COMMON SECTIONS
// =============================================================================

const ADMIN_SECTION: VisitFormSection = {
  id: 'admin',
  name: 'Administrative',
  description: 'Visit details and patient verification',
  required: true,
  questions: [
    {
      id: 'visit_date',
      code: 'ADMIN_DATE',
      label: 'Visit Date',
      responseType: 'date',
      required: true,
    },
    {
      id: 'visit_time_in',
      code: 'ADMIN_TIME_IN',
      label: 'Time In',
      responseType: 'time',
      required: true,
    },
    {
      id: 'visit_time_out',
      code: 'ADMIN_TIME_OUT',
      label: 'Time Out',
      responseType: 'time',
      required: true,
    },
    {
      id: 'patient_verified',
      code: 'ADMIN_VERIFIED',
      label: 'Patient identity verified',
      responseType: 'checkbox',
      required: true,
    },
    {
      id: 'visit_location',
      code: 'ADMIN_LOCATION',
      label: 'Visit Location',
      responseType: 'single_select',
      required: true,
      options: [
        { code: 'home', label: 'Patient Home' },
        { code: 'assisted_living', label: 'Assisted Living Facility' },
        { code: 'board_care', label: 'Board and Care' },
        { code: 'snf', label: 'Skilled Nursing Facility' },
        { code: 'other', label: 'Other' },
      ],
    },
  ],
};

const VITALS_SECTION: VisitFormSection = {
  id: 'vitals',
  name: 'Vital Signs',
  description: 'Current vital sign measurements',
  required: true,
  questions: [
    {
      id: 'vitals_entry',
      code: 'VITALS',
      label: 'Vital Signs',
      responseType: 'vitals',
      required: true,
      helpText: 'Record all applicable vital signs',
    },
    {
      id: 'vitals_position',
      code: 'VITALS_POSITION',
      label: 'Position for BP/HR',
      responseType: 'single_select',
      required: false,
      options: [
        { code: 'sitting', label: 'Sitting' },
        { code: 'standing', label: 'Standing' },
        { code: 'supine', label: 'Supine' },
      ],
    },
    {
      id: 'vitals_orthostatic',
      code: 'VITALS_ORTHOSTATIC',
      label: 'Orthostatic vital signs obtained',
      responseType: 'checkbox',
      required: false,
    },
  ],
};

const SIGNATURE_SECTION: VisitFormSection = {
  id: 'signatures',
  name: 'Signatures',
  description: 'Required signatures for visit completion',
  required: true,
  questions: [
    {
      id: 'clinician_signature',
      code: 'SIG_CLINICIAN',
      label: 'Clinician Signature',
      responseType: 'signature',
      required: true,
    },
    {
      id: 'patient_signature',
      code: 'SIG_PATIENT',
      label: 'Patient/Caregiver Signature',
      responseType: 'signature',
      required: false,
      helpText: 'Patient signature acknowledging visit and education provided',
    },
  ],
};

// =============================================================================
// NURSING SECTIONS
// =============================================================================

const NURSING_SUBJECTIVE_SECTION: VisitFormSection = {
  id: 'subjective',
  name: 'Subjective',
  description: 'Patient-reported symptoms and concerns',
  required: true,
  aiDraftEnabled: true,
  questions: [
    {
      id: 'chief_complaint',
      code: 'SUBJ_CHIEF',
      label: 'Chief Complaint / Reason for Visit',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
      placeholder: 'Patient states...',
    },
    {
      id: 'pain_assessment',
      code: 'SUBJ_PAIN',
      label: 'Pain Assessment',
      responseType: 'pain_scale',
      required: true,
      oasisMapping: 'J0400',
    },
    {
      id: 'symptom_changes',
      code: 'SUBJ_SYMPTOMS',
      label: 'Symptom Changes Since Last Visit',
      responseType: 'text',
      required: false,
      aiDraftEnabled: true,
    },
    {
      id: 'medication_compliance',
      code: 'SUBJ_MED_COMPLIANCE',
      label: 'Medication Compliance',
      responseType: 'single_select',
      required: true,
      options: [
        { code: 'compliant', label: 'Compliant' },
        { code: 'partial', label: 'Partially Compliant' },
        { code: 'non_compliant', label: 'Non-Compliant' },
        { code: 'unable', label: 'Unable to Assess' },
      ],
    },
    {
      id: 'compliance_barriers',
      code: 'SUBJ_BARRIERS',
      label: 'Barriers to Compliance',
      responseType: 'text',
      required: false,
      conditionalDisplay: {
        dependsOn: 'SUBJ_MED_COMPLIANCE',
        showWhen: ['partial', 'non_compliant'],
      },
    },
  ],
};

const NURSING_OBJECTIVE_SECTION: VisitFormSection = {
  id: 'objective',
  name: 'Objective',
  description: 'Clinical findings and observations',
  required: true,
  aiDraftEnabled: true,
  questions: [
    {
      id: 'general_appearance',
      code: 'OBJ_APPEARANCE',
      label: 'General Appearance',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
      placeholder: 'Alert, oriented, comfortable/distressed...',
    },
    {
      id: 'neuro_status',
      code: 'OBJ_NEURO',
      label: 'Neurological Status',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
      oasisMapping: 'M1700',
    },
    {
      id: 'cardiovascular',
      code: 'OBJ_CARDIAC',
      label: 'Cardiovascular',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'respiratory',
      code: 'OBJ_RESP',
      label: 'Respiratory',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'integumentary',
      code: 'OBJ_SKIN',
      label: 'Integumentary/Skin',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'wound_assessment',
      code: 'OBJ_WOUND',
      label: 'Wound Assessment',
      responseType: 'wound_assessment',
      required: false,
      oasisMapping: 'M1340',
    },
    {
      id: 'gi_status',
      code: 'OBJ_GI',
      label: 'Gastrointestinal',
      responseType: 'text',
      required: false,
      aiDraftEnabled: true,
    },
    {
      id: 'gu_status',
      code: 'OBJ_GU',
      label: 'Genitourinary',
      responseType: 'text',
      required: false,
      aiDraftEnabled: true,
    },
    {
      id: 'musculoskeletal',
      code: 'OBJ_MSK',
      label: 'Musculoskeletal',
      responseType: 'text',
      required: false,
      aiDraftEnabled: true,
    },
  ],
};

const NURSING_ASSESSMENT_PLAN_SECTION: VisitFormSection = {
  id: 'assessment_plan',
  name: 'Assessment & Plan',
  description: 'Clinical assessment and care plan',
  required: true,
  aiDraftEnabled: true,
  questions: [
    {
      id: 'clinical_assessment',
      code: 'ASSESS_CLINICAL',
      label: 'Clinical Assessment',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
      placeholder: 'Based on findings, patient is...',
    },
    {
      id: 'goals_progress',
      code: 'ASSESS_GOALS',
      label: 'Progress Toward Goals',
      responseType: 'single_select',
      required: true,
      options: [
        { code: 'met', label: 'Goals Met' },
        { code: 'progressing', label: 'Progressing Toward Goals' },
        { code: 'unchanged', label: 'No Change' },
        { code: 'declined', label: 'Declined' },
        { code: 'revised', label: 'Goals Revised' },
      ],
    },
    {
      id: 'plan_of_care',
      code: 'ASSESS_POC',
      label: 'Plan of Care',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'interventions',
      code: 'ASSESS_INTERVENTIONS',
      label: 'Interventions Performed',
      responseType: 'multi_select',
      required: true,
      options: [
        { code: 'assessment', label: 'Skilled Assessment' },
        { code: 'teaching', label: 'Patient/Caregiver Teaching' },
        { code: 'wound_care', label: 'Wound Care' },
        { code: 'medication_mgmt', label: 'Medication Management' },
        { code: 'iv_therapy', label: 'IV Therapy' },
        { code: 'catheter_care', label: 'Catheter Care' },
        { code: 'coordination', label: 'Care Coordination' },
        { code: 'other', label: 'Other' },
      ],
    },
    {
      id: 'teaching_topics',
      code: 'ASSESS_TEACHING',
      label: 'Teaching Topics',
      responseType: 'text',
      required: false,
      conditionalDisplay: {
        dependsOn: 'ASSESS_INTERVENTIONS',
        showWhen: ['teaching'],
      },
    },
    {
      id: 'next_visit',
      code: 'ASSESS_NEXT',
      label: 'Next Visit Planned',
      responseType: 'date',
      required: false,
    },
  ],
};

const NURSING_MEDICATIONS_SECTION: VisitFormSection = {
  id: 'medications',
  name: 'Medication Review',
  description: 'Current medication assessment',
  required: true,
  questions: [
    {
      id: 'medication_list',
      code: 'MED_LIST',
      label: 'Current Medications',
      responseType: 'medication_list',
      required: true,
      oasisMapping: 'N0415',
    },
    {
      id: 'medication_changes',
      code: 'MED_CHANGES',
      label: 'Medication Changes',
      responseType: 'text',
      required: false,
    },
    {
      id: 'high_risk_meds',
      code: 'MED_HIGH_RISK',
      label: 'High-Risk Medications Reconciled',
      responseType: 'checkbox',
      required: true,
    },
  ],
};

// =============================================================================
// THERAPY SECTIONS
// =============================================================================

const PT_EVALUATION_SECTION: VisitFormSection = {
  id: 'pt_evaluation',
  name: 'Physical Therapy Evaluation',
  description: 'Comprehensive PT assessment',
  required: true,
  aiDraftEnabled: true,
  questions: [
    {
      id: 'pt_history',
      code: 'PT_HISTORY',
      label: 'Relevant Medical/Surgical History',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'prior_function',
      code: 'PT_PRIOR_FUNCTION',
      label: 'Prior Level of Function',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'current_mobility',
      code: 'PT_CURRENT_MOBILITY',
      label: 'Current Mobility Status',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
      oasisMapping: 'GG0170',
    },
    {
      id: 'balance_assessment',
      code: 'PT_BALANCE',
      label: 'Balance Assessment',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'fall_risk',
      code: 'PT_FALL_RISK',
      label: 'Fall Risk Assessment',
      responseType: 'single_select',
      required: true,
      oasisMapping: 'J1800',
      options: [
        { code: 'low', label: 'Low Risk' },
        { code: 'moderate', label: 'Moderate Risk' },
        { code: 'high', label: 'High Risk' },
      ],
    },
    {
      id: 'rom_assessment',
      code: 'PT_ROM',
      label: 'Range of Motion Assessment',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'strength_assessment',
      code: 'PT_STRENGTH',
      label: 'Strength Assessment',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'gait_analysis',
      code: 'PT_GAIT',
      label: 'Gait Analysis',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'assistive_devices',
      code: 'PT_DEVICES',
      label: 'Assistive Devices',
      responseType: 'multi_select',
      required: false,
      options: [
        { code: 'cane', label: 'Cane' },
        { code: 'walker', label: 'Walker' },
        { code: 'rollator', label: 'Rollator' },
        { code: 'wheelchair', label: 'Wheelchair' },
        { code: 'crutches', label: 'Crutches' },
        { code: 'none', label: 'None' },
      ],
    },
  ],
};

const PT_TREATMENT_PLAN_SECTION: VisitFormSection = {
  id: 'pt_treatment',
  name: 'Treatment Plan',
  description: 'PT goals and treatment plan',
  required: true,
  aiDraftEnabled: true,
  questions: [
    {
      id: 'pt_diagnosis',
      code: 'PT_DIAGNOSIS',
      label: 'Physical Therapy Diagnosis',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'pt_goals_stg',
      code: 'PT_GOALS_STG',
      label: 'Short-Term Goals (2 weeks)',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'pt_goals_ltg',
      code: 'PT_GOALS_LTG',
      label: 'Long-Term Goals (60 days)',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'pt_interventions',
      code: 'PT_INTERVENTIONS',
      label: 'Planned Interventions',
      responseType: 'multi_select',
      required: true,
      options: [
        { code: 'therapeutic_exercise', label: 'Therapeutic Exercise' },
        { code: 'gait_training', label: 'Gait Training' },
        { code: 'balance_training', label: 'Balance Training' },
        { code: 'transfer_training', label: 'Transfer Training' },
        { code: 'manual_therapy', label: 'Manual Therapy' },
        { code: 'modalities', label: 'Modalities' },
        { code: 'hep', label: 'Home Exercise Program' },
        { code: 'patient_education', label: 'Patient/Caregiver Education' },
      ],
    },
    {
      id: 'pt_frequency',
      code: 'PT_FREQUENCY',
      label: 'Recommended Frequency',
      responseType: 'text',
      required: true,
      placeholder: 'e.g., 2-3x/week for 4 weeks',
    },
    {
      id: 'pt_prognosis',
      code: 'PT_PROGNOSIS',
      label: 'Rehabilitation Prognosis',
      responseType: 'single_select',
      required: true,
      options: [
        { code: 'excellent', label: 'Excellent' },
        { code: 'good', label: 'Good' },
        { code: 'fair', label: 'Fair' },
        { code: 'guarded', label: 'Guarded' },
        { code: 'poor', label: 'Poor' },
      ],
    },
  ],
};

const PT_PROGRESS_SECTION: VisitFormSection = {
  id: 'pt_progress',
  name: 'Treatment & Progress',
  description: 'Treatment provided and patient progress',
  required: true,
  aiDraftEnabled: true,
  questions: [
    {
      id: 'pt_treatment_today',
      code: 'PT_TX_TODAY',
      label: 'Treatment Provided Today',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'pt_patient_response',
      code: 'PT_RESPONSE',
      label: 'Patient Response to Treatment',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'pt_goal_progress',
      code: 'PT_GOAL_PROGRESS',
      label: 'Progress Toward Goals',
      responseType: 'single_select',
      required: true,
      options: [
        { code: 'met', label: 'Goals Met' },
        { code: 'progressing', label: 'Progressing' },
        { code: 'plateau', label: 'Plateau' },
        { code: 'regression', label: 'Regression' },
      ],
    },
    {
      id: 'pt_hep_compliance',
      code: 'PT_HEP_COMPLIANCE',
      label: 'HEP Compliance',
      responseType: 'single_select',
      required: false,
      options: [
        { code: 'independent', label: 'Independent' },
        { code: 'supervision', label: 'Requires Supervision' },
        { code: 'non_compliant', label: 'Non-Compliant' },
        { code: 'not_applicable', label: 'N/A' },
      ],
    },
    {
      id: 'pt_plan',
      code: 'PT_PLAN',
      label: 'Plan for Next Visit',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
  ],
};

const OT_EVALUATION_SECTION: VisitFormSection = {
  id: 'ot_evaluation',
  name: 'Occupational Therapy Evaluation',
  description: 'Comprehensive OT assessment',
  required: true,
  aiDraftEnabled: true,
  questions: [
    {
      id: 'ot_history',
      code: 'OT_HISTORY',
      label: 'Relevant Medical/Surgical History',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'ot_prior_adl',
      code: 'OT_PRIOR_ADL',
      label: 'Prior Level of ADL Function',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'ot_current_adl',
      code: 'OT_CURRENT_ADL',
      label: 'Current ADL Status',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
      oasisMapping: 'GG0130',
    },
    {
      id: 'ot_ue_function',
      code: 'OT_UE_FUNCTION',
      label: 'Upper Extremity Function',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'ot_fine_motor',
      code: 'OT_FINE_MOTOR',
      label: 'Fine Motor Assessment',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'ot_cognitive_screen',
      code: 'OT_COGNITIVE',
      label: 'Cognitive Screening',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
      oasisMapping: 'C0500',
    },
    {
      id: 'ot_safety_assessment',
      code: 'OT_SAFETY',
      label: 'Home Safety Assessment',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'ot_adaptive_equipment',
      code: 'OT_EQUIPMENT',
      label: 'Adaptive Equipment Needs',
      responseType: 'multi_select',
      required: false,
      options: [
        { code: 'reacher', label: 'Reacher' },
        { code: 'sock_aid', label: 'Sock Aid' },
        { code: 'long_shoehorn', label: 'Long Shoehorn' },
        { code: 'tub_bench', label: 'Tub Bench/Shower Chair' },
        { code: 'grab_bars', label: 'Grab Bars' },
        { code: 'raised_toilet', label: 'Raised Toilet Seat' },
        { code: 'button_hook', label: 'Button Hook' },
        { code: 'built_up_utensils', label: 'Built-Up Utensils' },
      ],
    },
  ],
};

const OT_TREATMENT_PLAN_SECTION: VisitFormSection = {
  id: 'ot_treatment',
  name: 'Treatment Plan',
  description: 'OT goals and treatment plan',
  required: true,
  aiDraftEnabled: true,
  questions: [
    {
      id: 'ot_diagnosis',
      code: 'OT_DIAGNOSIS',
      label: 'Occupational Therapy Diagnosis',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'ot_goals_stg',
      code: 'OT_GOALS_STG',
      label: 'Short-Term Goals (2 weeks)',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'ot_goals_ltg',
      code: 'OT_GOALS_LTG',
      label: 'Long-Term Goals (60 days)',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'ot_interventions',
      code: 'OT_INTERVENTIONS',
      label: 'Planned Interventions',
      responseType: 'multi_select',
      required: true,
      options: [
        { code: 'adl_training', label: 'ADL Training' },
        { code: 'iadl_training', label: 'IADL Training' },
        { code: 'ue_exercise', label: 'Upper Extremity Exercise' },
        { code: 'fine_motor', label: 'Fine Motor Activities' },
        { code: 'cognitive_training', label: 'Cognitive Training' },
        { code: 'safety_training', label: 'Safety Training' },
        { code: 'adaptive_training', label: 'Adaptive Equipment Training' },
        { code: 'energy_conservation', label: 'Energy Conservation' },
        { code: 'caregiver_training', label: 'Caregiver Training' },
      ],
    },
    {
      id: 'ot_frequency',
      code: 'OT_FREQUENCY',
      label: 'Recommended Frequency',
      responseType: 'text',
      required: true,
      placeholder: 'e.g., 2x/week for 3 weeks',
    },
    {
      id: 'ot_prognosis',
      code: 'OT_PROGNOSIS',
      label: 'Rehabilitation Prognosis',
      responseType: 'single_select',
      required: true,
      options: [
        { code: 'excellent', label: 'Excellent' },
        { code: 'good', label: 'Good' },
        { code: 'fair', label: 'Fair' },
        { code: 'guarded', label: 'Guarded' },
        { code: 'poor', label: 'Poor' },
      ],
    },
  ],
};

const OT_PROGRESS_SECTION: VisitFormSection = {
  id: 'ot_progress',
  name: 'Treatment & Progress',
  description: 'Treatment provided and patient progress',
  required: true,
  aiDraftEnabled: true,
  questions: [
    {
      id: 'ot_treatment_today',
      code: 'OT_TX_TODAY',
      label: 'Treatment Provided Today',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'ot_patient_response',
      code: 'OT_RESPONSE',
      label: 'Patient Response to Treatment',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'ot_goal_progress',
      code: 'OT_GOAL_PROGRESS',
      label: 'Progress Toward Goals',
      responseType: 'single_select',
      required: true,
      options: [
        { code: 'met', label: 'Goals Met' },
        { code: 'progressing', label: 'Progressing' },
        { code: 'plateau', label: 'Plateau' },
        { code: 'regression', label: 'Regression' },
      ],
    },
    {
      id: 'ot_adl_status',
      code: 'OT_ADL_STATUS',
      label: 'Current ADL Independence Level',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'ot_plan',
      code: 'OT_PLAN',
      label: 'Plan for Next Visit',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
  ],
};

const SLP_EVALUATION_SECTION: VisitFormSection = {
  id: 'slp_evaluation',
  name: 'Speech-Language Evaluation',
  description: 'Comprehensive SLP assessment',
  required: true,
  aiDraftEnabled: true,
  questions: [
    {
      id: 'slp_history',
      code: 'SLP_HISTORY',
      label: 'Relevant Medical/Speech History',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'slp_hearing_screen',
      code: 'SLP_HEARING',
      label: 'Hearing Screening Result',
      responseType: 'single_select',
      required: true,
      options: [
        { code: 'wnl', label: 'Within Normal Limits' },
        { code: 'mild_loss', label: 'Mild Loss' },
        { code: 'moderate_loss', label: 'Moderate Loss' },
        { code: 'severe_loss', label: 'Severe Loss' },
        { code: 'aids', label: 'Uses Hearing Aids' },
        { code: 'unable', label: 'Unable to Test' },
      ],
    },
    {
      id: 'slp_oral_motor',
      code: 'SLP_ORAL_MOTOR',
      label: 'Oral Motor Examination',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'slp_swallow_assessment',
      code: 'SLP_SWALLOW',
      label: 'Swallowing Assessment',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'slp_diet_recommendation',
      code: 'SLP_DIET',
      label: 'Diet Texture Recommendation',
      responseType: 'single_select',
      required: true,
      options: [
        { code: 'regular', label: 'Regular' },
        { code: 'soft', label: 'Soft/Easy to Chew' },
        { code: 'mechanical_soft', label: 'Mechanical Soft' },
        { code: 'pureed', label: 'Pureed' },
        { code: 'npo', label: 'NPO' },
      ],
    },
    {
      id: 'slp_liquid_recommendation',
      code: 'SLP_LIQUID',
      label: 'Liquid Consistency Recommendation',
      responseType: 'single_select',
      required: true,
      options: [
        { code: 'thin', label: 'Thin' },
        { code: 'nectar', label: 'Nectar Thick' },
        { code: 'honey', label: 'Honey Thick' },
        { code: 'pudding', label: 'Pudding Thick' },
        { code: 'npo', label: 'NPO' },
      ],
    },
    {
      id: 'slp_speech_assessment',
      code: 'SLP_SPEECH',
      label: 'Speech/Language Assessment',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'slp_cognition',
      code: 'SLP_COGNITION',
      label: 'Cognitive-Communication Assessment',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
      oasisMapping: 'C0500',
    },
  ],
};

const SLP_PROGRESS_SECTION: VisitFormSection = {
  id: 'slp_progress',
  name: 'Treatment & Progress',
  description: 'Treatment provided and patient progress',
  required: true,
  aiDraftEnabled: true,
  questions: [
    {
      id: 'slp_treatment_today',
      code: 'SLP_TX_TODAY',
      label: 'Treatment Provided Today',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'slp_patient_response',
      code: 'SLP_RESPONSE',
      label: 'Patient Response to Treatment',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'slp_goal_progress',
      code: 'SLP_GOAL_PROGRESS',
      label: 'Progress Toward Goals',
      responseType: 'single_select',
      required: true,
      options: [
        { code: 'met', label: 'Goals Met' },
        { code: 'progressing', label: 'Progressing' },
        { code: 'plateau', label: 'Plateau' },
        { code: 'regression', label: 'Regression' },
      ],
    },
    {
      id: 'slp_plan',
      code: 'SLP_PLAN',
      label: 'Plan for Next Visit',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
  ],
};

// =============================================================================
// MSW SECTIONS
// =============================================================================

const MSW_EVALUATION_SECTION: VisitFormSection = {
  id: 'msw_evaluation',
  name: 'Social Work Assessment',
  description: 'Comprehensive psychosocial assessment',
  required: true,
  aiDraftEnabled: true,
  questions: [
    {
      id: 'msw_psychosocial',
      code: 'MSW_PSYCHOSOCIAL',
      label: 'Psychosocial Assessment',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'msw_depression_screen',
      code: 'MSW_DEPRESSION',
      label: 'Depression Screening (PHQ-2/9)',
      responseType: 'text',
      required: true,
      oasisMapping: 'M1730',
    },
    {
      id: 'msw_support_system',
      code: 'MSW_SUPPORT',
      label: 'Support System Assessment',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'msw_financial',
      code: 'MSW_FINANCIAL',
      label: 'Financial Resources Assessment',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'msw_barriers',
      code: 'MSW_BARRIERS',
      label: 'Barriers to Care',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'msw_community_resources',
      code: 'MSW_RESOURCES',
      label: 'Community Resources Identified',
      responseType: 'text',
      required: false,
      aiDraftEnabled: true,
    },
    {
      id: 'msw_referrals',
      code: 'MSW_REFERRALS',
      label: 'Referrals Made',
      responseType: 'multi_select',
      required: false,
      options: [
        { code: 'meals', label: 'Meals on Wheels' },
        { code: 'transportation', label: 'Transportation Services' },
        { code: 'financial_aid', label: 'Financial Assistance' },
        { code: 'mental_health', label: 'Mental Health Services' },
        { code: 'support_group', label: 'Support Groups' },
        { code: 'legal', label: 'Legal Services' },
        { code: 'housing', label: 'Housing Assistance' },
      ],
    },
  ],
};

const MSW_PROGRESS_SECTION: VisitFormSection = {
  id: 'msw_progress',
  name: 'Intervention & Progress',
  description: 'Interventions provided and progress',
  required: true,
  aiDraftEnabled: true,
  questions: [
    {
      id: 'msw_intervention',
      code: 'MSW_INTERVENTION',
      label: 'Interventions Provided',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'msw_patient_response',
      code: 'MSW_RESPONSE',
      label: 'Patient/Family Response',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'msw_goal_progress',
      code: 'MSW_GOAL_PROGRESS',
      label: 'Progress Toward Goals',
      responseType: 'single_select',
      required: true,
      options: [
        { code: 'met', label: 'Goals Met' },
        { code: 'progressing', label: 'Progressing' },
        { code: 'unchanged', label: 'Unchanged' },
        { code: 'barriers', label: 'Barriers Identified' },
      ],
    },
    {
      id: 'msw_plan',
      code: 'MSW_PLAN',
      label: 'Plan for Follow-up',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
  ],
};

// =============================================================================
// HHA SECTIONS
// =============================================================================

const HHA_SERVICES_SECTION: VisitFormSection = {
  id: 'hha_services',
  name: 'Services Provided',
  description: 'Personal care and homemaker services',
  required: true,
  questions: [
    {
      id: 'hha_personal_care',
      code: 'HHA_PERSONAL',
      label: 'Personal Care Services',
      responseType: 'multi_select',
      required: true,
      options: [
        { code: 'bathing', label: 'Bathing/Showering' },
        { code: 'grooming', label: 'Grooming' },
        { code: 'oral_care', label: 'Oral Care' },
        { code: 'dressing', label: 'Dressing' },
        { code: 'toileting', label: 'Toileting' },
        { code: 'transfer', label: 'Transfers' },
        { code: 'ambulation', label: 'Ambulation Assistance' },
        { code: 'feeding', label: 'Feeding Assistance' },
        { code: 'skin_care', label: 'Skin Care' },
      ],
    },
    {
      id: 'hha_homemaker',
      code: 'HHA_HOMEMAKER',
      label: 'Homemaker Services',
      responseType: 'multi_select',
      required: false,
      options: [
        { code: 'light_housekeeping', label: 'Light Housekeeping' },
        { code: 'laundry', label: 'Laundry' },
        { code: 'meal_prep', label: 'Meal Preparation' },
        { code: 'shopping', label: 'Shopping Assistance' },
        { code: 'linen_change', label: 'Linen Change' },
      ],
    },
    {
      id: 'hha_exercise',
      code: 'HHA_EXERCISE',
      label: 'Exercise/ROM Performed',
      responseType: 'checkbox',
      required: false,
    },
  ],
};

const HHA_OBSERVATIONS_SECTION: VisitFormSection = {
  id: 'hha_observations',
  name: 'Patient Observations',
  description: 'Observations to report to nurse',
  required: true,
  questions: [
    {
      id: 'hha_general_condition',
      code: 'HHA_CONDITION',
      label: 'General Condition',
      responseType: 'single_select',
      required: true,
      options: [
        { code: 'stable', label: 'Stable/Unchanged' },
        { code: 'improved', label: 'Improved' },
        { code: 'declined', label: 'Declined' },
        { code: 'concern', label: 'Concerns Noted' },
      ],
    },
    {
      id: 'hha_skin_observations',
      code: 'HHA_SKIN',
      label: 'Skin Observations',
      responseType: 'text',
      required: false,
    },
    {
      id: 'hha_changes_noted',
      code: 'HHA_CHANGES',
      label: 'Changes/Concerns to Report',
      responseType: 'text',
      required: false,
    },
    {
      id: 'hha_nurse_notification',
      code: 'HHA_NOTIFY_RN',
      label: 'Nurse Notified of Changes',
      responseType: 'checkbox',
      required: false,
    },
  ],
};

// =============================================================================
// DISCHARGE SECTION
// =============================================================================

const DISCHARGE_SUMMARY_SECTION: VisitFormSection = {
  id: 'discharge_summary',
  name: 'Discharge Summary',
  description: 'Summary of care provided and outcomes',
  required: true,
  aiDraftEnabled: true,
  questions: [
    {
      id: 'discharge_reason',
      code: 'DC_REASON',
      label: 'Reason for Discharge',
      responseType: 'single_select',
      required: true,
      options: [
        { code: 'goals_met', label: 'Goals Met' },
        { code: 'transferred', label: 'Transferred to Facility' },
        { code: 'hospitalized', label: 'Hospitalized' },
        { code: 'deceased', label: 'Deceased' },
        { code: 'moved', label: 'Moved Out of Service Area' },
        { code: 'patient_choice', label: 'Patient/Family Choice' },
        { code: 'non_compliant', label: 'Non-Compliant with Care' },
        { code: 'no_longer_homebound', label: 'No Longer Homebound' },
        { code: 'other', label: 'Other' },
      ],
    },
    {
      id: 'discharge_destination',
      code: 'DC_DESTINATION',
      label: 'Discharge Destination',
      responseType: 'single_select',
      required: true,
      options: [
        { code: 'home_self', label: 'Home - Self Care' },
        { code: 'home_caregiver', label: 'Home - With Caregiver' },
        { code: 'snf', label: 'Skilled Nursing Facility' },
        { code: 'hospital', label: 'Acute Care Hospital' },
        { code: 'rehab', label: 'Rehabilitation Facility' },
        { code: 'hospice', label: 'Hospice' },
        { code: 'deceased', label: 'Deceased' },
        { code: 'other', label: 'Other' },
      ],
    },
    {
      id: 'goals_achievement',
      code: 'DC_GOALS',
      label: 'Goals Achievement Summary',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'services_summary',
      code: 'DC_SERVICES',
      label: 'Summary of Services Provided',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'clinical_status',
      code: 'DC_STATUS',
      label: 'Clinical Status at Discharge',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'discharge_instructions',
      code: 'DC_INSTRUCTIONS',
      label: 'Discharge Instructions Provided',
      responseType: 'text',
      required: true,
      aiDraftEnabled: true,
    },
    {
      id: 'followup_appointments',
      code: 'DC_FOLLOWUP',
      label: 'Follow-up Appointments',
      responseType: 'text',
      required: false,
    },
  ],
};

// =============================================================================
// VISIT FORM CONFIGURATIONS
// =============================================================================

export const VISIT_FORM_CONFIGS: VisitFormConfig[] = [
  // RN Configurations
  {
    discipline: 'RN',
    visitPurpose: 'SOC',
    requiresOasis: true,
    requiresPhysicianOrder: true,
    sections: [
      ADMIN_SECTION,
      VITALS_SECTION,
      NURSING_SUBJECTIVE_SECTION,
      NURSING_OBJECTIVE_SECTION,
      NURSING_MEDICATIONS_SECTION,
      NURSING_ASSESSMENT_PLAN_SECTION,
      SIGNATURE_SECTION,
    ],
  },
  {
    discipline: 'RN',
    visitPurpose: 'ROC',
    requiresOasis: true,
    requiresPhysicianOrder: true,
    sections: [
      ADMIN_SECTION,
      VITALS_SECTION,
      NURSING_SUBJECTIVE_SECTION,
      NURSING_OBJECTIVE_SECTION,
      NURSING_MEDICATIONS_SECTION,
      NURSING_ASSESSMENT_PLAN_SECTION,
      SIGNATURE_SECTION,
    ],
  },
  {
    discipline: 'RN',
    visitPurpose: 'RECERT',
    requiresOasis: true,
    requiresPhysicianOrder: true,
    sections: [
      ADMIN_SECTION,
      VITALS_SECTION,
      NURSING_SUBJECTIVE_SECTION,
      NURSING_OBJECTIVE_SECTION,
      NURSING_MEDICATIONS_SECTION,
      NURSING_ASSESSMENT_PLAN_SECTION,
      SIGNATURE_SECTION,
    ],
  },
  {
    discipline: 'RN',
    visitPurpose: 'FOLLOWUP',
    requiresOasis: false,
    requiresPhysicianOrder: false,
    sections: [
      ADMIN_SECTION,
      VITALS_SECTION,
      NURSING_SUBJECTIVE_SECTION,
      NURSING_OBJECTIVE_SECTION,
      NURSING_ASSESSMENT_PLAN_SECTION,
      SIGNATURE_SECTION,
    ],
  },
  {
    discipline: 'RN',
    visitPurpose: 'DISCHARGE',
    requiresOasis: true,
    requiresPhysicianOrder: false,
    sections: [
      ADMIN_SECTION,
      VITALS_SECTION,
      NURSING_SUBJECTIVE_SECTION,
      NURSING_OBJECTIVE_SECTION,
      DISCHARGE_SUMMARY_SECTION,
      SIGNATURE_SECTION,
    ],
  },

  // LVN Configurations
  {
    discipline: 'LVN',
    visitPurpose: 'FOLLOWUP',
    requiresOasis: false,
    requiresPhysicianOrder: false,
    sections: [
      ADMIN_SECTION,
      VITALS_SECTION,
      NURSING_SUBJECTIVE_SECTION,
      NURSING_OBJECTIVE_SECTION,
      NURSING_ASSESSMENT_PLAN_SECTION,
      SIGNATURE_SECTION,
    ],
  },

  // PT Configurations
  {
    discipline: 'PT',
    visitPurpose: 'EVALUATION',
    requiresOasis: true,
    requiresPhysicianOrder: true,
    sections: [
      ADMIN_SECTION,
      VITALS_SECTION,
      PT_EVALUATION_SECTION,
      PT_TREATMENT_PLAN_SECTION,
      SIGNATURE_SECTION,
    ],
  },
  {
    discipline: 'PT',
    visitPurpose: 'SOC',
    requiresOasis: true,
    requiresPhysicianOrder: true,
    sections: [
      ADMIN_SECTION,
      VITALS_SECTION,
      PT_EVALUATION_SECTION,
      PT_TREATMENT_PLAN_SECTION,
      SIGNATURE_SECTION,
    ],
  },
  {
    discipline: 'PT',
    visitPurpose: 'FOLLOWUP',
    requiresOasis: false,
    requiresPhysicianOrder: false,
    sections: [ADMIN_SECTION, VITALS_SECTION, PT_PROGRESS_SECTION, SIGNATURE_SECTION],
  },
  {
    discipline: 'PT',
    visitPurpose: 'RECERT',
    requiresOasis: true,
    requiresPhysicianOrder: true,
    sections: [
      ADMIN_SECTION,
      VITALS_SECTION,
      PT_EVALUATION_SECTION,
      PT_TREATMENT_PLAN_SECTION,
      SIGNATURE_SECTION,
    ],
  },
  {
    discipline: 'PT',
    visitPurpose: 'DISCHARGE',
    requiresOasis: true,
    requiresPhysicianOrder: false,
    sections: [
      ADMIN_SECTION,
      VITALS_SECTION,
      PT_PROGRESS_SECTION,
      DISCHARGE_SUMMARY_SECTION,
      SIGNATURE_SECTION,
    ],
  },

  // OT Configurations
  {
    discipline: 'OT',
    visitPurpose: 'EVALUATION',
    requiresOasis: true,
    requiresPhysicianOrder: true,
    sections: [
      ADMIN_SECTION,
      VITALS_SECTION,
      OT_EVALUATION_SECTION,
      OT_TREATMENT_PLAN_SECTION,
      SIGNATURE_SECTION,
    ],
  },
  {
    discipline: 'OT',
    visitPurpose: 'SOC',
    requiresOasis: true,
    requiresPhysicianOrder: true,
    sections: [
      ADMIN_SECTION,
      VITALS_SECTION,
      OT_EVALUATION_SECTION,
      OT_TREATMENT_PLAN_SECTION,
      SIGNATURE_SECTION,
    ],
  },
  {
    discipline: 'OT',
    visitPurpose: 'FOLLOWUP',
    requiresOasis: false,
    requiresPhysicianOrder: false,
    sections: [ADMIN_SECTION, VITALS_SECTION, OT_PROGRESS_SECTION, SIGNATURE_SECTION],
  },
  {
    discipline: 'OT',
    visitPurpose: 'RECERT',
    requiresOasis: true,
    requiresPhysicianOrder: true,
    sections: [
      ADMIN_SECTION,
      VITALS_SECTION,
      OT_EVALUATION_SECTION,
      OT_TREATMENT_PLAN_SECTION,
      SIGNATURE_SECTION,
    ],
  },
  {
    discipline: 'OT',
    visitPurpose: 'DISCHARGE',
    requiresOasis: true,
    requiresPhysicianOrder: false,
    sections: [
      ADMIN_SECTION,
      VITALS_SECTION,
      OT_PROGRESS_SECTION,
      DISCHARGE_SUMMARY_SECTION,
      SIGNATURE_SECTION,
    ],
  },

  // SLP Configurations
  {
    discipline: 'SLP',
    visitPurpose: 'EVALUATION',
    requiresOasis: true,
    requiresPhysicianOrder: true,
    sections: [ADMIN_SECTION, VITALS_SECTION, SLP_EVALUATION_SECTION, SIGNATURE_SECTION],
  },
  {
    discipline: 'SLP',
    visitPurpose: 'SOC',
    requiresOasis: true,
    requiresPhysicianOrder: true,
    sections: [ADMIN_SECTION, VITALS_SECTION, SLP_EVALUATION_SECTION, SIGNATURE_SECTION],
  },
  {
    discipline: 'SLP',
    visitPurpose: 'FOLLOWUP',
    requiresOasis: false,
    requiresPhysicianOrder: false,
    sections: [ADMIN_SECTION, VITALS_SECTION, SLP_PROGRESS_SECTION, SIGNATURE_SECTION],
  },
  {
    discipline: 'SLP',
    visitPurpose: 'DISCHARGE',
    requiresOasis: true,
    requiresPhysicianOrder: false,
    sections: [
      ADMIN_SECTION,
      VITALS_SECTION,
      SLP_PROGRESS_SECTION,
      DISCHARGE_SUMMARY_SECTION,
      SIGNATURE_SECTION,
    ],
  },

  // MSW Configurations
  {
    discipline: 'MSW',
    visitPurpose: 'EVALUATION',
    requiresOasis: false,
    requiresPhysicianOrder: true,
    sections: [ADMIN_SECTION, MSW_EVALUATION_SECTION, SIGNATURE_SECTION],
  },
  {
    discipline: 'MSW',
    visitPurpose: 'SOC',
    requiresOasis: false,
    requiresPhysicianOrder: true,
    sections: [ADMIN_SECTION, MSW_EVALUATION_SECTION, SIGNATURE_SECTION],
  },
  {
    discipline: 'MSW',
    visitPurpose: 'FOLLOWUP',
    requiresOasis: false,
    requiresPhysicianOrder: false,
    sections: [ADMIN_SECTION, MSW_PROGRESS_SECTION, SIGNATURE_SECTION],
  },
  {
    discipline: 'MSW',
    visitPurpose: 'DISCHARGE',
    requiresOasis: false,
    requiresPhysicianOrder: false,
    sections: [ADMIN_SECTION, MSW_PROGRESS_SECTION, DISCHARGE_SUMMARY_SECTION, SIGNATURE_SECTION],
  },

  // HHA Configurations
  {
    discipline: 'HHA',
    visitPurpose: 'FOLLOWUP',
    requiresOasis: false,
    requiresPhysicianOrder: false,
    sections: [
      ADMIN_SECTION,
      VITALS_SECTION,
      HHA_SERVICES_SECTION,
      HHA_OBSERVATIONS_SECTION,
      SIGNATURE_SECTION,
    ],
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get visit form configuration for a discipline and visit purpose
 */
export function getVisitFormConfig(
  discipline: Discipline,
  visitPurpose: VisitPurpose
): VisitFormConfig | null {
  return (
    VISIT_FORM_CONFIGS.find(
      (config) => config.discipline === discipline && config.visitPurpose === visitPurpose
    ) || null
  );
}

/**
 * Get all visit purposes available for a discipline
 */
export function getAvailableVisitPurposes(discipline: Discipline): VisitPurpose[] {
  return VISIT_FORM_CONFIGS.filter((config) => config.discipline === discipline).map(
    (config) => config.visitPurpose
  );
}

/**
 * Check if a discipline requires OASIS for a visit type
 */
export function requiresOasis(discipline: Discipline, visitPurpose: VisitPurpose): boolean {
  const config = getVisitFormConfig(discipline, visitPurpose);
  return config?.requiresOasis ?? false;
}

/**
 * Get all questions with OASIS mappings for a configuration
 */
export function getOasisMappedQuestions(config: VisitFormConfig): VisitFormQuestion[] {
  return config.sections.flatMap((section) =>
    section.questions.filter((q) => q.oasisMapping !== undefined)
  );
}

/**
 * Get all AI-enabled questions for a configuration
 */
export function getAIDraftEnabledQuestions(config: VisitFormConfig): VisitFormQuestion[] {
  return config.sections.flatMap((section) =>
    section.questions.filter((q) => q.aiDraftEnabled === true)
  );
}

/**
 * Calculate section completion for a given set of responses
 */
export function calculateSectionCompletion(
  section: VisitFormSection,
  responses: Record<string, unknown>
): { total: number; completed: number; required: number; requiredCompleted: number } {
  let total = 0;
  let completed = 0;
  let required = 0;
  let requiredCompleted = 0;

  for (const question of section.questions) {
    total++;
    const hasResponse = responses[question.code] !== undefined && responses[question.code] !== '';

    if (hasResponse) {
      completed++;
    }

    if (question.required) {
      required++;
      if (hasResponse) {
        requiredCompleted++;
      }
    }
  }

  return { total, completed, required, requiredCompleted };
}
