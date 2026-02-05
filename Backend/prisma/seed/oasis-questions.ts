/**
 * OASIS-E Question Library Seed Data
 * Based on CMS OASIS-E Guidance Manual (effective January 1, 2023)
 *
 * This file contains the actual OASIS questions used in home health care assessments.
 * Questions are organized by section and include response options, validation rules,
 * skip logic, and CMS guidance.
 */

// Assessment types that each question applies to
const ALL_ASSESSMENT_TYPES = [
  'START_OF_CARE',
  'RESUMPTION_OF_CARE',
  'RECERTIFICATION',
  'FOLLOW_UP',
  'TRANSFER_TO_INPATIENT',
  'DISCHARGE_FROM_AGENCY',
  'DEATH_AT_HOME',
];

const SOC_ROC = ['START_OF_CARE', 'RESUMPTION_OF_CARE'];
const SOC_ROC_RECERT = ['START_OF_CARE', 'RESUMPTION_OF_CARE', 'RECERTIFICATION'];
const SOC_ROC_RECERT_FU = ['START_OF_CARE', 'RESUMPTION_OF_CARE', 'RECERTIFICATION', 'FOLLOW_UP'];
const DISCHARGE_TYPES = ['TRANSFER_TO_INPATIENT', 'DISCHARGE_FROM_AGENCY', 'DEATH_AT_HOME'];
const SOC_ROC_DC = ['START_OF_CARE', 'RESUMPTION_OF_CARE', 'DISCHARGE_FROM_AGENCY'];

export interface OasisQuestionSeed {
  itemCode: string;
  itemName: string;
  section: string;
  questionText: string;
  helpText?: string;
  responseType: 'single_select' | 'multi_select' | 'numeric' | 'date' | 'text' | 'icd10';
  responses?: {
    code: string;
    label: string;
    description?: string;
    scoringWeight?: number;
  }[];
  skipLogic?: {
    condition: string;
    skipToItem: string;
    reason: string;
  };
  validationRules?: {
    ruleType: 'required' | 'conditional' | 'range' | 'consistency' | 'date';
    errorMessage: string;
    severity: 'error' | 'warning';
    condition?: string;
  }[];
  assessmentTypes: string[];
  effectiveDate: Date;
  cmsGuidance?: string;
  sortOrder: number;
}

// ===========================================
// CLINICAL RECORD ITEMS (M0010-M0080)
// ===========================================

