/**
 * WebSocket Event Types
 *
 * Typed events for real-time streaming communication between
 * the mobile/web client and the backend server.
 */

// ===========================================
// USER & CONNECTION TYPES
// ===========================================

export interface SocketUserData {
  userId: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

export interface ConnectedUser {
  socketId: string;
  user: SocketUserData;
  connectedAt: Date;
  rooms: Set<string>;
}

// ===========================================
// CAPTURE NAMESPACE EVENTS
// ===========================================

/**
 * Audio chunk sent from client during voice capture
 */
export interface AudioChunkEvent {
  /** Unique identifier for the capture session */
  sessionId: string;
  /** Visit ID this capture is associated with */
  visitId: string;
  /** Sequential chunk number for ordering */
  chunkIndex: number;
  /** Base64-encoded audio data */
  audioData: string;
  /** Audio format (e.g., 'wav', 'opus', 'mp3') */
  format: 'wav' | 'opus' | 'mp3' | 'webm';
  /** Sample rate in Hz */
  sampleRate: number;
  /** Duration of this chunk in milliseconds */
  durationMs: number;
  /** Client-side timestamp when chunk was recorded */
  timestamp: number;
  /** Whether this is the final chunk */
  isFinal: boolean;
}

/**
 * Transcription update sent from server as speech is recognized
 */
export interface TranscriptionUpdateEvent {
  /** Session ID this transcription belongs to */
  sessionId: string;
  /** Visit ID this transcription is associated with */
  visitId: string;
  /** Incremental or full transcription text */
  text: string;
  /** Whether this is a partial (interim) or final result */
  isFinal: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Timestamp range in the audio this covers */
  timeRange: {
    startMs: number;
    endMs: number;
  };
  /** Speaker identification if available */
  speaker?: 'clinician' | 'patient' | 'other' | 'unknown';
  /** Segment index for ordering multiple segments */
  segmentIndex: number;
}

/**
 * Field extraction update as structured data is extracted from transcription
 */
export interface FieldExtractionEvent {
  /** Session ID this extraction belongs to */
  sessionId: string;
  /** Visit ID this extraction is associated with */
  visitId: string;
  /** Field that was extracted */
  field: ExtractedField;
  /** All extracted fields so far */
  allFields: ExtractedField[];
  /** Confidence in the overall extraction */
  overallConfidence: number;
  /** Form section this field belongs to */
  formSection?: string;
}

export interface ExtractedField {
  /** Field identifier/name */
  fieldId: string;
  /** Human-readable field label */
  label: string;
  /** Extracted value */
  value: string | number | boolean | string[];
  /** Field data type */
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'date' | 'time';
  /** Confidence score for this extraction (0-1) */
  confidence: number;
  /** Source text that led to this extraction */
  sourceText?: string;
  /** Whether this field requires review */
  needsReview: boolean;
  /** Timestamp when extracted */
  extractedAt: number;
}

/**
 * Visit capture session lifecycle events
 */
export interface VisitStartEvent {
  /** Unique session ID for this capture */
  sessionId: string;
  /** Visit ID being captured */
  visitId: string;
  /** Patient ID for context */
  patientId: string;
  /** Form template being used */
  formTemplateId?: string;
  /** Client timestamp when capture started */
  startedAt: number;
}

export interface VisitStopEvent {
  /** Session ID being stopped */
  sessionId: string;
  /** Visit ID */
  visitId: string;
  /** Reason for stopping */
  reason: 'completed' | 'paused' | 'cancelled' | 'error';
  /** Client timestamp when capture stopped */
  stoppedAt: number;
  /** Total duration in milliseconds */
  totalDurationMs: number;
}

export interface CaptureStatusEvent {
  /** Session ID */
  sessionId: string;
  /** Current capture status */
  status: 'initializing' | 'recording' | 'processing' | 'paused' | 'completed' | 'error';
  /** Status message */
  message?: string;
  /** Progress percentage (0-100) for processing */
  progress?: number;
  /** Error details if status is 'error' */
  error?: {
    code: string;
    message: string;
  };
}

// ===========================================
// NOTIFICATION NAMESPACE EVENTS
// ===========================================

/**
 * Clinical alert event for urgent clinical notifications
 */
export interface ClinicalAlertEvent {
  /** Unique alert ID */
  alertId: string;
  /** Type of clinical alert */
  alertType: ClinicalAlertType;
  /** Severity level */
  severity: 'info' | 'warning' | 'urgent' | 'critical';
  /** Alert title */
  title: string;
  /** Detailed message */
  message: string;
  /** Patient ID if applicable */
  patientId?: string;
  /** Patient name for display */
  patientName?: string;
  /** Visit ID if applicable */
  visitId?: string;
  /** Episode ID if applicable */
  episodeId?: string;
  /** User ID who triggered/created the alert */
  triggeredBy?: string;
  /** When the alert was created */
  createdAt: number;
  /** When the alert expires (optional) */
  expiresAt?: number;
  /** Action URL or deep link */
  actionUrl?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export type ClinicalAlertType =
  | 'vital_sign_abnormal'
  | 'fall_risk'
  | 'medication_interaction'
  | 'missed_visit'
  | 'condition_change'
  | 'hospitalization_risk'
  | 'care_plan_deviation'
  | 'documentation_required'
  | 'physician_order_needed'
  | 'custom';

/**
 * Supervisor alert for management notifications
 */
export interface SupervisorAlertEvent {
  /** Unique alert ID */
  alertId: string;
  /** Type of supervisor alert */
  alertType: SupervisorAlertType;
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'urgent';
  /** Alert title */
  title: string;
  /** Detailed message */
  message: string;
  /** Clinician ID if applicable */
  clinicianId?: string;
  /** Clinician name for display */
  clinicianName?: string;
  /** Patient ID if applicable */
  patientId?: string;
  /** When the alert was created */
  createdAt: number;
  /** Action required */
  actionRequired: boolean;
  /** Action URL or deep link */
  actionUrl?: string;
}

export type SupervisorAlertType =
  | 'documentation_overdue'
  | 'visit_not_started'
  | 'cosign_required'
  | 'quality_issue'
  | 'schedule_conflict'
  | 'certification_expiring'
  | 'productivity_alert'
  | 'escalation'
  | 'custom';

/**
 * System notification for general application events
 */
export interface SystemNotificationEvent {
  /** Unique notification ID */
  notificationId: string;
  /** Notification type */
  type: 'info' | 'success' | 'warning' | 'error';
  /** Notification title */
  title: string;
  /** Notification message */
  message: string;
  /** When the notification was created */
  createdAt: number;
  /** Auto-dismiss after milliseconds (0 = no auto-dismiss) */
  autoDismissMs: number;
  /** Whether notification persists across sessions */
  persistent: boolean;
  /** Category for filtering */
  category?: string;
}

// ===========================================
// CLIENT-TO-SERVER EVENT MAPS
// ===========================================

export interface CaptureClientToServerEvents {
  'visit:start': (event: VisitStartEvent) => void;
  'visit:stop': (event: VisitStopEvent) => void;
  'audio:chunk': (event: AudioChunkEvent) => void;
  'capture:pause': (sessionId: string) => void;
  'capture:resume': (sessionId: string) => void;
  'room:join': (visitId: string) => void;
  'room:leave': (visitId: string) => void;
}

export interface CaptureServerToClientEvents {
  'transcription:update': (event: TranscriptionUpdateEvent) => void;
  'field:extraction': (event: FieldExtractionEvent) => void;
  'capture:status': (event: CaptureStatusEvent) => void;
  'error': (error: { code: string; message: string }) => void;
}

export interface NotificationClientToServerEvents {
  'subscribe:patient': (patientId: string) => void;
  'unsubscribe:patient': (patientId: string) => void;
  'subscribe:visit': (visitId: string) => void;
  'unsubscribe:visit': (visitId: string) => void;
  'alert:acknowledge': (alertId: string) => void;
  'notification:dismiss': (notificationId: string) => void;
}

export interface NotificationServerToClientEvents {
  'clinical:alert': (event: ClinicalAlertEvent) => void;
  'supervisor:alert': (event: SupervisorAlertEvent) => void;
  'system:notification': (event: SystemNotificationEvent) => void;
  'error': (error: { code: string; message: string }) => void;
}

// ===========================================
// SOCKET DATA TYPES
// ===========================================

export interface CaptureSocketData {
  user: SocketUserData;
  activeSessions: Map<string, string>; // sessionId -> visitId
}

export interface NotificationSocketData {
  user: SocketUserData;
  subscribedPatients: Set<string>;
  subscribedVisits: Set<string>;
}
