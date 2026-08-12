/**
 * The grounding step is the boundary that stops a fabricated clinical value
 * reaching a clinician. These tests are written adversarially — each one is a
 * way a model could plausibly produce something wrong.
 */
import {
  draftableQuestions,
  groundProposals,
  parseProposals,
  TranscriptSegment,
} from '../../src/services/agents/scribe.agent';
import { PT_EVALUATION_V1 } from '../../src/domain/canonical/forms/ptEvaluation';
import { CanonicalFormQuestion } from '../../src/domain/canonical/types';

const segments: TranscriptSegment[] = [
  { id: 's1', offset: 0, text: 'So how bad is the knee today, on a scale of nought to ten?' },
  { id: 's2', offset: 60, text: "It's about a six right now. Worse going down the stairs." },
  { id: 's3', offset: 120, text: 'And you were walking the dog every morning before the fall?' },
  { id: 's4', offset: 180, text: 'Every morning, yes, about a mile. Used a cane sometimes.' },
];

const questions = draftableQuestions(PT_EVALUATION_V1);
const find = (conceptId: string) =>
  questions.find((q) => q.conceptId === conceptId) as CanonicalFormQuestion;

describe('form gating', () => {
  it('never offers measurement fields to the agent', () => {
    const codes = questions.map((q) => q.conceptId);
    expect(codes).not.toContain('PT.ROM.KNEE_FLEX_R');
    expect(codes).not.toContain('PT.MMT.KNEE_EXT_R');
    expect(codes).not.toContain('PT.GAIT.DISTANCE_FT');
  });

  it('does offer narrative and pain fields', () => {
    const codes = questions.map((q) => q.conceptId);
    expect(codes).toContain('PT.PAIN.CURRENT');
    expect(codes).toContain('PT.NARRATIVE.PRIOR_FUNCTION');
  });
});

describe('groundProposals', () => {
  it('accepts a proposal whose quote is really in the transcript', () => {
    const out = groundProposals(
      [{ conceptId: 'PT.PAIN.CURRENT', value: 6, confidence: 0.92, quote: "It's about a six right now" }],
      questions,
      segments
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.evidence[0]?.transcriptId).toBe('s2');
  });

  it('drops a proposal whose quote appears nowhere — the fabrication guard', () => {
    const out = groundProposals(
      [{ conceptId: 'PT.PAIN.CURRENT', value: 9, confidence: 0.99, quote: 'the pain is a nine' }],
      questions,
      segments
    );
    expect(out).toHaveLength(0);
  });

  it('drops a field that was never offered, even with a real quote', () => {
    const out = groundProposals(
      [{ conceptId: 'PT.ROM.KNEE_FLEX_R', value: 110, confidence: 0.95, quote: 'Every morning, yes' }],
      questions,
      segments
    );
    expect(out).toHaveLength(0);
  });

  it('drops a select value outside the allowed option codes', () => {
    expect(find('PT.GAIT.DEVICE').options?.some((o) => o.code === 'hoverboard')).toBe(false);
    const out = groundProposals(
      [{ conceptId: 'PT.GAIT.DEVICE', value: 'hoverboard', confidence: 0.9, quote: 'Used a cane sometimes' }],
      questions,
      segments
    );
    expect(out).toHaveLength(0);
  });

  it('keeps a select value that is a legal option code', () => {
    const out = groundProposals(
      [{ conceptId: 'PT.GAIT.DEVICE', value: 'cane', confidence: 0.8, quote: 'Used a cane sometimes' }],
      questions,
      segments
    );
    expect(out).toHaveLength(1);
  });

  it('drops a scale value outside its range', () => {
    const out = groundProposals(
      [{ conceptId: 'PT.PAIN.CURRENT', value: 47, confidence: 0.9, quote: "It's about a six right now" }],
      questions,
      segments
    );
    expect(out).toHaveLength(0);
  });

  it('ignores whitespace and case differences when matching a quote', () => {
    const out = groundProposals(
      [{ conceptId: 'PT.PAIN.CURRENT', value: 6, confidence: 0.9, quote: "it's   ABOUT a Six right now" }],
      questions,
      segments
    );
    expect(out).toHaveLength(1);
  });

  it('rejects a trivially short quote that would match by accident', () => {
    const out = groundProposals(
      [{ conceptId: 'PT.PAIN.CURRENT', value: 6, confidence: 0.9, quote: 'a' }],
      questions,
      segments
    );
    expect(out).toHaveLength(0);
  });

  it('clamps a confidence outside 0..1 rather than trusting it', () => {
    const out = groundProposals(
      [{ conceptId: 'PT.PAIN.CURRENT', value: 6, confidence: 4.2, quote: "It's about a six right now" }],
      questions,
      segments
    );
    expect(out[0]?.confidence).toBe(1);
  });
});

describe('parseProposals', () => {
  it('parses a bare JSON array', () => {
    const out = parseProposals('[{"conceptId":"A","value":1,"confidence":0.5,"quote":"abcd"}]');
    expect(out).toHaveLength(1);
  });

  it('tolerates a code fence', () => {
    const out = parseProposals('```json\n[{"conceptId":"A","value":1,"confidence":0.5,"quote":"abcd"}]\n```');
    expect(out).toHaveLength(1);
  });

  it('returns nothing for prose, rather than throwing', () => {
    expect(parseProposals('I was unable to find any relevant fields.')).toEqual([]);
  });

  it('discards malformed elements but keeps valid siblings', () => {
    const out = parseProposals(
      '[{"conceptId":"A","value":1,"confidence":0.5,"quote":"abcd"},{"nope":true}]'
    );
    expect(out).toHaveLength(1);
  });
});
