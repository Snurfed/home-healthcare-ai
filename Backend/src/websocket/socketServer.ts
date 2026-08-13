/**
 * Socket.io Server Configuration
 *
 * Initializes and configures the Socket.io server with:
 * - JWT authentication middleware
 * - Namespaces for /capture and /notifications
 * - Connection handling and user tracking
 * - Room management for per-visit collaboration
 */

import { Server as HttpServer } from 'http';
import { Server, Socket, RemoteSocket, DefaultEventsMap } from 'socket.io';
import jwt from 'jsonwebtoken';
import {
  SocketUserData,
  ConnectedUser,
  CaptureClientToServerEvents,
  CaptureServerToClientEvents,
  CaptureSocketData,
  NotificationClientToServerEvents,
  NotificationServerToClientEvents,
  NotificationSocketData,
} from '../types/websocket.types';
import { setupCaptureHandler } from './captureHandler';
import { setupNotificationHandler } from './notificationHandler';

// ===========================================
// CONFIGURATION
// ===========================================

const JWT_ACCESS_SECRET = process.env['JWT_ACCESS_SECRET'];
const CORS_ORIGINS = process.env['CORS_ALLOWED_ORIGINS']?.split(',') || [
  'http://localhost:3000',
  'http://localhost:5173',
];

if (!JWT_ACCESS_SECRET) {
  throw new Error('JWT_ACCESS_SECRET environment variable is required for WebSocket authentication');
}

// ===========================================
// USER TRACKING
// ===========================================

// Track all connected users across namespaces
const connectedUsers = new Map<string, ConnectedUser>();

export function getConnectedUsers(): Map<string, ConnectedUser> {
  return connectedUsers;
}

export function getConnectedUsersByUserId(userId: string): ConnectedUser[] {
  return Array.from(connectedUsers.values()).filter(
    (conn) => conn.user.userId === userId
  );
}

export function isUserOnline(userId: string): boolean {
  return Array.from(connectedUsers.values()).some(
    (conn) => conn.user.userId === userId
  );
}

// ===========================================
// JWT AUTHENTICATION MIDDLEWARE
// ===========================================

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

/**
 * Socket.io authentication middleware
 * Validates JWT token from handshake auth or query params
 */
function createAuthMiddleware() {
  return async (socket: Socket, next: (err?: Error) => void) => {
    try {
      // Get token from auth object or query params
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token;

      if (!token || typeof token !== 'string') {
        return next(new Error('Authentication token required'));
      }

      // Verify the JWT token
      let decoded: JWTPayload;
      try {
        decoded = jwt.verify(token, JWT_ACCESS_SECRET!, {
          issuer: 'home-health-care-ai-assistant',
          audience: 'home-health-care-api',
        }) as JWTPayload;
      } catch (jwtError) {
        if (jwtError instanceof jwt.TokenExpiredError) {
          return next(new Error('Token expired'));
        }
        if (jwtError instanceof jwt.JsonWebTokenError) {
          return next(new Error('Invalid token'));
        }
        throw jwtError;
      }

      // Verify token type
      if (decoded.type !== 'access') {
        return next(new Error('Invalid token type'));
      }

      // Attach user data to socket
      const userData: SocketUserData = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        firstName: '', // Will be populated from database if needed
        lastName: '',
      };

      // Store user data in socket.data
      socket.data.user = userData;

      next();
    } catch (error) {
      console.error('[WebSocket] Authentication error:', error);
      next(new Error('Authentication failed'));
    }
  };
}

// ===========================================
// SOCKET.IO SERVER INITIALIZATION
// ===========================================

let io: Server | null = null;

/**
 * Initialize Socket.io server and attach to HTTP server
 */
