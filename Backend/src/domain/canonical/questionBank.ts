/**
 * Canonical Question Bank
 *
 * Contains all reusable sections and questions organized by clinical domain.
 * Questions use stable conceptIds that never change, regardless of EMR.
 */

import type {
  CanonicalSectionDefinition,
  CanonicalFormQuestion,
  CanonicalOption,
  Discipline,
  VisitType,
} from './types';

// =============================================================================
// SHARED OPTIONS (Reusable across questions)
// =============================================================================

export const YES_NO_OPTIONS: CanonicalOption[] = [
  { code: '1', label: 'Yes' },
  { code: '0', label: 'No' },
];

export const YES_NO_NA_OPTIONS: CanonicalOption[] = [
  { code: '1', label: 'Yes' },
  { code: '0', label: 'No' },
  { code: 'NA', label: 'Not Applicable' },
];

export const PAIN_SCALE_OPTIONS: CanonicalOption[] = Array.from({ length: 11 }, (_, i) => ({
  code: String(i),
  label: String(i),
  description: i === 0 ? 'No pain' : i === 10 ? 'Worst pain imaginable' : undefined,
}));

export const FUNCTIONAL_SCORE_OPTIONS: CanonicalOption[] = [
  { code: '06', label: 'Independent', scoringValue: 6 },
  { code: '05', label: 'Setup or cleanup assistance', scoringValue: 5 },
  { code: '04', label: 'Supervision or touching assistance', scoringValue: 4 },
  { code: '03', label: 'Partial/moderate assistance', scoringValue: 3 },
  { code: '02', label: 'Substantial/maximal assistance', scoringValue: 2 },
  { code: '01', label: 'Dependent', scoringValue: 1 },
  { code: '07', label: 'Patient refused', scoringValue: 0 },
  { code: '09', label: 'Not applicable', scoringValue: 0 },
  { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringValue: 0 },
];

export const ADHERENCE_OPTIONS: CanonicalOption[] = [
  { code: 'compliant', label: 'Takes as prescribed' },
  { code: 'partial', label: 'Partially compliant' },
  { code: 'non_compliant', label: 'Non-compliant' },
  { code: 'unable', label: 'Unable to assess' },
];

export const WOUND_HEALING_OPTIONS: CanonicalOption[] = [
  { code: 'improving', label: 'Improving' },
  { code: 'stable', label: 'Stable' },
  { code: 'declining', label: 'Declining/Worsening' },
];

export const GOAL_STATUS_OPTIONS: CanonicalOption[] = [
  { code: 'active', label: 'Active' },
  { code: 'met', label: 'Met' },
  { code: 'progressing', label: 'Progressing' },
  { code: 'not_met', label: 'Not Met' },
  { code: 'revised', label: 'Revised' },
  { code: 'discontinued', label: 'Discontinued' },
];

export const INTERVENTION_RESPONSE_OPTIONS: CanonicalOption[] = [
  { code: 'effective', label: 'Effective' },
  { code: 'partially_effective', label: 'Partially effective' },
  { code: 'ineffective', label: 'Ineffective' },
  { code: 'unable_to_assess', label: 'Unable to assess' },
];

export const PATIENT_TOLERANCE_OPTIONS: CanonicalOption[] = [
  { code: 'good', label: 'Good - tolerated well' },
  { code: 'fair', label: 'Fair - some difficulty' },
  { code: 'poor', label: 'Poor - significant difficulty' },
  { code: 'unable', label: 'Unable to tolerate' },
];

export const EDUCATION_RESPONSE_OPTIONS: CanonicalOption[] = [
  { code: 'verbalized', label: 'Verbalized understanding' },
  { code: 'demonstrated', label: 'Return demonstration successful' },
  { code: 'partial', label: 'Partial understanding' },
  { code: 'reinforcement', label: 'Needs reinforcement' },
  { code: 'barrier', label: 'Learning barrier identified' },
];

// =============================================================================
// ADMINISTRATIVE QUESTIONS
// =============================================================================

const ADMIN_QUESTIONS: CanonicalFormQuestion[] = [
  {
    id: 'q_visit_date',
    conceptId: 'admin.visit_date',
    label: 'Visit Date',
    type: 'date',
    required: true,
  },
  {
    id: 'q_time_in',
    conceptId: 'admin.time_in',
    label: 'Time In',
    type: 'time',
    required: true,
  },
  {
    id: 'q_time_out',
    conceptId: 'admin.time_out',
    label: 'Time Out',
    type: 'time',
    required: true,
  },
  {
    id: 'q_visit_location',
    conceptId: 'admin.visit_location',
    label: 'Visit Location',
    type: 'single_select',
    required: true,
    options: [
      { code: 'home', label: 'Patient Home' },
      { code: 'facility', label: 'Facility' },
      { code: 'telehealth', label: 'Telehealth' },
    ],
  },
  {
    id: 'q_caregiver_present',
    conceptId: 'admin.caregiver_present',
    label: 'Caregiver Present',
    type: 'boolean',
    required: false,
  },
  {
    id: 'q_caregiver_name',
    conceptId: 'admin.caregiver_name',
    label: 'Caregiver Name',
    type: 'text',
    required: false,
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'admin.caregiver_present', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_caregiver_relationship',
    conceptId: 'admin.caregiver_relationship',
    label: 'Relationship to Patient',
    type: 'single_select',
    required: false,
    options: [
      { code: 'spouse', label: 'Spouse' },
      { code: 'child', label: 'Child' },
      { code: 'parent', label: 'Parent' },
      { code: 'sibling', label: 'Sibling' },
      { code: 'other_family', label: 'Other Family Member' },
      { code: 'friend', label: 'Friend' },
      { code: 'paid_caregiver', label: 'Paid Caregiver' },
      { code: 'other', label: 'Other' },
    ],
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'admin.caregiver_present', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
];

// =============================================================================
// VITAL SIGNS QUESTIONS
// =============================================================================

const VITALS_QUESTIONS: CanonicalFormQuestion[] = [
  {
    id: 'q_bp_systolic',
    conceptId: 'vitals.bp_systolic',
    label: 'Blood Pressure - Systolic',
    shortLabel: 'SBP',
    type: 'number',
    required: true,
    validation: { min: 60, max: 260 },
  },
  {
    id: 'q_bp_diastolic',
    conceptId: 'vitals.bp_diastolic',
    label: 'Blood Pressure - Diastolic',
    shortLabel: 'DBP',
    type: 'number',
    required: true,
    validation: { min: 30, max: 160 },
  },
  {
    id: 'q_bp_position',
    conceptId: 'vitals.bp_position',
    label: 'BP Position',
    type: 'single_select',
    required: false,
    options: [
      { code: 'sitting', label: 'Sitting' },
      { code: 'standing', label: 'Standing' },
      { code: 'supine', label: 'Supine' },
    ],
  },
  {
    id: 'q_heart_rate',
    conceptId: 'vitals.heart_rate',
    label: 'Heart Rate',
    shortLabel: 'HR',
    helpText: 'Beats per minute',
    type: 'number',
    required: true,
    validation: { min: 30, max: 220 },
  },
  {
    id: 'q_heart_rhythm',
    conceptId: 'vitals.heart_rhythm',
    label: 'Heart Rhythm',
    type: 'single_select',
    required: false,
    options: [
      { code: 'regular', label: 'Regular' },
      { code: 'irregular', label: 'Irregular' },
    ],
  },
  {
    id: 'q_respiratory_rate',
    conceptId: 'vitals.respiratory_rate',
    label: 'Respiratory Rate',
    shortLabel: 'RR',
    helpText: 'Breaths per minute',
    type: 'number',
    required: true,
    validation: { min: 6, max: 60 },
  },
  {
    id: 'q_temperature',
    conceptId: 'vitals.temperature',
    label: 'Temperature',
    shortLabel: 'Temp',
    type: 'decimal',
    required: true,
    validation: { min: 90, max: 110 },
  },
  {
    id: 'q_temperature_unit',
    conceptId: 'vitals.temperature_unit',
    label: 'Temperature Unit',
    type: 'single_select',
    required: true,
    defaultValue: 'F',
    options: [
      { code: 'F', label: 'Fahrenheit' },
      { code: 'C', label: 'Celsius' },
    ],
  },
  {
    id: 'q_oxygen_saturation',
    conceptId: 'vitals.oxygen_saturation',
    label: 'Oxygen Saturation',
    shortLabel: 'SpO2',
    helpText: 'Percentage',
    type: 'number',
    required: true,
    validation: { min: 50, max: 100 },
  },
  {
    id: 'q_oxygen_on_room_air',
    conceptId: 'vitals.oxygen_on_room_air',
    label: 'On Room Air',
    type: 'boolean',
    required: true,
    defaultValue: true,
  },
  {
    id: 'q_oxygen_liters',
    conceptId: 'vitals.oxygen_liters',
    label: 'Oxygen Liters/Min',
    type: 'decimal',
    required: false,
    validation: { min: 0.5, max: 15 },
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'vitals.oxygen_on_room_air', operator: 'equals', value: false }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_oxygen_delivery',
    conceptId: 'vitals.oxygen_delivery',
    label: 'Oxygen Delivery Method',
    type: 'single_select',
    required: false,
    options: [
      { code: 'nasal_cannula', label: 'Nasal Cannula' },
      { code: 'simple_mask', label: 'Simple Mask' },
      { code: 'non_rebreather', label: 'Non-Rebreather' },
      { code: 'venturi', label: 'Venturi Mask' },
      { code: 'bipap', label: 'BiPAP' },
      { code: 'cpap', label: 'CPAP' },
      { code: 'high_flow', label: 'High Flow Nasal Cannula' },
    ],
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'vitals.oxygen_on_room_air', operator: 'equals', value: false }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_weight',
    conceptId: 'vitals.weight',
    label: 'Weight',
    type: 'decimal',
    required: false,
    validation: { min: 20, max: 700 },
  },
  {
    id: 'q_weight_unit',
    conceptId: 'vitals.weight_unit',
    label: 'Weight Unit',
    type: 'single_select',
    required: false,
    defaultValue: 'lbs',
    options: [
      { code: 'lbs', label: 'Pounds (lbs)' },
      { code: 'kg', label: 'Kilograms (kg)' },
    ],
  },
  {
    id: 'q_blood_glucose',
    conceptId: 'vitals.blood_glucose',
    label: 'Blood Glucose',
    shortLabel: 'BG',
    helpText: 'mg/dL',
    type: 'number',
    required: false,
    validation: { min: 20, max: 600 },
  },
  {
    id: 'q_blood_glucose_timing',
    conceptId: 'vitals.blood_glucose_timing',
    label: 'Blood Glucose Timing',
    type: 'single_select',
    required: false,
    options: [
      { code: 'fasting', label: 'Fasting' },
      { code: 'random', label: 'Random' },
      { code: 'pre_meal', label: 'Pre-Meal' },
      { code: 'post_meal', label: 'Post-Meal' },
    ],
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'vitals.blood_glucose', operator: 'is_set' }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_pain_level',
    conceptId: 'vitals.pain_level',
    label: 'Pain Level',
    helpText: '0-10 scale',
    type: 'scale',
    required: true,
    scaleMin: 0,
    scaleMax: 10,
    scaleLabels: {
      0: 'No pain',
      5: 'Moderate',
      10: 'Worst pain',
    },
  },
  {
    id: 'q_pain_location',
    conceptId: 'vitals.pain_location',
    label: 'Pain Location',
    type: 'text',
    required: false,
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'vitals.pain_level', operator: 'greater_than', value: 0 }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_pain_quality',
    conceptId: 'vitals.pain_quality',
    label: 'Pain Quality',
    type: 'multi_select',
    required: false,
    options: [
      { code: 'sharp', label: 'Sharp' },
      { code: 'dull', label: 'Dull' },
      { code: 'aching', label: 'Aching' },
      { code: 'burning', label: 'Burning' },
      { code: 'throbbing', label: 'Throbbing' },
      { code: 'stabbing', label: 'Stabbing' },
      { code: 'radiating', label: 'Radiating' },
      { code: 'cramping', label: 'Cramping' },
    ],
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'vitals.pain_level', operator: 'greater_than', value: 0 }],
      operator: 'AND',
    }],
  },
];

