/**
 * PT evaluation — the first form the MVP supports end to end.
 *
 * Chosen as the wedge because therapy has a narrower, more structured surface
 * than a nursing start of care, and objective measures are genuinely tabular,
 * which makes ambient extraction tractable far earlier.
 *
 * Two conventions worth knowing before editing:
 *
 *   conceptId is the canonical key the whole system stores against. It is
 *   deliberately prefixed (PT.ROM, PT.MMT, PT.NARRATIVE) because the confidence
 *   policy keys off those prefixes — an objective measurement is held to a much
 *   higher bar than a narrative sentence, and abstains rather than guessing.
 *
 *   aiDraftEnabled is off for every measurement. The scribe may only record a
 *   number a clinician actually said out loud; it must never infer one from
 *   context. A fabricated range-of-motion value is a clinical safety event, not
 *   a formatting error.
 */
import { CanonicalFormDefinition } from '../types';

export const PT_EVALUATION_V1: CanonicalFormDefinition = {
  id: 'PT_EVAL_V1',
  discipline: 'PT',
  visitType: 'EVAL',
  version: '1.0.0',
  name: 'Physical Therapy Evaluation',
  description: 'Initial PT evaluation for a home health episode.',
  status: 'published',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',

  sections: [
    {
      id: 'subjective',
      sectionId: 'lib.subjective',
      name: 'Subjective',
      required: true,
      aiDraftEnabled: true,
      questions: [
        {
          id: 'chief_complaint',
          conceptId: 'PT.NARRATIVE.CHIEF_COMPLAINT',
          label: 'Chief complaint',
          type: 'textarea',
          required: true,
          aiDraftEnabled: true,
          aiPromptHint:
            "The patient's own account of why therapy was ordered. Prefer their words.",
        },
        {
          id: 'pain_current',
          conceptId: 'PT.PAIN.CURRENT',
          label: 'Current pain (0–10)',
          type: 'scale',
          scaleMin: 0,
          scaleMax: 10,
          required: true,
          aiDraftEnabled: true,
          aiPromptHint:
            'Only if the patient states a number. Never infer from descriptive words like "bad".',
        },
        {
          id: 'pain_location',
          conceptId: 'PT.PAIN.LOCATION',
          label: 'Pain location',
          type: 'text',
          required: false,
          aiDraftEnabled: true,
        },
        {
          id: 'prior_level',
          conceptId: 'PT.NARRATIVE.PRIOR_FUNCTION',
          label: 'Prior level of function',
          helpText: 'Independence and activity before the current episode.',
          type: 'textarea',
          required: true,
          aiDraftEnabled: true,
        },
        {
          id: 'home_environment',
          conceptId: 'PT.NARRATIVE.HOME_ENVIRONMENT',
          label: 'Home environment and safety',
          helpText: 'Stairs, rugs, lighting, bathroom access, equipment in use.',
          type: 'textarea',
          required: true,
          aiDraftEnabled: true,
        },
      ],
    },

    {
      id: 'objective_rom',
      sectionId: 'lib.rom',
      name: 'Range of motion',
      required: true,
      // Measurements are dictated, not drafted. See the header note.
      aiDraftEnabled: false,
      questions: [
        romQuestion('KNEE_FLEX_R', 'Right knee flexion', 0, 145),
        romQuestion('KNEE_EXT_R', 'Right knee extension', -10, 10),
        romQuestion('KNEE_FLEX_L', 'Left knee flexion', 0, 145),
        romQuestion('KNEE_EXT_L', 'Left knee extension', -10, 10),
        romQuestion('HIP_FLEX_R', 'Right hip flexion', 0, 125),
        romQuestion('HIP_FLEX_L', 'Left hip flexion', 0, 125),
      ],
    },

    {
      id: 'objective_strength',
      sectionId: 'lib.mmt',
      name: 'Manual muscle testing',
      required: true,
      aiDraftEnabled: false,
      questions: [
        mmtQuestion('KNEE_EXT_R', 'Right knee extensors'),
        mmtQuestion('KNEE_FLEX_R', 'Right knee flexors'),
        mmtQuestion('KNEE_EXT_L', 'Left knee extensors'),
        mmtQuestion('KNEE_FLEX_L', 'Left knee flexors'),
        mmtQuestion('HIP_ABD_R', 'Right hip abductors'),
        mmtQuestion('HIP_ABD_L', 'Left hip abductors'),
      ],
    },

    {
      id: 'objective_mobility',
      sectionId: 'lib.mobility',
      name: 'Functional mobility',
      required: true,
      aiDraftEnabled: true,
      questions: [
        {
          id: 'gait_distance',
          conceptId: 'PT.GAIT.DISTANCE_FT',
          label: 'Ambulation distance (ft)',
          type: 'number',
          required: true,
          validation: { min: 0, max: 2000 },
          aiDraftEnabled: false,
        },
        {
          id: 'assistive_device',
          conceptId: 'PT.GAIT.DEVICE',
          label: 'Assistive device',
          type: 'single_select',
          required: true,
          aiDraftEnabled: true,
          options: [
            { code: 'none', label: 'None' },
            { code: 'cane', label: 'Cane' },
            { code: 'walker', label: 'Rolling walker' },
            { code: 'crutches', label: 'Crutches' },
            { code: 'wheelchair', label: 'Wheelchair' },
          ],
        },
        {
          id: 'assist_level',
          conceptId: 'PT.GAIT.ASSIST_LEVEL',
          label: 'Level of assistance',
          helpText:
            'Maps to the OASIS GG scale on export — see the mapping note in the assist-level transform.',
          type: 'single_select',
          required: true,
          aiDraftEnabled: true,
          options: [
            { code: 'independent', label: 'Independent', scoringValue: 6 },
            { code: 'setup', label: 'Setup or clean-up assistance', scoringValue: 5 },
            { code: 'supervision', label: 'Supervision or touching assistance', scoringValue: 4 },
            { code: 'partial_moderate', label: 'Partial/moderate assistance', scoringValue: 3 },
            { code: 'substantial_maximal', label: 'Substantial/maximal assistance', scoringValue: 2 },
            { code: 'dependent', label: 'Dependent', scoringValue: 1 },
          ],
        },
        {
          id: 'gait_description',
          conceptId: 'PT.NARRATIVE.GAIT',
          label: 'Gait description',
          type: 'textarea',
          required: false,
          aiDraftEnabled: true,
        },
      ],
    },

    {
      id: 'assessment',
      sectionId: 'lib.assessment',
      name: 'Assessment and plan',
      required: true,
      aiDraftEnabled: true,
      questions: [
        {
          id: 'clinical_impression',
          conceptId: 'PT.NARRATIVE.IMPRESSION',
          label: 'Clinical impression',
          type: 'textarea',
          required: true,
          aiDraftEnabled: true,
        },
        {
          id: 'rehab_potential',
          conceptId: 'PT.REHAB_POTENTIAL',
          label: 'Rehabilitation potential',
          type: 'single_select',
          required: true,
          aiDraftEnabled: true,
          options: [
            { code: 'excellent', label: 'Excellent' },
            { code: 'good', label: 'Good' },
            { code: 'fair', label: 'Fair' },
            { code: 'poor', label: 'Poor' },
          ],
        },
        {
          id: 'medical_necessity',
          conceptId: 'PT.NARRATIVE.MEDICAL_NECESSITY',
          label: 'Justification for skilled therapy',
          helpText:
            'Must establish why the service requires the skills of a therapist. Reviewed by the compliance agent before signature.',
          type: 'textarea',
          required: true,
          aiDraftEnabled: true,
        },
        {
          id: 'goals',
          conceptId: 'PT.GOALS',
          label: 'Goals',
          type: 'goal_list',
          required: true,
          aiDraftEnabled: true,
        },
        {
          id: 'frequency_duration',
          conceptId: 'PT.PLAN.FREQUENCY',
          label: 'Frequency and duration',
          helpText: 'e.g. 2x/week for 4 weeks',
          type: 'text',
          required: true,
          aiDraftEnabled: true,
        },
      ],
    },
  ],
};