export function initializeSocketServer(httpServer: HttpServer): Server {
  if (io) {
    console.warn('[WebSocket] Socket.io server already initialized');
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: CORS_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Connection settings
    pingTimeout: 60000,
    pingInterval: 25000,
    // Limit payload size for security
    maxHttpBufferSize: 1e7, // 10MB for audio chunks
    // Transport options
    transports: ['websocket', 'polling'],
    // Path for socket.io
    path: '/socket.io',
  });

  // ===========================================
  // CAPTURE NAMESPACE (/capture)
  // ===========================================

  const captureNamespace = io.of('/capture') as Server<
    CaptureClientToServerEvents,
    CaptureServerToClientEvents,
    Record<string, never>,
    CaptureSocketData
  >;

  // Apply authentication middleware
  captureNamespace.use(createAuthMiddleware());

  // Connection handler
  captureNamespace.on('connection', (socket: Socket<CaptureClientToServerEvents, CaptureServerToClientEvents, DefaultEventsMap, CaptureSocketData>) => {
    const user = socket.data.user;
    console.log(`[Capture] User connected: ${user.userId} (${socket.id})`);

    // Initialize socket data
    socket.data.activeSessions = new Map();

    // Track connected user
    connectedUsers.set(socket.id, {
      socketId: socket.id,
      user,
      connectedAt: new Date(),
      rooms: new Set(),
    });

    // Setup capture event handlers
    setupCaptureHandler(socket, captureNamespace);

    // Handle disconnection
    socket.on('disconnect', (reason: string) => {
      console.log(`[Capture] User disconnected: ${user.userId} (${reason})`);
      connectedUsers.delete(socket.id);
    });

    // Handle errors
    socket.on('error', (error: Error) => {
      console.error(`[Capture] Socket error for ${user.userId}:`, error);
    });
  });

  // ===========================================
  // NOTIFICATIONS NAMESPACE (/notifications)
  // ===========================================

  const notificationsNamespace = io.of('/notifications') as Server<
    NotificationClientToServerEvents,
    NotificationServerToClientEvents,
    Record<string, never>,
    NotificationSocketData
  >;

  // Apply authentication middleware
  notificationsNamespace.use(createAuthMiddleware());

  // Connection handler
  notificationsNamespace.on('connection', (socket: Socket<NotificationClientToServerEvents, NotificationServerToClientEvents, DefaultEventsMap, NotificationSocketData>) => {
    const user = socket.data.user;
    console.log(`[Notifications] User connected: ${user.userId} (${socket.id})`);

    // Initialize socket data
    socket.data.subscribedPatients = new Set();
    socket.data.subscribedVisits = new Set();

    // Track connected user
    connectedUsers.set(socket.id, {
      socketId: socket.id,
      user,
      connectedAt: new Date(),
      rooms: new Set(),
    });

    // Join user-specific room for direct notifications
    socket.join(`user:${user.userId}`);

    // Join role-based room for role-specific notifications
    socket.join(`role:${user.role}`);

    // Setup notification event handlers
    setupNotificationHandler(socket, notificationsNamespace);

    // Handle disconnection
    socket.on('disconnect', (reason: string) => {
      console.log(`[Notifications] User disconnected: ${user.userId} (${reason})`);
      connectedUsers.delete(socket.id);
    });

    // Handle errors
    socket.on('error', (error: Error) => {
      console.error(`[Notifications] Socket error for ${user.userId}:`, error);
    });
  });

  console.log('[WebSocket] Socket.io server initialized');
  console.log('[WebSocket] Namespaces: /capture, /notifications');

  return io;
}

/**
 * Get the Socket.io server instance
 */
export function getSocketServer(): Server | null {
  return io;
}

/**
 * Get the capture namespace
 */
export function getCaptureNamespace() {
  if (!io) return null;
  return io.of('/capture');
}

/**
 * Get the notifications namespace
 */
export function getNotificationsNamespace() {
  if (!io) return null;
  return io.of('/notifications');
}

// ===========================================
// ROOM UTILITIES
// ===========================================

/**
 * Get all sockets in a specific room
 */
export async function getSocketsInRoom(
  namespace: '/capture' | '/notifications',
  room: string
): Promise<string[]> {
  if (!io) return [];
  const nsp = io.of(namespace);
  const sockets = await nsp.in(room).fetchSockets();
  return sockets.map((s: RemoteSocket<DefaultEventsMap, unknown>) => s.id);
}

/**
 * Emit event to a specific room
 */
export function emitToRoom<T>(
  namespace: '/capture' | '/notifications',
  room: string,
  event: string,
  data: T
): void {
  if (!io) return;
  io.of(namespace).to(room).emit(event, data);
}

/**
 * Emit event to a specific user (all their connections)
 */
export function emitToUser<T>(
  namespace: '/capture' | '/notifications',
  userId: string,
  event: string,
  data: T
): void {
  if (!io) return;
  io.of(namespace).to(`user:${userId}`).emit(event, data);
}

/**
 * Emit event to users with a specific role
 */
export function emitToRole<T>(
  namespace: '/capture' | '/notifications',
  role: string,
  event: string,
  data: T
): void {
  if (!io) return;
  io.of(namespace).to(`role:${role}`).emit(event, data);
}

// ===========================================
// EXPORTS
// ===========================================

export default {
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
};