const clinicalRecordItems: OasisQuestionSeed[] = [
  {
    itemCode: 'M0010',
    itemName: 'CMS Certification Number',
    section: 'clinical_record',
    questionText: 'CMS Certification Number',
    helpText: 'Enter the Medicare-certified home health agency\'s 6-digit identification number assigned by CMS.',
    responseType: 'text',
    validationRules: [
      { ruleType: 'required', errorMessage: 'CMS Certification Number is required', severity: 'error' },
    ],
    assessmentTypes: ALL_ASSESSMENT_TYPES,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 1,
  },
  {
    itemCode: 'M0014',
    itemName: 'Branch State',
    section: 'clinical_record',
    questionText: 'Branch State',
    helpText: 'Enter the two-character state code for the branch that services the patient.',
    responseType: 'text',
    validationRules: [
      { ruleType: 'required', errorMessage: 'Branch State is required', severity: 'error' },
    ],
    assessmentTypes: ALL_ASSESSMENT_TYPES,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 2,
  },
  {
    itemCode: 'M0016',
    itemName: 'Branch ID Number',
    section: 'clinical_record',
    questionText: 'Branch ID Number',
    helpText: 'Enter the 10-digit branch identification number assigned by CMS.',
    responseType: 'text',
    assessmentTypes: ALL_ASSESSMENT_TYPES,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 3,
  },
  {
    itemCode: 'M0018',
    itemName: 'National Provider Identifier (NPI)',
    section: 'clinical_record',
    questionText: 'National Provider Identifier (NPI) for the attending physician',
    helpText: 'Enter the NPI of the attending physician who is responsible for the HHA plan of care.',
    responseType: 'text',
    validationRules: [
      { ruleType: 'required', errorMessage: 'NPI is required', severity: 'error' },
    ],
    assessmentTypes: ALL_ASSESSMENT_TYPES,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 4,
  },
  {
    itemCode: 'M0020',
    itemName: 'Patient ID Number',
    section: 'clinical_record',
    questionText: 'Patient ID Number',
    helpText: 'Enter the agency-assigned patient identifier.',
    responseType: 'text',
    validationRules: [
      { ruleType: 'required', errorMessage: 'Patient ID is required', severity: 'error' },
    ],
    assessmentTypes: ALL_ASSESSMENT_TYPES,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 5,
  },
  {
    itemCode: 'M0030',
    itemName: 'Start of Care Date',
    section: 'clinical_record',
    questionText: 'Start of Care Date',
    helpText: 'Enter the date the patient first received home care services for this episode of care.',
    responseType: 'date',
    validationRules: [
      { ruleType: 'required', errorMessage: 'Start of Care Date is required for SOC assessments', severity: 'error', condition: 'assessmentType=START_OF_CARE' },
    ],
    assessmentTypes: ALL_ASSESSMENT_TYPES,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 6,
  },
  {
    itemCode: 'M0032',
    itemName: 'Resumption of Care Date',
    section: 'clinical_record',
    questionText: 'Resumption of Care Date',
    helpText: 'Enter the date the patient resumed home care services following an inpatient stay.',
    responseType: 'date',
    validationRules: [
      { ruleType: 'required', errorMessage: 'Resumption of Care Date is required for ROC assessments', severity: 'error', condition: 'assessmentType=RESUMPTION_OF_CARE' },
    ],
    assessmentTypes: ['RESUMPTION_OF_CARE'],
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 7,
  },
  {
    itemCode: 'M0040',
    itemName: 'Patient Name',
    section: 'clinical_record',
    questionText: 'Patient Name (Last, First, Middle Initial, Suffix)',
    responseType: 'text',
    validationRules: [
      { ruleType: 'required', errorMessage: 'Patient name is required', severity: 'error' },
    ],
    assessmentTypes: ALL_ASSESSMENT_TYPES,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 8,
  },
  {
    itemCode: 'M0050',
    itemName: 'Patient State of Residence',
    section: 'clinical_record',
    questionText: 'Patient State of Residence',
    responseType: 'text',
    validationRules: [
      { ruleType: 'required', errorMessage: 'Patient state is required', severity: 'error' },
    ],
    assessmentTypes: ALL_ASSESSMENT_TYPES,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 9,
  },
  {
    itemCode: 'M0060',
    itemName: 'Patient ZIP Code',
    section: 'clinical_record',
    questionText: 'Patient ZIP Code',
    responseType: 'text',
    validationRules: [
      { ruleType: 'required', errorMessage: 'ZIP code is required', severity: 'error' },
    ],
    assessmentTypes: ALL_ASSESSMENT_TYPES,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 10,
  },
  {
    itemCode: 'M0066',
    itemName: 'Birth Date',
    section: 'clinical_record',
    questionText: 'Patient Birth Date',
    responseType: 'date',
    validationRules: [
      { ruleType: 'required', errorMessage: 'Birth date is required', severity: 'error' },
    ],
    assessmentTypes: ALL_ASSESSMENT_TYPES,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 11,
  },
  {
    itemCode: 'M0069',
    itemName: 'Gender',
    section: 'clinical_record',
    questionText: 'Gender',
    responseType: 'single_select',
    responses: [
      { code: '1', label: 'Male' },
      { code: '2', label: 'Female' },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Gender is required', severity: 'error' },
    ],
    assessmentTypes: ALL_ASSESSMENT_TYPES,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 12,
  },
  {
    itemCode: 'M0080',
    itemName: 'Discipline of Person Completing Assessment',
    section: 'clinical_record',
    questionText: 'Discipline of Person Completing Assessment',
    responseType: 'single_select',
    responses: [
      { code: '1', label: 'RN' },
      { code: '2', label: 'PT' },
      { code: '3', label: 'SLP/ST' },
      { code: '4', label: 'OT' },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Discipline is required', severity: 'error' },
    ],
    assessmentTypes: ALL_ASSESSMENT_TYPES,
    effectiveDate: new Date('2023-01-01'),
    cmsGuidance: 'Only RN, PT, SLP, or OT may complete a comprehensive assessment.',
    sortOrder: 13,
  },
];

// ===========================================
// PATIENT TRACKING ITEMS (M0090-M0110)
// ===========================================

const patientTrackingItems: OasisQuestionSeed[] = [
  {
    itemCode: 'M0090',
    itemName: 'Date Assessment Completed',
    section: 'patient_tracking',
    questionText: 'Date Assessment Completed',
    helpText: 'Enter the date the assessment was completed.',
    responseType: 'date',
    validationRules: [
      { ruleType: 'required', errorMessage: 'Assessment completion date is required', severity: 'error' },
    ],
    assessmentTypes: ALL_ASSESSMENT_TYPES,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 14,
  },
  {
    itemCode: 'M0100',
    itemName: 'Reason for Assessment',
    section: 'patient_tracking',
    questionText: 'This Assessment is Currently Being Completed for the Following Reason',
    responseType: 'single_select',
    responses: [
      { code: '01', label: 'Start of care—further visits planned' },
      { code: '03', label: 'Resumption of care (after inpatient stay)' },
      { code: '04', label: 'Recertification (follow-up) reassessment' },
      { code: '05', label: 'Other follow-up' },
      { code: '06', label: 'Transferred to an inpatient facility—patient not discharged from agency' },
      { code: '07', label: 'Transferred to an inpatient facility—patient discharged from agency' },
      { code: '08', label: 'Death at home' },
      { code: '09', label: 'Discharge from agency' },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Reason for assessment is required', severity: 'error' },
    ],
    assessmentTypes: ALL_ASSESSMENT_TYPES,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 15,
  },
  {
    itemCode: 'M0110',
    itemName: 'Episode Timing',
    section: 'patient_tracking',
    questionText: 'Episode Timing: Is the Medicare home health payment episode for which this assessment will define a case mix group an "early" episode or a "later" episode in the patient\'s current sequence of adjacent Medicare home health payment episodes?',
    responseType: 'single_select',
    responses: [
      { code: '1', label: 'Early' },
      { code: '2', label: 'Later' },
      { code: 'UK', label: 'Unknown' },
      { code: 'NA', label: 'Not Applicable: No Medicare case mix group to be defined by this assessment' },
    ],
    assessmentTypes: SOC_ROC_RECERT,
    effectiveDate: new Date('2023-01-01'),
    cmsGuidance: 'An "Early" episode is the first or second consecutive Medicare home health payment episode. A "Later" episode is the third or later consecutive episode.',
    sortOrder: 16,
  },
];

