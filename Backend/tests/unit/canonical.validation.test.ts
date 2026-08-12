/**
 * The form's rules must bind the clinician exactly as they bind the agent.
 *
 * Regression origin: the end-to-end run wrote the literal string
 * "CLINICIAN CORRECTED VALUE" into PT.GAIT.ASSIST_LEVEL — a field with six
 * legal option codes — because validation lived only inside the scribe.
 */
import { validateValue, findQuestion } from '../../src/domain/canonical/validation';
import { PT_EVALUATION_V1 } from '../../src/domain/canonical/forms/ptEvaluation';
import { questionFor, getForm, listForms } from '../../src/domain/canonical/forms/registry';
import { CanonicalFormQuestion } from '../../src/domain/canonical/types';

const q = (conceptId: string) =>
  findQuestion(PT_EVALUATION_V1, conceptId) as CanonicalFormQuestion;

describe('registry', () => {
  it('exposes the PT evaluation', () => {
    expect(listForms()).toContain('PT_EVAL_V1');
    expect(getForm('PT_EVAL_V1')?.discipline).toBe('PT');
  });

  it('resolves a question by form code and concept id', () => {
    expect(questionFor('PT_EVAL_V1', 'PT.GAIT.DEVICE')?.type).toBe('single_select');
  });

  it('returns undefined for an unknown form', () => {
    expect(questionFor('NOPE_V9', 'PT.GAIT.DEVICE')).toBeUndefined();
  });
});

describe('coded fields', () => {
  it('rejects the exact regression that slipped through', () => {
    const result = validateValue(q('PT.GAIT.ASSIST_LEVEL'), 'CLINICIAN CORRECTED VALUE');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('not a valid option');
    // The message should tell the clinician what is allowed.
    expect(result.reason).toContain('supervision');
  });

  it('accepts a legal option code', () => {
    expect(validateValue(q('PT.GAIT.ASSIST_LEVEL'), 'supervision').ok).toBe(true);
    expect(validateValue(q('PT.GAIT.DEVICE'), 'walker').ok).toBe(true);
  });

  it('rejects an option code from a different field', () => {
    expect(validateValue(q('PT.GAIT.DEVICE'), 'supervision').ok).toBe(false);
  });

  it('rejects an MMT grade that is not on the scale', () => {
    expect(validateValue(q('PT.MMT.KNEE_EXT_R'), '6').ok).toBe(false);
    expect(validateValue(q('PT.MMT.KNEE_EXT_R'), '4-').ok).toBe(true);
  });
});

describe('numeric fields', () => {
  it('enforces the pain scale range', () => {
    expect(validateValue(q('PT.PAIN.CURRENT'), 6).ok).toBe(true);
    expect(validateValue(q('PT.PAIN.CURRENT'), 11).ok).toBe(false);
    expect(validateValue(q('PT.PAIN.CURRENT'), -1).ok).toBe(false);
  });

  it('enforces anatomical range on knee flexion', () => {
    expect(validateValue(q('PT.ROM.KNEE_FLEX_R'), 105).ok).toBe(true);
    // 400 degrees is a transcription slip, not a knee.
    expect(validateValue(q('PT.ROM.KNEE_FLEX_R'), 400).ok).toBe(false);
  });

  it('allows the negative range on extension, which legitimately goes below zero', () => {
    expect(validateValue(q('PT.ROM.KNEE_EXT_R'), -5).ok).toBe(true);
    expect(validateValue(q('PT.ROM.KNEE_EXT_R'), -50).ok).toBe(false);
  });

  it('rejects text in a numeric field', () => {
    expect(validateValue(q('PT.GAIT.DISTANCE_FT'), 'quite far').ok).toBe(false);
  });

  it('rejects a fraction where a whole number is expected', () => {
    expect(validateValue(q('PT.GAIT.DISTANCE_FT'), 12.5).ok).toBe(false);
  });
});

describe('text fields', () => {
  it('accepts prose', () => {
    expect(validateValue(q('PT.NARRATIVE.GAIT'), 'Antalgic gait favouring the right.').ok).toBe(true);
  });

  it('rejects a number where text is expected', () => {
    expect(validateValue(q('PT.NARRATIVE.GAIT'), 42).ok).toBe(false);
  });
});

describe('clearing a field', () => {
  // Required-ness is checked at signature, not at entry — a clinician
  // mid-visit legitimately has partial data.
  it.each([null, undefined, ''])('allows %p on a required coded field', (value) => {
    expect(validateValue(q('PT.GAIT.ASSIST_LEVEL'), value).ok).toBe(true);
  });
});
