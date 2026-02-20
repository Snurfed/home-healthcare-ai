/**
 * HomeCare HomeBase (HCHB) - RN SOC Template
 *
 * Sample EMR template showing how canonical data maps to HCHB's field structure.
 */

import type { EMRTemplate } from '../types';

export const HCHB_RN_SOC_TEMPLATE: EMRTemplate = {
  id: 'hchb_rn_soc_v1',
  name: 'HCHB RN Start of Care',
  description: 'HomeCare HomeBase field mapping for RN SOC visits',

  // Targeting
  emrVendor: 'homecare_homebase',
  discipline: 'RN',
  visitType: 'SOC',

  // Versioning
  version: '1.0.0',
  status: 'published',

  // Template structure
  sections: [
    // ===========================================
    // VISIT INFORMATION
    // ===========================================
    {
      id: 'hchb_visit_info',
      emrSectionId: 'VISIT_INFO',
      emrSectionName: 'Visit Information',
      order: 1,
      fields: [
        {
          id: 'hchb_visit_date',
          emrFieldId: 'VISIT_DATE',
          emrLabel: 'Visit Date',
          emrAnswerType: 'date',
          order: 1,
          mapping: {
            type: 'direct',
            canonicalConceptId: 'admin.visit_date',
            transform: {
              type: 'date_format',
              params: { format: 'MM/DD/YYYY' },
            },
          },
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_time_in',
          emrFieldId: 'TIME_IN',
          emrLabel: 'Time In',
          emrAnswerType: 'time',
          order: 2,
          mapping: {
            type: 'direct',
            canonicalConceptId: 'admin.time_in',
          },
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_time_out',
          emrFieldId: 'TIME_OUT',
          emrLabel: 'Time Out',
          emrAnswerType: 'time',
          order: 3,
          mapping: {
            type: 'direct',
            canonicalConceptId: 'admin.time_out',
          },
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_visit_location',
          emrFieldId: 'VISIT_LOC',
          emrLabel: 'Visit Location',
          emrAnswerType: 'dropdown',
          order: 4,
          mapping: {
            type: 'transform',
            canonicalConceptId: 'admin.visit_location',
            transform: {
              type: 'map',
              valueMap: {
                'home': '1', // HCHB codes
                'facility': '2',
                'telehealth': '3',
              },
            },
          },
          allowedValues: [
            { code: '1', label: 'Patient Home', canonicalCodes: ['home'] },
            { code: '2', label: 'Facility', canonicalCodes: ['facility'] },
            { code: '3', label: 'Telehealth', canonicalCodes: ['telehealth'] },
          ],
          emrRequired: true,
          includeInOutput: true,
        },
      ],
    },

    // ===========================================
    // VITAL SIGNS
    // ===========================================
    {
      id: 'hchb_vitals',
      emrSectionId: 'VITALS',
      emrSectionName: 'Vital Signs',
      order: 2,
      fields: [
        {
          id: 'hchb_bp',
          emrFieldId: 'BP',
          emrLabel: 'Blood Pressure',
          emrAnswerType: 'vitals_compound',
          order: 1,
          mapping: {
            type: 'composite',
            compositeFields: [
              { canonicalConceptId: 'vitals.bp_systolic', order: 1 },
              { canonicalConceptId: 'vitals.bp_diastolic', order: 2, separator: '/' },
            ],
          },
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_hr',
          emrFieldId: 'HR',
          emrLabel: 'Heart Rate',
          emrAnswerType: 'number',
          order: 2,
          mapping: {
            type: 'direct',
            canonicalConceptId: 'vitals.heart_rate',
            transform: {
              type: 'number_format',
              params: { decimals: 0, suffix: ' bpm' },
            },
          },
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_rr',
          emrFieldId: 'RR',
          emrLabel: 'Respiratory Rate',
          emrAnswerType: 'number',
          order: 3,
          mapping: {
            type: 'direct',
            canonicalConceptId: 'vitals.respiratory_rate',
          },
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_temp',
          emrFieldId: 'TEMP',
          emrLabel: 'Temperature',
          emrAnswerType: 'number',
          order: 4,
          mapping: {
            type: 'composite',
            compositeFields: [
              {
                canonicalConceptId: 'vitals.temperature',
                order: 1,
                transform: { type: 'number_format', params: { decimals: 1 } },
              },
              { canonicalConceptId: 'vitals.temperature_unit', order: 2, prefix: '°' },
            ],
          },
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_spo2',
          emrFieldId: 'SPO2',
          emrLabel: 'Oxygen Saturation',
          emrAnswerType: 'number',
          order: 5,
          mapping: {
            type: 'direct',
            canonicalConceptId: 'vitals.oxygen_saturation',
            transform: {
              type: 'number_format',
              params: { decimals: 0, suffix: '%' },
            },
          },
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_o2_room_air',
          emrFieldId: 'O2_RA',
          emrLabel: 'On Room Air',
          emrAnswerType: 'checkbox',
          order: 6,
          mapping: {
            type: 'transform',
            canonicalConceptId: 'vitals.oxygen_on_room_air',
            transform: {
              type: 'boolean_to_text',
              params: { trueText: 'Y', falseText: 'N' },
            },
          },
          emrRequired: false,
          includeInOutput: true,
        },
        {
          id: 'hchb_weight',
          emrFieldId: 'WT',
          emrLabel: 'Weight',
          emrAnswerType: 'number',
          order: 7,
          mapping: {
            type: 'composite',
            compositeFields: [
              {
                canonicalConceptId: 'vitals.weight',
                order: 1,
                transform: { type: 'number_format', params: { decimals: 1 } },
              },
              { canonicalConceptId: 'vitals.weight_unit', order: 2, prefix: ' ' },
            ],
          },
          emrRequired: false,
          includeInOutput: true,
        },
        {
          id: 'hchb_pain',
          emrFieldId: 'PAIN_LEVEL',
          emrLabel: 'Pain Level',
          emrAnswerType: 'number',
          order: 8,
          mapping: {
            type: 'direct',
            canonicalConceptId: 'vitals.pain_level',
            transform: {
              type: 'format',
              formatString: '{value}/10',
            },
          },
          emrRequired: true,
          includeInOutput: true,
        },
      ],
    },

    // ===========================================
    // SUBJECTIVE
    // ===========================================
    {
      id: 'hchb_subjective',
      emrSectionId: 'SUBJECTIVE',
      emrSectionName: 'Subjective',
      order: 3,
      fields: [
        {
          id: 'hchb_chief_complaint',
          emrFieldId: 'CHIEF_COMPLAINT',
          emrLabel: 'Chief Complaint',
          emrAnswerType: 'textarea',
          order: 1,
          mapping: {
            type: 'direct',
            canonicalConceptId: 'rn.subjective.chief_complaint',
          },
          formatting: {
            maxLength: 2000,
            lineBreaks: 'preserve',
          },
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_patient_report',
          emrFieldId: 'PT_REPORT',
          emrLabel: 'Patient Report',
          emrAnswerType: 'textarea',
          order: 2,
          mapping: {
            type: 'direct',
            canonicalConceptId: 'rn.subjective.patient_report',
          },
          formatting: {
            maxLength: 5000,
            lineBreaks: 'preserve',
          },
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_er_hosp',
          emrFieldId: 'ER_HOSP',
          emrLabel: 'ER/Hospitalization',
          emrAnswerType: 'checkbox',
          order: 3,
          mapping: {
            type: 'transform',
            canonicalConceptId: 'rn.subjective.er_hospitalization',
            transform: {
              type: 'boolean_to_text',
              params: { trueText: 'Yes', falseText: 'No' },
            },
          },
          emrRequired: true,
          includeInOutput: true,
        },
      ],
    },

    // ===========================================
    // OBJECTIVE
    // ===========================================
    {
      id: 'hchb_objective',
      emrSectionId: 'OBJECTIVE',
      emrSectionName: 'Objective',
      order: 4,
      fields: [
        {
          id: 'hchb_general_appearance',
          emrFieldId: 'GEN_APPEAR',
          emrLabel: 'General Appearance',
          emrAnswerType: 'multi_checkbox',
          order: 1,
          mapping: {
            type: 'transform',
            canonicalConceptId: 'rn.objective.general_appearance',
            transform: {
              type: 'array_join',
              params: { separator: ', ' },
            },
          },
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_skin',
          emrFieldId: 'SKIN',
          emrLabel: 'Skin Assessment',
          emrAnswerType: 'multi_checkbox',
          order: 2,
          mapping: {
            type: 'transform',
            canonicalConceptId: 'rn.objective.skin_assessment',
            transform: {
              type: 'array_join',
              params: { separator: ', ' },
            },
          },
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_resp',
          emrFieldId: 'RESP',
          emrLabel: 'Respiratory',
          emrAnswerType: 'multi_checkbox',
          order: 3,
          mapping: {
            type: 'transform',
            canonicalConceptId: 'rn.objective.respiratory',
            transform: {
              type: 'array_join',
              params: { separator: ', ' },
            },
          },
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_cardiac',
          emrFieldId: 'CARDIAC',
          emrLabel: 'Cardiac',
          emrAnswerType: 'multi_checkbox',
          order: 4,
          mapping: {
            type: 'transform',
            canonicalConceptId: 'rn.objective.cardiac',
            transform: {
              type: 'array_join',
              params: { separator: ', ' },
            },
          },
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_narrative',
          emrFieldId: 'OBJ_NARRATIVE',
          emrLabel: 'Additional Findings',
          emrAnswerType: 'textarea',
          order: 5,
          mapping: {
            type: 'direct',
            canonicalConceptId: 'rn.objective.narrative',
          },
          formatting: {
            maxLength: 5000,
            lineBreaks: 'preserve',
          },
          emrRequired: false,
          includeInOutput: true,
        },
      ],
    },

    // ===========================================
    // ASSESSMENT & PLAN
    // ===========================================
    {
      id: 'hchb_assessment_plan',
      emrSectionId: 'ASSESSMENT_PLAN',
      emrSectionName: 'Assessment & Plan',
      order: 5,
      fields: [
        {
          id: 'hchb_clinical_assessment',
          emrFieldId: 'CLIN_ASSESS',
          emrLabel: 'Clinical Assessment',
          emrAnswerType: 'textarea',
          order: 1,
          mapping: {
            type: 'direct',
            canonicalConceptId: 'rn.assessment.clinical',
          },
          formatting: {
            maxLength: 10000,
            lineBreaks: 'preserve',
          },
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_homebound',
          emrFieldId: 'HOMEBOUND_STATUS',
          emrLabel: 'Homebound Status',
          emrAnswerType: 'dropdown',
          order: 2,
          mapping: {
            type: 'transform',
            canonicalConceptId: 'rn.assessment.homebound_status',
            transform: {
              type: 'map',
              valueMap: {
                'confined': 'HB1',
                'requires_assistance': 'HB2',
                'absences_medical': 'HB3',
                'absences_infrequent': 'HB4',
              },
            },
          },
          allowedValues: [
            { code: 'HB1', label: 'Confined to home', canonicalCodes: ['confined'] },
            { code: 'HB2', label: 'Requires assistance', canonicalCodes: ['requires_assistance'] },
            { code: 'HB3', label: 'Medical appointments only', canonicalCodes: ['absences_medical'] },
            { code: 'HB4', label: 'Infrequent absences', canonicalCodes: ['absences_infrequent'] },
          ],
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_skilled_need',
          emrFieldId: 'SKILLED_NEED',
          emrLabel: 'Skilled Nursing Need',
          emrAnswerType: 'multi_checkbox',
          order: 3,
          mapping: {
            type: 'transform',
            canonicalConceptId: 'rn.assessment.skilled_need',
            transform: {
              type: 'array_join',
              params: { separator: ', ' },
            },
          },
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_plan',
          emrFieldId: 'PLAN',
          emrLabel: 'Plan of Care',
          emrAnswerType: 'textarea',
          order: 4,
          mapping: {
            type: 'direct',
            canonicalConceptId: 'rn.plan.narrative',
          },
          formatting: {
            maxLength: 10000,
            lineBreaks: 'preserve',
          },
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_md_notify',
          emrFieldId: 'MD_NOTIFY',
          emrLabel: 'Physician Notification',
          emrAnswerType: 'checkbox',
          order: 5,
          mapping: {
            type: 'transform',
            canonicalConceptId: 'rn.plan.physician_notification',
            transform: {
              type: 'boolean_to_text',
              params: { trueText: 'Yes', falseText: 'No' },
            },
          },
          emrRequired: true,
          includeInOutput: true,
        },
      ],
    },

    // ===========================================
    // INTERVENTIONS
    // ===========================================
    {
      id: 'hchb_interventions',
      emrSectionId: 'INTERVENTIONS',
      emrSectionName: 'Interventions',
      order: 6,
      fields: [
        {
          id: 'hchb_interventions_performed',
          emrFieldId: 'INTERVENTIONS',
          emrLabel: 'Interventions Performed',
          emrAnswerType: 'multi_checkbox',
          order: 1,
          mapping: {
            type: 'transform',
            canonicalConceptId: 'intervention.performed',
            transform: {
              type: 'array_join',
              params: { separator: ', ' },
            },
          },
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_patient_response',
          emrFieldId: 'PT_RESPONSE',
          emrLabel: 'Patient Response',
          emrAnswerType: 'dropdown',
          order: 2,
          mapping: {
            type: 'direct',
            canonicalConceptId: 'intervention.patient_response',
          },
          allowedValues: [
            { code: 'effective', label: 'Effective', canonicalCodes: ['effective'] },
            { code: 'partial', label: 'Partially Effective', canonicalCodes: ['partially_effective'] },
            { code: 'ineffective', label: 'Ineffective', canonicalCodes: ['ineffective'] },
            { code: 'unable', label: 'Unable to Assess', canonicalCodes: ['unable_to_assess'] },
          ],
          emrRequired: true,
          includeInOutput: true,
        },
      ],
    },

    // ===========================================
    // EDUCATION
    // ===========================================
    {
      id: 'hchb_education',
      emrSectionId: 'EDUCATION',
      emrSectionName: 'Education',
      order: 7,
      fields: [
        {
          id: 'hchb_education_provided',
          emrFieldId: 'EDUCATION_YN',
          emrLabel: 'Education Provided',
          emrAnswerType: 'checkbox',
          order: 1,
          mapping: {
            type: 'transform',
            canonicalConceptId: 'education.provided',
            transform: {
              type: 'boolean_to_text',
              params: { trueText: 'Yes', falseText: 'No' },
            },
          },
          emrRequired: true,
          includeInOutput: true,
        },
        {
          id: 'hchb_education_topics',
          emrFieldId: 'EDUCATION_TOPICS',
          emrLabel: 'Education Topics',
          emrAnswerType: 'multi_checkbox',
          order: 2,
          mapping: {
            type: 'transform',
            canonicalConceptId: 'education.topics',
            transform: {
              type: 'array_join',
              params: { separator: ', ' },
            },
          },
          conditionalInclude: [
            { field: 'education.provided', operator: 'equals', value: true },
          ],
          emrRequired: false,
          includeInOutput: true,
        },
        {
          id: 'hchb_education_response',
          emrFieldId: 'EDUCATION_RESPONSE',
          emrLabel: 'Response to Education',
          emrAnswerType: 'dropdown',
          order: 3,
          mapping: {
            type: 'direct',
            canonicalConceptId: 'education.response',
          },
          conditionalInclude: [
            { field: 'education.provided', operator: 'equals', value: true },
          ],
          emrRequired: false,
          includeInOutput: true,
        },
      ],
    },
  ],

  // Output configuration
  outputConfig: {
    clipboardFormat: 'plain_text',
    clipboardDelimiter: 'newline',
    includeLabels: true,
    labelSeparator: ': ',
    sectionSeparator: '\n---\n',
    emptyFieldBehavior: 'omit',
    naText: 'N/A',
    structuredFormat: 'json',
    validateBeforeExport: true,
    requireAllRequired: false,
  },

  // Metadata
  createdBy: 'system',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  publishedAt: '2024-01-01T00:00:00Z',
  publishedBy: 'system',
  notes: 'Initial HomeCare HomeBase RN SOC template',
};

export default HCHB_RN_SOC_TEMPLATE;
