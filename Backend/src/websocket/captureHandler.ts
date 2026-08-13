/**
 * Capture Handler
 *
 * Handles real-time voice capture events including:
 * - Audio chunk streaming
 * - Transcription updates
 * - Field extraction updates
 * - Visit start/stop events
 * - Room management for per-visit collaboration
 *
 * Integrates with streaming services for real-time processing:
 * - StreamingTranscriptionSession for Whisper transcription
 * - RealtimeExtractionSession for Claude Haiku entity extraction
 * - FieldMapperService for OASIS/SOAP field mapping
 */

import { Socket, Namespace } from 'socket.io';
import {
  CaptureClientToServerEvents,
  CaptureServerToClientEvents,
  CaptureSocketData,
  AudioChunkEvent,
  VisitStartEvent,
  VisitStopEvent,
  TranscriptionUpdateEvent,
  FieldExtractionEvent,
  CaptureStatusEvent,
  ExtractedField,
} from '../types/websocket.types';
import {
  CaptureSession,
  createCaptureSession,
  removeCaptureSession,
  CaptureEvent,
  CaptureSessionResult,
} from '../services/streaming';

// ===========================================
// TYPE DEFINITIONS
// ===========================================

type CaptureSocket = Socket<
  CaptureClientToServerEvents,
  CaptureServerToClientEvents,
  Record<string, never>,
  CaptureSocketData
>;

type CaptureNamespace = Namespace<
  CaptureClientToServerEvents,
  CaptureServerToClientEvents,
  Record<string, never>,
  CaptureSocketData
>;

// ===========================================
// ACTIVE SESSION TRACKING
// ===========================================

interface ActiveSession {
  sessionId: string;
  visitId: string;
  userId: string;
  startedAt: Date;
  chunkCount: number;
  totalDurationMs: number;
  status: 'recording' | 'processing' | 'paused';
  captureSession?: CaptureSession;
}

// Track active capture sessions globally
const activeSessions = new Map<string, ActiveSession>();

// Store namespace reference for event emission (used for external emission helpers)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _captureNamespaceRef: CaptureNamespace | null = null;

export function getActiveSession(sessionId: string): ActiveSession | undefined {
  return activeSessions.get(sessionId);
}

export function getActiveSessionsByVisit(visitId: string): ActiveSession[] {
  return Array.from(activeSessions.values()).filter(
    (session) => session.visitId === visitId
  );
}

export function getActiveSessionsByUser(userId: string): ActiveSession[] {
  return Array.from(activeSessions.values()).filter(
    (session) => session.userId === userId
  );
}

// ===========================================
// CAPTURE HANDLER SETUP
// ===========================================

/**
 * Setup event handlers for capture socket
 */
