/**
 * Capture Routes
 *
 * API endpoints for the voice capture workflow
 */

import { Router } from 'express';
import multer from 'multer';
import * as captureController from '../controllers/capture.controller';
import * as documentController from '../controllers/document.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../generated/prisma';

// ===========================================
// MULTER CONFIGURATION
// ===========================================

const storage = multer.memoryStorage();

const SUPPORTED_AUDIO_TYPES = [
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mp3',
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
];

const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
];

const uploadAudio = multer({
  storage,
  limits: {
    fileSize: 52428800, // 50MB max
  },
  fileFilter: (_req, file, cb) => {
    if (SUPPORTED_AUDIO_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}. Supported: WAV, MP3, M4A, OGG, WebM, FLAC`));
    }
  },
});

const uploadDocument = multer({
  storage,
  limits: {
    fileSize: 20971520, // 20MB max for documents
  },
  fileFilter: (_req, file, cb) => {
    if (SUPPORTED_DOCUMENT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported document format: ${file.mimetype}. Supported: PDF, DOCX, JPG, PNG`));
    }
  },
});

// ===========================================
// ROUTER
// ===========================================

const router = Router();

/**
 * @route   POST /api/capture/process
 * @desc    Process audio recording and generate SOAP note + EMR field mapping
 * @access  Private - Clinical staff only
 */
router.post(
  '/process',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.HOME_HEALTH_AIDE,
    UserRole.MEDICAL_SOCIAL_WORKER,
  ]),
  uploadAudio.single('audio'),
  captureController.processCaptureRequest
);

/**
 * @route   GET /api/capture/health
 * @desc    Check capture service health (API keys configured)
 * @access  Private
 */
router.get(
  '/health',
  authenticate,
  captureController.healthCheck
);

/**
 * @route   POST /api/capture/extract-document
 * @desc    Extract text from an uploaded document (PDF, DOCX, JPG, PNG)
 * @access  Private - Clinical staff only
 */
router.post(
  '/extract-document',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.HOME_HEALTH_AIDE,
    UserRole.MEDICAL_SOCIAL_WORKER,
  ]),
  uploadDocument.single('file'),
  documentController.extractDocument
);

export default router;