function romQuestion(
  key: string,
  label: string,
  min: number,
  max: number
) {
  return {
    id: `rom_${key.toLowerCase()}`,
    conceptId: `PT.ROM.${key}`,
    label,
    type: 'number' as const,
    required: false,
    // Degrees outside the anatomical envelope are almost always a
    // transcription slip; catch them at entry rather than at QA.
    validation: { min, max },
    aiDraftEnabled: false,
  };
}

function mmtQuestion(key: string, label: string) {
  return {
    id: `mmt_${key.toLowerCase()}`,
    conceptId: `PT.MMT.${key}`,
    label,
    type: 'single_select' as const,
    required: false,
    aiDraftEnabled: false,
    options: [
      { code: '0', label: '0 — No contraction', scoringValue: 0 },
      { code: '1', label: '1 — Flicker', scoringValue: 1 },
      { code: '2', label: '2 — Full ROM gravity eliminated', scoringValue: 2 },
      { code: '2+', label: '2+ — Partial ROM against gravity', scoringValue: 2.5 },
      { code: '3-', label: '3− — Partial ROM against gravity', scoringValue: 2.75 },
      { code: '3', label: '3 — Full ROM against gravity', scoringValue: 3 },
      { code: '3+', label: '3+ — Full ROM, minimal resistance', scoringValue: 3.25 },
      { code: '4-', label: '4− — Slight resistance', scoringValue: 3.5 },
      { code: '4', label: '4 — Moderate resistance', scoringValue: 4 },
      { code: '4+', label: '4+ — Strong resistance', scoringValue: 4.5 },
      { code: '5', label: '5 — Normal', scoringValue: 5 },
    ],
  };
}
