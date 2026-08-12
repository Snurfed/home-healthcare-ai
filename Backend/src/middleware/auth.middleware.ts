import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole, UserStatus } from '../generated/prisma';
import prisma from '../config/prisma';

// ===========================================
// CONFIGURATION
// ===========================================

// JWT secret must be set via environment variable
// This will be validated at startup by validateEnv.ts
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

if (!JWT_ACCESS_SECRET) {
  throw new Error(
    'CRITICAL: JWT_ACCESS_SECRET environment variable is not set. ' +
    'This is required for secure authentication. ' +
    'Set JWT_ACCESS_SECRET to a secure random string of at least 32 characters.'
  );
}

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  firstName: string;
  lastName: string;
  /**
   * The tenant every scoped query runs under. Comes from the user record, never
   * from the request — a client that could name its own agency could read any
   * agency. Null only for legacy accounts created before tenancy existed; those
   * cannot reach patient data.
   */
  agencyId: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  token?: string;
}

// ===========================================
// MIDDLEWARE FUNCTIONS
// ===========================================

/**
 * Authenticate middleware - validates JWT token and populates req.user
 * Use this middleware on routes that require authentication
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authorization header provided',
      });
    }

    // Check for Bearer token format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid authorization header format. Use: Bearer <token>',
      });
    }

    const token = parts[1];

    // Verify the token
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, JWT_ACCESS_SECRET, {
        issuer: 'home-health-care-ai-assistant',
        audience: 'home-health-care-api',
      }) as JWTPayload;
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Token has expired',
          code: 'TOKEN_EXPIRED',
        });
      }
      if (jwtError instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid token',
          code: 'INVALID_TOKEN',
        });
      }
      throw jwtError;
    }

    // Verify token type
    if (decoded.type !== 'access') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token type',
        code: 'INVALID_TOKEN_TYPE',
      });
    }

    // Fetch user from database to ensure they still exist and are active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        firstName: true,
        lastName: true,
        agencyId: true,
        deletedAt: true,
        passwordChangedAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    // Check if user is deleted
    if (user.deletedAt) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User account has been deleted',
        code: 'USER_DELETED',
      });
    }

    // Check if user is suspended or inactive
    if (user.status === UserStatus.SUSPENDED) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'User account has been suspended',
        code: 'USER_SUSPENDED',
      });
    }

    if (user.status === UserStatus.INACTIVE) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'User account is inactive',
        code: 'USER_INACTIVE',
      });
    }

    // Check if password was changed after token was issued
    // This invalidates all tokens when user changes password
    if (user.passwordChangedAt) {
      const passwordChangedTimestamp = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < passwordChangedTimestamp) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Password has been changed. Please log in again.',
          code: 'PASSWORD_CHANGED',
        });
      }
    }

    // Populate req.user
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      firstName: user.firstName,
      lastName: user.lastName,
      agencyId: user.agencyId,
    };

    req.token = token;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication middleware - validates token if present but doesn't require it
 * Use this for routes that work with or without authentication
 */
export async function optionalAuthenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return next();
    }

    const token = parts[1];

    try {
      const decoded = jwt.verify(token, JWT_ACCESS_SECRET, {
        issuer: 'home-health-care-ai-assistant',
        audience: 'home-health-care-api',
      }) as JWTPayload;

      if (decoded.type !== 'access') {
        return next();
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          firstName: true,
          lastName: true,
          agencyId: true,
          deletedAt: true,
        },
      });

      if (user && !user.deletedAt && user.status === UserStatus.ACTIVE) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
          firstName: user.firstName,
          lastName: user.lastName,
          agencyId: user.agencyId,
        };
        req.token = token;
      }
    } catch {
      // Token invalid, continue without user
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Authorization middleware factory - checks if user has required role(s)
 * Use after authenticate middleware
 *
 * @param allowedRoles - Array of roles that are allowed to access the route
 */
export function authorize(allowedRoles: UserRole[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Response | void => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
    }

    next();
  };
}

/**
 * Require specific roles middleware - shorthand for common role checks
 */
export const requireAdmin = authorize([UserRole.ADMIN]);

export const requireSupervisor = authorize([
  UserRole.ADMIN,
  UserRole.SUPERVISOR,
]);

export const requireClinician = authorize([
  UserRole.ADMIN,
  UserRole.SUPERVISOR,
  UserRole.NURSE,
  UserRole.THERAPIST_PT,
  UserRole.THERAPIST_OT,
  UserRole.THERAPIST_ST,
  UserRole.MEDICAL_SOCIAL_WORKER,
]);

export const requireClinicalStaff = authorize([
  UserRole.ADMIN,
  UserRole.SUPERVISOR,
  UserRole.NURSE,
  UserRole.THERAPIST_PT,
  UserRole.THERAPIST_OT,
  UserRole.THERAPIST_ST,
  UserRole.HOME_HEALTH_AIDE,
  UserRole.MEDICAL_SOCIAL_WORKER,
]);

/**
 * Check if user owns the resource or is admin/supervisor
 * Use for routes where users can only access their own resources
 *
 * @param getResourceOwnerId - Function to extract owner ID from request
 */
export function authorizeOwnerOrAdmin(
  getResourceOwnerId: (req: AuthenticatedRequest) => string | undefined
) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Response | void => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const resourceOwnerId = getResourceOwnerId(req);
    const isOwner = resourceOwnerId === req.user.id;
    const isAdminOrSupervisor = [UserRole.ADMIN, UserRole.SUPERVISOR].includes(req.user.role);

    if (!isOwner && !isAdminOrSupervisor) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource',
      });
    }

    next();
  };
}

/**
 * Rate limit check for sensitive operations
 * This is a simple in-memory implementation - use Redis in production
 */
const sensitiveOpCounts = new Map<string, { count: number; resetAt: number }>();

export function rateLimitSensitiveOps(maxAttempts: number, windowMs: number) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Response | void => {
    const identifier = req.user?.id || req.ip || 'unknown';
    const now = Date.now();

    const record = sensitiveOpCounts.get(identifier);

    if (!record || record.resetAt < now) {
      sensitiveOpCounts.set(identifier, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= maxAttempts) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Too many attempts. Please try again later.',
        retryAfter: Math.ceil((record.resetAt - now) / 1000),
      });
    }

    record.count++;
    next();
  };
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  authenticate,
  optionalAuthenticate,
  authorize,
  authorizeOwnerOrAdmin,
  requireAdmin,
  requireSupervisor,
  requireClinician,
  requireClinicalStaff,
  rateLimitSensitiveOps,
};
