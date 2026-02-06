import { Response, NextFunction } from 'express';
import { UserRole, CarePlanStatus, Prisma } from '../generated/prisma';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export interface CreateEpisodeRequestBody {
  startDate: string;
  referralDate?: string;
  referralSource?: string;
  referralDiagnosis?: string;
  certPeriodStart?: string;
  certPeriodEnd?: string;
}

export interface ListEpisodesQuery {
  status?: CarePlanStatus;
  includeEnded?: string;
}

// ===========================================
// CONTROLLER FUNCTIONS
// ===========================================

/**
 * List episodes for a patient
 * GET /api/patients/:patientId/episodes
 */
export async function listPatientEpisodes(
  req: AuthenticatedRequest & { params: { patientId: string }; query: ListEpisodesQuery },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { patientId } = req.params;
    const { status, includeEnded } = req.query;

    // Validate patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!patient) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Patient not found',
      });
    }

    // Build where clause
    const where: Prisma.EpisodeWhereInput = {
      patientId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (includeEnded !== 'true') {
      where.endDate = null;
    }

    const episodes = await prisma.episode.findMany({
      where,
      orderBy: { episodeNumber: 'desc' },
      include: {
        _count: {
          select: {
            assessments: true,
            visits: true,
          },
        },
      },
    });

    return res.status(200).json({
      data: episodes,
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new episode for a patient
 * POST /api/patients/:patientId/episodes
 */
export async function createEpisode(
  req: AuthenticatedRequest & { params: { patientId: string }; body: CreateEpisodeRequestBody },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { patientId } = req.params;
    const body = req.body;

    // Validate required fields
    if (!body.startDate) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Start date is required',
      });
    }

    // Validate patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!patient) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Patient not found',
      });
    }

    // Get next episode number for this patient
    const lastEpisode = await prisma.episode.findFirst({
      where: { patientId },
      orderBy: { episodeNumber: 'desc' },
      select: { episodeNumber: true },
    });

    const episodeNumber = (lastEpisode?.episodeNumber ?? 0) + 1;

    // Create the episode
    const episode = await prisma.episode.create({
      data: {
        patientId,
        episodeNumber,
        startDate: new Date(body.startDate),
        referralDate: body.referralDate ? new Date(body.referralDate) : null,
        referralSource: body.referralSource || null,
        referralDiagnosis: body.referralDiagnosis || null,
        certPeriodStart: body.certPeriodStart ? new Date(body.certPeriodStart) : null,
        certPeriodEnd: body.certPeriodEnd ? new Date(body.certPeriodEnd) : null,
        status: CarePlanStatus.ACTIVE,
      },
      include: {
        _count: {
          select: {
            assessments: true,
            visits: true,
          },
        },
      },
    });

    return res.status(201).json({
      message: 'Episode created successfully',
      episode,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single episode by ID
 * GET /api/episodes/:id
 */
export async function getEpisode(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { id } = req.params;

    const episode = await prisma.episode.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            mrn: true,
            firstName: true,
            lastName: true,
          },
        },
        assessments: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            assessmentType: true,
            status: true,
            completionPercentage: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            visits: true,
          },
        },
      },
    });

    if (!episode || episode.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Episode not found',
      });
    }

    return res.status(200).json(episode);
  } catch (error) {
    next(error);
  }
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  listPatientEpisodes,
  createEpisode,
  getEpisode,
};
