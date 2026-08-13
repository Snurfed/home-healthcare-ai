/**
 * Streaming Transcription Service
 *
 * Manages real-time transcription sessions for voice capture.
 * Buffers audio chunks and processes them via OpenAI Whisper API.
 * Emits partial transcriptions via callback for UI updates.
 *
 * TODO: Add Deepgram streaming integration for true real-time transcription
 */

import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

// ===========================================
// TYPES
// ===========================================

export interface TranscriptionCallback {
  (update: TranscriptionUpdate): void;
}

export interface TranscriptionUpdate {
  sessionId: string;
  segmentIndex: number;
  text: string;
  isFinal: boolean;
  confidence: number;
  timeRange: {
    startMs: number;
    endMs: number;
  };
  speaker?: 'clinician' | 'patient' | 'other' | 'unknown';
}

export interface TranscriptionSessionConfig {
  sessionId: string;
  visitId: string;
  patientId: string;
  language?: string;
  medicalVocabulary?: boolean;
  /** Minimum audio duration (ms) before processing a batch */
  minBatchDurationMs?: number;
  /** Maximum audio duration (ms) before forcing a batch process */
  maxBatchDurationMs?: number;
}

export interface AudioChunk {
  chunkIndex: number;
  audioData: string; // Base64 encoded
  format: 'wav' | 'opus' | 'mp3' | 'webm';
  sampleRate: number;
  durationMs: number;
  timestamp: number;
}

export interface SessionState {
  sessionId: string;
  visitId: string;
  patientId: string;
  status: 'active' | 'paused' | 'stopped';
  startedAt: Date;
  totalDurationMs: number;
  segmentCount: number;
  fullTranscript: string;
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
// STREAMING TRANSCRIPTION SESSION
// ===========================================

export class StreamingTranscriptionSession {
  private client: OpenAI | null = null;
  private config: TranscriptionSessionConfig;
  private callback: TranscriptionCallback;

  private audioBuffer: AudioChunk[] = [];
  private bufferedDurationMs: number = 0;
  private isProcessing: boolean = false;
  private processQueue: Promise<void> = Promise.resolve();

  private state: SessionState;
  private minBatchDurationMs: number;
  private maxBatchDurationMs: number;

  constructor(config: TranscriptionSessionConfig, callback: TranscriptionCallback) {
    this.config = config;
    this.callback = callback;
    this.minBatchDurationMs = config.minBatchDurationMs ?? 3000; // 3 seconds default
    this.maxBatchDurationMs = config.maxBatchDurationMs ?? 10000; // 10 seconds default

    this.state = {
      sessionId: config.sessionId,
      visitId: config.visitId,
      patientId: config.patientId,
      status: 'active',
      startedAt: new Date(),
      totalDurationMs: 0,
      segmentCount: 0,
      fullTranscript: '',
    };
  }

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
   * Get current session state
   */
  getState(): SessionState {
    return { ...this.state };
  }

  /**
   * Get accumulated full transcript
   */
  getFullTranscript(): string {
    return this.state.fullTranscript;
  }

  /**
   * Add an audio chunk to the buffer
   */
  addChunk(chunk: AudioChunk): void {
    if (this.state.status !== 'active') {
      console.warn(`[StreamingTranscription] Cannot add chunk - session ${this.config.sessionId} is ${this.state.status}`);
      return;
    }

    this.audioBuffer.push(chunk);
    this.bufferedDurationMs += chunk.durationMs;
    this.state.totalDurationMs += chunk.durationMs;

    console.log(
      `[StreamingTranscription] Chunk added: session=${this.config.sessionId}, ` +
      `chunk=${chunk.chunkIndex}, buffered=${this.bufferedDurationMs}ms`
    );

    // Check if we should process the buffer
    if (this.bufferedDurationMs >= this.minBatchDurationMs && !this.isProcessing) {
      this.scheduleProcess();
    } else if (this.bufferedDurationMs >= this.maxBatchDurationMs) {
      // Force process if we hit max duration
      this.scheduleProcess();
    }
  }

  /**
   * Schedule buffer processing (queued to avoid concurrent processing)
   */
  private scheduleProcess(): void {
    this.processQueue = this.processQueue.then(() => this.processBuffer());
  }

