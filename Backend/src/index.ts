// Load environment variables FIRST (before any other imports)
import 'dotenv/config';

import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';

import path from 'path';

// Route imports
import authRoutes from './routes/auth';
import patientRoutes from './routes/patients';
import episodeRoutes from './routes/episodes';
import voiceRoutes from './routes/voice';
import documentRoutes from './routes/documents';
import oasisRoutes from './routes/oasis';
import supervisorRoutes from './routes/supervisor';
import referralDocumentsRoutes from './routes/referralDocuments';
import soapNotesRoutes from './routes/soapNotes';
import agencySettingsRoutes from './routes/agencySettings';
import communicationRoutes from './routes/communications';
import clinicalEventsRoutes from './routes/clinicalEvents';
import integrationsRoutes from './routes/integrations';
import emrRoutes from './routes/emr';

// Initialize Express app
const app: Application = express();

// ===========================================
// CONFIGURATION
// ===========================================
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGINS = process.env.CORS_ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'];

// ===========================================
// SECURITY MIDDLEWARE
// ===========================================

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS Configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (CORS_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate Limiting - General
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  message: {
    status: 429,
    error: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate Limiting - Strict for auth endpoints
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '5', 10),
  message: {
    status: 429,
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// ===========================================
// PARSING & LOGGING MIDDLEWARE
// ===========================================

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
const morganFormat = NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  skip: (req: Request) => req.path === '/health',
}));

// ===========================================
// STATIC FILE SERVING (for uploaded files)
// ===========================================

const UPLOAD_DIR = process.env.DOCUMENT_UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

// ===========================================
// HEALTH CHECK ENDPOINT
// ===========================================
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: process.env.API_VERSION || 'v1',
  });
});

// ===========================================
// API ROUTES
// ===========================================

// Auth routes - with stricter rate limiting
app.use('/api/auth', authLimiter, authRoutes);

// Patient management routes
app.use('/api/patients', patientRoutes);

// Episode routes (nested under /api)
app.use('/api', episodeRoutes);

// Voice-to-text routes
app.use('/api/voice', voiceRoutes);

// Document management routes
app.use('/api/documents', documentRoutes);

// OASIS assessment routes
app.use('/api/oasis', oasisRoutes);

// Supervisor dashboard routes
app.use('/api/supervisor', supervisorRoutes);

// Referral document routes (includes both /api/patients/:id/referrals and /api/referrals/:id)
app.use('/api', referralDocumentsRoutes);

// SOAP notes routes (includes /api/assessments/:id/soap-notes, /api/soap-notes/:id, /api/patients/:id/soap-notes)
app.use('/api', soapNotesRoutes);

// Agency settings routes
app.use('/api/settings/agency', agencySettingsRoutes);

// Physician communication routes
app.use('/api', communicationRoutes);

// Clinical event detection and notification routes
app.use('/api/clinical-events', clinicalEventsRoutes);

// Email/Fax integration management routes
app.use('/api/integrations', integrationsRoutes);

// EMR integration routes (FHIR R4)
app.use('/api/emr', emrRoutes);

// ===========================================
// 404 HANDLER
// ===========================================
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    status: 404,
    error: 'Not Found',
    message: 'The requested resource does not exist',
  });
});

// ===========================================
// ERROR HANDLING MIDDLEWARE
// ===========================================
interface ApiError extends Error {
  status?: number;
  code?: string;
}

app.use((err: ApiError, req: Request, res: Response, _next: NextFunction) => {
  // Log error details (but not in tests)
  if (NODE_ENV !== 'test') {
    console.error(`[ERROR] ${new Date().toISOString()} - ${req.method} ${req.path}`);
    console.error(`Message: ${err.message}`);
    if (NODE_ENV === 'development') {
      console.error(`Stack: ${err.stack}`);
    }
  }

  // CORS error handling
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      status: 403,
      error: 'Forbidden',
      message: 'Cross-origin request blocked',
    });
  }

  // Default error response
  const status = err.status || 500;
  const response: Record<string, unknown> = {
    status,
    error: status === 500 ? 'Internal Server Error' : err.message,
    message: status === 500 && NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  };

  // Include error code if present
  if (err.code) {
    response.code = err.code;
  }

  // Include stack trace in development
  if (NODE_ENV === 'development' && err.stack) {
    response.stack = err.stack;
  }

  return res.status(status).json(response);
});

// ===========================================
// SERVER STARTUP
// ===========================================
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Home Health Care AI Assistant - Backend API               ║
╠════════════════════════════════════════════════════════════╣
║  Status:      Running                                      ║
║  Environment: ${NODE_ENV.padEnd(43)}║
║  Port:        ${String(PORT).padEnd(43)}║
║  Health:      http://localhost:${PORT}/health${' '.repeat(24 - String(PORT).length)}║
╚════════════════════════════════════════════════════════════╝
  `);
});

// ===========================================
// GRACEFUL SHUTDOWN
// ===========================================
const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  server.close(() => {
    console.log('HTTP server closed.');
    // Close database connections here
    // Close other resources here
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
