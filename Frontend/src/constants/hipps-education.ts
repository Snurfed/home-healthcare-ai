/**
 * HIPPS Code Education Constants
 *
 * Educational content for explaining HIPPS code components
 * and reimbursement calculations under PDGM
 */

// Position explanations for the 5-character HIPPS code
export const HIPPS_POSITION_EXPLANATIONS = {
  position1: {
    title: 'Admission Source & Timing',
    description: 'Indicates the admission source (institutional vs community) and episode timing (early vs late in the 60-day period).',
    codes: {
      '1': { label: 'Community - Early', description: 'Community admission, days 1-30' },
      '2': { label: 'Community - Late', description: 'Community admission, days 31-60' },
      '3': { label: 'Institutional - Early', description: 'Institutional admission, days 1-30' },
      '4': { label: 'Institutional - Late', description: 'Institutional admission, days 31-60' },
    },
  },
  position2: {
    title: 'Clinical Grouping',
    description: 'Based on the primary diagnosis, patients are assigned to one of 12 clinical groups that represent common home health conditions.',
    codes: {
      A: { label: 'MMTA - Surgical Aftercare', description: 'Musculoskeletal Rehab - Surgical' },
      B: { label: 'MMTA - Medical/Other', description: 'Musculoskeletal Rehab - Medical' },
      C: { label: 'Neuro Rehab', description: 'Neurological Rehabilitation' },
      D: { label: 'Wounds - Post-Op', description: 'Wound care following surgery' },
      E: { label: 'Wounds - Diabetic', description: 'Diabetic wound care' },
      F: { label: 'Wounds - Non-Surgical', description: 'Non-surgical wound care' },
      G: { label: 'Complex Nursing', description: 'Complex nursing interventions' },
      H: { label: 'MS Rehab', description: 'Musculoskeletal rehabilitation' },
      I: { label: 'Behavioral Health', description: 'Behavioral and mental health' },
      J: { label: 'Medication Mgmt', description: 'Medication management, teaching, assessment' },
    },
  },
  position3: {
    title: 'Functional Impairment Level',
    description: 'Based on responses to GG0170 mobility items, indicates the patient\'s overall functional limitation.',
    codes: {
      A: { label: 'Low Impairment', description: 'Minimal functional limitations' },
      B: { label: 'Medium Impairment', description: 'Moderate functional limitations' },
      C: { label: 'High Impairment', description: 'Significant functional limitations' },
      D: { label: 'Very High', description: 'Severe functional limitations' },
    },
  },
  position4: {
    title: 'Comorbidity Adjustment - Primary',
    description: 'Primary comorbidity adjustment based on secondary diagnoses and their interaction with the primary diagnosis.',
    codes: {
      '0': { label: 'None', description: 'No comorbidity adjustment' },
      '1': { label: 'Low', description: 'Low comorbidity adjustment' },
      '2': { label: 'High', description: 'High comorbidity adjustment' },
    },
  },
  position5: {
    title: 'Comorbidity Adjustment - Secondary',
    description: 'Secondary/interaction comorbidity based on specific diagnosis pairs that increase care complexity.',
    codes: {
      '0': { label: 'None', description: 'No secondary interaction' },
      '1': { label: 'Present', description: 'Secondary comorbidity interaction present' },
    },
  },
} as const;

// Reimbursement calculation disclaimers
export const REIMBURSEMENT_DISCLAIMERS = [
  'Estimates are based on FY2024 CMS national standardized payment rates.',
  'Actual payment may vary based on LUPA (Low Utilization Payment Adjustment) threshold visits.',
  'Outlier adjustments may apply for exceptionally high-cost episodes.',
  'Geographic wage index adjustments are applied based on the provider\'s CBSA location.',
  'These estimates are for educational purposes only and should not be used for billing.',
  'Partial Episode Payment (PEP) adjustments apply if patient is transferred or discharged early.',
];

