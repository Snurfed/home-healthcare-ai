/**
 * Clinical Event Detection Service
 *
 * Two-layer detection system:
 * 1. Fast keyword matching - runs in real-time during documentation
 * 2. AI contextual analysis - runs after save for nuanced detection
 */

import Anthropic from '@anthropic-ai/sdk';
import prisma from '../config/prisma';
import { MODELS } from '../config/models';
import {
  ClinicalEventType,
  TriggerPriority,
  ClinicalEventTriggerConfig,
  DetectedClinicalEvent,
  Prisma,
} from '../generated/prisma';

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export interface DetectionContext {
  patientId: string;
  episodeId: string;
  assessmentId?: string;
  visitId?: string;
  clinicianId: string;
}

export interface KeywordMatch {
  eventType: ClinicalEventType;
  triggerId: string;
  triggerName: string;
  priority: TriggerPriority;
  matchedKeywords: string[];
  matchCount: number;
  sourceText: string;
  confidence: number;
}

export interface AIDetectionResult {
  eventType: ClinicalEventType;
  detected: boolean;
  confidence: number;
  summary: string;
  details: string;
  clinicalSignificance: string;
  recommendedActions: string[];
  sourceExcerpt: string;
}

export interface DetectionResult {
  keywordMatches: KeywordMatch[];
  aiDetections: AIDetectionResult[];
  combinedEvents: CombinedDetection[];
}

export interface CombinedDetection {
  eventType: ClinicalEventType;
  priority: TriggerPriority;
  detectionMethod: 'keyword' | 'ai' | 'both';
  confidence: number;
  matchedKeywords: string[];
  summary: string;
  details: string;
  clinicalSignificance: string;
  recommendedActions: string[];
  sourceText: string;
}

// ===========================================
// CLAUDE CLIENT - LAZY LOADING
// ===========================================

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// ===========================================
// TRIGGER CONFIG CACHE
// ===========================================

let triggerConfigCache: ClinicalEventTriggerConfig[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getTriggerConfigs(): Promise<ClinicalEventTriggerConfig[]> {
  const now = Date.now();
  if (triggerConfigCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return triggerConfigCache;
  }

  triggerConfigCache = await prisma.clinicalEventTriggerConfig.findMany({
    where: { isEnabled: true },
  });
  cacheTimestamp = now;
  return triggerConfigCache;
}

// Clear cache (call when configs are updated)
export function clearTriggerConfigCache(): void {
  triggerConfigCache = null;
  cacheTimestamp = 0;
}

// ===========================================
// KEYWORD DETECTION (FAST, REAL-TIME)
// ===========================================

/**
 * Fast keyword-based detection that runs in real-time
 * Returns matches within milliseconds
 */
export async function detectByKeywords(
  text: string,
  context: DetectionContext
): Promise<KeywordMatch[]> {
  if (!text || text.trim().length < 10) {
    return [];
  }

  const triggers = await getTriggerConfigs();
  const matches: KeywordMatch[] = [];
  const normalizedText = text.toLowerCase();

  for (const trigger of triggers) {
    // Check exclude keywords first
    const hasExclude = trigger.excludeKeywords.some(
      (keyword) => normalizedText.includes(keyword.toLowerCase())
    );
    if (hasExclude) continue;

    // Find matching keywords
    const matchedKeywords: string[] = [];
    for (const keyword of trigger.keywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      }
    }

    // Check if we meet the threshold
    if (matchedKeywords.length >= trigger.keywordMatchThreshold) {
      // Extract the relevant source text (surrounding the first match)
      const sourceText = extractSourceContext(text, matchedKeywords[0]);

      // Calculate confidence based on match count
      const maxConfidence = 0.85;
      const confidence = Math.min(
        maxConfidence,
        0.5 + (matchedKeywords.length * 0.1)
      );

      matches.push({
        eventType: trigger.eventType,
        triggerId: trigger.id,
        triggerName: trigger.name,
        priority: trigger.priority,
        matchedKeywords,
        matchCount: matchedKeywords.length,
        sourceText,
        confidence,
      });
    }
  }

  // Sort by priority (CRITICAL first) then by match count
  const priorityOrder = {
    [TriggerPriority.CRITICAL]: 0,
    [TriggerPriority.HIGH]: 1,
    [TriggerPriority.MEDIUM]: 2,
    [TriggerPriority.LOW]: 3,
  };

  matches.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.matchCount - a.matchCount;
  });

  return matches;
}