export function setupCaptureHandler(
  socket: CaptureSocket,
  namespace: CaptureNamespace
): void {
  const user = socket.data.user;

  // Store namespace reference for event emission (used for external emission helpers)
  _captureNamespaceRef = namespace;

  // ===========================================
  // ROOM MANAGEMENT
  // ===========================================

  /**
   * Join a visit room for real-time collaboration
   */
  socket.on('room:join', (visitId: string) => {
    if (!visitId) {
      socket.emit('error', { code: 'INVALID_VISIT_ID', message: 'Visit ID is required' });
      return;
    }

    const room = `visit:${visitId}`;
    socket.join(room);

    console.log(`[Capture] User ${user.userId} joined room ${room}`);
  });

  /**
   * Leave a visit room
   */
  socket.on('room:leave', (visitId: string) => {
    if (!visitId) return;

    const room = `visit:${visitId}`;
    socket.leave(room);

    console.log(`[Capture] User ${user.userId} left room ${room}`);
  });

  // ===========================================
  // VISIT LIFECYCLE EVENTS
  // ===========================================

  /**
   * Handle visit capture start
   * Creates a CaptureSession that orchestrates transcription, extraction, and field mapping
   */
  socket.on('visit:start', async (event: VisitStartEvent) => {
    try {
      const { sessionId, visitId, patientId, formTemplateId, startedAt } = event;

      // Validate required fields
      if (!sessionId || !visitId || !patientId) {
        socket.emit('error', {
          code: 'INVALID_START_EVENT',
          message: 'sessionId, visitId, and patientId are required',
        });
        return;
      }

      // Check if session already exists
      if (activeSessions.has(sessionId)) {
        socket.emit('error', {
          code: 'SESSION_EXISTS',
          message: 'Session already exists',
        });
        return;
      }

      // Create CaptureSession with streaming services
      const captureSession = createCaptureSession(
        {
          sessionId,
          visitId,
          patientId,
          userId: user.userId,
          templateType: formTemplateId === 'SOAP' ? 'SOAP' : 'OASIS',
        },
        (captureEvent: CaptureEvent) => {
          // Handle events from the capture session pipeline
          handleCaptureEvent(socket, namespace, visitId, captureEvent);
        }
      );

      // Start the capture session
      await captureSession.start();

      // Create local session tracking
      const session: ActiveSession = {
        sessionId,
        visitId,
        userId: user.userId,
        startedAt: new Date(startedAt || Date.now()),
        chunkCount: 0,
        totalDurationMs: 0,
        status: 'recording',
        captureSession,
      };

      activeSessions.set(sessionId, session);
      socket.data.activeSessions.set(sessionId, visitId);

      // Join the visit room
      const room = `visit:${visitId}`;
      socket.join(room);

      // Emit status update
      const statusEvent: CaptureStatusEvent = {
        sessionId,
        status: 'recording',
        message: 'Capture session started',
      };
      socket.emit('capture:status', statusEvent);

      // Notify others in the room
      socket.to(room).emit('capture:status', {
        sessionId,
        status: 'recording',
        message: `${user.firstName || 'User'} started capturing`,
      });

      console.log(`[Capture] Session started: ${sessionId} for visit ${visitId}`);
    } catch (error) {
      console.error('[Capture] Error starting visit:', error);
      socket.emit('error', { code: 'START_ERROR', message: 'Failed to start capture' });
    }
  });

  /**
   * Handle visit capture stop
   * Stops the CaptureSession and returns final results
   */
  socket.on('visit:stop', async (event: VisitStopEvent) => {
    try {
      const { sessionId, visitId, reason, stoppedAt: _stoppedAt, totalDurationMs } = event;

      const session = activeSessions.get(sessionId);
      if (!session) {
        socket.emit('error', {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found',
        });
        return;
      }

      // Verify user owns the session
      if (session.userId !== user.userId) {
        socket.emit('error', {
          code: 'UNAUTHORIZED',
          message: 'Not authorized to stop this session',
        });
        return;
      }

      // Update session status
      session.status = 'processing';
      session.totalDurationMs = totalDurationMs;

      // Emit processing status
      const statusEvent: CaptureStatusEvent = {
        sessionId,
        status: reason === 'completed' ? 'processing' : reason === 'paused' ? 'paused' : 'completed',
        message: `Capture ${reason}`,
        progress: 0,
      };
      socket.emit('capture:status', statusEvent);

      const room = `visit:${visitId}`;

      if (reason === 'completed' || reason === 'cancelled') {
        // Stop the capture session and get results
        let result: CaptureSessionResult | null = null;
        if (session.captureSession) {
          if (reason === 'completed') {
            result = await session.captureSession.stop();
          } else {
            await session.captureSession.cancel();
          }
        }

        // Clean up session
        activeSessions.delete(sessionId);
        socket.data.activeSessions.delete(sessionId);
        removeCaptureSession(sessionId);

        // Final status with result summary
        socket.emit('capture:status', {
          sessionId,
          status: 'completed',
          message: result
            ? `Capture complete: ${result.statistics.entityCount} entities, ${result.statistics.fieldCount} fields`
            : 'Capture session completed',
          progress: 100,
        });
      }

      // Notify others in the room
      socket.to(room).emit('capture:status', {
        sessionId,
        status: statusEvent.status,
        message: `${user.firstName || 'User'} ${reason} capturing`,
      });

      console.log(`[Capture] Session stopped: ${sessionId} (${reason})`);
    } catch (error) {
      console.error('[Capture] Error stopping visit:', error);
      socket.emit('error', { code: 'STOP_ERROR', message: 'Failed to stop capture' });
    }
  });

  // ===========================================
  // AUDIO STREAMING EVENTS
  // ===========================================

  /**
   * Handle incoming audio chunk
   * Routes audio to the CaptureSession's streaming transcription pipeline
   */
  socket.on('audio:chunk', async (event: AudioChunkEvent) => {
    try {
      const {
        sessionId,
        visitId: _visitId,
        chunkIndex,
        audioData,
        format,
        sampleRate,
        durationMs,
        timestamp,
        isFinal: _isFinal,
      } = event;

      // Validate session
      const session = activeSessions.get(sessionId);
      if (!session) {
        socket.emit('error', {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found. Start a capture session first.',
        });
        return;
      }

      // Verify session ownership
      if (session.userId !== user.userId) {
        socket.emit('error', {
          code: 'UNAUTHORIZED',
          message: 'Not authorized for this session',
        });
        return;
      }

      // Validate audio data
      if (!audioData || audioData.length === 0) {
        socket.emit('error', {
          code: 'INVALID_AUDIO',
          message: 'Audio data is required',
        });
        return;
      }

      // Update session stats
      session.chunkCount++;
      session.totalDurationMs += durationMs;

      console.log(
        `[Capture] Audio chunk received: session=${sessionId}, chunk=${chunkIndex}, ` +
        `duration=${durationMs}ms, format=${format}`
      );

      // Route audio chunk to the CaptureSession for processing
      if (session.captureSession) {
        session.captureSession.addAudioChunk({
          chunkIndex,
          audioData,
          format,
          sampleRate,
          durationMs,
          timestamp,
        });
      }

    } catch (error) {
      console.error('[Capture] Error processing audio chunk:', error);
      socket.emit('error', { code: 'AUDIO_ERROR', message: 'Failed to process audio chunk' });
    }
  });

  // ===========================================
  // PAUSE/RESUME EVENTS
  // ===========================================

  /**
   * Handle capture pause
   * Pauses the CaptureSession's transcription pipeline
   */
  socket.on('capture:pause', (sessionId: string) => {
    const session = activeSessions.get(sessionId);
    if (!session) {
      socket.emit('error', { code: 'SESSION_NOT_FOUND', message: 'Session not found' });
      return;
    }

    if (session.userId !== user.userId) {
      socket.emit('error', { code: 'UNAUTHORIZED', message: 'Not authorized' });
      return;
    }

    session.status = 'paused';

    // Pause the capture session pipeline
    if (session.captureSession) {
      session.captureSession.pause();
    }

    socket.emit('capture:status', {
      sessionId,
      status: 'paused',
      message: 'Capture paused',
    });

    const room = `visit:${session.visitId}`;
    socket.to(room).emit('capture:status', {
      sessionId,
      status: 'paused',
      message: `${user.firstName || 'User'} paused capturing`,
    });

    console.log(`[Capture] Session paused: ${sessionId}`);
  });

  /**
   * Handle capture resume
   * Resumes the CaptureSession's transcription pipeline
   */
  socket.on('capture:resume', (sessionId: string) => {
    const session = activeSessions.get(sessionId);
    if (!session) {
      socket.emit('error', { code: 'SESSION_NOT_FOUND', message: 'Session not found' });
      return;
    }

    if (session.userId !== user.userId) {
      socket.emit('error', { code: 'UNAUTHORIZED', message: 'Not authorized' });
      return;
    }

    session.status = 'recording';

    // Resume the capture session pipeline
    if (session.captureSession) {
      session.captureSession.resume();
    }

    socket.emit('capture:status', {
      sessionId,
      status: 'recording',
      message: 'Capture resumed',
    });

    const room = `visit:${session.visitId}`;
    socket.to(room).emit('capture:status', {
      sessionId,
      status: 'recording',
      message: `${user.firstName || 'User'} resumed capturing`,
    });

    console.log(`[Capture] Session resumed: ${sessionId}`);
  });

  // ===========================================
  // CLEANUP ON DISCONNECT
  // ===========================================

  socket.on('disconnect', () => {
    // Clean up any active sessions for this user
    const entries = Array.from(activeSessions.entries());
    for (const [sessionId, session] of entries) {
      if (session.userId === user.userId) {
        // Mark session as disconnected but don't delete
        // This allows reconnection handling
        session.status = 'paused';

        // Pause the capture session pipeline on disconnect
        if (session.captureSession) {
          session.captureSession.pause();
        }

        const room = `visit:${session.visitId}`;
        namespace.to(room).emit('capture:status', {
          sessionId,
          status: 'paused',
          message: `${user.firstName || 'User'} disconnected`,
        });
      }
    }
  });
}

