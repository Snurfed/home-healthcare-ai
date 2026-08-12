/**
 * Visit Note Controller
 *
 * HTTP handlers for visit note operations.
 */

import { Response } from 'express';

import prisma from '../config/prisma';
import { withTenant } from '../config/tenancy';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import visitNoteService from '../services/visitNote.service';
import type { Discipline, VisitPurpose } from '../constants/visitForm.constants';

// ===========================================
// TYPE DEFINITIONS
// ===========================================

interface CreateVisitNoteBody {
  visitId: string;
  patientId: string;
  episodeId: string;
  discipline: Discipline;
  visitPurpose: VisitPurpose;
  visitDate: string;
}

interface UpdateVisitNoteBody {
  responses?: Record<string, { value: unknown; source?: string; aiConfidence?: number }>;
  vitalSigns?: Record<string, unknown>;
  wounds?: Array<Record<string, unknown>>;
  timeIn?: string;
  timeOut?: string;
}

interface GenerateAIDraftBody {
  sectionId: string;
  questionCodes?: string[];
  context?: {
    patientHistory?: string;
    recentVisits?: string;
    oasisResponses?: Record<string, string>;
  };
}

interface FinalizeVisitNoteBody {
  clinicianSignature: {
    signatureData: string;
    signedAt: string;
  };
  patientSignature?: {
    signatureData: string;
    signedAt: string;
    signedBy: string;
    relationship?: string;
  };
}

// ===========================================
// CONTROLLER FUNCTIONS
// ===========================================

/**
 * Get visit note by visit ID
 * GET /api/visits/:visitId/note
 */
/**
 * The agency this request runs under. Taken from the session; a visit id alone
 * must not be enough to read another agency's note.
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

export async function getVisitNote(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const agencyId = tenantOf(req, res);
    if (!agencyId) return;

    const visitId = req.params['visitId'];

    if (!visitId) {
      res.status(400).json({ error: 'Visit ID is required' });
      return;
    }

    const note = await withTenant(prisma, agencyId, (tx) => visitNoteService.getVisitNote(tx, visitId));

    if (!note) {
      res.status(404).json({ error: 'Visit note not found' });
      return;
    }

    res.json(note);
  } catch (error) {
    console.error('Error getting visit note:', error);
    res.status(500).json({
      error: 'Failed to get visit note',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Create a new visit note
 * POST /api/visits/:visitId/note
 */