// ===========================================
// PATIENT HISTORY (M1000-M1056)
// ===========================================

const patientHistoryItems: OasisQuestionSeed[] = [
  {
    itemCode: 'M1000',
    itemName: 'Primary Diagnosis',
    section: 'patient_history',
    questionText: 'Primary Diagnosis & ICD code category (three digits) for the primary diagnosis',
    helpText: 'Enter the ICD-10-CM code that represents the primary reason for home health services.',
    responseType: 'icd10',
    validationRules: [
      { ruleType: 'required', errorMessage: 'Primary diagnosis is required', severity: 'error' },
    ],
    assessmentTypes: ALL_ASSESSMENT_TYPES,
    effectiveDate: new Date('2023-01-01'),
    cmsGuidance: 'The primary diagnosis is the chief reason home health services are required and should be coded to the highest level of specificity.',
    sortOrder: 20,
  },
  {
    itemCode: 'M1005',
    itemName: 'Other Diagnoses',
    section: 'patient_history',
    questionText: 'Other Diagnoses',
    helpText: 'List secondary diagnoses that are actively addressed in the patient\'s plan of care.',
    responseType: 'icd10',
    assessmentTypes: ALL_ASSESSMENT_TYPES,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 21,
  },
  {
    itemCode: 'M1021',
    itemName: 'Primary Diagnosis Severity',
    section: 'patient_history',
    questionText: 'Primary Diagnosis Severity Rating',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'Asymptomatic, no treatment needed at this time', scoringWeight: 0 },
      { code: '1', label: 'Symptoms well controlled with current therapy', scoringWeight: 1 },
      { code: '2', label: 'Symptoms controlled with difficulty, affecting daily functioning', scoringWeight: 2 },
      { code: '3', label: 'Symptoms poorly controlled, patient needs frequent adjustment in treatment', scoringWeight: 3 },
      { code: '4', label: 'Symptoms poorly controlled, history of rehospitalizations', scoringWeight: 4 },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Primary diagnosis severity rating is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 22,
  },
  {
    itemCode: 'M1033',
    itemName: 'Risk for Hospitalization',
    section: 'patient_history',
    questionText: 'Risk for Hospitalization: Which of the following signs or symptoms characterize this patient as at risk for hospitalization?',
    responseType: 'multi_select',
    responses: [
      { code: '1', label: 'History of falls (2 or more falls—or any fall with an injury—in the past 12 months)' },
      { code: '2', label: 'Unintentional weight loss of a total of 10 pounds or more in the past 12 months' },
      { code: '3', label: 'Multiple hospitalizations (2 or more) in the past 6 months' },
      { code: '4', label: 'Multiple emergency department visits (2 or more) in the past 6 months' },
      { code: '5', label: 'Decline in mental, emotional, or behavioral status in the past 3 months' },
      { code: '6', label: 'Reported or observed history of difficulty complying with any medical instructions in the past 3 months' },
      { code: '7', label: 'Currently taking 5 or more medications' },
      { code: '8', label: 'Currently reports exhaustion' },
      { code: '9', label: 'Other risk(s) not listed' },
      { code: '0', label: 'None of the above' },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Risk for hospitalization assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 23,
  },
  {
    itemCode: 'M1041',
    itemName: 'Influenza Vaccine Received',
    section: 'patient_history',
    questionText: 'Influenza Vaccine: Did the patient receive the influenza vaccine for this year\'s flu season?',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'No' },
      { code: '1', label: 'Yes; received from agency' },
      { code: '2', label: 'Yes; received from another provider' },
      { code: '3', label: 'Patient offered but declined' },
      { code: '4', label: 'Patient assessed and offered vaccine but was ineligible' },
    ],
    assessmentTypes: SOC_ROC_DC,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 24,
  },
  {
    itemCode: 'M1056',
    itemName: 'High-Risk Drug Education',
    section: 'patient_history',
    questionText: 'Does the patient/caregiver possess knowledge of medication management including purpose, administration, and potential side effects of high-risk drugs?',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'No' },
      { code: '1', label: 'Yes' },
      { code: 'NA', label: 'N/A—No high-risk drugs or fully cognizant caregiver' },
    ],
    assessmentTypes: SOC_ROC_DC,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 25,
  },
];

// ===========================================
// SENSORY STATUS (M1200-M1242)
// ===========================================