// =============================================================================
// RN ASSESSMENT QUESTIONS
// =============================================================================

const RN_SUBJECTIVE_QUESTIONS: CanonicalFormQuestion[] = [
  {
    id: 'q_chief_complaint',
    conceptId: 'rn.subjective.chief_complaint',
    label: 'Chief Complaint',
    helpText: 'Primary reason for home health services',
    type: 'textarea',
    required: true,
    aiDraftEnabled: true,
  },
  {
    id: 'q_patient_report',
    conceptId: 'rn.subjective.patient_report',
    label: 'Patient Report',
    helpText: 'Patient/caregiver statements about current condition',
    type: 'textarea',
    required: true,
    aiDraftEnabled: true,
  },
  {
    id: 'q_symptoms_today',
    conceptId: 'rn.subjective.symptoms_today',
    label: 'Symptoms Today',
    type: 'multi_select',
    required: false,
    options: [
      { code: 'none', label: 'No new symptoms' },
      { code: 'pain', label: 'Pain' },
      { code: 'sob', label: 'Shortness of breath' },
      { code: 'fatigue', label: 'Fatigue' },
      { code: 'dizziness', label: 'Dizziness' },
      { code: 'nausea', label: 'Nausea' },
      { code: 'edema', label: 'Swelling/Edema' },
      { code: 'confusion', label: 'Confusion' },
      { code: 'appetite_change', label: 'Appetite change' },
      { code: 'sleep_change', label: 'Sleep disturbance' },
      { code: 'other', label: 'Other' },
    ],
  },
  {
    id: 'q_symptoms_other',
    conceptId: 'rn.subjective.symptoms_other',
    label: 'Other Symptoms (describe)',
    type: 'textarea',
    required: false,
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'rn.subjective.symptoms_today', operator: 'contains', value: 'other' }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_since_last_visit',
    conceptId: 'rn.subjective.since_last_visit',
    label: 'Changes Since Last Visit',
    type: 'textarea',
    required: false,
    aiDraftEnabled: true,
  },
  {
    id: 'q_er_hospitalization',
    conceptId: 'rn.subjective.er_hospitalization',
    label: 'ER Visit or Hospitalization Since Last Visit',
    type: 'boolean',
    required: true,
  },
  {
    id: 'q_er_hospitalization_details',
    conceptId: 'rn.subjective.er_hospitalization_details',
    label: 'ER/Hospitalization Details',
    type: 'textarea',
    required: false,
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'rn.subjective.er_hospitalization', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
];

