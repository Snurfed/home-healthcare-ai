/**
 * Referral Documents Routes
 *
 * API routes for referral document upload and extraction.
 */

import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../generated/prisma';
import * as controller from '../controllers/referralDocuments.controller';

// ===========================================
// MULTER CONFIGURATION
// ===========================================

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env['MAX_REFERRAL_SIZE'] || '52428800', 10), // 50MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// ===========================================
// ROUTER INITIALIZATION
// ===========================================

const router = Router();

// Clinical roles that can access referral documents
const CLINICAL_ROLES = [
  UserRole.ADMIN,
  UserRole.SUPERVISOR,
  UserRole.NURSE,
  UserRole.THERAPIST_PT,
  UserRole.THERAPIST_OT,
  UserRole.THERAPIST_ST,
  UserRole.MEDICAL_SOCIAL_WORKER,
];

// ===========================================
// ROUTES - Patient-scoped
// ===========================================

/**
 * @route   POST /api/patients/:patientId/referrals/upload
 * @desc    Upload a referral document for a patient
 * @access  Private - Clinical staff
 */
router.post(
  '/patients/:patientId/referrals/upload',
  authenticate,
  authorize(CLINICAL_ROLES),
  upload.single('file'),
  controller.uploadReferral
);

/**
 * @route   GET /api/patients/:patientId/referrals
 * @desc    List all referral documents for a patient
 * @access  Private - Clinical staff
 */
router.get(
  '/patients/:patientId/referrals',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.listReferrals
);

// ===========================================
// ROUTES - Document-scoped
// ===========================================

/**
 * @route   GET /api/referrals/:id
 * @desc    Get a single referral document with extracted data
 * @access  Private - Clinical staff
 */
router.get(
  '/referrals/:id',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.getReferral
);

/**
 * @route   PATCH /api/referrals/:id
 * @desc    Update referral document (extraction status, extracted data, metadata)
 * @access  Private - Clinical staff
 */
router.patch(
  '/referrals/:id',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.updateReferral
);

/**
 * @route   DELETE /api/referrals/:id
 * @desc    Delete a referral document (soft delete)
 * @access  Private - Admin or Supervisor only
 */
router.delete(
  '/referrals/:id',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.SUPERVISOR]),
  controller.deleteReferral
);

/**
 * @route   POST /api/referrals/:id/extract
 * @desc    Trigger extraction processing for a document
 * @access  Private - Clinical staff
 */
router.post(
  '/referrals/:id/extract',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.triggerExtraction
);

/**
 * @route   GET /api/referrals/:id/status
 * @desc    Get extraction status for polling
 * @access  Private - Clinical staff
 */
router.get(
  '/referrals/:id/status',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.getExtractionStatus
);

/**
 * @route   POST /api/referrals/:id/apply
 * @desc    Apply extracted data to an assessment
 * @access  Private - Clinical staff
 */
router.post(
  '/referrals/:id/apply',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.applyToAssessment
);

/**
 * @route   GET /api/referrals/:id/download
 * @desc    Download the original referral document file
 * @access  Private - Clinical staff
 */
router.get(
  '/referrals/:id/download',
  authenticate,
  authorize(CLINICAL_ROLES),
  controller.downloadReferral
);

// ===========================================
// EXPORTS
// ===========================================

export default router;