const sensoryStatusItems: OasisQuestionSeed[] = [
  {
    itemCode: 'M1200',
    itemName: 'Vision',
    section: 'sensory_status',
    questionText: 'Vision (with corrective lenses if the patient usually wears them)',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'Normal vision: sees adequately in most situations' },
      { code: '1', label: 'Partially impaired: cannot see medication labels or newsprint, but can see obstacles in path' },
      { code: '2', label: 'Severely impaired: cannot locate objects without hearing or touching them' },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Vision assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 30,
  },
  {
    itemCode: 'M1210',
    itemName: 'Hearing and Ability to Understand Spoken Language',
    section: 'sensory_status',
    questionText: 'Ability to hear (with hearing aids if applicable)',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'Adequate: hears normal conversation without difficulty' },
      { code: '1', label: 'Mildly impaired: difficulty hearing in some environments' },
      { code: '2', label: 'Moderately impaired: speaker must speak loudly or patient reads lips' },
      { code: '3', label: 'Severely impaired: hears only if speaker shouts or speaks in ear' },
      { code: '4', label: 'Profound impairment: unable to hear despite every effort' },
    ],
    assessmentTypes: SOC_ROC,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 31,
  },
  {
    itemCode: 'M1220',
    itemName: 'Understanding of Verbal Content',
    section: 'sensory_status',
    questionText: 'Understanding of Verbal Content in patient\'s own language',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'Understands: clear comprehension without cues or repetitions' },
      { code: '1', label: 'Usually understands: understands most conversations with some difficulty' },
      { code: '2', label: 'Sometimes understands: understands only basic conversations' },
      { code: '3', label: 'Rarely/Never understands' },
    ],
    assessmentTypes: SOC_ROC,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 32,
  },
  {
    itemCode: 'M1230',
    itemName: 'Speech and Oral Expression',
    section: 'sensory_status',
    questionText: 'Speech and Oral (Verbal) Expression of Language',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'Expresses complex ideas, feelings, and needs clearly, completely, and easily' },
      { code: '1', label: 'Minimal difficulty in expressing ideas and needs' },
      { code: '2', label: 'Expresses simple ideas or needs with moderate difficulty' },
      { code: '3', label: 'Has severe difficulty expressing basic ideas or needs' },
      { code: '4', label: 'Unable to express basic needs' },
    ],
    assessmentTypes: SOC_ROC,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 33,
  },
  {
    itemCode: 'M1240',
    itemName: 'Pain Assessment',
    section: 'sensory_status',
    questionText: 'Has the patient had a formal validated pain assessment using a standardized pain assessment tool?',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'No standardized assessment—skip to M1242' },
      { code: '1', label: 'Yes, and it indicates the patient has no pain' },
      { code: '2', label: 'Yes, and it indicates the patient has pain' },
    ],
    skipLogic: {
      condition: 'M1240 = 0',
      skipToItem: 'M1242',
      reason: 'No standardized pain assessment conducted',
    },
    validationRules: [
      { ruleType: 'required', errorMessage: 'Pain assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT,
    effectiveDate: new Date('2023-01-01'),
    cmsGuidance: 'A standardized pain assessment tool is a validated instrument used to quantify pain.',
    sortOrder: 34,
  },
  {
    itemCode: 'M1242',
    itemName: 'Frequency of Pain Interfering with Activity',
    section: 'sensory_status',
    questionText: 'Frequency of Pain Interfering with patient\'s activity or movement',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'Patient has no pain' },
      { code: '1', label: 'Patient has pain that does not interfere with activity or movement' },
      { code: '2', label: 'Less often than daily' },
      { code: '3', label: 'Daily, but not constantly' },
      { code: '4', label: 'All of the time' },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Pain frequency assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 35,
  },
];

// ===========================================
// INTEGUMENTARY STATUS (M1300-M1350)
// ===========================================