  /**
   * Process buffered audio chunks
   */
  private async processBuffer(): Promise<void> {
    if (this.audioBuffer.length === 0 || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    const chunksToProcess = [...this.audioBuffer];
    const durationToProcess = this.bufferedDurationMs;

    // Clear buffer for next batch
    this.audioBuffer = [];
    this.bufferedDurationMs = 0;

    try {
      console.log(
        `[StreamingTranscription] Processing ${chunksToProcess.length} chunks, ` +
        `${durationToProcess}ms total`
      );

      // Combine audio chunks and transcribe
      const transcription = await this.transcribeChunks(chunksToProcess);

      if (transcription && transcription.text.trim()) {
        this.state.segmentCount++;
        this.state.fullTranscript += (this.state.fullTranscript ? ' ' : '') + transcription.text;

        // Calculate time range
        const startMs = chunksToProcess[0]?.timestamp ?? 0;
        const endMs = startMs + durationToProcess;

        // Emit transcription update
        const update: TranscriptionUpdate = {
          sessionId: this.config.sessionId,
          segmentIndex: this.state.segmentCount,
          text: transcription.text,
          isFinal: true, // Whisper batches are always final
          confidence: transcription.confidence,
          timeRange: { startMs, endMs },
          speaker: 'unknown', // TODO: Add speaker diarization
        };

        this.callback(update);
      }
    } catch (error) {
      console.error('[StreamingTranscription] Error processing buffer:', error);
      // Re-add chunks to buffer on error for retry
      this.audioBuffer = [...chunksToProcess, ...this.audioBuffer];
      this.bufferedDurationMs += durationToProcess;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Transcribe combined audio chunks using Whisper
   */
  private async transcribeChunks(
    chunks: AudioChunk[]
  ): Promise<{ text: string; confidence: number } | null> {
    if (chunks.length === 0) {
      return null;
    }

    const client = this.getClient();
    let tempFilePath: string | null = null;

    try {
      // Combine audio data
      const combinedAudioBuffer = this.combineAudioChunks(chunks);

      // Write to temp file
      const format = chunks[0]?.format ?? 'webm';
      tempFilePath = path.join(os.tmpdir(), `transcribe_${uuidv4()}.${format}`);
      fs.writeFileSync(tempFilePath, combinedAudioBuffer);

      // Build prompt
      const prompt = this.config.medicalVocabulary !== false
        ? MEDICAL_VOCABULARY_PROMPT
        : undefined;

      // Call Whisper API
      const audioFile = fs.createReadStream(tempFilePath);
      const response = await client.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: this.config.language ?? 'en',
        prompt: prompt?.substring(0, 224), // Whisper prompt limit
        temperature: 0,
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      });

      // Calculate confidence from segments
      const segments = response.segments || [];
      let avgConfidence = 0.9;
      if (segments.length > 0) {
        const confidences = segments.map(
          (seg: { avg_logprob?: number }) =>
            seg.avg_logprob ? Math.min(1, Math.max(0, 1 + seg.avg_logprob / 2)) : 0.9
        );
        avgConfidence = confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length;
      }

      return {
        text: response.text.trim(),
        confidence: avgConfidence,
      };
    } finally {
      // Cleanup temp file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Combine multiple audio chunks into a single buffer
   */
  private combineAudioChunks(chunks: AudioChunk[]): Buffer {
    // For now, simple concatenation of base64-decoded data
    // In production, may need format-specific handling
    const buffers = chunks.map(chunk => Buffer.from(chunk.audioData, 'base64'));
    return Buffer.concat(buffers);
  }

  /**
   * Flush any remaining buffered audio
   */
  async flush(): Promise<void> {
    if (this.audioBuffer.length > 0) {
      console.log(`[StreamingTranscription] Flushing ${this.audioBuffer.length} remaining chunks`);
      await this.processBuffer();
    }

    // Wait for any in-progress processing to complete
    await this.processQueue;
  }

  /**
   * Pause the transcription session
   */
  pause(): void {
    if (this.state.status === 'active') {
      this.state.status = 'paused';
      console.log(`[StreamingTranscription] Session paused: ${this.config.sessionId}`);
    }
  }

  /**
   * Resume the transcription session
   */
  resume(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'active';
      console.log(`[StreamingTranscription] Session resumed: ${this.config.sessionId}`);
    }
  }

  /**
   * Stop the transcription session and flush remaining audio
   */
  async stop(): Promise<SessionState> {
    console.log(`[StreamingTranscription] Stopping session: ${this.config.sessionId}`);

    // Flush remaining audio
    await this.flush();

    this.state.status = 'stopped';
    return this.getState();
  }
}

// ===========================================
// SESSION MANAGER
// ===========================================

const activeSessions = new Map<string, StreamingTranscriptionSession>();

/**
 * Create a new streaming transcription session
 */
export function createTranscriptionSession(
  config: TranscriptionSessionConfig,
  callback: TranscriptionCallback
): StreamingTranscriptionSession {
  const session = new StreamingTranscriptionSession(config, callback);
  activeSessions.set(config.sessionId, session);
  console.log(`[StreamingTranscription] Session created: ${config.sessionId}`);
  return session;
}

/**
 * Get an active transcription session
 */
export function getTranscriptionSession(sessionId: string): StreamingTranscriptionSession | undefined {
  return activeSessions.get(sessionId);
}

/**
 * Remove a transcription session from active tracking
 */
export function removeTranscriptionSession(sessionId: string): void {
  activeSessions.delete(sessionId);
  console.log(`[StreamingTranscription] Session removed: ${sessionId}`);
}

/**
 * Get all active session IDs
 */
export function getActiveSessionIds(): string[] {
  return Array.from(activeSessions.keys());
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  StreamingTranscriptionSession,
  createTranscriptionSession,
  getTranscriptionSession,
  removeTranscriptionSession,
  getActiveSessionIds,
};