const RN_OBJECTIVE_QUESTIONS: CanonicalFormQuestion[] = [
  {
    id: 'q_general_appearance',
    conceptId: 'rn.objective.general_appearance',
    label: 'General Appearance',
    type: 'multi_select',
    required: true,
    options: [
      { code: 'alert', label: 'Alert' },
      { code: 'oriented', label: 'Oriented' },
      { code: 'cooperative', label: 'Cooperative' },
      { code: 'well_groomed', label: 'Well-groomed' },
      { code: 'appropriate_affect', label: 'Appropriate affect' },
      { code: 'fatigued', label: 'Fatigued' },
      { code: 'anxious', label: 'Anxious' },
      { code: 'distressed', label: 'In distress' },
      { code: 'confused', label: 'Confused' },
      { code: 'lethargic', label: 'Lethargic' },
    ],
  },
  {
    id: 'q_skin_assessment',
    conceptId: 'rn.objective.skin_assessment',
    label: 'Skin Assessment',
    type: 'multi_select',
    required: true,
    options: [
      { code: 'intact', label: 'Intact' },
      { code: 'warm_dry', label: 'Warm and dry' },
      { code: 'pale', label: 'Pale' },
      { code: 'flushed', label: 'Flushed' },
      { code: 'cyanotic', label: 'Cyanotic' },
      { code: 'diaphoretic', label: 'Diaphoretic' },
      { code: 'edematous', label: 'Edematous' },
      { code: 'rash', label: 'Rash present' },
      { code: 'wound_present', label: 'Wound present' },
      { code: 'bruising', label: 'Bruising' },
    ],
  },
  {
    id: 'q_respiratory_assessment',
    conceptId: 'rn.objective.respiratory',
    label: 'Respiratory Assessment',
    type: 'multi_select',
    required: true,
    options: [
      { code: 'breath_sounds_clear', label: 'Breath sounds clear' },
      { code: 'diminished', label: 'Diminished' },
      { code: 'wheezes', label: 'Wheezes' },
      { code: 'crackles', label: 'Crackles/Rales' },
      { code: 'rhonchi', label: 'Rhonchi' },
      { code: 'stridor', label: 'Stridor' },
      { code: 'labored', label: 'Labored breathing' },
      { code: 'cough', label: 'Cough present' },
      { code: 'productive', label: 'Productive cough' },
    ],
  },
  {
    id: 'q_cardiac_assessment',
    conceptId: 'rn.objective.cardiac',
    label: 'Cardiac Assessment',
    type: 'multi_select',
    required: true,
    options: [
      { code: 's1_s2_present', label: 'S1/S2 present' },
      { code: 'regular', label: 'Regular rhythm' },
      { code: 'irregular', label: 'Irregular rhythm' },
      { code: 'murmur', label: 'Murmur' },
      { code: 'gallop', label: 'Gallop' },
      { code: 'jvd', label: 'JVD present' },
      { code: 'peripheral_edema', label: 'Peripheral edema' },
    ],
  },
  {
    id: 'q_edema_location',
    conceptId: 'rn.objective.edema_location',
    label: 'Edema Location',
    type: 'multi_select',
    required: false,
    options: [
      { code: 'bilateral_le', label: 'Bilateral lower extremities' },
      { code: 'right_le', label: 'Right lower extremity' },
      { code: 'left_le', label: 'Left lower extremity' },
      { code: 'bilateral_ue', label: 'Bilateral upper extremities' },
      { code: 'right_ue', label: 'Right upper extremity' },
      { code: 'left_ue', label: 'Left upper extremity' },
      { code: 'sacral', label: 'Sacral' },
      { code: 'periorbital', label: 'Periorbital' },
      { code: 'generalized', label: 'Generalized' },
    ],
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'rn.objective.cardiac', operator: 'contains', value: 'peripheral_edema' }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_edema_severity',
    conceptId: 'rn.objective.edema_severity',
    label: 'Edema Severity',
    type: 'single_select',
    required: false,
    options: [
      { code: '1_plus', label: '1+ (2mm depth, disappears rapidly)' },
      { code: '2_plus', label: '2+ (4mm depth, disappears 10-15 sec)' },
      { code: '3_plus', label: '3+ (6mm depth, disappears >1 min)' },
      { code: '4_plus', label: '4+ (8mm+ depth, persistent 2-5 min)' },
    ],
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'rn.objective.cardiac', operator: 'contains', value: 'peripheral_edema' }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_gi_assessment',
    conceptId: 'rn.objective.gi',
    label: 'GI Assessment',
    type: 'multi_select',
    required: false,
    options: [
      { code: 'abdomen_soft', label: 'Abdomen soft' },
      { code: 'non_tender', label: 'Non-tender' },
      { code: 'non_distended', label: 'Non-distended' },
      { code: 'bowel_sounds_present', label: 'Bowel sounds present' },
      { code: 'tender', label: 'Tender' },
      { code: 'distended', label: 'Distended' },
      { code: 'hypoactive_bs', label: 'Hypoactive bowel sounds' },
      { code: 'hyperactive_bs', label: 'Hyperactive bowel sounds' },
      { code: 'absent_bs', label: 'Absent bowel sounds' },
      { code: 'nausea', label: 'Nausea reported' },
      { code: 'vomiting', label: 'Vomiting reported' },
    ],
  },
  {
    id: 'q_bowel_pattern',
    conceptId: 'rn.objective.bowel_pattern',
    label: 'Bowel Pattern',
    type: 'single_select',
    required: false,
    options: [
      { code: 'regular', label: 'Regular' },
      { code: 'constipation', label: 'Constipation' },
      { code: 'diarrhea', label: 'Diarrhea' },
      { code: 'incontinence', label: 'Incontinence' },
      { code: 'ostomy', label: 'Ostomy' },
    ],
  },
  {
    id: 'q_neuro_assessment',
    conceptId: 'rn.objective.neuro',
    label: 'Neurological Assessment',
    type: 'multi_select',
    required: false,
    options: [
      { code: 'alert', label: 'Alert' },
      { code: 'oriented_x4', label: 'Oriented x4' },
      { code: 'oriented_x3', label: 'Oriented x3' },
      { code: 'oriented_x2', label: 'Oriented x2' },
      { code: 'oriented_x1', label: 'Oriented x1' },
      { code: 'confused', label: 'Confused' },
      { code: 'lethargic', label: 'Lethargic' },
      { code: 'pupils_equal', label: 'Pupils equal, round, reactive' },
      { code: 'speech_clear', label: 'Speech clear' },
      { code: 'speech_slurred', label: 'Speech slurred' },
      { code: 'moves_all', label: 'Moves all extremities' },
      { code: 'weakness', label: 'Weakness noted' },
      { code: 'sensation_intact', label: 'Sensation intact' },
    ],
  },
  {
    id: 'q_objective_narrative',
    conceptId: 'rn.objective.narrative',
    label: 'Additional Objective Findings',
    type: 'textarea',
    required: false,
    aiDraftEnabled: true,
  },
];

const RN_ASSESSMENT_PLAN_QUESTIONS: CanonicalFormQuestion[] = [
  {
    id: 'q_clinical_assessment',
    conceptId: 'rn.assessment.clinical',
    label: 'Clinical Assessment',
    helpText: 'Clinical interpretation of findings',
    type: 'textarea',
    required: true,
    aiDraftEnabled: true,
  },
  {
    id: 'q_homebound_status',
    conceptId: 'rn.assessment.homebound_status',
    label: 'Homebound Status',
    type: 'single_select',
    required: true,
    oasisItemCode: 'M0080',
    options: [
      { code: 'confined', label: 'Confined to home - requires taxing effort to leave' },
      { code: 'requires_assistance', label: 'Requires assistance and supportive devices' },
      { code: 'absences_medical', label: 'Leaves home for medical appointments only' },
      { code: 'absences_infrequent', label: 'Infrequent/short duration absences' },
    ],
  },
  {
    id: 'q_homebound_reason',
    conceptId: 'rn.assessment.homebound_reason',
    label: 'Homebound Reason',
    type: 'multi_select',
    required: true,
    options: [
      { code: 'medical_restriction', label: 'Medical restriction' },
      { code: 'physical_limitation', label: 'Physical limitation' },
      { code: 'cognitive_impairment', label: 'Cognitive impairment' },
      { code: 'safety_concerns', label: 'Safety concerns' },
      { code: 'requires_assistance', label: 'Requires considerable effort/assistance' },
      { code: 'equipment_dependent', label: 'Dependent on medical equipment' },
    ],
  },
  {
    id: 'q_skilled_need',
    conceptId: 'rn.assessment.skilled_need',
    label: 'Skilled Nursing Need',
    type: 'multi_select',
    required: true,
    options: [
      { code: 'assessment', label: 'Assessment and evaluation' },
      { code: 'teaching', label: 'Teaching and training' },
      { code: 'wound_care', label: 'Wound care' },
      { code: 'iv_therapy', label: 'IV therapy' },
      { code: 'injections', label: 'Injections' },
      { code: 'catheter_care', label: 'Catheter care' },
      { code: 'ostomy_care', label: 'Ostomy care' },
      { code: 'medication_mgmt', label: 'Medication management' },
      { code: 'disease_mgmt', label: 'Disease management' },
      { code: 'care_coordination', label: 'Care coordination' },
    ],
  },
  {
    id: 'q_progress_toward_goals',
    conceptId: 'rn.assessment.progress_toward_goals',
    label: 'Progress Toward Goals',
    type: 'single_select',
    required: true,
    options: [
      { code: 'met', label: 'Goals met' },
      { code: 'progressing', label: 'Progressing toward goals' },
      { code: 'minimal_progress', label: 'Minimal progress' },
      { code: 'no_progress', label: 'No progress' },
      { code: 'declined', label: 'Patient has declined' },
      { code: 'revised', label: 'Goals revised' },
    ],
  },
  {
    id: 'q_plan_of_care',
    conceptId: 'rn.plan.narrative',
    label: 'Plan of Care',
    helpText: 'Interventions and next steps',
    type: 'textarea',
    required: true,
    aiDraftEnabled: true,
  },
  {
    id: 'q_frequency_recommendation',
    conceptId: 'rn.plan.frequency_recommendation',
    label: 'Recommended Visit Frequency',
    type: 'text',
    required: false,
    helpText: 'e.g., 2x/week for 2 weeks, then 1x/week for 2 weeks',
  },
  {
    id: 'q_physician_notification',
    conceptId: 'rn.plan.physician_notification',
    label: 'Physician Notification Required',
    type: 'boolean',
    required: true,
  },
  {
    id: 'q_physician_notification_reason',
    conceptId: 'rn.plan.physician_notification_reason',
    label: 'Reason for Physician Notification',
    type: 'textarea',
    required: false,
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'rn.plan.physician_notification', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_orders_obtained',
    conceptId: 'rn.plan.orders_obtained',
    label: 'New Orders Obtained',
    type: 'textarea',
    required: false,
  },
];