// PDGM educational content
export const PDGM_EDUCATION = {
  title: 'Patient-Driven Groupings Model (PDGM)',
  overview: `PDGM is CMS's payment model for home health care that became effective January 1, 2020.
    It uses patient characteristics and clinical factors to determine payment rates, replacing
    the previous therapy-threshold model.`,
  keyComponents: [
    {
      title: 'Admission Source',
      description: 'Whether the patient was admitted from an institutional setting (hospital, SNF) or the community affects the base payment.',
    },
    {
      title: 'Timing',
      description: 'Episodes are categorized as "Early" (days 1-30) or "Late" (days 31-60) within a 60-day certification period.',
    },
    {
      title: 'Clinical Grouping',
      description: 'Based on the primary diagnosis ICD-10 code, patients are grouped into one of 12 clinical categories.',
    },
    {
      title: 'Functional Impairment',
      description: 'GG items from OASIS measure the patient\'s functional status to determine impairment level.',
    },
    {
      title: 'Comorbidity Adjustment',
      description: 'Secondary diagnoses may increase payment if they represent additional care needs.',
    },
  ],
  links: [
    {
      title: 'CMS PDGM Overview',
      url: 'https://www.cms.gov/Medicare/Medicare-Fee-for-Service-Payment/HomeHealthPPS/Home-Health-Patient-Driven-Groupings-Model',
    },
    {
      title: 'OASIS-E Guidance',
      url: 'https://www.cms.gov/Medicare/Quality-Initiatives-Patient-Assessment-Instruments/HomeHealthQualityInits/OASIS-E',
    },
  ],
};

// Functional score explanation
export const FUNCTIONAL_SCORE_EXPLANATION = {
  title: 'Functional Impairment Score',
  description: `The functional impairment level is calculated from the GG0170 mobility items in OASIS.
    These items assess the patient's ability to perform activities like walking, transferring,
    and climbing stairs. The aggregate score determines the functional level (Low, Medium, High).`,
  items: [
    'GG0170A: Roll left and right',
    'GG0170B: Sit to lying',
    'GG0170C: Lying to sitting',
    'GG0170D: Sit to stand',
    'GG0170E: Chair/bed-to-chair transfer',
    'GG0170F: Toilet transfer',
    'GG0170I: Walk 10 feet',
    'GG0170J: Walk 50 feet with two turns',
    'GG0170K: Walk 150 feet',
    'GG0170L: Walk on uneven surfaces',
    'GG0170M: Step curb',
    'GG0170N: Four steps',
    'GG0170O: Twelve steps',
    'GG0170P: Picking up object',
  ],
};

// Clinical grouping descriptions
export const CLINICAL_GROUPING_DESCRIPTIONS: Record<string, { name: string; description: string; examples: string[] }> = {
  A: {
    name: 'MMTA - Surgical Aftercare',
    description: 'Patients recovering from orthopedic or other surgeries requiring rehabilitation.',
    examples: ['Total hip replacement', 'Total knee replacement', 'Spinal surgery'],
  },
  B: {
    name: 'MMTA - Medical/Other',
    description: 'Medical management conditions requiring skilled nursing or therapy.',
    examples: ['Pneumonia recovery', 'Heart failure management', 'COPD exacerbation'],
  },
  C: {
    name: 'Neuro Rehab',
    description: 'Neurological conditions requiring rehabilitation services.',
    examples: ['Stroke rehabilitation', 'Parkinson\'s disease', 'Multiple sclerosis'],
  },
  D: {
    name: 'Wounds - Post-Op',
    description: 'Wound care following surgical procedures.',
    examples: ['Surgical incision care', 'Post-operative drain management'],
  },
  E: {
    name: 'Wounds - Diabetic',
    description: 'Wound care for patients with diabetes-related wounds.',
    examples: ['Diabetic foot ulcers', 'Diabetic neuropathy wounds'],
  },
  F: {
    name: 'Wounds - Non-Surgical',
    description: 'Non-surgical wound care including pressure injuries.',
    examples: ['Pressure ulcers', 'Venous stasis ulcers', 'Arterial ulcers'],
  },
  G: {
    name: 'Complex Nursing',
    description: 'Patients requiring complex nursing interventions.',
    examples: ['IV therapy', 'TPN administration', 'Ventilator care'],
  },
  H: {
    name: 'Musculoskeletal Rehab',
    description: 'Musculoskeletal conditions requiring physical therapy.',
    examples: ['Fracture recovery', 'Joint replacement follow-up', 'Gait training'],
  },
  I: {
    name: 'Behavioral Health',
    description: 'Patients with behavioral or mental health conditions.',
    examples: ['Depression management', 'Anxiety disorders', 'Dementia care'],
  },
  J: {
    name: 'Medication Management',
    description: 'Patients primarily needing medication management and teaching.',
    examples: ['Complex medication regimens', 'Diabetes management', 'Anticoagulation therapy'],
  },
};

export default {
  HIPPS_POSITION_EXPLANATIONS,
  REIMBURSEMENT_DISCLAIMERS,
  PDGM_EDUCATION,
  FUNCTIONAL_SCORE_EXPLANATION,
  CLINICAL_GROUPING_DESCRIPTIONS,
};
