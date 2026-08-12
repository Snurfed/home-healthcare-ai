import {
  decide,
  editDistance,
  InvalidTransitionError,
  requiresEvidence,
  summarise,
  triage,
  triageStrict,
} from '../../src/domain/proposals/stateMachine';
import { DraftProposal, thresholdFor } from '../../src/domain/proposals/types';

const span = (quote: string) => ({ transcriptId: 't1', startOffset: 0, endOffset: quote.length, quote });

const draft = (over: Partial<DraftProposal> = {}): DraftProposal => ({
  questionCode: 'PT.NARRATIVE.SUBJECTIVE',
  value: 'Patient reports 6/10 knee pain.',
  confidence: 0.9,
  evidence: [span('six out of ten pain')],
  ...over,
});

describe('confidence thresholds', () => {
  it('holds payment-linked OASIS items to a higher bar than narrative', () => {
    expect(thresholdFor('OASIS.GG0130A')).toBeGreaterThan(thresholdFor('PT.NARRATIVE.SUBJECTIVE'));
  });

  it('prefers the longest matching prefix over a general rule', () => {
    // PT.ROM is stricter than the default; make sure it wins for a ROM field.
    expect(thresholdFor('PT.ROM.KNEE_FLEX_R')).toBe(0.85);
    expect(thresholdFor('PT.SOMETHING_ELSE')).toBe(0.7);
  });
});

describe('triage', () => {
  it('surfaces a confident proposal', () => {
    const [p] = triage([draft({ confidence: 0.95 })]);
    expect(p.status).toBe('SURFACED');
  });

  it('withholds rather than guessing on a payment-linked item', () => {
    // 0.8 would pass the default bar but not the OASIS bar.
    const [p] = triage([draft({ questionCode: 'OASIS.GG0130A', confidence: 0.8 })]);
    expect(p.status).toBe('WITHHELD');
  });

  it('never surfaces a proposal with no evidence, however confident', () => {
    const fabricated = draft({ confidence: 1.0, evidence: [] });
    expect(requiresEvidence(fabricated)).toBe(true);
    const [p] = triageStrict([fabricated]);
    expect(p.status).toBe('WITHHELD');
  });
});

describe('decide', () => {
  it('accepting commits the proposed value with zero edit distance', () => {
    const out = decide('SURFACED', 'ROM 110 deg', { kind: 'accept' });
    expect(out).toMatchObject({ status: 'COMMITTED', finalValue: 'ROM 110 deg', commits: true, editDistance: 0 });
  });

  it('editing commits the clinician value and records how far it moved', () => {
    const out = decide('SURFACED', 'ROM 110 deg', { kind: 'edit', value: 'ROM 115 deg' });
    expect(out.status).toBe('COMMITTED');
    expect(out.finalValue).toBe('ROM 115 deg');
    expect(out.editDistance).toBeGreaterThan(0);
  });

  it('rejecting writes nothing', () => {
    const out = decide('SURFACED', 'anything', { kind: 'reject' });
    expect(out.commits).toBe(false);
    expect(out.status).toBe('REJECTED');
  });

  it('refuses to decide a withheld proposal — it was never shown', () => {
    expect(() => decide('WITHHELD', 'x', { kind: 'accept' })).toThrow(InvalidTransitionError);
  });

  it('refuses to decide the same proposal twice', () => {
    expect(() => decide('COMMITTED', 'x', { kind: 'edit', value: 'y' })).toThrow(InvalidTransitionError);
  });
});

describe('editDistance', () => {
  it('is zero for identical values', () => {
    expect(editDistance('same', 'same')).toBe(0);
    expect(editDistance(42, 42)).toBe(0);
  });

  it('grows with the size of the correction', () => {
    const small = editDistance('ROM 110 degrees', 'ROM 115 degrees');
    const large = editDistance('ROM 110 degrees', 'Patient declined range of motion testing');
    expect(large).toBeGreaterThan(small);
  });

  it('handles null and structured values without throwing', () => {
    expect(editDistance(null, 'x')).toBe(1);
    expect(editDistance({ a: 1 }, { a: 2 })).toBeGreaterThan(0);
  });
});

describe('summarise', () => {
  it('flags a field the clinician keeps rewriting', () => {
    const rows = [
      ...Array.from({ length: 9 }, () => ({ questionCode: 'PT.GAIT', status: 'COMMITTED' as const, editDistance: 30 })),
      { questionCode: 'PT.GAIT', status: 'COMMITTED' as const, editDistance: 0 },
    ];
    const [q] = summarise(rows);
    expect(q.surfaced).toBe(10);
    expect(q.acceptRate).toBeCloseTo(0.1);
    expect(q.underperforming).toBe(true);
  });

  it('does not flag a field on a small sample', () => {
    const rows = [{ questionCode: 'PT.GAIT', status: 'COMMITTED' as const, editDistance: 30 }];
    const [q] = summarise(rows);
    expect(q.underperforming).toBe(false);
  });

  it('counts withheld separately from rejected', () => {
    const rows = [
      { questionCode: 'OASIS.GG0130A', status: 'WITHHELD' as const, editDistance: null },
      { questionCode: 'OASIS.GG0130A', status: 'REJECTED' as const, editDistance: null },
    ];
    const [q] = summarise(rows);
    expect(q.withheld).toBe(1);
    expect(q.rejected).toBe(1);
    // Withheld was never shown, so it is not part of the surfaced denominator.
    expect(q.surfaced).toBe(1);
  });
});
