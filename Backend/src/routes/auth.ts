import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

// ===========================================
// ROUTER INITIALIZATION
// ===========================================

const router = Router();

// ===========================================
// PUBLIC ROUTES
// ===========================================

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user account
 * @access  Public
 */
router.post('/register', authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return tokens
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh-token', authController.refreshToken);

// ===========================================
// PROTECTED ROUTES
// ===========================================

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate refresh token
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user info
 * @access  Private
 */
router.get('/me', authenticate, authController.getCurrentUser);

/**
 * @route   POST /api/auth/revoke-all
 * @desc    Revoke all refresh tokens (logout from all devices)
 * @access  Private
 */
router.post('/revoke-all', authenticate, authController.revokeAllTokens);

export default router;
