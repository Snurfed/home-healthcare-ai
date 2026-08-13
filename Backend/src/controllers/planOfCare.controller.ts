/**
 * Plan of Care Controller
 *
 * HTTP handlers for CMS-485 Plan of Care operations.
 */

import { Response } from 'express';

import prisma from '../config/prisma';
import { withTenant } from '../config/tenancy';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import planOfCareService from '../services/planOfCare.service';

// ===========================================
// TYPE DEFINITIONS
// ===========================================

interface CreatePlanOfCareBody {
  patientId: string;
  certificationPeriod: {
    startDate: string;
    endDate: string;
  };
  physicianName: string;
  physicianNpi?: string;
}

interface UpdatePlanOfCareBody {
  diagnoses?: Array<{
    code: string;
    description: string;
    isPrimary: boolean;
    sequence?: number;
  }>;
  functionalLimitations?: string[];
  safetyMeasures?: string[];
  dmeNeeds?: string[];
  serviceFrequencies?: Array<{
    discipline: string;
    frequency: string;
  }>;
  goals?: Array<{
    id: string;
    discipline: string;
    goalType: 'short_term' | 'long_term';
    description: string;
    targetDate: string;
    status: string;
    measurableOutcome?: string;
  }>;
  allowedActivities?: string;
  nutritionalRequirements?: string;
  mentalStatus?: string;
  prognosis?: 'excellent' | 'good' | 'fair' | 'guarded' | 'poor';
  dischargeGoals?: string;
}

interface AutoPopulateBody {
  oasisAssessmentId: string;
  fieldsToPopulate?: string[];
}

interface SignPlanOfCareBody {
  signatureType: 'physician' | 'nurse';
  signatureData: string;
  signedAt: string;
}

// ===========================================
// CONTROLLER FUNCTIONS
// ===========================================

/**
 * Get Plan of Care by episode ID
 * GET /api/episodes/:episodeId/plan-of-care
 */
/**
 * The agency this request runs under. An episode id alone must not be enough
 * to read or sign another agency's plan of care.
 */
function tenantOf(req: AuthenticatedRequest, res: Response): string | null {
  const agencyId = req.user?.agencyId;
  if (!agencyId) {
    res.status(403).json({
      error: 'Your account is not assigned to an agency, so patient data is unavailable.',
      code: 'NO_AGENCY',
    });
    return null;
  }
  return agencyId;
}