// =============================================================================
// RN MEDICATION QUESTIONS
// =============================================================================

const RN_MEDICATION_QUESTIONS: CanonicalFormQuestion[] = [
  {
    id: 'q_medication_reconciliation',
    conceptId: 'rn.medications.reconciliation_completed',
    label: 'Medication Reconciliation Completed',
    type: 'boolean',
    required: true,
    oasisItemCode: 'N0415',
  },
  {
    id: 'q_medication_changes',
    conceptId: 'rn.medications.changes_since_last',
    label: 'Medication Changes Since Last Visit',
    type: 'boolean',
    required: true,
  },
  {
    id: 'q_medication_changes_details',
    conceptId: 'rn.medications.changes_details',
    label: 'Medication Change Details',
    type: 'textarea',
    required: false,
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'rn.medications.changes_since_last', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_high_risk_meds',
    conceptId: 'rn.medications.high_risk_present',
    label: 'High-Risk Medications Present',
    type: 'boolean',
    required: true,
  },
  {
    id: 'q_high_risk_meds_list',
    conceptId: 'rn.medications.high_risk_list',
    label: 'High-Risk Medications',
    type: 'multi_select',
    required: false,
    options: [
      { code: 'anticoagulants', label: 'Anticoagulants (Warfarin, DOACs)' },
      { code: 'insulin', label: 'Insulin' },
      { code: 'opioids', label: 'Opioids' },
      { code: 'digoxin', label: 'Digoxin' },
      { code: 'chemo', label: 'Chemotherapy agents' },
      { code: 'immunosuppressants', label: 'Immunosuppressants' },
      { code: 'antiepileptics', label: 'Antiepileptics' },
      { code: 'antiarrhythmics', label: 'Antiarrhythmics' },
    ],
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'rn.medications.high_risk_present', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_medication_adherence',
    conceptId: 'rn.medications.adherence',
    label: 'Overall Medication Adherence',
    type: 'single_select',
    required: true,
    options: ADHERENCE_OPTIONS,
  },
  {
    id: 'q_medication_concerns',
    conceptId: 'rn.medications.concerns',
    label: 'Medication Concerns/Side Effects',
    type: 'textarea',
    required: false,
  },
];

// =============================================================================
// PT ASSESSMENT QUESTIONS
// =============================================================================

const PT_SUBJECTIVE_QUESTIONS: CanonicalFormQuestion[] = [
  {
    id: 'q_pt_chief_complaint',
    conceptId: 'pt.subjective.chief_complaint',
    label: 'Chief Complaint',
    helpText: 'Primary reason for PT services',
    type: 'textarea',
    required: true,
    aiDraftEnabled: true,
  },
  {
    id: 'q_pt_prior_level',
    conceptId: 'pt.subjective.prior_level_function',
    label: 'Prior Level of Function',
    helpText: 'Functional status before current episode',
    type: 'textarea',
    required: true,
  },
  {
    id: 'q_pt_current_complaints',
    conceptId: 'pt.subjective.current_complaints',
    label: 'Current Complaints',
    type: 'multi_select',
    required: true,
    options: [
      { code: 'pain', label: 'Pain' },
      { code: 'weakness', label: 'Weakness' },
      { code: 'balance', label: 'Balance problems' },
      { code: 'endurance', label: 'Decreased endurance' },
      { code: 'rom', label: 'Limited range of motion' },
      { code: 'gait', label: 'Gait abnormality' },
      { code: 'transfers', label: 'Difficulty with transfers' },
      { code: 'stairs', label: 'Difficulty with stairs' },
      { code: 'falls', label: 'Recent falls' },
      { code: 'fear_falling', label: 'Fear of falling' },
    ],
  },
  {
    id: 'q_pt_falls_history',
    conceptId: 'pt.subjective.falls_history',
    label: 'Fall History (Past 12 Months)',
    type: 'single_select',
    required: true,
    oasisItemCode: 'J1800',
    options: [
      { code: 'none', label: 'No falls' },
      { code: 'one', label: '1 fall' },
      { code: 'two_plus', label: '2 or more falls' },
      { code: 'unknown', label: 'Unknown' },
    ],
  },
  {
    id: 'q_pt_fall_details',
    conceptId: 'pt.subjective.fall_details',
    label: 'Fall Details',
    type: 'textarea',
    required: false,
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'pt.subjective.falls_history', operator: 'in', value: ['one', 'two_plus'] }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_pt_living_situation',
    conceptId: 'pt.subjective.living_situation',
    label: 'Living Situation',
    type: 'single_select',
    required: true,
    options: [
      { code: 'alone', label: 'Lives alone' },
      { code: 'with_spouse', label: 'Lives with spouse/partner' },
      { code: 'with_family', label: 'Lives with family' },
      { code: 'with_caregiver', label: 'Lives with paid caregiver' },
      { code: 'alf', label: 'Assisted living facility' },
    ],
  },
  {
    id: 'q_pt_home_barriers',
    conceptId: 'pt.subjective.home_barriers',
    label: 'Home Environment Barriers',
    type: 'multi_select',
    required: false,
    options: [
      { code: 'stairs', label: 'Stairs' },
      { code: 'narrow_doorways', label: 'Narrow doorways' },
      { code: 'rugs', label: 'Throw rugs' },
      { code: 'clutter', label: 'Clutter' },
      { code: 'poor_lighting', label: 'Poor lighting' },
      { code: 'bathroom_access', label: 'Bathroom accessibility' },
      { code: 'no_grab_bars', label: 'No grab bars' },
      { code: 'uneven_surfaces', label: 'Uneven surfaces' },
    ],
  },
];