// ===========================================
// CAPTURE EVENT HANDLER
// ===========================================

/**
 * Handle events from the CaptureSession pipeline
 * Transforms internal events to WebSocket events for client consumption
 */
function handleCaptureEvent(
  socket: CaptureSocket,
  namespace: CaptureNamespace,
  visitId: string,
  event: CaptureEvent
): void {
  const room = `visit:${visitId}`;

  switch (event.type) {
    case 'transcription': {
      const transcriptionData = event.data as {
        sessionId: string;
        segmentIndex: number;
        text: string;
        isFinal: boolean;
        confidence: number;
        timeRange: { startMs: number; endMs: number };
        speaker?: 'clinician' | 'patient' | 'other' | 'unknown';
      };

      const transcriptionUpdate: TranscriptionUpdateEvent = {
        sessionId: transcriptionData.sessionId,
        visitId,
        text: transcriptionData.text,
        isFinal: transcriptionData.isFinal,
        confidence: transcriptionData.confidence,
        timeRange: transcriptionData.timeRange,
        speaker: transcriptionData.speaker,
        segmentIndex: transcriptionData.segmentIndex,
      };

      namespace.to(room).emit('transcription:update', transcriptionUpdate);
      break;
    }

    case 'extraction': {
      const extractionData = event.data as {
        sessionId: string;
        entities: Array<{
          type: string;
          value: string | number;
          confidence: number;
          sourceText: string;
          oasisField?: string;
        }>;
      };

      // Convert entities to ExtractedField format
      const extractedFields: ExtractedField[] = extractionData.entities.map((entity, index) => ({
        fieldId: entity.oasisField || `${entity.type}_${index}`,
        label: formatEntityLabel(entity.type),
        value: entity.value,
        type: typeof entity.value === 'number' ? 'number' : 'text',
        confidence: entity.confidence,
        sourceText: entity.sourceText,
        needsReview: entity.confidence < 0.85,
        extractedAt: Date.now(),
      }));

      if (extractedFields.length > 0) {
        const fieldExtraction: FieldExtractionEvent = {
          sessionId: extractionData.sessionId,
          visitId,
          field: extractedFields[extractedFields.length - 1]!, // Most recent field
          allFields: extractedFields,
          overallConfidence:
            extractedFields.reduce((sum, f) => sum + f.confidence, 0) / extractedFields.length,
        };

        namespace.to(room).emit('field:extraction', fieldExtraction);
      }
      break;
    }

    case 'fieldUpdate': {
      const fieldData = event.data as {
        sessionId: string;
        field: {
          fieldId: string;
          fieldLabel: string;
          value: string | number | boolean | string[];
          confidence: number;
          sourceText: string;
          needsReview: boolean;
        };
        allFields: Array<{
          fieldId: string;
          fieldLabel: string;
          value: string | number | boolean | string[];
          confidence: number;
          sourceText: string;
          needsReview: boolean;
        }>;
      };

      const extractedFields: ExtractedField[] = fieldData.allFields.map((f) => ({
        fieldId: f.fieldId,
        label: f.fieldLabel,
        value: f.value,
        type: typeof f.value === 'number' ? 'number' : typeof f.value === 'boolean' ? 'boolean' : 'text',
        confidence: f.confidence,
        sourceText: f.sourceText,
        needsReview: f.needsReview,
        extractedAt: Date.now(),
      }));

      const fieldExtraction: FieldExtractionEvent = {
        sessionId: fieldData.sessionId,
        visitId,
        field: {
          fieldId: fieldData.field.fieldId,
          label: fieldData.field.fieldLabel,
          value: fieldData.field.value,
          type: typeof fieldData.field.value === 'number' ? 'number' : 'text',
          confidence: fieldData.field.confidence,
          sourceText: fieldData.field.sourceText,
          needsReview: fieldData.field.needsReview,
          extractedAt: Date.now(),
        },
        allFields: extractedFields,
        overallConfidence:
          extractedFields.length > 0
            ? extractedFields.reduce((sum, f) => sum + f.confidence, 0) / extractedFields.length
            : 0,
      };

      namespace.to(room).emit('field:extraction', fieldExtraction);
      break;
    }

    case 'status': {
      const statusData = event.data as {
        status: string;
        message: string;
        progress?: number;
      };

      const captureStatus: CaptureStatusEvent = {
        sessionId: event.sessionId,
        status: statusData.status as CaptureStatusEvent['status'],
        message: statusData.message,
        progress: statusData.progress,
      };

      namespace.to(room).emit('capture:status', captureStatus);
      break;
    }

    case 'error': {
      const errorData = event.data as {
        code: string;
        message: string;
      };

      socket.emit('error', {
        code: errorData.code,
        message: errorData.message,
      });
      break;
    }
  }
}

