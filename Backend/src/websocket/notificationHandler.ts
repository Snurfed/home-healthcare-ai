/**
 * Notification Handler
 *
 * Handles real-time notification events including:
 * - Clinical event notifications
 * - Supervisor alerts
 * - System notifications
 * - Subscription management for patients and visits
 */

import { Socket, Namespace } from 'socket.io';
import {
  NotificationClientToServerEvents,
  NotificationServerToClientEvents,
  NotificationSocketData,
  ClinicalAlertEvent,
  SupervisorAlertEvent,
  SystemNotificationEvent,
} from '../types/websocket.types';

// ===========================================
// TYPE DEFINITIONS
// ===========================================

type NotificationSocket = Socket<
  NotificationClientToServerEvents,
  NotificationServerToClientEvents,
  Record<string, never>,
  NotificationSocketData
>;

type NotificationNamespace = Namespace<
  NotificationClientToServerEvents,
  NotificationServerToClientEvents,
  Record<string, never>,
  NotificationSocketData
>;

// ===========================================
// ALERT TRACKING
// ===========================================

interface PendingAlert {
  alertId: string;
  type: 'clinical' | 'supervisor' | 'system';
  createdAt: Date;
  acknowledgedBy: Set<string>;
  targetUsers: Set<string>;
}

// Track pending alerts that need acknowledgment
const pendingAlerts = new Map<string, PendingAlert>();

export function getPendingAlert(alertId: string): PendingAlert | undefined {
  return pendingAlerts.get(alertId);
}

export function getPendingAlertsForUser(userId: string): PendingAlert[] {
  return Array.from(pendingAlerts.values()).filter(
    (alert) => alert.targetUsers.has(userId) && !alert.acknowledgedBy.has(userId)
  );
}

// ===========================================
// NOTIFICATION HANDLER SETUP
// ===========================================

/**
 * Setup event handlers for notification socket
 */
export function setupNotificationHandler(
  socket: NotificationSocket,
  _namespace: NotificationNamespace
): void {
  const user = socket.data.user;

  // ===========================================
  // SUBSCRIPTION MANAGEMENT
  // ===========================================

  /**
   * Subscribe to patient notifications
   */
  socket.on('subscribe:patient', (patientId: string) => {
    if (!patientId) {
      socket.emit('error', { code: 'INVALID_PATIENT_ID', message: 'Patient ID is required' });
      return;
    }

    const room = `patient:${patientId}`;
    socket.join(room);
    socket.data.subscribedPatients.add(patientId);

    console.log(`[Notifications] User ${user.userId} subscribed to patient ${patientId}`);
  });

  /**
   * Unsubscribe from patient notifications
   */
  socket.on('unsubscribe:patient', (patientId: string) => {
    if (!patientId) return;

    const room = `patient:${patientId}`;
    socket.leave(room);
    socket.data.subscribedPatients.delete(patientId);

    console.log(`[Notifications] User ${user.userId} unsubscribed from patient ${patientId}`);
  });

  /**
   * Subscribe to visit notifications
   */
  socket.on('subscribe:visit', (visitId: string) => {
    if (!visitId) {
      socket.emit('error', { code: 'INVALID_VISIT_ID', message: 'Visit ID is required' });
      return;
    }

    const room = `visit:${visitId}`;
    socket.join(room);
    socket.data.subscribedVisits.add(visitId);

    console.log(`[Notifications] User ${user.userId} subscribed to visit ${visitId}`);
  });

  /**
   * Unsubscribe from visit notifications
   */
  socket.on('unsubscribe:visit', (visitId: string) => {
    if (!visitId) return;

    const room = `visit:${visitId}`;
    socket.leave(room);
    socket.data.subscribedVisits.delete(visitId);

    console.log(`[Notifications] User ${user.userId} unsubscribed from visit ${visitId}`);
  });

  // ===========================================
  // ALERT ACKNOWLEDGMENT
  // ===========================================

  /**
   * Handle alert acknowledgment
   */
  socket.on('alert:acknowledge', (alertId: string) => {
    if (!alertId) {
      socket.emit('error', { code: 'INVALID_ALERT_ID', message: 'Alert ID is required' });
      return;
    }

    const alert = pendingAlerts.get(alertId);
    if (!alert) {
      // Alert may have already been processed or doesn't exist
      console.log(`[Notifications] Alert ${alertId} not found for acknowledgment`);
      return;
    }

    // Mark as acknowledged by this user
    alert.acknowledgedBy.add(user.userId);

    console.log(`[Notifications] Alert ${alertId} acknowledged by ${user.userId}`);

    // If all target users have acknowledged, clean up
    if (alert.acknowledgedBy.size >= alert.targetUsers.size) {
      pendingAlerts.delete(alertId);
      console.log(`[Notifications] Alert ${alertId} fully acknowledged, removed from pending`);
    }
  });

  // ===========================================
  // NOTIFICATION DISMISSAL
  // ===========================================

  /**
   * Handle notification dismissal
   */
  socket.on('notification:dismiss', (notificationId: string) => {
    if (!notificationId) {
      socket.emit('error', { code: 'INVALID_NOTIFICATION_ID', message: 'Notification ID is required' });
      return;
    }

    // In production, this would update the notification status in the database
    console.log(`[Notifications] Notification ${notificationId} dismissed by ${user.userId}`);

    // Could emit confirmation back to client if needed
  });

  // ===========================================
  // CLEANUP ON DISCONNECT
  // ===========================================

  socket.on('disconnect', () => {
    // Clean up subscriptions tracked in socket data
    // Rooms are automatically left on disconnect by Socket.io
    console.log(`[Notifications] User ${user.userId} disconnected, cleaned up subscriptions`);
  });
}

