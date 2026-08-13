/**
 * Capture Session Service
 *
 * Orchestrates a full voice capture session combining:
 * - Streaming transcription (Whisper)
 * - Real-time entity extraction (Claude Haiku)
 * - Field mapping (OASIS, SOAP, custom templates)
 *
 * Maintains session state and emits events for WebSocket updates.
 */

import {
  StreamingTranscriptionSession,
  createTranscriptionSession,
  removeTranscriptionSession,
  TranscriptionUpdate,
  AudioChunk,
} from './streamingTranscription.service';

import {
  RealtimeExtractionSession,
  createExtractionSession,
  removeExtractionSession,
  ExtractionResult,
  ExtractedEntity,
} from './realtimeExtraction.service';

import {
  FieldMapperService,
  createFieldMapper,
  removeFieldMapper,
  FieldUpdate,
  TemplateType,
  FieldMapping,
} from './fieldMapper.service';

// ===========================================
// TYPES
// ===========================================

export type CaptureSessionStatus =
  | 'initializing'
  | 'active'
  | 'paused'
  | 'processing'
  | 'completed'
  | 'error';

export interface CaptureSessionConfig {
  sessionId: string;
  visitId: string;
  patientId: string;
  userId: string;
  templateType?: TemplateType;
  patientContext?: {
    name?: string;
    dateOfBirth?: string;
    diagnoses?: string[];
    medications?: string[];
  };
  language?: string;
}

export interface CaptureSessionState {
  sessionId: string;
  visitId: string;
  patientId: string;
  userId: string;
  status: CaptureSessionStatus;
  startedAt: Date;
  pausedAt?: Date;
  completedAt?: Date;
  totalDurationMs: number;
  chunkCount: number;
  transcriptSegments: number;
  extractedEntityCount: number;
  mappedFieldCount: number;
}

export interface CaptureSessionResult {
  sessionId: string;
  visitId: string;
  fullTranscript: string;
  entities: ExtractedEntity[];
  mappedFields: FieldMapping[];
  duration: {
    totalMs: number;
    activeMs: number;
  };
  statistics: {
    chunkCount: number;
    transcriptSegments: number;
    entityCount: number;
    fieldCount: number;
    avgConfidence: number;
  };
}

// Event types for WebSocket emission
export interface CaptureEvent {
  type: 'transcription' | 'extraction' | 'fieldUpdate' | 'status' | 'error';
  sessionId: string;
  visitId: string;
  timestamp: number;
  data: TranscriptionUpdate | ExtractionResult | FieldUpdate | StatusUpdate | ErrorEvent;
}

export interface StatusUpdate {
  status: CaptureSessionStatus;
  message: string;
  progress?: number;
}

export interface ErrorEvent {
  code: string;
  message: string;
  recoverable: boolean;
}

export type CaptureEventCallback = (event: CaptureEvent) => void;

// ===========================================
// CAPTURE SESSION
// ===========================================

export class CaptureSession {
  private config: CaptureSessionConfig;
  private eventCallback: CaptureEventCallback;

  private transcriptionSession: StreamingTranscriptionSession | null = null;
  private extractionSession: RealtimeExtractionSession | null = null;
  private fieldMapper: FieldMapperService | null = null;

  private state: CaptureSessionState;
  private pauseStartTime: number | null = null;
  private totalPauseDurationMs: number = 0;

  constructor(config: CaptureSessionConfig, eventCallback: CaptureEventCallback) {
    this.config = config;
    this.eventCallback = eventCallback;

    this.state = {
      sessionId: config.sessionId,
      visitId: config.visitId,
      patientId: config.patientId,
      userId: config.userId,
      status: 'initializing',
      startedAt: new Date(),
      totalDurationMs: 0,
      chunkCount: 0,
      transcriptSegments: 0,
      extractedEntityCount: 0,
      mappedFieldCount: 0,
    };
  }

  /**
   * Get current session state
   */
  getState(): CaptureSessionState {
    return { ...this.state };
  }

  /**
   * Start the capture session
   */
  async start(): Promise<void> {
    try {
      console.log(`[CaptureSession] Starting session: ${this.config.sessionId}`);

      // Create transcription session
      this.transcriptionSession = createTranscriptionSession(
        {
          sessionId: this.config.sessionId,
          visitId: this.config.visitId,
          patientId: this.config.patientId,
          language: this.config.language,
          medicalVocabulary: true,
        },
        (update) => this.handleTranscriptionUpdate(update)
      );

      // Create extraction session
      this.extractionSession = createExtractionSession(
        {
          sessionId: this.config.sessionId,
          visitId: this.config.visitId,
          patientId: this.config.patientId,
          patientContext: this.config.patientContext,
        },
        (result) => this.handleExtractionResult(result)
      );

      // Create field mapper
      this.fieldMapper = createFieldMapper({
        sessionId: this.config.sessionId,
        templateType: this.config.templateType || 'OASIS',
      });

      this.state.status = 'active';
      this.emitStatusUpdate('active', 'Capture session started');

      console.log(`[CaptureSession] Session started successfully: ${this.config.sessionId}`);
    } catch (error) {
      console.error(`[CaptureSession] Error starting session:`, error);
      this.state.status = 'error';
      this.emitError('START_ERROR', 'Failed to start capture session', false);
      throw error;
    }
  }

