/**
 * Physician Communication Controller
 *
 * HTTP handlers for communication detection, generation, and management.
 */

import { Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import {
  detectTriggersForQuestion,
  getTriggersWithDismissalStatus,
  dismissTrigger,
  getTriggerSummary,
} from '../services/communicationDetection.service';
import {
  generateCommunication,
  regenerateCommunication,
  generatePostVisitSummary,
} from '../services/communicationGeneration.service';
import type { CommunicationType, CommunicationUrgency } from '../constants/communication-rules.constants';

// =============================================================================
// TRIGGER ENDPOINTS
// =============================================================================

/**
 * GET /api/assessments/:id/communication-triggers
 * Get all communication triggers for an assessment
 */
export async function getCommunicationTriggers(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const assessmentId = req.params['id'];

    if (!assessmentId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'assessmentId is required',
      });
      return;
    }

    // Verify assessment exists
    const assessment = await prisma.oasisAssessment.findUnique({
      where: { id: assessmentId },
      select: { id: true, patientId: true, episodeId: true },
    });

    if (!assessment) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Assessment not found',
      });
      return;
    }

    const triggersWithStatus = await getTriggersWithDismissalStatus(assessmentId);
    const summary = await getTriggerSummary(assessmentId);

    res.json({
      assessmentId,
      triggers: triggersWithStatus,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/assessments/:id/communication-triggers/detect
 * Detect triggers for a specific question change
 */
export async function detectTriggers(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const assessmentId = req.params['id'];
    const { questionCode, allResponses } = req.body;

    if (!assessmentId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'assessmentId is required',
      });
      return;
    }

    // Convert responses object to Map
    const responsesMap = new Map<string, string | null>(
      Object.entries(allResponses || {})
    );

    const result = await detectTriggersForQuestion({
      assessmentId,
      questionCode,
      allResponses: responsesMap,
    });

    res.json({
      assessmentId,
      questionCode,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/communication-triggers/:id/dismiss
 * Dismiss a communication trigger
 */
export async function dismissCommunicationTrigger(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // triggerId from params is not needed - we use assessmentId + ruleId from body
    const { assessmentId, ruleId, reason } = req.body;

    if (!assessmentId || !ruleId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'assessmentId and ruleId are required',
      });
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
      return;
    }

    await dismissTrigger(assessmentId, ruleId, userId, reason || 'dismissed');

    res.json({
      success: true,
      assessmentId,
      ruleId,
      dismissedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

// =============================================================================
// COMMUNICATION GENERATION ENDPOINTS
// =============================================================================

/**
 * POST /api/assessments/:id/communications/generate
 * Generate a communication draft from a trigger
 */
export async function generateCommunicationDraft(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const assessmentId = req.params['id'];
    const { trigger, physicianName, physicianNpi, additionalContext } = req.body;

    if (!assessmentId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'assessmentId is required',
      });
      return;
    }

    if (!trigger || !physicianName) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'trigger and physicianName are required',
      });
      return;
    }

    // Get assessment for patient/episode info
    const assessment = await prisma.oasisAssessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        patientId: true,
        episodeId: true,
        patient: {
          select: {
            primaryPhysicianFax: true,
          },
        },
      },
    });

    if (!assessment) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Assessment not found',
      });
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
      return;
    }

    // Generate communication
    const result = await generateCommunication({
      assessmentId,
      patientId: assessment.patientId,
      episodeId: assessment.episodeId,
      trigger,
      physicianName,
      physicianNpi,
      additionalContext,
    });

    if (!result.success || !result.communication) {
      res.status(500).json({
        error: 'Generation Failed',
        message: result.error || 'Failed to generate communication',
      });
      return;
    }

    // Save draft to database
    const communication = await prisma.physicianCommunication.create({
      data: {
        patientId: assessment.patientId,
        episodeId: assessment.episodeId,
        assessmentId,
        communicationType: trigger.type as CommunicationType,
        urgency: trigger.urgency as CommunicationUrgency,
        status: 'DRAFT',
        physicianName,
        physicianNpi,
        physicianFax: assessment.patient.primaryPhysicianFax,
        subject: result.communication.subject,
        summaryContent: result.communication.summaryContent,
        detailedContent: result.communication.detailedContent,
        triggeredBy: trigger.ruleId,
        triggerData: trigger.triggerData,
        aiModelUsed: result.aiModelUsed,
        generationTimeMs: result.generationTimeMs,
        createdById: userId,
      },
    });

    // Link trigger to communication
    await prisma.communicationTrigger.upsert({
      where: {
        assessmentId_ruleId: {
          assessmentId,
          ruleId: trigger.ruleId,
        },
      },
      create: {
        assessmentId,
        ruleId: trigger.ruleId,
        triggerType: trigger.type,
        urgency: trigger.urgency,
        triggerData: trigger.triggerData,
        communicationId: communication.id,
      },
      update: {
        communicationId: communication.id,
      },
    });

    res.status(201).json({
      success: true,
      communication,
      generationTimeMs: result.generationTimeMs,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/assessments/:id/communications/post-visit-summary
 * Generate a comprehensive post-visit summary
 */
export async function generatePostVisit(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const assessmentId = req.params['id'];
    const { physicianName, physicianNpi } = req.body;

    if (!assessmentId || !physicianName) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'assessmentId and physicianName are required',
      });
      return;
    }

    // Get assessment for patient/episode info
    const assessment = await prisma.oasisAssessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        patientId: true,
        episodeId: true,
        patient: {
          select: {
            primaryPhysicianFax: true,
          },
        },
      },
    });

    if (!assessment) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Assessment not found',
      });
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
      return;
    }

    // Generate summary
    const result = await generatePostVisitSummary(assessmentId, physicianName);

    if (!result.success || !result.communication) {
      res.status(500).json({
        error: 'Generation Failed',
        message: result.error || 'Failed to generate post-visit summary',
      });
      return;
    }

    // Save to database
    const communication = await prisma.physicianCommunication.create({
      data: {
        patientId: assessment.patientId,
        episodeId: assessment.episodeId,
        assessmentId,
        communicationType: 'POC_UPDATE_REQUEST',
        urgency: 'ROUTINE',
        status: 'DRAFT',
        physicianName,
        physicianNpi,
        physicianFax: assessment.patient.primaryPhysicianFax,
        subject: result.communication.subject,
        summaryContent: result.communication.summaryContent,
        detailedContent: result.communication.detailedContent,
        aiModelUsed: result.aiModelUsed,
        generationTimeMs: result.generationTimeMs,
        createdById: userId,
      },
    });

    res.status(201).json({
      success: true,
      communication,
      generationTimeMs: result.generationTimeMs,
    });
  } catch (error) {
    next(error);
  }
}