/**
 * Format entity type to human-readable label
 */
function formatEntityLabel(entityType: string): string {
  const labels: Record<string, string> = {
    vital_bp: 'Blood Pressure',
    vital_hr: 'Heart Rate',
    vital_rr: 'Respiratory Rate',
    vital_temp: 'Temperature',
    vital_spo2: 'Oxygen Saturation',
    vital_weight: 'Weight',
    vital_pain: 'Pain Level',
    medication: 'Medication',
    diagnosis: 'Diagnosis',
    diagnosis_code: 'Diagnosis Code',
    procedure: 'Procedure',
    functional_adl: 'ADL Status',
    functional_mobility: 'Mobility',
    functional_transfer: 'Transfer',
    wound: 'Wound Assessment',
    symptom: 'Symptom',
    mental_status: 'Mental Status',
    fall_risk: 'Fall Risk',
    homebound_status: 'Homebound Status',
  };

  return labels[entityType] || entityType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ===========================================
// EXTERNAL EMISSION HELPERS
// ===========================================

/**
 * Emit transcription update to a session
 * Called by transcription service when results are ready
 */
export function emitTranscriptionUpdate(
  namespace: CaptureNamespace,
  visitId: string,
  update: TranscriptionUpdateEvent
): void {
  const room = `visit:${visitId}`;
  namespace.to(room).emit('transcription:update', update);
}

/**
 * Emit field extraction update to a session
 * Called by AI extraction service when fields are extracted
 */
export function emitFieldExtraction(
  namespace: CaptureNamespace,
  visitId: string,
  extraction: FieldExtractionEvent
): void {
  const room = `visit:${visitId}`;
  namespace.to(room).emit('field:extraction', extraction);
}

/**
 * Emit capture status update to a session
 */
export function emitCaptureStatus(
  namespace: CaptureNamespace,
  visitId: string,
  status: CaptureStatusEvent
): void {
  const room = `visit:${visitId}`;
  namespace.to(room).emit('capture:status', status);
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  setupCaptureHandler,
  getActiveSession,
  getActiveSessionsByVisit,
  getActiveSessionsByUser,
  emitTranscriptionUpdate,
  emitFieldExtraction,
  emitCaptureStatus,
};