const PT_OBJECTIVE_QUESTIONS: CanonicalFormQuestion[] = [
  {
    id: 'q_pt_posture',
    conceptId: 'pt.objective.posture',
    label: 'Posture Assessment',
    type: 'multi_select',
    required: false,
    options: [
      { code: 'within_normal', label: 'Within normal limits' },
      { code: 'kyphosis', label: 'Kyphosis' },
      { code: 'lordosis', label: 'Lordosis' },
      { code: 'scoliosis', label: 'Scoliosis' },
      { code: 'forward_head', label: 'Forward head posture' },
      { code: 'rounded_shoulders', label: 'Rounded shoulders' },
      { code: 'trunk_lean', label: 'Trunk lean' },
    ],
  },
  {
    id: 'q_pt_rom_ue',
    conceptId: 'pt.objective.rom_upper_extremity',
    label: 'Upper Extremity ROM',
    type: 'single_select',
    required: true,
    options: [
      { code: 'wnl', label: 'Within normal limits' },
      { code: 'mild', label: 'Mildly limited' },
      { code: 'moderate', label: 'Moderately limited' },
      { code: 'severe', label: 'Severely limited' },
    ],
  },
  {
    id: 'q_pt_rom_le',
    conceptId: 'pt.objective.rom_lower_extremity',
    label: 'Lower Extremity ROM',
    type: 'single_select',
    required: true,
    options: [
      { code: 'wnl', label: 'Within normal limits' },
      { code: 'mild', label: 'Mildly limited' },
      { code: 'moderate', label: 'Moderately limited' },
      { code: 'severe', label: 'Severely limited' },
    ],
  },
  {
    id: 'q_pt_strength_ue',
    conceptId: 'pt.objective.strength_upper_extremity',
    label: 'Upper Extremity Strength',
    type: 'single_select',
    required: true,
    options: [
      { code: '5', label: '5/5 - Normal' },
      { code: '4', label: '4/5 - Good' },
      { code: '3', label: '3/5 - Fair' },
      { code: '2', label: '2/5 - Poor' },
      { code: '1', label: '1/5 - Trace' },
      { code: '0', label: '0/5 - None' },
    ],
  },
  {
    id: 'q_pt_strength_le',
    conceptId: 'pt.objective.strength_lower_extremity',
    label: 'Lower Extremity Strength',
    type: 'single_select',
    required: true,
    options: [
      { code: '5', label: '5/5 - Normal' },
      { code: '4', label: '4/5 - Good' },
      { code: '3', label: '3/5 - Fair' },
      { code: '2', label: '2/5 - Poor' },
      { code: '1', label: '1/5 - Trace' },
      { code: '0', label: '0/5 - None' },
    ],
  },
  {
    id: 'q_pt_balance_sitting',
    conceptId: 'pt.objective.balance_sitting',
    label: 'Sitting Balance',
    type: 'single_select',
    required: true,
    options: [
      { code: 'normal', label: 'Normal - independent' },
      { code: 'good', label: 'Good - minimal support' },
      { code: 'fair', label: 'Fair - moderate support' },
      { code: 'poor', label: 'Poor - maximal support' },
      { code: 'unable', label: 'Unable to maintain' },
    ],
  },
  {
    id: 'q_pt_balance_standing',
    conceptId: 'pt.objective.balance_standing',
    label: 'Standing Balance',
    type: 'single_select',
    required: true,
    options: [
      { code: 'normal', label: 'Normal - independent' },
      { code: 'good', label: 'Good - minimal support' },
      { code: 'fair', label: 'Fair - moderate support' },
      { code: 'poor', label: 'Poor - maximal support' },
      { code: 'unable', label: 'Unable to maintain' },
    ],
  },
  {
    id: 'q_pt_gait',
    conceptId: 'pt.objective.gait_assessment',
    label: 'Gait Assessment',
    type: 'multi_select',
    required: true,
    options: [
      { code: 'normal', label: 'Normal gait pattern' },
      { code: 'antalgic', label: 'Antalgic (pain avoidance)' },
      { code: 'ataxic', label: 'Ataxic (uncoordinated)' },
      { code: 'festinating', label: 'Festinating (short, shuffling)' },
      { code: 'steppage', label: 'Steppage (high stepping)' },
      { code: 'trendelenburg', label: 'Trendelenburg' },
      { code: 'scissoring', label: 'Scissoring' },
      { code: 'wide_base', label: 'Wide base of support' },
      { code: 'uneven_step', label: 'Uneven step length' },
      { code: 'decreased_speed', label: 'Decreased speed' },
    ],
  },
  {
    id: 'q_pt_assistive_device',
    conceptId: 'pt.objective.assistive_device',
    label: 'Assistive Device Used',
    type: 'multi_select',
    required: false,
    options: [
      { code: 'none', label: 'None' },
      { code: 'cane', label: 'Cane' },
      { code: 'quad_cane', label: 'Quad cane' },
      { code: 'walker', label: 'Standard walker' },
      { code: 'rolling_walker', label: 'Rolling walker' },
      { code: 'wheelchair', label: 'Wheelchair' },
      { code: 'crutches', label: 'Crutches' },
      { code: 'brace', label: 'Brace/orthotic' },
    ],
  },
];

const PT_FUNCTIONAL_QUESTIONS: CanonicalFormQuestion[] = [
  {
    id: 'q_pt_bed_mobility',
    conceptId: 'pt.functional.bed_mobility',
    label: 'Bed Mobility',
    helpText: 'Rolling, sitting up, supine to sit',
    type: 'single_select',
    required: true,
    oasisItemCode: 'GG0170A',
    options: FUNCTIONAL_SCORE_OPTIONS,
  },
  {
    id: 'q_pt_transfer_sit_to_stand',
    conceptId: 'pt.functional.transfer_sit_to_stand',
    label: 'Transfer: Sit to Stand',
    type: 'single_select',
    required: true,
    oasisItemCode: 'GG0170B',
    options: FUNCTIONAL_SCORE_OPTIONS,
  },
  {
    id: 'q_pt_transfer_chair',
    conceptId: 'pt.functional.transfer_chair_bed',
    label: 'Transfer: Chair/Bed to Chair',
    type: 'single_select',
    required: true,
    oasisItemCode: 'GG0170C',
    options: FUNCTIONAL_SCORE_OPTIONS,
  },
  {
    id: 'q_pt_transfer_toilet',
    conceptId: 'pt.functional.transfer_toilet',
    label: 'Transfer: Toilet',
    type: 'single_select',
    required: true,
    oasisItemCode: 'GG0170D',
    options: FUNCTIONAL_SCORE_OPTIONS,
  },
  {
    id: 'q_pt_ambulation',
    conceptId: 'pt.functional.ambulation',
    label: 'Ambulation',
    helpText: 'Walking on level surface',
    type: 'single_select',
    required: true,
    oasisItemCode: 'GG0170I',
    options: FUNCTIONAL_SCORE_OPTIONS,
  },
  {
    id: 'q_pt_ambulation_distance',
    conceptId: 'pt.functional.ambulation_distance',
    label: 'Ambulation Distance (feet)',
    type: 'number',
    required: false,
  },
  {
    id: 'q_pt_stairs',
    conceptId: 'pt.functional.stairs',
    label: 'Stairs',
    helpText: '4-6 steps',
    type: 'single_select',
    required: true,
    oasisItemCode: 'GG0170L',
    options: FUNCTIONAL_SCORE_OPTIONS,
  },
];

const PT_ASSESSMENT_PLAN_QUESTIONS: CanonicalFormQuestion[] = [
  {
    id: 'q_pt_clinical_assessment',
    conceptId: 'pt.assessment.clinical',
    label: 'PT Assessment',
    helpText: 'Clinical interpretation of findings',
    type: 'textarea',
    required: true,
    aiDraftEnabled: true,
  },
  {
    id: 'q_pt_rehab_potential',
    conceptId: 'pt.assessment.rehab_potential',
    label: 'Rehabilitation Potential',
    type: 'single_select',
    required: true,
    options: [
      { code: 'excellent', label: 'Excellent' },
      { code: 'good', label: 'Good' },
      { code: 'fair', label: 'Fair' },
      { code: 'guarded', label: 'Guarded' },
      { code: 'poor', label: 'Poor' },
    ],
  },
  {
    id: 'q_pt_progress',
    conceptId: 'pt.assessment.progress_toward_goals',
    label: 'Progress Toward Goals',
    type: 'single_select',
    required: true,
    options: GOAL_STATUS_OPTIONS,
  },
  {
    id: 'q_pt_treatment_plan',
    conceptId: 'pt.plan.treatment',
    label: 'Treatment Plan',
    type: 'textarea',
    required: true,
    aiDraftEnabled: true,
  },
  {
    id: 'q_pt_interventions_planned',
    conceptId: 'pt.plan.interventions',
    label: 'Planned Interventions',
    type: 'multi_select',
    required: true,
    options: [
      { code: 'therapeutic_exercise', label: 'Therapeutic exercise' },
      { code: 'gait_training', label: 'Gait training' },
      { code: 'balance_training', label: 'Balance training' },
      { code: 'transfer_training', label: 'Transfer training' },
      { code: 'stairs_training', label: 'Stair training' },
      { code: 'stretching', label: 'Stretching/flexibility' },
      { code: 'strengthening', label: 'Strengthening' },
      { code: 'neuromuscular_re_ed', label: 'Neuromuscular re-education' },
      { code: 'manual_therapy', label: 'Manual therapy' },
      { code: 'modalities', label: 'Modalities (heat/cold/TENS)' },
      { code: 'patient_education', label: 'Patient/caregiver education' },
      { code: 'hep', label: 'Home exercise program' },
      { code: 'fall_prevention', label: 'Fall prevention education' },
      { code: 'safety_assessment', label: 'Home safety assessment' },
    ],
  },
  {
    id: 'q_pt_frequency',
    conceptId: 'pt.plan.frequency_recommendation',
    label: 'Recommended Visit Frequency',
    type: 'text',
    required: false,
    helpText: 'e.g., 2x/week for 4 weeks',
  },
  {
    id: 'q_pt_hep_provided',
    conceptId: 'pt.plan.hep_provided',
    label: 'Home Exercise Program Provided',
    type: 'boolean',
    required: true,
  },
  {
    id: 'q_pt_hep_details',
    conceptId: 'pt.plan.hep_details',
    label: 'HEP Details',
    type: 'textarea',
    required: false,
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'pt.plan.hep_provided', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_pt_dme_recommendations',
    conceptId: 'pt.plan.dme_recommendations',
    label: 'DME Recommendations',
    type: 'multi_select',
    required: false,
    options: [
      { code: 'none', label: 'None' },
      { code: 'walker', label: 'Walker' },
      { code: 'cane', label: 'Cane' },
      { code: 'wheelchair', label: 'Wheelchair' },
      { code: 'grab_bars', label: 'Grab bars' },
      { code: 'tub_bench', label: 'Tub bench/transfer bench' },
      { code: 'raised_toilet', label: 'Raised toilet seat' },
      { code: 'hospital_bed', label: 'Hospital bed' },
      { code: 'bedside_commode', label: 'Bedside commode' },
      { code: 'brace', label: 'Brace/orthotic' },
    ],
  },
];

