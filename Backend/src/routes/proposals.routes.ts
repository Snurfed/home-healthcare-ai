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

// Applied per route rather than with router.use(). This router is mounted at
// a bare /api, so a blanket middleware here would run for every /api request
// that reaches it — including ones belonging to routers mounted later. That is
// exactly what happened: it was silently supplying the only authentication that
// visitNotes, formEngine and emrExport had.

// Form instances
router.post('/forms', authenticate, authorize(CLINICIANS), controller.createFormInstance);
router.get('/forms/quality', authenticate, controller.fieldQuality);
router.get('/forms/:id', authenticate, controller.getFormInstance);

// Capture and review
router.post('/forms/:id/capture', authenticate, authorize(CLINICIANS), controller.runScribe);
router.get('/forms/:id/proposals', authenticate, controller.listProposals);
router.post('/proposals/:id/decide', authenticate, authorize(CLINICIANS), controller.decideProposal);

// Direct entry
router.put('/forms/:id/values/:questionCode', authenticate, authorize(CLINICIANS), controller.setValue);

export default router;