export async function createVisitNote(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const agencyId = tenantOf(req, res);
    if (!agencyId) return;

    const visitId = req.params['visitId'];
    const body = req.body as CreateVisitNoteBody;

    if (!visitId) {
      res.status(400).json({ error: 'Visit ID is required' });
      return;
    }

    // Authenticated: attribute the write to the actual clinician. This used to
    // fall back to 'system', which put unattributable entries in the record.
    const clinicianId = req.user!.id;

    const note = await withTenant(prisma, agencyId, (tx) => visitNoteService.createVisitNote(tx, {
      visitId,
      patientId: body.patientId,
      episodeId: body.episodeId,
      clinicianId,
      discipline: body.discipline,
      visitPurpose: body.visitPurpose,
      visitDate: body.visitDate,
    }));

    res.status(201).json(note);
  } catch (error) {
    console.error('Error creating visit note:', error);
    res.status(500).json({
      error: 'Failed to create visit note',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update an existing visit note
 * PUT /api/visits/:visitId/note
 */
export async function updateVisitNote(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const agencyId = tenantOf(req, res);
    if (!agencyId) return;

    const visitId = req.params['visitId'];
    const body = req.body as UpdateVisitNoteBody;

    if (!visitId) {
      res.status(400).json({ error: 'Visit ID is required' });
      return;
    }

    // See the note above: attribution is real now that the route authenticates.
    const userId = req.user!.id;

    const note = await withTenant(prisma, agencyId, (tx) => visitNoteService.updateVisitNote(tx, 
      visitId,
      {
        responses: body.responses as Record<string, { value: unknown; source?: 'manual' | 'voice' | 'ai_draft' | 'oasis' | 'system'; aiConfidence?: number }>,
        vitalSigns: body.vitalSigns,
        wounds: body.wounds,
        timeIn: body.timeIn,
        timeOut: body.timeOut,
      },
      userId
    ));

    res.json(note);
  } catch (error) {
    console.error('Error updating visit note:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error instanceof Error && error.message.includes('finalized')) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: 'Failed to update visit note',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Generate AI draft for a section
 * POST /api/visits/:visitId/note/draft
 */
export async function generateAIDraft(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const agencyId = tenantOf(req, res);
    if (!agencyId) return;

    const visitId = req.params['visitId'];
    const body = req.body as GenerateAIDraftBody;

    if (!visitId) {
      res.status(400).json({ error: 'Visit ID is required' });
      return;
    }

    if (!body.sectionId) {
      res.status(400).json({ error: 'Section ID is required' });
      return;
    }

    const result = await withTenant(prisma, agencyId, (tx) => visitNoteService.generateAIDraft(tx, visitId, {
      sectionId: body.sectionId,
      questionCodes: body.questionCodes,
      context: body.context,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error generating AI draft:', error);
    res.status(500).json({
      error: 'Failed to generate AI draft',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Finalize visit note with signatures
 * POST /api/visits/:visitId/note/finalize
 */
export async function finalizeVisitNote(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const agencyId = tenantOf(req, res);
    if (!agencyId) return;

    const visitId = req.params['visitId'];
    const body = req.body as FinalizeVisitNoteBody;

    if (!visitId) {
      res.status(400).json({ error: 'Visit ID is required' });
      return;
    }

    if (!body.clinicianSignature?.signatureData) {
      res.status(400).json({ error: 'Clinician signature is required' });
      return;
    }

    // Authenticated: attribute the write to the actual clinician. This used to
    // fall back to 'system', which put unattributable entries in the record.
    const clinicianId = req.user!.id;

    const note = await withTenant(prisma, agencyId, (tx) => visitNoteService.finalizeVisitNote(tx, 
      visitId,
      {
        signatureData: body.clinicianSignature.signatureData,
        signedAt: body.clinicianSignature.signedAt || new Date().toISOString(),
        signedBy: clinicianId,
      },
      body.patientSignature
    ));

    res.json(note);
  } catch (error) {
    console.error('Error finalizing visit note:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error instanceof Error && error.message.includes('already finalized')) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: 'Failed to finalize visit note',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get episode dashboard data
 * GET /api/episodes/:episodeId/dashboard
 */
export async function getEpisodeDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const agencyId = tenantOf(req, res);
    if (!agencyId) return;

    const episodeId = req.params['episodeId'];

    if (!episodeId) {
      res.status(400).json({ error: 'Episode ID is required' });
      return;
    }

    const dashboard = await withTenant(prisma, agencyId, (tx) => visitNoteService.getEpisodeDashboard(tx, episodeId));
    res.json(dashboard);
  } catch (error) {
    console.error('Error getting episode dashboard:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: 'Failed to get episode dashboard',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get visit notes for an episode
 * GET /api/episodes/:episodeId/visit-notes
 */
export async function getEpisodeVisitNotes(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const agencyId = tenantOf(req, res);
    if (!agencyId) return;

    const episodeId = req.params['episodeId'];

    if (!episodeId) {
      res.status(400).json({ error: 'Episode ID is required' });
      return;
    }

    // Get all visits for the episode with their notes
    const visits = await withTenant(prisma, agencyId, (tx) => tx.visit.findMany({
      where: { episodeId },
      orderBy: { scheduledDate: 'desc' },
      include: {
        patient: true,
        clinician: true,
      },
    }));

    const visitNotes = visits
      .filter((v: { visitNotes?: unknown }) => v.visitNotes)
      .map((v: { id: string; visitNotes: unknown; patient: { firstName: string; lastName: string }; clinician: { firstName: string; lastName: string } | null }) => {
        const notes = v.visitNotes as Record<string, unknown>;
        return {
          id: notes['id'] as string,
          visitId: v.id,
          patientName: `${v.patient.firstName} ${v.patient.lastName}`,
          discipline: notes['discipline'] as string,
          visitPurpose: notes['visitPurpose'] as string,
          visitDate: notes['visitDate'] as string,
          status: notes['status'] as string,
          clinicianName: v.clinician
            ? `${v.clinician.firstName} ${v.clinician.lastName}`
            : 'Unassigned',
          completionPercent: 0, // Would calculate from responses
          requiresOasis: false,
          oasisComplete: false,
        };
      });

    res.json(visitNotes);
  } catch (error) {
    console.error('Error getting episode visit notes:', error);
    res.status(500).json({
      error: 'Failed to get episode visit notes',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export default {
  getVisitNote,
  createVisitNote,
  updateVisitNote,
  generateAIDraft,
  finalizeVisitNote,
  getEpisodeDashboard,
  getEpisodeVisitNotes,
};