/**
 * Extract context around a keyword match
 */
function extractSourceContext(text: string, keyword: string, contextChars: number = 150): string {
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(keyword.toLowerCase());
  if (index === -1) return text.substring(0, 300);

  const start = Math.max(0, index - contextChars);
  const end = Math.min(text.length, index + keyword.length + contextChars);

  let excerpt = text.substring(start, end);
  if (start > 0) excerpt = '...' + excerpt;
  if (end < text.length) excerpt = excerpt + '...';

  return excerpt;
}

// ===========================================
// AI DETECTION (CONTEXTUAL, POST-SAVE)
// ===========================================

const AI_DETECTION_SYSTEM_PROMPT = `You are a clinical event detection system for home health care. Analyze documentation text to identify clinically significant events that require physician notification.

For each event type, determine if the text provides evidence of that event occurring. Be conservative - only flag events where there is clear clinical evidence, not just mentions of risk factors or history.

Return a JSON array of detected events. For each detection include:
- eventType: The type from the provided list
- detected: true/false
- confidence: 0.0-1.0 (only include if detected=true)
- summary: Brief 1-2 sentence summary
- details: Full clinical details
- clinicalSignificance: Why this matters clinically
- recommendedActions: Array of suggested next steps
- sourceExcerpt: The exact text that indicates this event

Only include events where detected=true. Return empty array [] if no events detected.`;

/**
 * AI-powered contextual detection that runs after save
 * Catches nuanced events that keyword matching might miss
 */
export async function detectByAI(
  text: string,
  context: DetectionContext,
  patientHistory?: string
): Promise<AIDetectionResult[]> {
  if (!text || text.trim().length < 50) {
    return [];
  }

  const triggers = await getTriggerConfigs();
  const aiEnabledTriggers = triggers.filter((t) => t.aiDetectionEnabled);

  if (aiEnabledTriggers.length === 0) {
    return [];
  }

  // Build event type descriptions for the AI
  const eventDescriptions = aiEnabledTriggers.map((t) => ({
    eventType: t.eventType,
    name: t.name,
    description: t.description,
    additionalContext: t.aiPromptContext,
    confidenceThreshold: t.aiConfidenceThreshold.toNumber(),
  }));

  const userPrompt = `Analyze the following clinical documentation for significant events:

EVENT TYPES TO DETECT:
${JSON.stringify(eventDescriptions, null, 2)}

DOCUMENTATION TEXT:
---
${text}
---

${patientHistory ? `RELEVANT PATIENT HISTORY:\n${patientHistory}\n---` : ''}

Identify any clinical events from the list above that are evidenced in this documentation.
Return ONLY a valid JSON array of detected events (or empty array if none).`;

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: MODELS.GENERATION,
      max_tokens: 4096,
      system: AI_DETECTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = response.content[0];
    if (!content || content.type !== 'text') {
      return [];
    }

    // Parse JSON response
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    }
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const detections = JSON.parse(jsonText) as AIDetectionResult[];

    // Filter by confidence threshold
    return detections.filter((d) => {
      if (!d.detected) return false;
      const trigger = aiEnabledTriggers.find((t) => t.eventType === d.eventType);
      if (!trigger) return false;
      return d.confidence >= trigger.aiConfidenceThreshold.toNumber();
    });
  } catch (error) {
    console.error('[AI Detection] Error:', error);
    return [];
  }
}

// ===========================================
// COMBINED DETECTION
// ===========================================

/**
 * Run both keyword and AI detection, merge results
 */
export async function detectClinicalEvents(
  text: string,
  context: DetectionContext,
  options: {
    runAI?: boolean;
    patientHistory?: string;
  } = {}
): Promise<DetectionResult> {
  const { runAI = true, patientHistory } = options;

  // Run keyword detection (always fast)
  const keywordMatches = await detectByKeywords(text, context);

  // Run AI detection if enabled
  let aiDetections: AIDetectionResult[] = [];
  if (runAI) {
    aiDetections = await detectByAI(text, context, patientHistory);
  }

  // Combine and deduplicate results
  const combinedEvents = mergeDetections(keywordMatches, aiDetections);

  return {
    keywordMatches,
    aiDetections,
    combinedEvents,
  };
}