const integumentaryItems: OasisQuestionSeed[] = [
  {
    itemCode: 'M1300',
    itemName: 'Pressure Ulcer Risk Assessment',
    section: 'integumentary_status',
    questionText: 'Pressure Ulcer Risk Assessment: Was the patient assessed for pressure ulcer risk using a standardized, validated tool?',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'No' },
      { code: '1', label: 'Yes—patient not at risk' },
      { code: '2', label: 'Yes—patient is at risk' },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Pressure ulcer risk assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC,
    effectiveDate: new Date('2023-01-01'),
    cmsGuidance: 'Use a standardized, validated pressure ulcer risk assessment tool such as the Braden Scale.',
    sortOrder: 40,
  },
  {
    itemCode: 'M1306',
    itemName: 'Unhealed Pressure Ulcers Present',
    section: 'integumentary_status',
    questionText: 'Does this patient have one or more unhealed pressure ulcer(s) at Stage 2 or higher?',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'No' },
      { code: '1', label: 'Yes' },
    ],
    skipLogic: {
      condition: 'M1306 = 0',
      skipToItem: 'M1322',
      reason: 'No unhealed pressure ulcers present',
    },
    validationRules: [
      { ruleType: 'required', errorMessage: 'Unhealed pressure ulcer assessment is required', severity: 'error' },
    ],
    assessmentTypes: ALL_ASSESSMENT_TYPES,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 41,
  },
  {
    itemCode: 'M1307',
    itemName: 'Oldest Stage 2 Pressure Ulcer',
    section: 'integumentary_status',
    questionText: 'The oldest Stage 2 pressure ulcer that is present at discharge',
    responseType: 'single_select',
    responses: [
      { code: '1', label: 'Was present at most recent SOC/ROC' },
      { code: '2', label: 'Developed since most recent SOC/ROC' },
      { code: 'NA', label: 'No Stage 2 pressure ulcers present at discharge' },
    ],
    assessmentTypes: DISCHARGE_TYPES,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 42,
  },
  {
    itemCode: 'M1311',
    itemName: 'Current Number of Unhealed Pressure Ulcers',
    section: 'integumentary_status',
    questionText: 'Current Number of Unhealed Pressure Ulcers at Each Stage',
    helpText: 'Enter the number of pressure ulcers at each stage.',
    responseType: 'numeric',
    validationRules: [
      { ruleType: 'range', errorMessage: 'Number must be 0 or greater', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 43,
  },
  {
    itemCode: 'M1322',
    itemName: 'Current Number of Stasis Ulcers',
    section: 'integumentary_status',
    questionText: 'Current Number of Stage II or Higher Observable Stasis Ulcers',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'Zero' },
      { code: '1', label: 'One' },
      { code: '2', label: 'Two' },
      { code: '3', label: 'Three' },
      { code: '4', label: 'Four or more' },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Stasis ulcer count is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 44,
  },
  {
    itemCode: 'M1324',
    itemName: 'Stage of Most Problematic Stasis Ulcer',
    section: 'integumentary_status',
    questionText: 'Stage of Most Problematic (Observable) Stasis Ulcer That is Stageable',
    responseType: 'single_select',
    responses: [
      { code: '1', label: 'Stage II' },
      { code: '2', label: 'Stage III' },
      { code: '3', label: 'Stage IV' },
      { code: 'NA', label: 'No observable stasis ulcers' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 45,
  },
  {
    itemCode: 'M1330',
    itemName: 'Surgical Wound Present',
    section: 'integumentary_status',
    questionText: 'Does this patient have a surgical wound?',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'No—skip to M1340' },
      { code: '1', label: 'Yes, patient has at least one surgical wound' },
      { code: '2', label: 'Surgical wound(s) fully granulated or healed' },
    ],
    skipLogic: {
      condition: 'M1330 = 0',
      skipToItem: 'M1340',
      reason: 'No surgical wound present',
    },
    validationRules: [
      { ruleType: 'required', errorMessage: 'Surgical wound assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 46,
  },
  {
    itemCode: 'M1340',
    itemName: 'Surgical Wound Status',
    section: 'integumentary_status',
    questionText: 'Does the patient have a surgical wound that has NOT healed by primary intention?',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'No' },
      { code: '1', label: 'Yes' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 47,
  },
];

// ===========================================
// RESPIRATORY STATUS (M1400-M1410)
// ===========================================

const respiratoryItems: OasisQuestionSeed[] = [
  {
    itemCode: 'M1400',
    itemName: 'Dyspnea',
    section: 'respiratory_status',
    questionText: 'When is the patient dyspneic or noticeably Short of Breath?',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'Patient is not short of breath', scoringWeight: 0 },
      { code: '1', label: 'When walking more than 20 feet, climbing stairs', scoringWeight: 1 },
      { code: '2', label: 'With moderate exertion (e.g., while dressing, using commode)', scoringWeight: 2 },
      { code: '3', label: 'With minimal exertion (e.g., while eating, talking)', scoringWeight: 3 },
      { code: '4', label: 'At rest (during day or night)', scoringWeight: 4 },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Dyspnea assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 50,
  },
];

// ===========================================
// CARDIAC STATUS (M1500-M1510)
// ===========================================

const cardiacItems: OasisQuestionSeed[] = [
  {
    itemCode: 'M1500',
    itemName: 'Symptoms in Heart Failure Patients',
    section: 'cardiac_status',
    questionText: 'Symptoms in Heart Failure Patients: Has this patient been assessed for symptoms of heart failure?',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'No' },
      { code: '1', label: 'Yes, and no symptoms present' },
      { code: '2', label: 'Yes, and symptoms present' },
      { code: 'NA', label: 'N/A—Patient does not have diagnosis of heart failure' },
    ],
    assessmentTypes: SOC_ROC_RECERT,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 55,
  },
];

// ===========================================
// ELIMINATION STATUS (M1600-M1630)
// ===========================================

