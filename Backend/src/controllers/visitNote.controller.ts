/**
 * Visit Note Controller
 *
 * HTTP handlers for visit note operations.
 */

import { Request, Response } from 'express';
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
export async function getVisitNote(req: Request, res: Response): Promise<void> {
  try {
    const visitId = req.params['visitId'];

    if (!visitId) {
      res.status(400).json({ error: 'Visit ID is required' });
      return;
    }

    const note = await visitNoteService.getVisitNote(visitId);

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
export async function createVisitNote(req: Request, res: Response): Promise<void> {
  try {
    const visitId = req.params['visitId'];
    const body = req.body as CreateVisitNoteBody;

    if (!visitId) {
      res.status(400).json({ error: 'Visit ID is required' });
      return;
    }

    // Get user ID from auth context (placeholder)
    const clinicianId = (req as Request & { user?: { id: string } }).user?.id || 'system';

    const note = await visitNoteService.createVisitNote({
      visitId,
      patientId: body.patientId,
      episodeId: body.episodeId,
      clinicianId,
      discipline: body.discipline,
      visitPurpose: body.visitPurpose,
      visitDate: body.visitDate,
    });

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
export async function updateVisitNote(req: Request, res: Response): Promise<void> {
  try {
    const visitId = req.params['visitId'];
    const body = req.body as UpdateVisitNoteBody;

    if (!visitId) {
      res.status(400).json({ error: 'Visit ID is required' });
      return;
    }

    // Get user ID from auth context (placeholder)
    const userId = (req as Request & { user?: { id: string } }).user?.id || 'system';

    const note = await visitNoteService.updateVisitNote(
      visitId,
      {
        responses: body.responses as Record<string, { value: unknown; source?: 'manual' | 'voice' | 'ai_draft' | 'oasis' | 'system'; aiConfidence?: number }>,
        vitalSigns: body.vitalSigns,
        wounds: body.wounds,
        timeIn: body.timeIn,
        timeOut: body.timeOut,
      },
      userId
    );

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
export async function generateAIDraft(req: Request, res: Response): Promise<void> {
  try {
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

    const result = await visitNoteService.generateAIDraft(visitId, {
      sectionId: body.sectionId,
      questionCodes: body.questionCodes,
      context: body.context,
    });

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
export async function finalizeVisitNote(req: Request, res: Response): Promise<void> {
  try {
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

    // Get user ID from auth context (placeholder)
    const clinicianId = (req as Request & { user?: { id: string } }).user?.id || 'system';

    const note = await visitNoteService.finalizeVisitNote(
      visitId,
      {
        signatureData: body.clinicianSignature.signatureData,
        signedAt: body.clinicianSignature.signedAt || new Date().toISOString(),
        signedBy: clinicianId,
      },
      body.patientSignature
    );

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
export async function getEpisodeDashboard(req: Request, res: Response): Promise<void> {
  try {
    const episodeId = req.params['episodeId'];

    if (!episodeId) {
      res.status(400).json({ error: 'Episode ID is required' });
      return;
    }

    const dashboard = await visitNoteService.getEpisodeDashboard(episodeId);
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
export async function getEpisodeVisitNotes(req: Request, res: Response): Promise<void> {
  try {
    const episodeId = req.params['episodeId'];

    if (!episodeId) {
      res.status(400).json({ error: 'Episode ID is required' });
      return;
    }

    // Get all visits for the episode with their notes
    const prismaModule = await import('../config/prisma');
    const prisma = prismaModule.prisma;
    const visits = await prisma.visit.findMany({
      where: { episodeId },
      orderBy: { scheduledDate: 'desc' },
      include: {
        patient: true,
        clinician: true,
      },
    });

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