export async function getPlanOfCare(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const agencyId = tenantOf(req, res);
    if (!agencyId) return;

    const episodeId = req.params['episodeId'];

    if (!episodeId) {
      res.status(400).json({ error: 'Episode ID is required' });
      return;
    }

    const poc = await withTenant(prisma, agencyId, (tx) => planOfCareService.getPlanOfCare(tx, episodeId));

    if (!poc) {
      res.status(404).json({ error: 'Plan of Care not found' });
      return;
    }

    res.json(poc);
  } catch (error) {
    console.error('Error getting Plan of Care:', error);
    res.status(500).json({
      error: 'Failed to get Plan of Care',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Create a new Plan of Care
 * POST /api/episodes/:episodeId/plan-of-care
 */
export async function createPlanOfCare(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const agencyId = tenantOf(req, res);
    if (!agencyId) return;

    const episodeId = req.params['episodeId'];
    const body = req.body as CreatePlanOfCareBody;

    if (!episodeId) {
      res.status(400).json({ error: 'Episode ID is required' });
      return;
    }

    if (!body.patientId) {
      res.status(400).json({ error: 'Patient ID is required' });
      return;
    }

    if (!body.certificationPeriod?.startDate || !body.certificationPeriod?.endDate) {
      res.status(400).json({ error: 'Certification period dates are required' });
      return;
    }

    if (!body.physicianName) {
      res.status(400).json({ error: 'Physician name is required' });
      return;
    }

    const poc = await withTenant(prisma, agencyId, (tx) => planOfCareService.createPlanOfCare(tx, {
      episodeId,
      patientId: body.patientId,
      certificationPeriod: body.certificationPeriod,
      physicianName: body.physicianName,
      physicianNpi: body.physicianNpi,
    }));

    res.status(201).json(poc);
  } catch (error) {
    console.error('Error creating Plan of Care:', error);
    res.status(500).json({
      error: 'Failed to create Plan of Care',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update an existing Plan of Care
 * PUT /api/episodes/:episodeId/plan-of-care/:pocId
 */
export async function updatePlanOfCare(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const agencyId = tenantOf(req, res);
    if (!agencyId) return;

    const pocId = req.params['pocId'];
    const body = req.body as UpdatePlanOfCareBody;

    if (!pocId) {
      res.status(400).json({ error: 'Plan of Care ID is required' });
      return;
    }

    const poc = await withTenant(prisma, agencyId, (tx) => planOfCareService.updatePlanOfCare(tx, pocId, {
      diagnoses: body.diagnoses,
      functionalLimitations: body.functionalLimitations,
      safetyMeasures: body.safetyMeasures,
      dmeNeeds: body.dmeNeeds,
      serviceFrequencies: body.serviceFrequencies,
      goals: body.goals,
      allowedActivities: body.allowedActivities,
      nutritionalRequirements: body.nutritionalRequirements,
      mentalStatus: body.mentalStatus,
      prognosis: body.prognosis,
      dischargeGoals: body.dischargeGoals,
    }));

    res.json(poc);
  } catch (error) {
    console.error('Error updating Plan of Care:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: 'Failed to update Plan of Care',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Auto-populate Plan of Care from OASIS
 * POST /api/episodes/:episodeId/plan-of-care/:pocId/auto-populate
 */
export async function autoPopulateFromOasis(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const agencyId = tenantOf(req, res);
    if (!agencyId) return;

    const pocId = req.params['pocId'];
    const body = req.body as AutoPopulateBody;

    if (!pocId) {
      res.status(400).json({ error: 'Plan of Care ID is required' });
      return;
    }

    if (!body.oasisAssessmentId) {
      res.status(400).json({ error: 'OASIS Assessment ID is required' });
      return;
    }

    const result = await withTenant(prisma, agencyId, (tx) => planOfCareService.autoPopulateFromOasis(tx, 
      pocId,
      body.oasisAssessmentId,
      body.fieldsToPopulate
    ));

    res.json(result);
  } catch (error) {
    console.error('Error auto-populating Plan of Care:', error);
    res.status(500).json({
      error: 'Failed to auto-populate Plan of Care',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Sign Plan of Care
 * POST /api/episodes/:episodeId/plan-of-care/:pocId/sign
 */
export async function signPlanOfCare(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const agencyId = tenantOf(req, res);
    if (!agencyId) return;

    const pocId = req.params['pocId'];
    const body = req.body as SignPlanOfCareBody;

    if (!pocId) {
      res.status(400).json({ error: 'Plan of Care ID is required' });
      return;
    }

    if (!body.signatureType) {
      res.status(400).json({ error: 'Signature type is required' });
      return;
    }

    if (!body.signatureData) {
      res.status(400).json({ error: 'Signature data is required' });
      return;
    }

    // The authenticated clinician signs, by name where available. This used to
    // fall back to 'system', leaving a CMS-485 signed by nobody.
    const signedBy = `${req.user!.firstName} ${req.user!.lastName}`.trim() || req.user!.id;

    const poc = await withTenant(prisma, agencyId, (tx) => planOfCareService.signPlanOfCare(tx, 
      pocId,
      body.signatureType,
      signedBy,
      body.signedAt || new Date().toISOString()
    ));

    res.json(poc);
  } catch (error) {
    console.error('Error signing Plan of Care:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: 'Failed to sign Plan of Care',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export default {
  getPlanOfCare,
  createPlanOfCare,
  updatePlanOfCare,
  autoPopulateFromOasis,
  signPlanOfCare,
};
