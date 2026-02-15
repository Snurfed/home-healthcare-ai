/**
 * Physician Communication Types
 *
 * Type definitions for the AI-powered physician communication system.
 */

// =============================================================================
// ENUMS
// =============================================================================

export type CommunicationType =
  | 'CHANGE_IN_CONDITION'
  | 'REQUEST_NEW_ORDERS'
  | 'REFERRAL_REQUEST'
  | 'HOSPITALIZATION_NOTIFICATION'
  | 'ABNORMAL_FINDING'
  | 'POC_UPDATE_REQUEST'
  | 'RECERTIFICATION_SUMMARY'
  | 'DISCHARGE_RECOMMENDATION';

export type CommunicationUrgency = 'ROUTINE' | 'URGENT' | 'EMERGENT';

export type CommunicationStatus =
  | 'DRAFT'
  | 'READY_TO_SEND'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'ACKNOWLEDGED'
  | 'FAILED';

// =============================================================================
// TRIGGER TYPES
// =============================================================================

export interface CommunicationTrigger {
  ruleId: string;
  type: CommunicationType;
  urgency: CommunicationUrgency;
  title: string;
  description: string;
  triggerData: Record<string, unknown>;
  relatedOasisItems: string[];
}

export interface CommunicationTriggerWithStatus extends CommunicationTrigger {
  dismissed: boolean;
  dismissedAt?: string;
  dismissedById?: string;
  dismissReason?: string;
  communicationId?: string;
}

export interface TriggerSummary {
  total: number;
  active: number;
  dismissed: number;
  byType: Record<CommunicationType, number>;
  byUrgency: Record<CommunicationUrgency, number>;
  emergent: CommunicationTrigger[];
}

// =============================================================================
// COMMUNICATION TYPES
// =============================================================================

export interface PhysicianCommunication {
  id: string;
  patientId: string;
  episodeId: string;
  assessmentId?: string;
  communicationType: CommunicationType;
  urgency: CommunicationUrgency;
  status: CommunicationStatus;
  physicianName: string;
  physicianNpi?: string;
  physicianFax?: string;
  subject: string;
  summaryContent: string;
  detailedContent: string;
  clinicalDataSnapshot?: Record<string, unknown>;
  triggeredBy?: string;
  triggerData?: Record<string, unknown>;
  aiModelUsed?: string;
  generationTimeMs?: number;
  sentAt?: string;
  deliveredAt?: string;
  acknowledgedAt?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  patient?: {
    firstName: string;
    lastName: string;
    mrn: string;
  };
  episode?: {
    episodeNumber: number;
    startDate: string;
  };
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface GetTriggersResponse {
  assessmentId: string;
  triggers: CommunicationTriggerWithStatus[];
  summary: TriggerSummary;
  timestamp: string;
}

export interface DetectTriggersRequest {
  questionCode: string;
  allResponses: Record<string, string | null>;
}

export interface DetectTriggersResponse {
  assessmentId: string;
  questionCode: string;
  triggers: CommunicationTrigger[];
  evaluatedRules: number;
  timestamp: string;
}

export interface DismissTriggerRequest {
  assessmentId: string;
  ruleId: string;
  reason?: string;
}

export interface GenerateCommunicationRequest {
  trigger: CommunicationTrigger;
  physicianName: string;
  physicianNpi?: string;
  additionalContext?: string;
}

export interface GenerateCommunicationResponse {
  success: boolean;
  communication: PhysicianCommunication;
  generationTimeMs: number;
}

export interface UpdateCommunicationRequest {
  subject?: string;
  summaryContent?: string;
  detailedContent?: string;
  status?: CommunicationStatus;
  physicianName?: string;
  physicianNpi?: string;
  physicianFax?: string;
}

export interface RegenerateCommunicationRequest {
  instructions: string;
}

export interface ListCommunicationsResponse {
  communications: PhysicianCommunication[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
}

// =============================================================================
// UI CONFIG
// =============================================================================

export const COMMUNICATION_TYPE_CONFIG: Record<
  CommunicationType,
  {
    label: string;
    icon: string;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  CHANGE_IN_CONDITION: {
    label: 'Change in Condition',
    icon: 'AlertTriangle',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  REQUEST_NEW_ORDERS: {
    label: 'New Orders Request',
    icon: 'FileText',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  REFERRAL_REQUEST: {
    label: 'Referral Request',
    icon: 'UserPlus',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  HOSPITALIZATION_NOTIFICATION: {
    label: 'Hospitalization Notice',
    icon: 'Building2',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  ABNORMAL_FINDING: {
    label: 'Abnormal Finding',
    icon: 'AlertCircle',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  POC_UPDATE_REQUEST: {
    label: 'POC Update Request',
    icon: 'ClipboardList',
    color: 'text-teal-700',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
  },
  RECERTIFICATION_SUMMARY: {
    label: 'Recertification Summary',
    icon: 'RefreshCw',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
  },
  DISCHARGE_RECOMMENDATION: {
    label: 'Discharge Recommendation',
    icon: 'LogOut',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
};

export const COMMUNICATION_URGENCY_CONFIG: Record<
  CommunicationUrgency,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    dotColor: string;
    sortOrder: number;
  }
> = {
  EMERGENT: {
    label: 'Emergent',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    dotColor: 'bg-red-500',
    sortOrder: 0,
  },
  URGENT: {
    label: 'Urgent',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-300',
    dotColor: 'bg-orange-500',
    sortOrder: 1,
  },
  ROUTINE: {
    label: 'Routine',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    dotColor: 'bg-gray-500',
    sortOrder: 2,
  },
};

export const COMMUNICATION_STATUS_CONFIG: Record<
  CommunicationStatus,
  {
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  DRAFT: {
    label: 'Draft',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  READY_TO_SEND: {
    label: 'Ready to Send',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  SENDING: {
    label: 'Sending',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  SENT: {
    label: 'Sent',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  DELIVERED: {
    label: 'Delivered',
    color: 'text-green-700',
    bgColor: 'bg-green-200',
  },
  ACKNOWLEDGED: {
    label: 'Acknowledged',
    color: 'text-green-800',
    bgColor: 'bg-green-300',
  },
  FAILED: {
    label: 'Failed',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
};