// =============================================================================
// INTERVENTIONS & EDUCATION QUESTIONS (Shared)
// =============================================================================

const INTERVENTION_QUESTIONS: CanonicalFormQuestion[] = [
  {
    id: 'q_interventions_performed',
    conceptId: 'intervention.performed',
    label: 'Interventions Performed This Visit',
    type: 'multi_select',
    required: true,
    options: [
      { code: 'assessment', label: 'Assessment/Observation' },
      { code: 'teaching', label: 'Teaching/Education' },
      { code: 'wound_care', label: 'Wound Care' },
      { code: 'medication_admin', label: 'Medication Administration' },
      { code: 'injection', label: 'Injection' },
      { code: 'iv_therapy', label: 'IV Therapy' },
      { code: 'catheter_care', label: 'Catheter Care' },
      { code: 'ostomy_care', label: 'Ostomy Care' },
      { code: 'blood_draw', label: 'Blood Draw/Labs' },
      { code: 'dressing_change', label: 'Dressing Change' },
      { code: 'therapeutic_exercise', label: 'Therapeutic Exercise' },
      { code: 'gait_training', label: 'Gait Training' },
      { code: 'transfer_training', label: 'Transfer Training' },
      { code: 'balance_activities', label: 'Balance Activities' },
      { code: 'adl_training', label: 'ADL Training' },
      { code: 'safety_assessment', label: 'Safety Assessment' },
      { code: 'care_coordination', label: 'Care Coordination' },
    ],
  },
  {
    id: 'q_intervention_response',
    conceptId: 'intervention.patient_response',
    label: 'Patient Response to Interventions',
    type: 'single_select',
    required: true,
    options: INTERVENTION_RESPONSE_OPTIONS,
  },
  {
    id: 'q_patient_tolerance',
    conceptId: 'intervention.patient_tolerance',
    label: 'Patient Tolerance',
    type: 'single_select',
    required: true,
    options: PATIENT_TOLERANCE_OPTIONS,
  },
  {
    id: 'q_intervention_notes',
    conceptId: 'intervention.notes',
    label: 'Intervention Notes',
    type: 'textarea',
    required: false,
    aiDraftEnabled: true,
  },
];

