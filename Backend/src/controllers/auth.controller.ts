import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient, UserRole, UserStatus, Prisma } from '../generated/prisma';

// ===========================================
// INITIALIZATION
// ===========================================

const prisma = new PrismaClient();

// ===========================================
// CONFIGURATION
// ===========================================

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'your-access-secret-min-32-chars';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-min-32-chars';
const JWT_ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || '15m';
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '7d';
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export interface RegisterRequestBody {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone?: string;
  role?: UserRole;
  licenseNumber?: string;
  licenseState?: string;
  licenseExpiration?: string;
  npiNumber?: string;
}

export interface LoginRequestBody {
  email: string;
  password: string;
}

export interface RefreshTokenRequestBody {
  refreshToken: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  licenseNumber: string | null;
  licenseState: string | null;
  licenseExpiration: Date | null;
  npiNumber: string | null;
  profileImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Generate JWT access token
 */
function generateAccessToken(user: { id: string; email: string; role: UserRole }): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    type: 'access',
  };

  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRATION,
    issuer: 'home-health-care-ai-assistant',
    audience: 'home-health-care-api',
  });
}

/**
 * Generate JWT refresh token
 */
function generateRefreshToken(user: { id: string; email: string; role: UserRole }): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    type: 'refresh',
  };

  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRATION,
    issuer: 'home-health-care-ai-assistant',
    audience: 'home-health-care-api',
  });
}

/**
 * Parse expiration string to seconds
 */
function parseExpirationToSeconds(expiration: string): number {
  const match = expiration.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // Default 15 minutes

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 60 * 60 * 24;
    default: return 900;
  }
}

/**
 * Calculate refresh token expiration date
 */
function calculateRefreshTokenExpiry(): Date {
  const seconds = parseExpirationToSeconds(JWT_REFRESH_EXPIRATION);
  return new Date(Date.now() + seconds * 1000);
}

/**
 * Format user for response (exclude sensitive fields)
 */
function formatUserResponse(user: Prisma.UserGetPayload<object>): UserResponse {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName,
    phone: user.phone,
    role: user.role,
    status: user.status,
    licenseNumber: user.licenseNumber,
    licenseState: user.licenseState,
    licenseExpiration: user.licenseExpiration,
    npiNumber: user.npiNumber,
    profileImageUrl: user.profileImageUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Create audit log entry
 */
async function createAuditLog(
  action: 'LOGIN' | 'LOGOUT' | 'CREATE',
  userId: string | null,
  userEmail: string | null,
  userRole: string | null,
  resourceType: string,
  resourceId: string | null,
  success: boolean,
  req: Request,
  errorMessage?: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        userEmail,
        userRole,
        action,
        resourceType,
        resourceId,
        success,
        errorMessage,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        phiAccessed: false,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('[Audit Log Error]', error);
  }
}

// ===========================================
// CONTROLLER FUNCTIONS
// ===========================================

/**
 * Register a new user
 * POST /api/auth/register
 */