  /**
   * Add an audio chunk for processing
   */
  addAudioChunk(chunk: AudioChunk): void {
    if (this.state.status !== 'active') {
      console.warn(`[CaptureSession] Cannot add chunk - session is ${this.state.status}`);
      return;
    }

    if (!this.transcriptionSession) {
      console.error(`[CaptureSession] Transcription session not initialized`);
      return;
    }

    this.state.chunkCount++;
    this.state.totalDurationMs += chunk.durationMs;

    this.transcriptionSession.addChunk(chunk);
  }

  /**
   * Handle transcription update from Whisper
   */
  private handleTranscriptionUpdate(update: TranscriptionUpdate): void {
    this.state.transcriptSegments++;

    // Emit transcription event
    this.emitEvent({
      type: 'transcription',
      sessionId: this.config.sessionId,
      visitId: this.config.visitId,
      timestamp: Date.now(),
      data: update,
    });

    // Feed text to extraction session
    if (this.extractionSession && update.text) {
      this.extractionSession.addUtterance(update.text);
    }
  }

  /**
   * Handle extraction result from Claude Haiku
   */
  private handleExtractionResult(result: ExtractionResult): void {
    this.state.extractedEntityCount += result.entities.length;

    // Emit extraction event
    this.emitEvent({
      type: 'extraction',
      sessionId: this.config.sessionId,
      visitId: this.config.visitId,
      timestamp: Date.now(),
      data: result,
    });

    // Map entities to fields
    if (this.fieldMapper) {
      for (const entity of result.entities) {
        const updates = this.fieldMapper.mapEntity(entity);
        for (const update of updates) {
          this.state.mappedFieldCount = update.allFields.length;
          this.emitEvent({
            type: 'fieldUpdate',
            sessionId: this.config.sessionId,
            visitId: this.config.visitId,
            timestamp: Date.now(),
            data: update,
          });
        }
      }
    }
  }

  /**
   * Pause the capture session
   */
  pause(): void {
    if (this.state.status !== 'active') {
      console.warn(`[CaptureSession] Cannot pause - session is ${this.state.status}`);
      return;
    }

    this.state.status = 'paused';
    this.state.pausedAt = new Date();
    this.pauseStartTime = Date.now();

    if (this.transcriptionSession) {
      this.transcriptionSession.pause();
    }

    this.emitStatusUpdate('paused', 'Capture paused');
    console.log(`[CaptureSession] Session paused: ${this.config.sessionId}`);
  }

  /**
   * Resume the capture session
   */
  resume(): void {
    if (this.state.status !== 'paused') {
      console.warn(`[CaptureSession] Cannot resume - session is ${this.state.status}`);
      return;
    }

    // Track pause duration
    if (this.pauseStartTime) {
      this.totalPauseDurationMs += Date.now() - this.pauseStartTime;
      this.pauseStartTime = null;
    }

    this.state.status = 'active';
    this.state.pausedAt = undefined;

    if (this.transcriptionSession) {
      this.transcriptionSession.resume();
    }

    this.emitStatusUpdate('active', 'Capture resumed');
    console.log(`[CaptureSession] Session resumed: ${this.config.sessionId}`);
  }

