/**
 * Clinical Events Controller
 *
 * Handles API endpoints for clinical event detection and management.
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as detectionService from '../services/clinicalEventDetection.service';
import prisma from '../config/prisma';
import { ClinicalEventType, TriggerPriority } from '../generated/prisma';

// ===========================================
// REAL-TIME DETECTION (KEYWORD ONLY)
// ===========================================

/**
 * Detect clinical events in text using fast keyword matching
 * POST /api/clinical-events/detect/keywords
 *
 * Use this for real-time detection during documentation
 */
export async function detectByKeywords(
  req: AuthenticatedRequest & {
    body: {
      text: string;
      patientId: string;
      episodeId: string;
      assessmentId?: string;
      visitId?: string;
    };
  },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { text, patientId, episodeId, assessmentId, visitId } = req.body;

    if (!text || !patientId || !episodeId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'text, patientId, and episodeId are required',
      });
    }

    const context = {
      patientId,
      episodeId,
      assessmentId,
      visitId,
      clinicianId: req.user.id,
    };

    const matches = await detectionService.detectByKeywords(text, context);

    return res.json({
      matches,
      count: matches.length,
      hasHighPriority: matches.some(
        (m) => m.priority === TriggerPriority.CRITICAL || m.priority === TriggerPriority.HIGH
      ),
    });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// FULL DETECTION (KEYWORD + AI)
// ===========================================

/**
 * Run full detection including AI analysis
 * POST /api/clinical-events/detect/full
 *
 * Use this after documentation is saved
 */
export async function detectFull(
  req: AuthenticatedRequest & {
    body: {
      text: string;
      patientId: string;
      episodeId: string;
      assessmentId?: string;
      visitId?: string;
      saveEvents?: boolean;
      patientHistory?: string;
    };
  },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      text,
      patientId,
      episodeId,
      assessmentId,
      visitId,
      saveEvents = true,
      patientHistory,
    } = req.body;

    if (!text || !patientId || !episodeId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'text, patientId, and episodeId are required',
      });
    }

    const context = {
      patientId,
      episodeId,
      assessmentId,
      visitId,
      clinicianId: req.user.id,
    };

    console.log(`[Clinical Events] Running full detection for patient ${patientId}`);
    const startTime = Date.now();

    const result = await detectionService.detectClinicalEvents(text, context, {
      runAI: true,
      patientHistory,
    });

    const detectionTime = Date.now() - startTime;
    console.log(`[Clinical Events] Detection complete in ${detectionTime}ms, found ${result.combinedEvents.length} events`);

    // Save events if requested
    let savedEvents: Awaited<ReturnType<typeof detectionService.saveDetectedEvents>> = [];
    if (saveEvents && result.combinedEvents.length > 0) {
      savedEvents = await detectionService.saveDetectedEvents(result.combinedEvents, context);
    }

    return res.json({
      keywordMatches: result.keywordMatches,
      aiDetections: result.aiDetections,
      combinedEvents: result.combinedEvents,
      savedEvents: savedEvents.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        priority: e.priority,
      })),
      stats: {
        keywordCount: result.keywordMatches.length,
        aiCount: result.aiDetections.length,
        combinedCount: result.combinedEvents.length,
        savedCount: savedEvents.length,
        detectionTimeMs: detectionTime,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// OASIS CHANGE DETECTION
// ===========================================

/**
 * Detect functional changes between assessments
 * POST /api/clinical-events/detect/oasis-changes
 */
export async function detectOasisChanges(
  req: AuthenticatedRequest & {
    body: {
      assessmentId: string;
      previousAssessmentId: string;
      patientId: string;
      episodeId: string;
      saveEvents?: boolean;
    };
  },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { assessmentId, previousAssessmentId, patientId, episodeId, saveEvents = true } = req.body;

    if (!assessmentId || !previousAssessmentId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'assessmentId and previousAssessmentId are required',
      });
    }

    const detections = await detectionService.detectOasisChanges(
      assessmentId,
      previousAssessmentId
    );

    let savedEvents: Awaited<ReturnType<typeof detectionService.saveDetectedEvents>> = [];
    if (saveEvents && detections.length > 0) {
      savedEvents = await detectionService.saveDetectedEvents(detections, {
        patientId,
        episodeId,
        assessmentId,
        clinicianId: req.user.id,
      });
    }

    return res.json({
      detections,
      savedEvents: savedEvents.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        priority: e.priority,
      })),
    });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// EVENT MANAGEMENT
