/**
 * Whisper Transcription Service
 *
 * Integrates with OpenAI Whisper API for audio transcription
 * with medical vocabulary optimization
 */

import OpenAI from 'openai';
import * as fs from 'fs';

// ===========================================
// TYPES
// ===========================================

export interface TranscriptionOptions {
  language?: string;
  prompt?: string;
  temperature?: number;
  medicalVocabulary?: boolean;
}

export interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
  speaker?: string;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptSegment[];
  language: string;
  duration: number;
  confidence: number;
  processingTimeMs: number;
}

export interface MedicalTermExtraction {
  term: string;
  category: string;
  startPosition: number;
  endPosition: number;
  confidence: number;
  normalizedTerm?: string;
  codes?: {
    icd10?: string;
    snomed?: string;
    rxnorm?: string;
  };
}

// ===========================================
// MEDICAL VOCABULARY PROMPT
// ===========================================

const MEDICAL_VOCABULARY_PROMPT = `
This is a home health care clinical assessment. Common terms include:
- OASIS (Outcome and Assessment Information Set)
- ADLs (Activities of Daily Living), IADLs (Instrumental ADLs)
- ROM (Range of Motion), WNL (Within Normal Limits)
- Ambulation, gait, transfers, bed mobility
- Dyspnea, edema, pain scale 0-10
- Blood pressure, pulse, respiration, SpO2, temperature
- Wound care: granulation, epithelialization, slough, eschar, exudate
- Pressure ulcers: Stage 1-4, unstageable, DTI (Deep Tissue Injury)
- Medications: dosages in mg, mL, units
- ICD-10 diagnosis codes
- PHQ-2, PHQ-9 depression screening
- BIMS (Brief Interview for Mental Status)
- GG items for functional abilities
- M-codes for OASIS items (M0100, M1021, etc.)
`.trim();

// ===========================================
// WHISPER SERVICE
// ===========================================

class WhisperService {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env['OPENAI_API_KEY'];
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  /**
   * Transcribe audio file using OpenAI Whisper
   */
  async transcribeAudio(
    audioPath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    const client = this.getClient();

    const {
      language = 'en',
      temperature = 0,
      medicalVocabulary = true,
    } = options;

    // Build prompt with medical vocabulary if enabled
    const prompt = medicalVocabulary
      ? `${MEDICAL_VOCABULARY_PROMPT}\n\n${options.prompt || ''}`
      : options.prompt;

    try {
      // Read audio file
      const audioFile = fs.createReadStream(audioPath);

      // Call Whisper API with verbose JSON for word timestamps
      const response = await client.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language,
        prompt: prompt?.substring(0, 224), // Whisper prompt limit
        temperature,
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      });

      const processingTimeMs = Date.now() - startTime;

      // Parse segments from response
      const segments: TranscriptSegment[] = (response.segments || []).map(
        (seg: { id: number; start: number; end: number; text: string; avg_logprob?: number }, index: number) => ({
          id: `seg-${index}`,
          startTime: seg.start,
          endTime: seg.end,
          text: seg.text.trim(),
          confidence: seg.avg_logprob
            ? Math.min(1, Math.max(0, 1 + seg.avg_logprob / 2))
            : 0.9,
        })
      );

      // Calculate overall confidence from segment averages
      const avgConfidence =
        segments.length > 0
          ? segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length
          : 0.9;

      return {
        text: response.text,
        segments,
        language: response.language || language,
        duration: response.duration || 0,
        confidence: avgConfidence,
        processingTimeMs,
      };
    } catch (error) {
      console.error('[Whisper Service Error]', error);

      // Return error result
      throw new Error(
        `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract medical terms from transcription text
   * This is a simplified extraction - in production would use NER models
   */
  extractMedicalTerms(text: string): MedicalTermExtraction[] {
    const terms: MedicalTermExtraction[] = [];

    // Common medical term patterns
    const patterns: Array<{ pattern: RegExp; category: string }> = [
      // Pain scale
      { pattern: /pain\s*(?:level|scale|of)?\s*(\d{1,2})\s*(?:out of|\/)\s*10/gi, category: 'pain_assessment' },
      { pattern: /(\d{1,2})\s*(?:out of|\/)\s*10\s*pain/gi, category: 'pain_assessment' },

      // Blood pressure
      { pattern: /(?:blood pressure|bp)\s*(?:is|of|:)?\s*(\d{2,3})\s*(?:over|\/)\s*(\d{2,3})/gi, category: 'vital_signs' },

      // Heart rate / Pulse
      { pattern: /(?:pulse|heart rate|hr)\s*(?:is|of|:)?\s*(\d{2,3})/gi, category: 'vital_signs' },

      // SpO2
      { pattern: /(?:oxygen|o2|spo2|saturation)\s*(?:is|of|:)?\s*(\d{2,3})\s*%?/gi, category: 'vital_signs' },

      // Temperature
      { pattern: /(?:temp|temperature)\s*(?:is|of|:)?\s*(\d{2,3}(?:\.\d)?)\s*(?:degrees|°|f)?/gi, category: 'vital_signs' },

      // Weight
      { pattern: /(?:weight|weighs)\s*(?:is|of|:)?\s*(\d{2,3}(?:\.\d)?)\s*(?:pounds|lbs|kg)/gi, category: 'vital_signs' },

      // Medications
      { pattern: /(\w+)\s*(\d+)\s*(?:mg|mcg|ml|units)/gi, category: 'medications' },

      // ICD-10 codes
      { pattern: /\b([A-Z]\d{2}(?:\.\d{1,4})?)\b/g, category: 'diagnosis_code' },

      // Wound staging
      { pattern: /stage\s*([1-4]|one|two|three|four)\s*(?:pressure)?\s*(?:ulcer|injury)/gi, category: 'wound_care' },
      { pattern: /(?:unstageable|dti|deep tissue injury)/gi, category: 'wound_care' },

      // Functional terms
      { pattern: /(?:independent|modified independent|supervision|minimal assist|moderate assist|maximal assist|dependent|total dependence)/gi, category: 'functional_status' },

      // Ambulation
      { pattern: /(?:ambulates|ambulation|walks|gait)\s*(?:with|using)?\s*(?:cane|walker|wheelchair|rollator|no device)/gi, category: 'mobility' },
    ];

    for (const { pattern, category } of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        terms.push({
          term: match[0],
          category,
          startPosition: match.index,
          endPosition: match.index + match[0].length,
          confidence: 0.85,
          normalizedTerm: match[0].toLowerCase().trim(),
        });
      }
    }

    return terms;
  }

  /**
   * Assess audio quality based on transcription metrics
   */
  assessAudioQuality(result: TranscriptionResult): string {
    const avgConfidence = result.confidence;

    if (avgConfidence >= 0.95) return 'excellent';
    if (avgConfidence >= 0.85) return 'good';
    if (avgConfidence >= 0.7) return 'fair';
    return 'poor';
  }
}

// Export singleton instance
export const whisperService = new WhisperService();
export default whisperService;