/**
 * Merge keyword and AI detections, preferring AI details when available
 */
function mergeDetections(
  keywordMatches: KeywordMatch[],
  aiDetections: AIDetectionResult[]
): CombinedDetection[] {
  const combined = new Map<ClinicalEventType, CombinedDetection>();

  // Add keyword matches
  for (const match of keywordMatches) {
    combined.set(match.eventType, {
      eventType: match.eventType,
      priority: match.priority,
      detectionMethod: 'keyword',
      confidence: match.confidence,
      matchedKeywords: match.matchedKeywords,
      summary: `Detected ${match.triggerName} based on keywords: ${match.matchedKeywords.join(', ')}`,
      details: '',
      clinicalSignificance: '',
      recommendedActions: [],
      sourceText: match.sourceText,
    });
  }

  // Add/merge AI detections
  for (const aiResult of aiDetections) {
    const existing = combined.get(aiResult.eventType);
    if (existing) {
      // Merge - AI provides better details
      existing.detectionMethod = 'both';
      existing.confidence = Math.max(existing.confidence, aiResult.confidence);
      existing.summary = aiResult.summary || existing.summary;
      existing.details = aiResult.details;
      existing.clinicalSignificance = aiResult.clinicalSignificance;
      existing.recommendedActions = aiResult.recommendedActions;
      if (aiResult.sourceExcerpt) {
        existing.sourceText = aiResult.sourceExcerpt;
      }
    } else {
      // Get priority from trigger config
      const triggers = triggerConfigCache || [];
      const trigger = triggers.find((t) => t.eventType === aiResult.eventType);
      const priority = trigger?.priority || TriggerPriority.MEDIUM;

      combined.set(aiResult.eventType, {
        eventType: aiResult.eventType,
        priority,
        detectionMethod: 'ai',
        confidence: aiResult.confidence,
        matchedKeywords: [],
        summary: aiResult.summary,
        details: aiResult.details,
        clinicalSignificance: aiResult.clinicalSignificance,
        recommendedActions: aiResult.recommendedActions,
        sourceText: aiResult.sourceExcerpt,
      });
    }
  }

  // Sort by priority
  const priorityOrder = {
    [TriggerPriority.CRITICAL]: 0,
    [TriggerPriority.HIGH]: 1,
    [TriggerPriority.MEDIUM]: 2,
    [TriggerPriority.LOW]: 3,
  };

  return Array.from(combined.values()).sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );
}

// ===========================================
// OASIS FIELD CHANGE DETECTION
// ===========================================

/**
 * Detect functional decline by comparing OASIS scores
 */
export async function detectOasisChanges(
  assessmentId: string,
  previousAssessmentId?: string
): Promise<CombinedDetection[]> {
  if (!previousAssessmentId) {
    return [];
  }

  const triggers = await getTriggerConfigs();
  const declineEvents: CombinedDetection[] = [];

  for (const trigger of triggers) {
    if (!trigger.monitoredOasisFields.length || !trigger.declineThreshold) {
      continue;
    }

    // Get current and previous responses for monitored fields
    const [currentResponses, previousResponses] = await Promise.all([
      prisma.oasisResponse.findMany({
        where: {
          assessmentId,
          itemCode: { in: trigger.monitoredOasisFields },
        },
      }),
      prisma.oasisResponse.findMany({
        where: {
          assessmentId: previousAssessmentId,
          itemCode: { in: trigger.monitoredOasisFields },
        },
      }),
    ]);

    // Compare scores
    const previousMap = new Map(previousResponses.map((r) => [r.itemCode, r]));
    const declinedFields: string[] = [];
    let totalDecline = 0;

    for (const current of currentResponses) {
      const previous = previousMap.get(current.itemCode);
      if (!previous) continue;

      const currentScore = parseInt(current.responseCode || '0', 10);
      const previousScore = parseInt(previous.responseCode || '0', 10);

      // Lower score = more dependent = decline (for GG items)
      if (currentScore < previousScore) {
        const decline = previousScore - currentScore;
        totalDecline += decline;
        declinedFields.push(`${current.itemCode}: ${previousScore} → ${currentScore}`);
      }
    }

    if (totalDecline >= trigger.declineThreshold) {
      declineEvents.push({
        eventType: trigger.eventType,
        priority: trigger.priority,
        detectionMethod: 'keyword', // OASIS comparison
        confidence: 0.9,
        matchedKeywords: [],
        summary: `${trigger.name} detected: ${declinedFields.length} fields declined`,
        details: `Declined fields: ${declinedFields.join('; ')}`,
        clinicalSignificance: `Total decline of ${totalDecline} points exceeds threshold of ${trigger.declineThreshold}`,
        recommendedActions: ['Review functional status with patient', 'Consider therapy evaluation'],
        sourceText: `OASIS comparison: ${declinedFields.join(', ')}`,
      });
    }
  }

  return declineEvents;
}