const eliminationItems: OasisQuestionSeed[] = [
  {
    itemCode: 'M1600',
    itemName: 'Urinary Tract Infection',
    section: 'elimination_status',
    questionText: 'Has the patient been treated for a Urinary Tract Infection in the past 14 days?',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'No' },
      { code: '1', label: 'Yes' },
      { code: 'NA', label: 'Patient on prophylactic treatment' },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'UTI assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 60,
  },
  {
    itemCode: 'M1610',
    itemName: 'Urinary Incontinence or Urinary Catheter',
    section: 'elimination_status',
    questionText: 'Urinary Incontinence or Urinary Catheter Presence',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'No incontinence or catheter (includes anuria)' },
      { code: '1', label: 'Patient is incontinent' },
      { code: '2', label: 'Patient requires a urinary catheter' },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Urinary incontinence assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 61,
  },
  {
    itemCode: 'M1620',
    itemName: 'Bowel Incontinence Frequency',
    section: 'elimination_status',
    questionText: 'Bowel Incontinence Frequency',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'Very rarely or never has bowel incontinence' },
      { code: '1', label: 'Less than once weekly' },
      { code: '2', label: 'One to three times weekly' },
      { code: '3', label: 'Four to six times weekly' },
      { code: '4', label: 'On a daily basis' },
      { code: '5', label: 'More often than once daily' },
      { code: 'NA', label: 'Patient has an ostomy for bowel elimination' },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Bowel incontinence assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 62,
  },
  {
    itemCode: 'M1630',
    itemName: 'Ostomy for Bowel Elimination',
    section: 'elimination_status',
    questionText: 'Ostomy for Bowel Elimination: Does this patient have an ostomy for bowel elimination?',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'No' },
      { code: '1', label: 'Yes' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 63,
  },
];

// ===========================================
// NEURO/EMOTIONAL/BEHAVIORAL (M1700-M1750)
// ===========================================

const neuroEmotionalItems: OasisQuestionSeed[] = [
  {
    itemCode: 'M1700',
    itemName: 'Cognitive Functioning',
    section: 'neuro_emotional',
    questionText: 'Cognitive Functioning: Patient\'s current level of alertness, orientation, comprehension, concentration, and immediate memory for simple commands.',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'Alert/oriented, able to focus and shift attention, comprehends and recalls task directions independently', scoringWeight: 0 },
      { code: '1', label: 'Requires prompting (cueing, repetition, reminders) only under stressful or unfamiliar conditions', scoringWeight: 1 },
      { code: '2', label: 'Requires assistance and some direction in specific situations or consistently requires low stimulus environment', scoringWeight: 2 },
      { code: '3', label: 'Requires considerable assistance in routine situations; is not alert and oriented or is unable to shift attention', scoringWeight: 3 },
      { code: '4', label: 'Totally dependent due to disturbances such as constant disorientation, coma, persistent vegetative state, or delirium', scoringWeight: 4 },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Cognitive functioning assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 70,
  },
  {
    itemCode: 'M1710',
    itemName: 'When Confused',
    section: 'neuro_emotional',
    questionText: 'When Confused (Reported or Observed Within the Last 14 Days)',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'Never' },
      { code: '1', label: 'In new or complex situations only' },
      { code: '2', label: 'On awakening or at night only' },
      { code: '3', label: 'During the day and evening, but not constantly' },
      { code: '4', label: 'Constantly' },
      { code: 'NA', label: 'Patient nonresponsive' },
    ],
    assessmentTypes: SOC_ROC_RECERT,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 71,
  },
  {
    itemCode: 'M1720',
    itemName: 'When Anxious',
    section: 'neuro_emotional',
    questionText: 'When Anxious (Reported or Observed Within the Last 14 Days)',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'None of the time' },
      { code: '1', label: 'Less often than daily' },
      { code: '2', label: 'Daily, but not constantly' },
      { code: '3', label: 'All of the time' },
      { code: 'NA', label: 'Patient nonresponsive' },
    ],
    assessmentTypes: SOC_ROC_RECERT,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 72,
  },
  {
    itemCode: 'M1730',
    itemName: 'PHQ-2 Depression Screening',
    section: 'neuro_emotional',
    questionText: 'PHQ-2: Over the last 2 weeks, how often have you been bothered by little interest or pleasure in doing things?',
    helpText: 'Use the PHQ-2 standardized screening tool.',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'Not at all' },
      { code: '1', label: 'Several days' },
      { code: '2', label: 'More than half the days' },
      { code: '3', label: 'Nearly every day' },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'PHQ-2 screening is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC,
    effectiveDate: new Date('2023-01-01'),
    cmsGuidance: 'If PHQ-2 score is 3 or greater, complete PHQ-9.',
    sortOrder: 73,
  },
  {
    itemCode: 'M1740',
    itemName: 'PHQ-9 Total Severity Score',
    section: 'neuro_emotional',
    questionText: 'PHQ-9: Total Severity Score',
    responseType: 'numeric',
    validationRules: [
      { ruleType: 'range', errorMessage: 'PHQ-9 score must be between 0 and 27', severity: 'error' },
      { ruleType: 'conditional', errorMessage: 'PHQ-9 required when PHQ-2 >= 3', severity: 'error', condition: 'M1730 >= 3' },
    ],
    assessmentTypes: SOC_ROC,
    effectiveDate: new Date('2023-01-01'),
    cmsGuidance: 'Complete PHQ-9 only if PHQ-2 indicates depression (score >= 3).',
    sortOrder: 74,
  },
  {
    itemCode: 'M1745',
    itemName: 'Frequency of Disruptive Behavior Symptoms',
    section: 'neuro_emotional',
    questionText: 'Frequency of Disruptive Behavior Symptoms',
    responseType: 'single_select',
    responses: [
      { code: '0', label: 'Never' },
      { code: '1', label: 'Less than once a month' },
      { code: '2', label: 'Once a month' },
      { code: '3', label: 'Several times each month' },
      { code: '4', label: 'Several times a week' },
      { code: '5', label: 'At least daily' },
    ],
    assessmentTypes: SOC_ROC_RECERT,
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 75,
  },
];