const EDUCATION_QUESTIONS: CanonicalFormQuestion[] = [
  {
    id: 'q_education_provided',
    conceptId: 'education.provided',
    label: 'Education Provided',
    type: 'boolean',
    required: true,
  },
  {
    id: 'q_education_topics',
    conceptId: 'education.topics',
    label: 'Education Topics',
    type: 'multi_select',
    required: false,
    options: [
      { code: 'disease_process', label: 'Disease process' },
      { code: 'medications', label: 'Medications' },
      { code: 'diet', label: 'Diet/Nutrition' },
      { code: 'activity', label: 'Activity/Exercise' },
      { code: 'fall_prevention', label: 'Fall prevention' },
      { code: 'safety', label: 'Home safety' },
      { code: 'wound_care', label: 'Wound care' },
      { code: 'signs_symptoms', label: 'Signs/symptoms to report' },
      { code: 'equipment_use', label: 'Equipment use' },
      { code: 'pain_management', label: 'Pain management' },
      { code: 'infection_control', label: 'Infection control' },
      { code: 'diabetes_mgmt', label: 'Diabetes management' },
      { code: 'cardiac_mgmt', label: 'Cardiac management' },
      { code: 'respiratory_mgmt', label: 'Respiratory management' },
      { code: 'emergency_plan', label: 'Emergency plan' },
    ],
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'education.provided', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_education_recipient',
    conceptId: 'education.recipient',
    label: 'Education Recipient',
    type: 'multi_select',
    required: false,
    options: [
      { code: 'patient', label: 'Patient' },
      { code: 'caregiver', label: 'Caregiver' },
      { code: 'family', label: 'Family member' },
    ],
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'education.provided', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_education_response',
    conceptId: 'education.response',
    label: 'Response to Education',
    type: 'single_select',
    required: false,
    options: EDUCATION_RESPONSE_OPTIONS,
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'education.provided', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_education_barriers',
    conceptId: 'education.barriers',
    label: 'Learning Barriers Identified',
    type: 'multi_select',
    required: false,
    options: [
      { code: 'none', label: 'None identified' },
      { code: 'cognitive', label: 'Cognitive impairment' },
      { code: 'language', label: 'Language barrier' },
      { code: 'hearing', label: 'Hearing impairment' },
      { code: 'vision', label: 'Vision impairment' },
      { code: 'literacy', label: 'Low literacy' },
      { code: 'anxiety', label: 'Anxiety/stress' },
      { code: 'motivation', label: 'Lack of motivation' },
      { code: 'denial', label: 'Denial of condition' },
    ],
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'education.provided', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
];

// =============================================================================
// GOALS SECTION
// =============================================================================

const GOALS_QUESTIONS: CanonicalFormQuestion[] = [
  {
    id: 'q_goals_reviewed',
    conceptId: 'goals.reviewed',
    label: 'Care Plan Goals Reviewed',
    type: 'boolean',
    required: true,
  },
  {
    id: 'q_goals_status',
    conceptId: 'goals.overall_status',
    label: 'Overall Progress Toward Goals',
    type: 'single_select',
    required: true,
    options: GOAL_STATUS_OPTIONS,
  },
  {
    id: 'q_goals_updates',
    conceptId: 'goals.updates',
    label: 'Goal Updates/Revisions',
    type: 'textarea',
    required: false,
    aiDraftEnabled: true,
  },
];

// =============================================================================
// WOUND MODULE QUESTIONS
// =============================================================================

const WOUND_MODULE_QUESTIONS: CanonicalFormQuestion[] = [
  {
    id: 'q_wound_present',
    conceptId: 'wound.present',
    label: 'Wound Present',
    type: 'boolean',
    required: true,
  },
  {
    id: 'q_wound_type',
    conceptId: 'wound.type',
    label: 'Wound Type',
    type: 'single_select',
    required: false,
    options: [
      { code: 'pressure_ulcer', label: 'Pressure Ulcer/Injury' },
      { code: 'surgical', label: 'Surgical Wound' },
      { code: 'venous', label: 'Venous Ulcer' },
      { code: 'arterial', label: 'Arterial Ulcer' },
      { code: 'diabetic', label: 'Diabetic Foot Ulcer' },
      { code: 'traumatic', label: 'Traumatic Wound' },
      { code: 'skin_tear', label: 'Skin Tear' },
      { code: 'other', label: 'Other' },
    ],
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'wound.present', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_wound_location',
    conceptId: 'wound.location',
    label: 'Wound Location',
    type: 'text',
    required: false,
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'wound.present', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_wound_stage',
    conceptId: 'wound.stage',
    label: 'Wound Stage',
    type: 'single_select',
    required: false,
    oasisItemCode: 'M1311',
    options: [
      { code: 'stage_1', label: 'Stage 1' },
      { code: 'stage_2', label: 'Stage 2' },
      { code: 'stage_3', label: 'Stage 3' },
      { code: 'stage_4', label: 'Stage 4' },
      { code: 'unstageable', label: 'Unstageable' },
      { code: 'deep_tissue', label: 'Deep Tissue Pressure Injury' },
      { code: 'na', label: 'N/A (non-pressure wound)' },
    ],
    visibilityRules: [{
      type: 'show_when',
      conditions: [
        { field: 'wound.present', operator: 'equals', value: true },
        { field: 'wound.type', operator: 'equals', value: 'pressure_ulcer' },
      ],
      operator: 'AND',
    }],
  },
  {
    id: 'q_wound_length',
    conceptId: 'wound.length',
    label: 'Length (cm)',
    type: 'decimal',
    required: false,
    validation: { min: 0.1, max: 100 },
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'wound.present', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_wound_width',
    conceptId: 'wound.width',
    label: 'Width (cm)',
    type: 'decimal',
    required: false,
    validation: { min: 0.1, max: 100 },
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'wound.present', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_wound_depth',
    conceptId: 'wound.depth',
    label: 'Depth (cm)',
    type: 'decimal',
    required: false,
    validation: { min: 0, max: 50 },
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'wound.present', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_wound_bed',
    conceptId: 'wound.wound_bed',
    label: 'Wound Bed Tissue',
    type: 'multi_select',
    required: false,
    options: [
      { code: 'granulation', label: 'Granulation (red)' },
      { code: 'epithelial', label: 'Epithelial (pink)' },
      { code: 'slough', label: 'Slough (yellow)' },
      { code: 'eschar', label: 'Eschar (black)' },
      { code: 'exposed_bone', label: 'Exposed bone/tendon' },
    ],
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'wound.present', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_wound_exudate_amount',
    conceptId: 'wound.exudate_amount',
    label: 'Exudate Amount',
    type: 'single_select',
    required: false,
    options: [
      { code: 'none', label: 'None' },
      { code: 'scant', label: 'Scant' },
      { code: 'small', label: 'Small' },
      { code: 'moderate', label: 'Moderate' },
      { code: 'large', label: 'Large/Copious' },
    ],
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'wound.present', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_wound_exudate_type',
    conceptId: 'wound.exudate_type',
    label: 'Exudate Type',
    type: 'single_select',
    required: false,
    options: [
      { code: 'serous', label: 'Serous (clear)' },
      { code: 'serosanguineous', label: 'Serosanguineous (pink)' },
      { code: 'sanguineous', label: 'Sanguineous (bloody)' },
      { code: 'purulent', label: 'Purulent (pus)' },
    ],
    visibilityRules: [{
      type: 'show_when',
      conditions: [
        { field: 'wound.present', operator: 'equals', value: true },
        { field: 'wound.exudate_amount', operator: 'not_equals', value: 'none' },
      ],
      operator: 'AND',
    }],
  },
  {
    id: 'q_wound_periwound',
    conceptId: 'wound.periwound',
    label: 'Periwound Skin',
    type: 'multi_select',
    required: false,
    options: [
      { code: 'intact', label: 'Intact' },
      { code: 'macerated', label: 'Macerated' },
      { code: 'erythematous', label: 'Erythematous' },
      { code: 'indurated', label: 'Indurated' },
      { code: 'edematous', label: 'Edematous' },
      { code: 'dry', label: 'Dry/Scaly' },
    ],
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'wound.present', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_wound_healing',
    conceptId: 'wound.healing_status',
    label: 'Wound Healing Status',
    type: 'single_select',
    required: false,
    options: WOUND_HEALING_OPTIONS,
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'wound.present', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
  {
    id: 'q_wound_treatment',
    conceptId: 'wound.treatment',
    label: 'Wound Treatment',
    type: 'textarea',
    required: false,
    visibilityRules: [{
      type: 'show_when',
      conditions: [{ field: 'wound.present', operator: 'equals', value: true }],
      operator: 'AND',
    }],
  },
];

// =============================================================================
// SIGNATURES SECTION
// =============================================================================

const SIGNATURE_QUESTIONS: CanonicalFormQuestion[] = [
  {
    id: 'q_clinician_signature',
    conceptId: 'signature.clinician',
    label: 'Clinician Signature',
    type: 'signature',
    required: true,
  },
  {
    id: 'q_patient_signature',
    conceptId: 'signature.patient',
    label: 'Patient/Caregiver Signature',
    type: 'signature',
    required: false,
  },
  {
    id: 'q_signature_date',
    conceptId: 'signature.date',
    label: 'Signature Date',
    type: 'date',
    required: true,
  },
];

// =============================================================================
// DISCHARGE QUESTIONS
// =============================================================================

const DISCHARGE_QUESTIONS: CanonicalFormQuestion[] = [
  {
    id: 'q_discharge_reason',
    conceptId: 'discharge.reason',
    label: 'Discharge Reason',
    type: 'single_select',
    required: true,
    oasisItemCode: 'M0100',
    options: [
      { code: 'goals_met', label: 'Goals met - no longer homebound' },
      { code: 'goals_met_stable', label: 'Goals met - stable/maintained' },
      { code: 'goals_not_met', label: 'Goals not met - patient refused' },
      { code: 'hospitalized', label: 'Transferred to hospital' },
      { code: 'snf', label: 'Transferred to SNF' },
      { code: 'inpatient_rehab', label: 'Transferred to inpatient rehab' },
      { code: 'hospice', label: 'Transferred to hospice' },
      { code: 'death', label: 'Death at home' },
      { code: 'moved', label: 'Moved out of service area' },
      { code: 'other', label: 'Other' },
    ],
  },
  {
    id: 'q_discharge_summary',
    conceptId: 'discharge.summary',
    label: 'Discharge Summary',
    type: 'textarea',
    required: true,
    aiDraftEnabled: true,
  },
  {
    id: 'q_discharge_functional_status',
    conceptId: 'discharge.functional_status',
    label: 'Functional Status at Discharge',
    type: 'single_select',
    required: true,
    options: [
      { code: 'improved', label: 'Improved from baseline' },
      { code: 'maintained', label: 'Maintained baseline' },
      { code: 'declined', label: 'Declined from baseline' },
    ],
  },
  {
    id: 'q_discharge_goals_status',
    conceptId: 'discharge.goals_status',
    label: 'Goals Status at Discharge',
    type: 'single_select',
    required: true,
    options: [
      { code: 'all_met', label: 'All goals met' },
      { code: 'partially_met', label: 'Partially met' },
      { code: 'not_met', label: 'Not met' },
      { code: 'na', label: 'Unable to assess' },
    ],
  },
  {
    id: 'q_discharge_instructions',
    conceptId: 'discharge.instructions',
    label: 'Discharge Instructions Provided',
    type: 'multi_select',
    required: true,
    options: [
      { code: 'medications', label: 'Medication management' },
      { code: 'follow_up', label: 'Follow-up appointments' },
      { code: 'diet', label: 'Diet/Nutrition' },
      { code: 'activity', label: 'Activity level' },
      { code: 'exercise', label: 'Home exercise program' },
      { code: 'safety', label: 'Safety precautions' },
      { code: 'emergency', label: 'Emergency contacts' },
      { code: 'community', label: 'Community resources' },
    ],
  },
  {
    id: 'q_discharge_follow_up',
    conceptId: 'discharge.follow_up_appointments',
    label: 'Scheduled Follow-up',
    type: 'textarea',
    required: false,
  },
];

// =============================================================================
// SECTION DEFINITIONS
// =============================================================================

export const CANONICAL_SECTIONS: Record<string, CanonicalSectionDefinition> = {
  admin: {
    sectionId: 'admin',
    name: 'Administrative',
    description: 'Visit date, time, and location',
    category: 'admin',
    version: '1.0.0',
    questions: ADMIN_QUESTIONS,
    applicableVisitTypes: ['SOC', 'ROC', 'RECERT', 'FOLLOWUP', 'DISCHARGE', 'EVAL', 'SUPERVISORY'],
    applicableDisciplines: ['RN', 'LVN', 'PT', 'OT', 'SLP', 'MSW', 'HHA'],
    isModule: false,
  },
  vitals: {
    sectionId: 'vitals',
    name: 'Vital Signs',
    description: 'Blood pressure, heart rate, temperature, etc.',
    category: 'assessment',
    version: '1.0.0',
    questions: VITALS_QUESTIONS,
    applicableVisitTypes: ['SOC', 'ROC', 'RECERT', 'FOLLOWUP', 'DISCHARGE', 'EVAL'],
    applicableDisciplines: ['RN', 'LVN', 'PT', 'OT', 'SLP'],
    isModule: false,
  },
  rn_subjective: {
    sectionId: 'rn_subjective',
    name: 'Subjective',
    description: 'Patient/caregiver reports and symptoms',
    category: 'assessment',
    version: '1.0.0',
    questions: RN_SUBJECTIVE_QUESTIONS,
    applicableVisitTypes: ['SOC', 'ROC', 'RECERT', 'FOLLOWUP', 'DISCHARGE'],
    applicableDisciplines: ['RN', 'LVN'],
    isModule: false,
  },
  rn_objective: {
    sectionId: 'rn_objective',
    name: 'Objective',
    description: 'Physical examination findings',
    category: 'assessment',
    version: '1.0.0',
    questions: RN_OBJECTIVE_QUESTIONS,
    applicableVisitTypes: ['SOC', 'ROC', 'RECERT', 'FOLLOWUP', 'DISCHARGE'],
    applicableDisciplines: ['RN', 'LVN'],
    isModule: false,
  },
  rn_medications: {
    sectionId: 'rn_medications',
    name: 'Medications',
    description: 'Medication review and reconciliation',
    category: 'assessment',
    version: '1.0.0',
    questions: RN_MEDICATION_QUESTIONS,
    applicableVisitTypes: ['SOC', 'ROC', 'RECERT', 'FOLLOWUP', 'DISCHARGE'],
    applicableDisciplines: ['RN', 'LVN'],
    isModule: false,
  },
  rn_assessment_plan: {
    sectionId: 'rn_assessment_plan',
    name: 'Assessment & Plan',
    description: 'Clinical assessment and care plan',
    category: 'assessment',
    version: '1.0.0',
    questions: RN_ASSESSMENT_PLAN_QUESTIONS,
    applicableVisitTypes: ['SOC', 'ROC', 'RECERT', 'FOLLOWUP', 'DISCHARGE'],
    applicableDisciplines: ['RN', 'LVN'],
    isModule: false,
  },
  pt_subjective: {
    sectionId: 'pt_subjective',
    name: 'PT Subjective',
    description: 'Patient history and complaints',
    category: 'assessment',
    version: '1.0.0',
    questions: PT_SUBJECTIVE_QUESTIONS,
    applicableVisitTypes: ['SOC', 'ROC', 'RECERT', 'FOLLOWUP', 'DISCHARGE', 'EVAL'],
    applicableDisciplines: ['PT'],
    isModule: false,
  },
  pt_objective: {
    sectionId: 'pt_objective',
    name: 'PT Objective',
    description: 'ROM, strength, balance, gait',
    category: 'assessment',
    version: '1.0.0',
    questions: PT_OBJECTIVE_QUESTIONS,
    applicableVisitTypes: ['SOC', 'ROC', 'RECERT', 'FOLLOWUP', 'DISCHARGE', 'EVAL'],
    applicableDisciplines: ['PT'],
    isModule: false,
  },
  pt_functional: {
    sectionId: 'pt_functional',
    name: 'Functional Assessment',
    description: 'Mobility, transfers, ambulation, stairs',
    category: 'assessment',
    version: '1.0.0',
    questions: PT_FUNCTIONAL_QUESTIONS,
    applicableVisitTypes: ['SOC', 'ROC', 'RECERT', 'DISCHARGE', 'EVAL'],
    applicableDisciplines: ['PT'],
    isModule: false,
  },
  pt_assessment_plan: {
    sectionId: 'pt_assessment_plan',
    name: 'PT Assessment & Plan',
    description: 'Treatment assessment and plan',
    category: 'assessment',
    version: '1.0.0',
    questions: PT_ASSESSMENT_PLAN_QUESTIONS,
    applicableVisitTypes: ['SOC', 'ROC', 'RECERT', 'FOLLOWUP', 'DISCHARGE', 'EVAL'],
    applicableDisciplines: ['PT'],
    isModule: false,
  },
  interventions: {
    sectionId: 'interventions',
    name: 'Interventions',
    description: 'Services provided this visit',
    category: 'intervention',
    version: '1.0.0',
    questions: INTERVENTION_QUESTIONS,
    applicableVisitTypes: ['SOC', 'ROC', 'RECERT', 'FOLLOWUP', 'DISCHARGE'],
    applicableDisciplines: ['RN', 'LVN', 'PT', 'OT', 'SLP', 'MSW', 'HHA'],
    isModule: false,
  },
  education: {
    sectionId: 'education',
    name: 'Education',
    description: 'Patient/caregiver teaching',
    category: 'education',
    version: '1.0.0',
    questions: EDUCATION_QUESTIONS,
    applicableVisitTypes: ['SOC', 'ROC', 'RECERT', 'FOLLOWUP', 'DISCHARGE'],
    applicableDisciplines: ['RN', 'LVN', 'PT', 'OT', 'SLP', 'MSW', 'HHA'],
    isModule: false,
  },
  goals: {
    sectionId: 'goals',
    name: 'Goals Review',
    description: 'Progress toward care plan goals',
    category: 'assessment',
    version: '1.0.0',
    questions: GOALS_QUESTIONS,
    applicableVisitTypes: ['RECERT', 'FOLLOWUP', 'DISCHARGE'],
    applicableDisciplines: ['RN', 'LVN', 'PT', 'OT', 'SLP', 'MSW'],
    isModule: false,
  },
  wound_care: {
    sectionId: 'wound_care',
    name: 'Wound Care',
    description: 'Wound assessment and treatment',
    category: 'compound',
    version: '1.0.0',
    questions: WOUND_MODULE_QUESTIONS,
    applicableVisitTypes: ['SOC', 'ROC', 'RECERT', 'FOLLOWUP', 'DISCHARGE'],
    applicableDisciplines: ['RN', 'LVN'],
    isModule: true,
    moduleId: 'wound_module',
  },
  signatures: {
    sectionId: 'signatures',
    name: 'Signatures',
    description: 'Clinician and patient signatures',
    category: 'admin',
    version: '1.0.0',
    questions: SIGNATURE_QUESTIONS,
    applicableVisitTypes: ['SOC', 'ROC', 'RECERT', 'FOLLOWUP', 'DISCHARGE', 'EVAL', 'SUPERVISORY'],
    applicableDisciplines: ['RN', 'LVN', 'PT', 'OT', 'SLP', 'MSW', 'HHA'],
    isModule: false,
  },
  discharge: {
    sectionId: 'discharge',
    name: 'Discharge',
    description: 'Discharge summary and instructions',
    category: 'narrative',
    version: '1.0.0',
    questions: DISCHARGE_QUESTIONS,
    applicableVisitTypes: ['DISCHARGE'],
    applicableDisciplines: ['RN', 'LVN', 'PT', 'OT', 'SLP', 'MSW'],
    isModule: false,
  },
};

// =============================================================================
// FORM DEFINITION BUILDERS
// =============================================================================

/**
 * Get sections applicable to a given discipline and visit type
 */
export function getSectionsForVisit(
  discipline: Discipline,
  visitType: VisitType
): CanonicalSectionDefinition[] {
  return Object.values(CANONICAL_SECTIONS).filter(
    (section) =>
      section.applicableDisciplines.includes(discipline) &&
      section.applicableVisitTypes.includes(visitType)
  );
}

/**
 * Get all questions for a specific canonical conceptId prefix
 */
export function getQuestionsByPrefix(prefix: string): CanonicalFormQuestion[] {
  const questions: CanonicalFormQuestion[] = [];
  Object.values(CANONICAL_SECTIONS).forEach((section) => {
    section.questions.forEach((q) => {
      if (q.conceptId.startsWith(prefix)) {
        questions.push(q);
      }
    });
  });
  return questions;
}

/**
 * Get a question by its canonicalConceptId
 */
export function getQuestionByConceptId(conceptId: string): CanonicalFormQuestion | undefined {
  for (const section of Object.values(CANONICAL_SECTIONS)) {
    const question = section.questions.find((q) => q.conceptId === conceptId);
    if (question) return question;
  }
  return undefined;
}

export default {
  CANONICAL_SECTIONS,
  getSectionsForVisit,
  getQuestionsByPrefix,
  getQuestionByConceptId,
  // Export option sets
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
};
