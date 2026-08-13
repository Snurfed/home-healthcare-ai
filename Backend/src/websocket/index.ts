/**
 * WebSocket Module Exports
 *
 * Central export point for WebSocket functionality
 */

// Socket server
export {
  initializeSocketServer,
  getSocketServer,
  getCaptureNamespace,
  getNotificationsNamespace,
  getConnectedUsers,
  getConnectedUsersByUserId,
  isUserOnline,
  getSocketsInRoom,
  emitToRoom,
  emitToUser,
  emitToRole,
} from './socketServer';

// Capture handler
export {
  setupCaptureHandler,
  getActiveSession,
  getActiveSessionsByVisit,
  getActiveSessionsByUser,
  emitTranscriptionUpdate,
  emitFieldExtraction,
  emitCaptureStatus,
} from './captureHandler';

// Notification handler
export {
  setupNotificationHandler,
  emitClinicalAlert,
  emitSupervisorAlert,
  emitSystemNotification,
  emitToVisit,
  emitToPatient,
  getPendingAlert,
  getPendingAlertsForUser,
  cleanupOldAlerts,
  getPendingAlertCount,
} from './notificationHandler';

// Re-export types
export * from '../types/websocket.types';
