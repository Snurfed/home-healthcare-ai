/**
 * Clinical Events Types
 *
 * TypeScript interfaces for the clinical event detection system.
 */

export type ClinicalEventType =
  | 'FALL'
  | 'HOSPITALIZATION'
  | 'MEDICATION_CHANGE'
  | 'FUNCTIONAL_DECLINE'
  | 'WOUND_CHANGE'
  | 'ABNORMAL_VITALS'
  | 'PAIN_INCREASE'
  | 'ORDER_REQUEST'
  | 'DISCHARGE_READY'
  | 'RECERTIFICATION_DUE';

export type TriggerPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type DetectionMethod = 'keyword' | 'ai' | 'both' | 'oasis_change' | 'manual';

// Keyword detection result
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

// AI detection result
export interface AIDetection {
  eventType: ClinicalEventType;
  confidence: number;
  reasoning: string;
  suggestedPriority: TriggerPriority;
  relevantText: string;
}

// Combined detection event
export interface CombinedDetection {
  eventType: ClinicalEventType;
  priority: TriggerPriority;
  detectionMethod: DetectionMethod;
  confidence: number;
  matchedKeywords: string[];
  aiReasoning?: string;
  sourceText: string;
  eventSummary: string;
  triggerId?: string;
}

// Saved event from database
export interface DetectedClinicalEvent {
  id: string;
  patientId: string;
  episodeId: string;
  assessmentId?: string;
  visitId?: string;
  eventType: ClinicalEventType;
  priority: TriggerPriority;
  detectionMethod: DetectionMethod;
  matchedKeywords: string[];
  aiConfidence?: number;
  aiReasoning?: string;
  sourceText: string;
  eventSummary: string;
  isAcknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedById?: string;
  isDismissed: boolean;
  dismissedAt?: string;
  dismissedById?: string;
  dismissReason?: string;
  createdAt: string;
  updatedAt: string;
}

// API request types
export interface KeywordDetectionRequest {
  text: string;
  patientId: string;
  episodeId: string;
  assessmentId?: string;
  visitId?: string;
}

export interface FullDetectionRequest extends KeywordDetectionRequest {
  saveEvents?: boolean;
  patientHistory?: string;
}

// API response types
export interface KeywordDetectionResponse {
  matches: KeywordMatch[];
  count: number;
  hasHighPriority: boolean;
}

export interface FullDetectionResponse {
  keywordMatches: KeywordMatch[];
  aiDetections: AIDetection[];
  combinedEvents: CombinedDetection[];
  savedEvents: Array<{
    id: string;
    eventType: ClinicalEventType;
    priority: TriggerPriority;
  }>;
  stats: {
    keywordCount: number;
    aiCount: number;
    combinedCount: number;
    savedCount: number;
    detectionTimeMs: number;
  };
}

export interface PendingEventsResponse {
  events: DetectedClinicalEvent[];
  count: number;
  hasCritical: boolean;
  hasHigh: boolean;
}

// Trigger configuration
export interface TriggerConfig {
  id: string;
  eventType: ClinicalEventType;
  name: string;
  description: string;
  priority: TriggerPriority;
  isEnabled: boolean;
  keywords: string[];
  excludeKeywords: string[];
  keywordMatchThreshold: number;
  aiDetectionEnabled: boolean;
  aiConfidenceThreshold: number;
  cooldownMinutes: number;
}

// UI state types
export interface ClinicalEventAlert {
  id: string;
  eventType: ClinicalEventType;
  priority: TriggerPriority;
  title: string;
  summary: string;
  detectionMethod: DetectionMethod;
  confidence: number;
  isNew: boolean;
  timestamp: Date;
}

// Priority display helpers
export const PRIORITY_CONFIG: Record<TriggerPriority, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}> = {
  CRITICAL: {
    label: 'Critical',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    icon: '🚨',
  },
  HIGH: {
    label: 'High',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
    icon: '⚠️',
  },
  MEDIUM: {
    label: 'Medium',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
    icon: '📋',
  },
  LOW: {
    label: 'Low',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    icon: 'ℹ️',
  },
};

// Event type display helpers
export const EVENT_TYPE_CONFIG: Record<ClinicalEventType, {
  label: string;
  description: string;
  icon: string;
}> = {
  FALL: {
    label: 'Fall Event',
    description: 'Patient fall or near-fall incident',
    icon: '🚶',
  },
  HOSPITALIZATION: {
    label: 'Hospitalization',
    description: 'ER visit or hospital admission',
    icon: '🏥',
  },
  MEDICATION_CHANGE: {
    label: 'Medication Change',
    description: 'New, stopped, or changed medications',
    icon: '💊',
  },
  FUNCTIONAL_DECLINE: {
    label: 'Functional Decline',
    description: 'Decreased ability in daily activities',
    icon: '📉',
  },
  WOUND_CHANGE: {
    label: 'Wound Change',
    description: 'New wound or wound deterioration',
    icon: '🩹',
  },
  ABNORMAL_VITALS: {
    label: 'Abnormal Vitals',
    description: 'Critical vital sign readings',
    icon: '❤️',
  },
  PAIN_INCREASE: {
    label: 'Pain Increase',
    description: 'Significant increase in pain level',
    icon: '😣',
  },
  ORDER_REQUEST: {
    label: 'Order Request',
    description: 'New orders or referrals needed',
    icon: '📝',
  },
  DISCHARGE_READY: {
    label: 'Discharge Ready',
    description: 'Patient may be ready for discharge',
    icon: '✅',
  },
  RECERTIFICATION_DUE: {
    label: 'Recertification Due',
    description: 'Episode recertification approaching',
    icon: '📅',
  },
};