// ===========================================
// FUNCTIONAL ABILITIES - SELF CARE (GG0130)
// ===========================================

const functionalSelfCareItems: OasisQuestionSeed[] = [
  {
    itemCode: 'GG0130A',
    itemName: 'Self-Care: Eating',
    section: 'functional_abilities',
    questionText: 'Eating: The ability to use suitable utensils to bring food and/or liquid to the mouth and swallow food and/or liquid once the meal is placed before the patient.',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent—Patient completes the activity by themself with no assistance from a helper', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance—Helper sets up or cleans up; patient completes activity', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance—Helper provides verbal cues and/or touching/steadying and/or contact guard assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance—Helper does LESS THAN HALF the effort', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance—Helper does MORE THAN HALF the effort', scoringWeight: 2 },
      { code: '01', label: 'Dependent—Helper does ALL of the effort', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable—Not attempted and patient did not perform this activity prior to the current illness', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Eating assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    cmsGuidance: 'Assess the patient\'s ability to eat, not the ability to prepare food.',
    sortOrder: 80,
  },
  {
    itemCode: 'GG0130B',
    itemName: 'Self-Care: Oral Hygiene',
    section: 'functional_abilities',
    questionText: 'Oral Hygiene: The ability to use suitable items to clean teeth. Dentures: The ability to insert and remove dentures into and from the mouth, and manage denture storage and cleaning.',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance', scoringWeight: 2 },
      { code: '01', label: 'Dependent', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Oral hygiene assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 81,
  },
  {
    itemCode: 'GG0130C',
    itemName: 'Self-Care: Toileting Hygiene',
    section: 'functional_abilities',
    questionText: 'Toileting Hygiene: The ability to maintain perineal hygiene, adjust clothes before and after voiding or having a bowel movement. If managing ostomy, include cleaning area around stoma.',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance', scoringWeight: 2 },
      { code: '01', label: 'Dependent', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Toileting hygiene assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 82,
  },
  {
    itemCode: 'GG0130E',
    itemName: 'Self-Care: Shower/Bathe Self',
    section: 'functional_abilities',
    questionText: 'Shower/Bathe Self: The ability to bathe self, including washing, rinsing, and drying self (excludes washing of back and hair). Does not include transferring in/out of tub/shower.',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance', scoringWeight: 2 },
      { code: '01', label: 'Dependent', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Shower/bathe self assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 83,
  },
  {
    itemCode: 'GG0130F',
    itemName: 'Self-Care: Upper Body Dressing',
    section: 'functional_abilities',
    questionText: 'Upper Body Dressing: The ability to dress and undress above the waist; includes fasteners, if applicable.',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance', scoringWeight: 2 },
      { code: '01', label: 'Dependent', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Upper body dressing assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 84,
  },
  {
    itemCode: 'GG0130G',
    itemName: 'Self-Care: Lower Body Dressing',
    section: 'functional_abilities',
    questionText: 'Lower Body Dressing: The ability to dress and undress below the waist, including fasteners; does not include footwear.',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance', scoringWeight: 2 },
      { code: '01', label: 'Dependent', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Lower body dressing assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 85,
  },
  {
    itemCode: 'GG0130H',
    itemName: 'Self-Care: Putting On/Taking Off Footwear',
    section: 'functional_abilities',
    questionText: 'Putting On/Taking Off Footwear: The ability to put on and take off socks and shoes or other footwear that is appropriate for safe mobility; includes fasteners.',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance', scoringWeight: 2 },
      { code: '01', label: 'Dependent', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Putting on/taking off footwear assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 86,
  },
];

// ===========================================
// FUNCTIONAL ABILITIES - MOBILITY (GG0170)
// ===========================================

const functionalMobilityItems: OasisQuestionSeed[] = [
  {
    itemCode: 'GG0170A',
    itemName: 'Mobility: Roll Left and Right',
    section: 'functional_abilities',
    questionText: 'Roll Left and Right: The ability to roll from lying on back to left and right side, and return to lying on back on the bed.',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance', scoringWeight: 2 },
      { code: '01', label: 'Dependent', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 90,
  },
  {
    itemCode: 'GG0170B',
    itemName: 'Mobility: Sit to Lying',
    section: 'functional_abilities',
    questionText: 'Sit to Lying: The ability to move from sitting on side of bed to lying flat on the bed.',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance', scoringWeight: 2 },
      { code: '01', label: 'Dependent', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 91,
  },
  {
    itemCode: 'GG0170C',
    itemName: 'Mobility: Lying to Sitting on Side of Bed',
    section: 'functional_abilities',
    questionText: 'Lying to Sitting on Side of Bed: The ability to move from lying on the back to sitting on the side of the bed with feet flat on the floor, and with no back support.',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance', scoringWeight: 2 },
      { code: '01', label: 'Dependent', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Lying to sitting assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 92,
  },
  {
    itemCode: 'GG0170D',
    itemName: 'Mobility: Sit to Stand',
    section: 'functional_abilities',
    questionText: 'Sit to Stand: The ability to come to a standing position from sitting in a chair, wheelchair, or on the side of the bed.',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance', scoringWeight: 2 },
      { code: '01', label: 'Dependent', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Sit to stand assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 93,
  },
  {
    itemCode: 'GG0170E',
    itemName: 'Mobility: Chair/Bed-to-Chair Transfer',
    section: 'functional_abilities',
    questionText: 'Chair/Bed-to-Chair Transfer: The ability to transfer to and from a bed to a chair (or wheelchair).',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance', scoringWeight: 2 },
      { code: '01', label: 'Dependent', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Chair/bed-to-chair transfer assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 94,
  },
  {
    itemCode: 'GG0170F',
    itemName: 'Mobility: Toilet Transfer',
    section: 'functional_abilities',
    questionText: 'Toilet Transfer: The ability to get on and off a toilet or commode.',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance', scoringWeight: 2 },
      { code: '01', label: 'Dependent', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Toilet transfer assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 95,
  },
  {
    itemCode: 'GG0170I',
    itemName: 'Mobility: Walk 10 Feet',
    section: 'functional_abilities',
    questionText: 'Walk 10 feet: Once standing, the ability to walk at least 10 feet in a room, corridor, or similar space.',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance', scoringWeight: 2 },
      { code: '01', label: 'Dependent', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Walk 10 feet assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 96,
  },
  {
    itemCode: 'GG0170J',
    itemName: 'Mobility: Walk 50 Feet with Two Turns',
    section: 'functional_abilities',
    questionText: 'Walk 50 feet with two turns: Once standing, the ability to walk at least 50 feet and make two turns.',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance', scoringWeight: 2 },
      { code: '01', label: 'Dependent', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    validationRules: [
      { ruleType: 'required', errorMessage: 'Walk 50 feet with two turns assessment is required', severity: 'error' },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 97,
  },
  {
    itemCode: 'GG0170K',
    itemName: 'Mobility: Walk 150 Feet',
    section: 'functional_abilities',
    questionText: 'Walk 150 feet: Once standing, the ability to walk at least 150 feet in a corridor or similar space.',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance', scoringWeight: 2 },
      { code: '01', label: 'Dependent', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 98,
  },
  {
    itemCode: 'GG0170M',
    itemName: 'Mobility: 1 Step (Curb)',
    section: 'functional_abilities',
    questionText: '1 step (curb): The ability to go up and down a curb and/or up and down one step.',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance', scoringWeight: 2 },
      { code: '01', label: 'Dependent', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 99,
  },
  {
    itemCode: 'GG0170N',
    itemName: 'Mobility: 4 Steps',
    section: 'functional_abilities',
    questionText: '4 steps: The ability to go up and down four steps with or without a rail.',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance', scoringWeight: 2 },
      { code: '01', label: 'Dependent', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 100,
  },
  {
    itemCode: 'GG0170O',
    itemName: 'Mobility: 12 Steps',
    section: 'functional_abilities',
    questionText: '12 steps: The ability to go up and down 12 steps with or without a rail.',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance', scoringWeight: 2 },
      { code: '01', label: 'Dependent', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 101,
  },
  {
    itemCode: 'GG0170P',
    itemName: 'Mobility: Picking Up Object',
    section: 'functional_abilities',
    questionText: 'Picking up object: The ability to bend/stoop from a standing position to pick up a small object, such as a spoon, from the floor.',
    responseType: 'single_select',
    responses: [
      { code: '06', label: 'Independent', scoringWeight: 6 },
      { code: '05', label: 'Setup or clean-up assistance', scoringWeight: 5 },
      { code: '04', label: 'Supervision or touching assistance', scoringWeight: 4 },
      { code: '03', label: 'Partial/moderate assistance', scoringWeight: 3 },
      { code: '02', label: 'Substantial/maximal assistance', scoringWeight: 2 },
      { code: '01', label: 'Dependent', scoringWeight: 1 },
      { code: '07', label: 'Patient refused', scoringWeight: 0 },
      { code: '09', label: 'Not applicable', scoringWeight: 0 },
      { code: '10', label: 'Not attempted due to environmental limitations', scoringWeight: 0 },
      { code: '88', label: 'Not attempted due to medical condition or safety concerns', scoringWeight: 0 },
    ],
    assessmentTypes: SOC_ROC_RECERT_FU.concat(DISCHARGE_TYPES),
    effectiveDate: new Date('2023-01-01'),
    sortOrder: 102,
  },
];

// ===========================================
// EXPORT ALL QUESTIONS
// ===========================================

export const allOasisQuestions: OasisQuestionSeed[] = [
  ...clinicalRecordItems,
  ...patientTrackingItems,
  ...patientHistoryItems,
  ...sensoryStatusItems,
  ...integumentaryItems,
  ...respiratoryItems,
  ...cardiacItems,
  ...eliminationItems,
  ...neuroEmotionalItems,
  ...functionalSelfCareItems,
  ...functionalMobilityItems,
];

export default allOasisQuestions;