// ===========================================
// EXTERNAL EMISSION HELPERS
// ===========================================

/**
 * Emit clinical alert
 * Can target specific users, patients, or broadcast by role
 */
export function emitClinicalAlert(
  namespace: NotificationNamespace,
  alert: ClinicalAlertEvent,
  options: {
    userIds?: string[];
    patientId?: string;
    roles?: string[];
    broadcast?: boolean;
  } = {}
): void {
  const { userIds, patientId, roles, broadcast } = options;

  // Track the alert for acknowledgment
  const pendingAlert: PendingAlert = {
    alertId: alert.alertId,
    type: 'clinical',
    createdAt: new Date(),
    acknowledgedBy: new Set(),
    targetUsers: new Set(userIds || []),
  };
  pendingAlerts.set(alert.alertId, pendingAlert);

  // Emit to specific users
  if (userIds && userIds.length > 0) {
    for (const userId of userIds) {
      namespace.to(`user:${userId}`).emit('clinical:alert', alert);
    }
  }

  // Emit to patient subscribers
  if (patientId) {
    namespace.to(`patient:${patientId}`).emit('clinical:alert', alert);
  }

  // Emit to specific roles
  if (roles && roles.length > 0) {
    for (const role of roles) {
      namespace.to(`role:${role}`).emit('clinical:alert', alert);
    }
  }

  // Broadcast to all
  if (broadcast) {
    namespace.emit('clinical:alert', alert);
  }

  console.log(`[Notifications] Clinical alert emitted: ${alert.alertId} (${alert.alertType})`);
}

/**
 * Emit supervisor alert
 * Typically targets supervisors and admins
 */
export function emitSupervisorAlert(
  namespace: NotificationNamespace,
  alert: SupervisorAlertEvent,
  options: {
    userIds?: string[];
    toAllSupervisors?: boolean;
  } = {}
): void {
  const { userIds, toAllSupervisors } = options;

  // Track the alert for acknowledgment
  const pendingAlert: PendingAlert = {
    alertId: alert.alertId,
    type: 'supervisor',
    createdAt: new Date(),
    acknowledgedBy: new Set(),
    targetUsers: new Set(userIds || []),
  };
  pendingAlerts.set(alert.alertId, pendingAlert);

  // Emit to specific users
  if (userIds && userIds.length > 0) {
    for (const userId of userIds) {
      namespace.to(`user:${userId}`).emit('supervisor:alert', alert);
    }
  }

  // Emit to all supervisors and admins
  if (toAllSupervisors) {
    namespace.to('role:SUPERVISOR').emit('supervisor:alert', alert);
    namespace.to('role:ADMIN').emit('supervisor:alert', alert);
  }

  console.log(`[Notifications] Supervisor alert emitted: ${alert.alertId} (${alert.alertType})`);
}

/**
 * Emit system notification
 * Can target specific users or broadcast
 */
export function emitSystemNotification(
  namespace: NotificationNamespace,
  notification: SystemNotificationEvent,
  options: {
    userIds?: string[];
    roles?: string[];
    broadcast?: boolean;
  } = {}
): void {
  const { userIds, roles, broadcast } = options;

  // Emit to specific users
  if (userIds && userIds.length > 0) {
    for (const userId of userIds) {
      namespace.to(`user:${userId}`).emit('system:notification', notification);
    }
  }

  // Emit to specific roles
  if (roles && roles.length > 0) {
    for (const role of roles) {
      namespace.to(`role:${role}`).emit('system:notification', notification);
    }
  }

  // Broadcast to all
  if (broadcast) {
    namespace.emit('system:notification', notification);
  }

  console.log(`[Notifications] System notification emitted: ${notification.notificationId} (${notification.type})`);
}

/**
 * Emit notification to a specific visit room
 */
export function emitToVisit(
  namespace: NotificationNamespace,
  visitId: string,
  event: 'clinical:alert' | 'supervisor:alert' | 'system:notification',
  data: ClinicalAlertEvent | SupervisorAlertEvent | SystemNotificationEvent
): void {
  namespace.to(`visit:${visitId}`).emit(event, data as never);
  console.log(`[Notifications] Emitted ${event} to visit ${visitId}`);
}

/**
 * Emit notification to a specific patient's subscribers
 */
export function emitToPatient(
  namespace: NotificationNamespace,
  patientId: string,
  event: 'clinical:alert' | 'supervisor:alert' | 'system:notification',
  data: ClinicalAlertEvent | SupervisorAlertEvent | SystemNotificationEvent
): void {
  namespace.to(`patient:${patientId}`).emit(event, data as never);
  console.log(`[Notifications] Emitted ${event} to patient ${patientId} subscribers`);
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Clean up old pending alerts (run periodically)
 */
export function cleanupOldAlerts(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [alertId, alert] of pendingAlerts.entries()) {
    if (now - alert.createdAt.getTime() > maxAgeMs) {
      pendingAlerts.delete(alertId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[Notifications] Cleaned up ${cleaned} old pending alerts`);
  }

  return cleaned;
}

/**
 * Get count of pending alerts
 */
export function getPendingAlertCount(): number {
  return pendingAlerts.size;
}

// ===========================================
// EXPORTS
// ===========================================

export default {
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
};