// ===========================================
// SAVE DETECTED EVENTS
// ===========================================

/**
 * Save detected events to the database
 */
export async function saveDetectedEvents(
  detections: CombinedDetection[],
  context: DetectionContext
): Promise<DetectedClinicalEvent[]> {
  const savedEvents: DetectedClinicalEvent[] = [];

  for (const detection of detections) {
    // Check cooldown - don't create duplicate events too quickly
    const trigger = (await getTriggerConfigs()).find(
      (t) => t.eventType === detection.eventType
    );
    if (trigger && trigger.cooldownMinutes > 0) {
      const cooldownTime = new Date(Date.now() - trigger.cooldownMinutes * 60 * 1000);
      const recentEvent = await prisma.detectedClinicalEvent.findFirst({
        where: {
          patientId: context.patientId,
          eventType: detection.eventType,
          detectedAt: { gte: cooldownTime },
          isDismissed: false,
        },
      });
      if (recentEvent) {
        console.log(`[Event Detection] Skipping ${detection.eventType} - within cooldown period`);
        continue;
      }
    }

    try {
      const event = await prisma.detectedClinicalEvent.create({
        data: {
          patientId: context.patientId,
          episodeId: context.episodeId,
          assessmentId: context.assessmentId,
          visitId: context.visitId,
          eventType: detection.eventType,
          priority: detection.priority,
          detectionMethod: detection.detectionMethod,
          detectionConfidence: new Prisma.Decimal(detection.confidence),
          matchedKeywords: detection.matchedKeywords,
          eventSummary: detection.summary,
          eventDetails: detection.details,
          clinicalSignificance: detection.clinicalSignificance,
          recommendedActions: detection.recommendedActions,
          sourceText: detection.sourceText,
        },
      });
      savedEvents.push(event);
      console.log(`[Event Detection] Saved ${detection.eventType} event: ${event.id}`);
    } catch (error) {
      console.error(`[Event Detection] Failed to save ${detection.eventType}:`, error);
    }
  }

  return savedEvents;
}

// ===========================================
// GET PENDING EVENTS
// ===========================================

/**
 * Get unacknowledged events for a patient/episode
 */
export async function getPendingEvents(
  patientId: string,
  episodeId?: string
): Promise<DetectedClinicalEvent[]> {
  return prisma.detectedClinicalEvent.findMany({
    where: {
      patientId,
      ...(episodeId && { episodeId }),
      isAcknowledged: false,
      isDismissed: false,
    },
    orderBy: [
      { priority: 'asc' }, // CRITICAL first (enum ordering)
      { detectedAt: 'desc' },
    ],
  });
}

/**
 * Acknowledge an event (mark as seen)
 */
export async function acknowledgeEvent(
  eventId: string,
  userId: string
): Promise<DetectedClinicalEvent> {
  return prisma.detectedClinicalEvent.update({
    where: { id: eventId },
    data: {
      isAcknowledged: true,
      acknowledgedAt: new Date(),
      acknowledgedById: userId,
    },
  });
}

/**
 * Dismiss an event (won't generate notification)
 */
export async function dismissEvent(
  eventId: string,
  userId: string,
  reason: string
): Promise<DetectedClinicalEvent> {
  return prisma.detectedClinicalEvent.update({
    where: { id: eventId },
    data: {
      isDismissed: true,
      dismissedAt: new Date(),
      dismissedById: userId,
      dismissReason: reason,
    },
  });
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  detectByKeywords,
  detectByAI,
  detectClinicalEvents,
  detectOasisChanges,
  saveDetectedEvents,
  getPendingEvents,
  acknowledgeEvent,
  dismissEvent,
  clearTriggerConfigCache,
};
