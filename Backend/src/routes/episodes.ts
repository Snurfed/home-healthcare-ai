import { Router } from 'express';
import * as episodeController from '../controllers/episode.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../generated/prisma';

const router = Router();

/**
 * @route   GET /api/patients/:patientId/episodes
 * @desc    List episodes for a patient
 * @access  Private - Clinical staff
 */
router.get(
  '/patients/:patientId/episodes',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.MEDICAL_SOCIAL_WORKER,
    UserRole.BILLING,
    UserRole.READONLY,
  ]),
  episodeController.listPatientEpisodes
);

/**
 * @route   POST /api/patients/:patientId/episodes
 * @desc    Create a new episode for a patient
 * @access  Private - Admin, Supervisor, Nurse
 */
router.post(
  '/patients/:patientId/episodes',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
  ]),
  episodeController.createEpisode
);

/**
 * @route   GET /api/episodes/:id
 * @desc    Get a single episode
 * @access  Private - Clinical staff
 */
router.get(
  '/episodes/:id',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.MEDICAL_SOCIAL_WORKER,
    UserRole.BILLING,
    UserRole.READONLY,
  ]),
  episodeController.getEpisode
);

export default router;