// =============================================================================
// COMMUNICATION CRUD ENDPOINTS
// =============================================================================

/**
 * GET /api/communications/:id
 * Get a specific communication
 */
export async function getCommunication(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const communicationId = req.params['id'];

    if (!communicationId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'communicationId is required',
      });
      return;
    }

    const communication = await prisma.physicianCommunication.findUnique({
      where: { id: communicationId },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            mrn: true,
          },
        },
        auditTrail: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!communication) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Communication not found',
      });
      return;
    }

    res.json(communication);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/communications/:id
 * Update a communication draft
 */
export async function updateCommunication(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const communicationId = req.params['id'];
    const {
      subject,
      summaryContent,
      detailedContent,
      status,
      physicianName,
      physicianNpi,
      physicianFax,
    } = req.body;

    if (!communicationId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'communicationId is required',
      });
      return;
    }

    // Verify communication exists
    const existing = await prisma.physicianCommunication.findUnique({
      where: { id: communicationId },
    });

    if (!existing) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Communication not found',
      });
      return;
    }

    // Prevent editing sent communications
    if (['SENT', 'DELIVERED', 'ACKNOWLEDGED'].includes(existing.status)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot edit a sent communication',
      });
      return;
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (subject !== undefined) updateData['subject'] = subject;
    if (summaryContent !== undefined) updateData['summaryContent'] = summaryContent;
    if (detailedContent !== undefined) updateData['detailedContent'] = detailedContent;
    if (status !== undefined) updateData['status'] = status;
    if (physicianName !== undefined) updateData['physicianName'] = physicianName;
    if (physicianNpi !== undefined) updateData['physicianNpi'] = physicianNpi;
    if (physicianFax !== undefined) updateData['physicianFax'] = physicianFax;

    const updated = await prisma.physicianCommunication.update({
      where: { id: communicationId },
      data: updateData,
    });

    // Add audit log
    await prisma.communicationAuditLog.create({
      data: {
        communicationId,
        action: 'UPDATED',
        performedById: req.user?.id || 'system',
        details: JSON.stringify({ fieldsUpdated: Object.keys(updateData) }),
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/communications/:id/regenerate
 * Regenerate communication with instructions
 */
export async function regenerateCommunicationDraft(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const communicationId = req.params['id'];
    const { instructions } = req.body;

    if (!communicationId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'communicationId is required',
      });
      return;
    }

    if (!instructions) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'instructions are required for regeneration',
      });
      return;
    }

    const result = await regenerateCommunication(communicationId, instructions);

    if (!result.success || !result.communication) {
      res.status(500).json({
        error: 'Regeneration Failed',
        message: result.error || 'Failed to regenerate communication',
      });
      return;
    }

    // Update the communication
    const updated = await prisma.physicianCommunication.update({
      where: { id: communicationId },
      data: {
        subject: result.communication.subject,
        summaryContent: result.communication.summaryContent,
        detailedContent: result.communication.detailedContent,
        aiModelUsed: result.aiModelUsed,
        generationTimeMs: result.generationTimeMs,
      },
    });

    // Add audit log
    await prisma.communicationAuditLog.create({
      data: {
        communicationId,
        action: 'REGENERATED',
        performedById: req.user?.id || 'system',
        details: JSON.stringify({ instructions }),
      },
    });

    res.json({
      success: true,
      communication: updated,
      generationTimeMs: result.generationTimeMs,
    });
  } catch (error) {
    next(error);
  }
}

