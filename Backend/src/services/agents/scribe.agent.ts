/**
 * Scribe agent — transcript in, field proposals out.
 *
 * Three rules are enforced here rather than left to the prompt, because a
 * prompt is a request and this is a clinical record:
 *
 *   1. Only questions with aiDraftEnabled are ever drafted. Measurements are
 *      excluded at the form level, so the agent is not even offered the chance
 *      to invent a range-of-motion figure.
 *   2. Every proposal must carry a verbatim quote that actually appears in the
 *      transcript. Quotes that don't match are dropped, which makes fabrication
 *      structurally difficult rather than merely discouraged.
 *   3. Values are range-checked against the form's own validation before being
 *      returned.
 *
 * Bump PROMPT_VERSION on any prompt change. It is recorded on every AgentRun,
 * and without it a quality regression cannot be attributed to the change that
 * caused it.
 */
import Anthropic from '@anthropic-ai/sdk';

import { MODELS } from '../../config/models';

import {
  CanonicalFormDefinition,
  CanonicalFormQuestion,
} from '../../domain/canonical/types';
import { AgentRunResult, DraftProposal } from '../../domain/proposals/types';
import { validateValue } from '../../domain/canonical/validation';

export const PROMPT_VERSION = 'scribe-v1';
const MODEL_ID = MODELS.EXTRACTION;

export interface TranscriptSegment {
  id: string;
  text: string;
  /** Character offset of this segment within the full transcript. */
  offset: number;
  speaker?: 'clinician' | 'patient' | 'other';
}

export interface ScribeInput {
  form: CanonicalFormDefinition;
  segments: TranscriptSegment[];
}

interface RawProposal {
  conceptId: string;
  value: unknown;
  confidence: number;
  quote: string;
}

export class ScribeAgent {
  constructor(private readonly client: Anthropic) {}

  async run(input: ScribeInput): Promise<AgentRunResult> {
    const started = Date.now();
    const draftable = draftableQuestions(input.form);
    const transcript = input.segments.map((s) => s.text).join('\n');

    if (draftable.length === 0 || transcript.trim().length === 0) {
      return {
        kind: 'SCRIBE',
        modelId: MODEL_ID,
        promptVersion: PROMPT_VERSION,
        proposals: [],
        latencyMs: Date.now() - started,
      };
    }

    const response = await this.client.messages.create({
      model: MODEL_ID,
      max_tokens: 4096,
      system: systemPrompt(),
      messages: [{ role: 'user', content: userPrompt(draftable, transcript) }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const raw = parseProposals(text);

    return {
      kind: 'SCRIBE',
      modelId: MODEL_ID,
      promptVersion: PROMPT_VERSION,
      latencyMs: Date.now() - started,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      proposals: groundProposals(raw, draftable, input.segments),
    };
  }
}

export function draftableQuestions(
  form: CanonicalFormDefinition
): CanonicalFormQuestion[] {
  return form.sections.flatMap((section) =>
    section.questions.filter((q) => q.aiDraftEnabled === true)
  );
}

function systemPrompt(): string {
  return [
    'You are a documentation scribe for a home health physical therapist.',
    'You extract only what was actually said. You do not infer, summarise beyond the words, or fill gaps with clinical plausibility.',
    '',
    'For every field you propose you must supply a verbatim quote from the transcript that supports it. If no quote supports a field, omit the field entirely — omitting is always correct when in doubt.',
    '',
    'Confidence is your honest estimate that a reviewing clinician would accept the value unchanged. Use the full range. A value you inferred rather than heard is low confidence at best, and more likely should be omitted.',
    '',
    'Respond with a JSON array only. No prose, no code fence.',
    'Each element: {"conceptId": string, "value": string|number, "confidence": number, "quote": string}',
  ].join('\n');
}

function userPrompt(questions: CanonicalFormQuestion[], transcript: string): string {
  const fields = questions.map((q) => {
    const parts = [`- ${q.conceptId} (${q.type}): ${q.label}`];
    if (q.aiPromptHint) parts.push(`  guidance: ${q.aiPromptHint}`);
    if (q.options?.length) {
      parts.push(`  allowed values: ${q.options.map((o) => o.code).join(', ')}`);
    }
    if (q.scaleMin !== undefined && q.scaleMax !== undefined) {
      parts.push(`  range: ${q.scaleMin}–${q.scaleMax}`);
    }
    return parts.join('\n');
  });

  return [
    'Fields available to draft:',
    ...fields,
    '',
    'Visit transcript:',
    '"""',
    transcript,
    '"""',
  ].join('\n');
}

export function parseProposals(text: string): RawProposal[] {
  // Models occasionally wrap JSON in a fence despite instruction; tolerate it
  // rather than losing an entire visit's extraction to a formatting slip.
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) return [];

  try {
    const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRawProposal);
  } catch {
    return [];
  }
}

function isRawProposal(v: unknown): v is RawProposal {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o['conceptId'] === 'string' &&
    typeof o['confidence'] === 'number' &&
    typeof o['quote'] === 'string' &&
    (typeof o['value'] === 'string' || typeof o['value'] === 'number')
  );
}

/**
 * Reject anything the transcript does not actually support, then attach the
 * evidence span. This is the step that turns "the model said so" into
 * "here are the words it came from".
 */
export function groundProposals(
  raw: RawProposal[],
  questions: CanonicalFormQuestion[],
  segments: TranscriptSegment[]
): DraftProposal[] {
  const byConcept = new Map(questions.map((q) => [q.conceptId, q]));
  const out: DraftProposal[] = [];

  for (const item of raw) {
    const question = byConcept.get(item.conceptId);
    // A field that was not offered, or was never draftable, is discarded.
    if (!question) continue;

    const located = locateQuote(item.quote, segments);
    // No verifiable quote means no proposal, whatever the stated confidence.
    if (!located) continue;

    // Same validator the human write paths use — one implementation.
    if (!validateValue(question, item.value).ok) continue;

    out.push({
      questionCode: item.conceptId,
      value: item.value,
      confidence: clamp01(item.confidence),
      evidence: [
        {
          transcriptId: located.segment.id,
          startOffset: located.start,
          endOffset: located.start + item.quote.length,
          quote: item.quote,
        },
      ],
    });
  }

  return out;
}

function locateQuote(
  quote: string,
  segments: TranscriptSegment[]
): { segment: TranscriptSegment; start: number } | null {
  const needle = normalise(quote);
  if (needle.length < 4) return null;

  for (const segment of segments) {
    const index = normalise(segment.text).indexOf(needle);
    if (index !== -1) return { segment, start: index };
  }
  return null;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