// ===========================================

/**
 * Get pending (unacknowledged) events for a patient
 * GET /api/clinical-events/pending/:patientId
 */
export async function getPendingEvents(
  req: AuthenticatedRequest & { params: { patientId: string }; query: { episodeId?: string } },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { patientId } = req.params;
    const { episodeId } = req.query;

    const events = await detectionService.getPendingEvents(patientId, episodeId);

    return res.json({
      events,
      count: events.length,
      hasCritical: events.some((e) => e.priority === TriggerPriority.CRITICAL),
      hasHigh: events.some((e) => e.priority === TriggerPriority.HIGH),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single event by ID
 * GET /api/clinical-events/:id
 */
export async function getEvent(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const event = await prisma.detectedClinicalEvent.findUnique({
      where: { id: req.params['id'] },
    });

    if (!event) {
      return res.status(404).json({ error: 'Not Found', message: 'Event not found' });
    }

    return res.json(event);
  } catch (error) {
    next(error);
  }
}

/**
 * Acknowledge an event
 * POST /api/clinical-events/:id/acknowledge
 */
export async function acknowledgeEvent(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const event = await detectionService.acknowledgeEvent(req.params['id'], req.user.id);

    return res.json({
      message: 'Event acknowledged',
      event: {
        id: event.id,
        eventType: event.eventType,
        isAcknowledged: event.isAcknowledged,
        acknowledgedAt: event.acknowledgedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Dismiss an event
 * POST /api/clinical-events/:id/dismiss
 */
export async function dismissEvent(
  req: AuthenticatedRequest & {
    params: { id: string };
    body: { reason: string };
  },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Dismiss reason is required',
      });
    }

    const event = await detectionService.dismissEvent(req.params['id'], req.user.id, reason);

    return res.json({
      message: 'Event dismissed',
      event: {
        id: event.id,
        eventType: event.eventType,
        isDismissed: event.isDismissed,
        dismissedAt: event.dismissedAt,
        dismissReason: event.dismissReason,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// TRIGGER CONFIGURATION
// ===========================================

/**
 * Get all trigger configurations
 * GET /api/clinical-events/triggers
 */
export async function getTriggerConfigs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const triggers = await prisma.clinicalEventTriggerConfig.findMany({
      include: {
        templates: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            channel: true,
            isDefault: true,
          },
        },
      },
      orderBy: { eventType: 'asc' },
    });

    return res.json({ triggers });
  } catch (error) {
    next(error);
  }
}

/**
 * Update a trigger configuration
 * PATCH /api/clinical-events/triggers/:eventType
 */
export async function updateTriggerConfig(
  req: AuthenticatedRequest & {
    params: { eventType: string };
    body: {
      isEnabled?: boolean;
      priority?: TriggerPriority;
      keywords?: string[];
      excludeKeywords?: string[];
      aiDetectionEnabled?: boolean;
      aiConfidenceThreshold?: number;
      cooldownMinutes?: number;
    };
  },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const eventType = req.params['eventType'] as ClinicalEventType;
    const updates = req.body;

    const trigger = await prisma.clinicalEventTriggerConfig.update({
      where: { eventType },
      data: {
        ...updates,
        aiConfidenceThreshold: updates.aiConfidenceThreshold
          ? new (await import('../generated/prisma')).Prisma.Decimal(updates.aiConfidenceThreshold)
          : undefined,
      },
    });

    // Clear cache so changes take effect immediately
    detectionService.clearTriggerConfigCache();

    return res.json({
      message: 'Trigger configuration updated',
      trigger,
    });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  detectByKeywords,
  detectFull,
  detectOasisChanges,
  getPendingEvents,
  getEvent,
  acknowledgeEvent,
  dismissEvent,
  getTriggerConfigs,
  updateTriggerConfig,
};