  /**
   * Stop the capture session and return results
   */
  async stop(): Promise<CaptureSessionResult> {
    console.log(`[CaptureSession] Stopping session: ${this.config.sessionId}`);

    this.state.status = 'processing';
    this.emitStatusUpdate('processing', 'Finalizing capture...');

    try {
      // Flush transcription
      let fullTranscript = '';
      if (this.transcriptionSession) {
        await this.transcriptionSession.stop();
        fullTranscript = this.transcriptionSession.getFullTranscript();
      }

      // Flush extraction
      let entities: ExtractedEntity[] = [];
      if (this.extractionSession) {
        entities = await this.extractionSession.stop();
      }

      // Get mapped fields
      let mappedFields: FieldMapping[] = [];
      if (this.fieldMapper) {
        mappedFields = this.fieldMapper.getMappedFields();
      }

      // Calculate active duration
      const totalMs = Date.now() - this.state.startedAt.getTime();
      const activeMs = totalMs - this.totalPauseDurationMs;

      // Calculate average confidence
      const avgConfidence =
        entities.length > 0
          ? entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length
          : 0;

      // Build result
      const result: CaptureSessionResult = {
        sessionId: this.config.sessionId,
        visitId: this.config.visitId,
        fullTranscript,
        entities,
        mappedFields,
        duration: {
          totalMs,
          activeMs,
        },
        statistics: {
          chunkCount: this.state.chunkCount,
          transcriptSegments: this.state.transcriptSegments,
          entityCount: entities.length,
          fieldCount: mappedFields.length,
          avgConfidence,
        },
      };

      // Cleanup
      this.cleanup();

      this.state.status = 'completed';
      this.state.completedAt = new Date();
      this.emitStatusUpdate('completed', 'Capture session completed');

      console.log(
        `[CaptureSession] Session completed: ${this.config.sessionId}, ` +
        `transcript: ${fullTranscript.length} chars, ` +
        `entities: ${entities.length}, fields: ${mappedFields.length}`
      );

      return result;
    } catch (error) {
      console.error(`[CaptureSession] Error stopping session:`, error);
      this.state.status = 'error';
      this.emitError('STOP_ERROR', 'Failed to stop capture session', false);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Cancel the session without saving
   */
  async cancel(): Promise<void> {
    console.log(`[CaptureSession] Cancelling session: ${this.config.sessionId}`);
    this.cleanup();
    this.state.status = 'completed';
    this.emitStatusUpdate('completed', 'Capture session cancelled');
  }

  /**
   * Cleanup all session resources
   */
  private cleanup(): void {
    if (this.transcriptionSession) {
      removeTranscriptionSession(this.config.sessionId);
      this.transcriptionSession = null;
    }

    if (this.extractionSession) {
      removeExtractionSession(this.config.sessionId);
      this.extractionSession = null;
    }

    if (this.fieldMapper) {
      removeFieldMapper(this.config.sessionId);
      this.fieldMapper = null;
    }
  }

  /**
   * Emit a capture event via callback
   */
  private emitEvent(event: CaptureEvent): void {
    try {
      this.eventCallback(event);
    } catch (error) {
      console.error(`[CaptureSession] Error emitting event:`, error);
    }
  }

  /**
   * Emit a status update event
   */
  private emitStatusUpdate(status: CaptureSessionStatus, message: string, progress?: number): void {
    this.emitEvent({
      type: 'status',
      sessionId: this.config.sessionId,
      visitId: this.config.visitId,
      timestamp: Date.now(),
      data: { status, message, progress } as StatusUpdate,
    });
  }

  /**
   * Emit an error event
   */
  private emitError(code: string, message: string, recoverable: boolean): void {
    this.emitEvent({
      type: 'error',
      sessionId: this.config.sessionId,
      visitId: this.config.visitId,
      timestamp: Date.now(),
      data: { code, message, recoverable } as ErrorEvent,
    });
  }
}

// ===========================================
// SESSION MANAGER
// ===========================================

const activeSessions = new Map<string, CaptureSession>();

/**
 * Create a new capture session
 */
export function createCaptureSession(
  config: CaptureSessionConfig,
  eventCallback: CaptureEventCallback
): CaptureSession {
  const session = new CaptureSession(config, eventCallback);
  activeSessions.set(config.sessionId, session);
  console.log(`[CaptureSession] Created: ${config.sessionId}`);
  return session;
}

/**
 * Get an active capture session
 */
export function getCaptureSession(sessionId: string): CaptureSession | undefined {
  return activeSessions.get(sessionId);
}

/**
 * Remove a capture session
 */
export function removeCaptureSession(sessionId: string): void {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.cancel().catch(console.error);
    activeSessions.delete(sessionId);
    console.log(`[CaptureSession] Removed: ${sessionId}`);
  }
}

/**
 * Get all active session IDs
 */
export function getActiveCaptureSessionIds(): string[] {
  return Array.from(activeSessions.keys());
}

/**
 * Get active sessions for a user
 */
export function getSessionsByUser(userId: string): CaptureSession[] {
  return Array.from(activeSessions.values()).filter(
    session => session.getState().userId === userId
  );
}

/**
 * Get active sessions for a visit
 */
export function getSessionsByVisit(visitId: string): CaptureSession[] {
  return Array.from(activeSessions.values()).filter(
    session => session.getState().visitId === visitId
  );
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  CaptureSession,
  createCaptureSession,
  getCaptureSession,
  removeCaptureSession,
  getActiveCaptureSessionIds,
  getSessionsByUser,
  getSessionsByVisit,
};