// =============================================================================
// LIST ENDPOINTS
// =============================================================================

/**
 * GET /api/patients/:patientId/communications
 * Get all communications for a patient
 */
export async function getPatientCommunications(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const patientId = req.params['patientId'];
    const { status, type, limit = '20', offset = '0' } = req.query;

    if (!patientId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'patientId is required',
      });
      return;
    }

    const where: Record<string, unknown> = { patientId };
    if (status) where['status'] = status;
    if (type) where['communicationType'] = type;

    const [communications, total] = await Promise.all([
      prisma.physicianCommunication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string, 10),
        skip: parseInt(offset as string, 10),
        include: {
          episode: {
            select: {
              episodeNumber: true,
              startDate: true,
            },
          },
        },
      }),
      prisma.physicianCommunication.count({ where }),
    ]);

    res.json({
      communications,
      pagination: {
        total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/episodes/:episodeId/communications
 * Get all communications for an episode
 */
export async function getEpisodeCommunications(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const episodeId = req.params['episodeId'];
    const { status, type } = req.query;

    if (!episodeId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'episodeId is required',
      });
      return;
    }

    const where: Record<string, unknown> = { episodeId };
    if (status) where['status'] = status;
    if (type) where['communicationType'] = type;

    const communications = await prisma.physicianCommunication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            mrn: true,
          },
        },
      },
    });

    res.json({ communications });
  } catch (error) {
    next(error);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  getCommunicationTriggers,
  detectTriggers,
  dismissCommunicationTrigger,
  generateCommunicationDraft,
  generatePostVisit,
  getCommunication,
  updateCommunication,
  regenerateCommunicationDraft,
  getPatientCommunications,
  getEpisodeCommunications,
};
