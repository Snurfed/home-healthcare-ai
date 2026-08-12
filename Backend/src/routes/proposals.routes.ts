/**
 * Routes for the AI proposal loop.
 *
 * Deciding a proposal is restricted to clinicians who can sign — accepting an
 * AI suggestion is a clinical act, and the accepting user is recorded on the
 * FieldValue as the person who put it in the record.
 */
import { Router } from 'express';

import * as controller from '../controllers/proposals.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../generated/prisma';

const router = Router();

const CLINICIANS = [
  UserRole.ADMIN,
  UserRole.SUPERVISOR,
  UserRole.NURSE,
  UserRole.THERAPIST_PT,
  UserRole.THERAPIST_OT,
  UserRole.THERAPIST_ST,
  UserRole.MEDICAL_SOCIAL_WORKER,
];

router.use(authenticate);

// Form instances
router.post('/forms', authorize(CLINICIANS), controller.createFormInstance);
router.get('/forms/quality', controller.fieldQuality);
router.get('/forms/:id', controller.getFormInstance);

// Capture and review
router.post('/forms/:id/capture', authorize(CLINICIANS), controller.runScribe);
router.get('/forms/:id/proposals', controller.listProposals);
router.post('/proposals/:id/decide', authorize(CLINICIANS), controller.decideProposal);

// Direct entry
router.put('/forms/:id/values/:questionCode', authorize(CLINICIANS), controller.setValue);

export default router;