export async function register(
  req: Request<object, object, RegisterRequestBody>,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      middleName,
      phone,
      role = UserRole.NURSE,
      licenseNumber,
      licenseState,
      licenseExpiration,
      npiNumber,
    } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email, password, first name, and last name are required',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid email format',
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password must be at least 8 characters long',
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A user with this email already exists',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        middleName,
        phone,
        role,
        status: UserStatus.PENDING_VERIFICATION,
        licenseNumber,
        licenseState,
        licenseExpiration: licenseExpiration ? new Date(licenseExpiration) : null,
        npiNumber,
        passwordChangedAt: new Date(),
      },
    });

    // Create audit log
    await createAuditLog(
      'CREATE',
      user.id,
      user.email,
      user.role,
      'user',
      user.id,
      true,
      req
    );

    return res.status(201).json({
      message: 'User registered successfully',
      user: formatUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Login user and return tokens
 * POST /api/auth/login
 */
export async function login(
  req: Request<object, object, LoginRequestBody>,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required',
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      await createAuditLog('LOGIN', null, email, null, 'user', null, false, req, 'User not found');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    // Check if user is deleted
    if (user.deletedAt) {
      await createAuditLog('LOGIN', user.id, user.email, user.role, 'user', user.id, false, req, 'Account deleted');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await createAuditLog('LOGIN', user.id, user.email, user.role, 'user', user.id, false, req, 'Account locked');
      return res.status(423).json({
        error: 'Locked',
        message: 'Account is temporarily locked. Please try again later.',
        lockedUntil: user.lockedUntil,
      });
    }

    // Check if account is suspended
    if (user.status === UserStatus.SUSPENDED) {
      await createAuditLog('LOGIN', user.id, user.email, user.role, 'user', user.id, false, req, 'Account suspended');
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Account has been suspended. Please contact support.',
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // Increment failed login attempts
      const failedAttempts = user.failedLoginAttempts + 1;
      const lockAccount = failedAttempts >= 5;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failedAttempts,
          lockedUntil: lockAccount ? new Date(Date.now() + 15 * 60 * 1000) : null, // Lock for 15 minutes
        },
      });

      await createAuditLog('LOGIN', user.id, user.email, user.role, 'user', user.id, false, req, 'Invalid password');

      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password',
        ...(lockAccount && { accountLocked: true }),
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: calculateRefreshTokenExpiry(),
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      },
    });

    // Update user login info and reset failed attempts
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: req.ip || req.socket.remoteAddress,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Create audit log
    await createAuditLog('LOGIN', user.id, user.email, user.role, 'user', user.id, true, req);

    const tokenResponse: TokenResponse = {
      accessToken,
      refreshToken,
      expiresIn: parseExpirationToSeconds(JWT_ACCESS_EXPIRATION),
      tokenType: 'Bearer',
    };

    return res.status(200).json({
      ...tokenResponse,
      user: formatUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Refresh access token
 * POST /api/auth/refresh-token
 */
export async function refreshToken(
  req: Request<object, object, RefreshTokenRequestBody>,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token is required',
      });
    }

    // Verify the refresh token
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
        issuer: 'home-health-care-ai-assistant',
        audience: 'home-health-care-api',
      }) as JWTPayload;
    } catch (jwtError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token',
      });
    }

    // Check token type
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token type',
      });
    }

    // Find the refresh token in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!storedToken) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token not found',
      });
    }

    // Check if token is revoked
    if (storedToken.isRevoked) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token has been revoked',
      });
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token has expired',
      });
    }

    // Check if user is still valid
    const user = storedToken.user;
    if (user.deletedAt || user.status === UserStatus.SUSPENDED) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User account is no longer active',
      });
    }

    // Revoke the old refresh token (token rotation)
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    // Generate new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Store new refresh token
    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: calculateRefreshTokenExpiry(),
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      },
    });

    const tokenResponse: TokenResponse = {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: parseExpirationToSeconds(JWT_ACCESS_EXPIRATION),
      tokenType: 'Bearer',
    };

    return res.status(200).json(tokenResponse);
  } catch (error) {
    next(error);
  }
}

/**
 * Logout user and invalidate refresh token
 * POST /api/auth/logout
 */
export async function logout(
  req: AuthenticatedRequest & { body: RefreshTokenRequestBody },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const { refreshToken: token } = req.body;

    if (token) {
      // Revoke the specific refresh token
      await prisma.refreshToken.updateMany({
        where: { token },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });
    }

    // If user is authenticated, optionally revoke all their tokens
    if (req.user?.id) {
      // Create audit log
      await createAuditLog(
        'LOGOUT',
        req.user.id,
        req.user.email,
        req.user.role,
        'user',
        req.user.id,
        true,
        req
      );
    }

    return res.status(200).json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current authenticated user
 * GET /api/auth/me
 */
export async function getCurrentUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    if (user.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    return res.status(200).json(formatUserResponse(user));
  } catch (error) {
    next(error);
  }
}

/**
 * Revoke all refresh tokens for a user (force logout from all devices)
 * POST /api/auth/revoke-all
 */
export async function revokeAllTokens(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    await prisma.refreshToken.updateMany({
      where: {
        userId: req.user.id,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    return res.status(200).json({
      message: 'All sessions have been terminated',
    });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  register,
  login,
  refreshToken,
  logout,
  getCurrentUser,
  revokeAllTokens,
};
