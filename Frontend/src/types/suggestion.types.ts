/**
 * Smart Suggestion Types
 *
 * Types for real-time OASIS assessment guidance and optimization suggestions
 */

// Suggestion type categories
export type SuggestionType =
  | 'HELP'              // General clinical guidance
  | 'OPTIMIZATION'      // Reimbursement optimization opportunity
  | 'INCONSISTENCY'     // Detected data inconsistency
  | 'REQUIRED_FOLLOWUP' // Required documentation based on diagnosis
  | 'REVENUE_RISK';     // Under-documentation affecting revenue

// Suggestion priority levels
export type SuggestionPriority = 'high' | 'medium' | 'low';

// Financial impact direction
export type FinancialDirection = 'positive' | 'negative' | 'neutral';

// Related question action
export interface RelatedQuestion {
  itemCode: string;
  itemName: string;
  action: string; // e.g., "Review", "Complete", "Verify"
}

// Financial impact estimate
export interface FinancialImpact {
  estimatedDelta: number;
  direction: FinancialDirection;
  explanation: string;
}

// Main suggestion interface
export interface QuestionSuggestion {
  id: string;
  questionCode: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  title: string;
  message: string;
  helpText?: string;  // Expandable CMS guidance
  financialImpact?: FinancialImpact;
  relatedQuestions?: RelatedQuestion[];
  actionLabel?: string;  // e.g., "Go to Section M"
  actionTarget?: string; // Target question code for navigation
  dismissible: boolean;
}

// Dismissal reason options
export type DismissalReason = 'addressed' | 'not_applicable' | 'reviewed';

// Suggestion dismissal record
export interface SuggestionDismissal {
  id: string;
  assessmentId: string;
  suggestionId: string;
  questionCode: string;
  reason: DismissalReason;
  dismissedAt: string;
  dismissedBy: string;
}

// API request for fetching suggestions
export interface GetSuggestionsRequest {
  questionCode: string;
  currentValue: string | number | null;
  allResponses: Record<string, string | number | null>;
}

// API response for suggestions
export interface GetSuggestionsResponse {
  assessmentId: string;
  questionCode: string;
  suggestions: QuestionSuggestion[];
  timestamp: string;
}

// Dismiss suggestion request
export interface DismissSuggestionRequest {
  suggestionId: string;
  reason: DismissalReason;
}

// Assessment-level suggestion summary
export interface SuggestionsSummary {
  assessmentId: string;
  totalSuggestions: number;
  byType: Record<SuggestionType, number>;
  byPriority: Record<SuggestionPriority, number>;
  dismissed: number;
  active: number;
  totalFinancialOpportunity: number;
  topSuggestions: QuestionSuggestion[];
}

// Visual configuration for suggestion types
export const SUGGESTION_TYPE_CONFIG: Record<SuggestionType, {
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
}> = {
  HELP: {
    icon: '💡',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    label: 'Guidance',
  },
  OPTIMIZATION: {
    icon: '📈',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'Optimization',
  },
  INCONSISTENCY: {
    icon: '⚠️',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    label: 'Inconsistency',
  },
  REQUIRED_FOLLOWUP: {
    icon: '📋',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    label: 'Follow-up Required',
  },
  REVENUE_RISK: {
    icon: '💰',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'Revenue at Risk',
  },
};

// Visual configuration for priority levels
export const SUGGESTION_PRIORITY_CONFIG: Record<SuggestionPriority, {
  dot: string;
  label: string;
  sortOrder: number;
}> = {
  high: {
    dot: 'bg-red-500',
    label: 'High Priority',
    sortOrder: 1,
  },
  medium: {
    dot: 'bg-yellow-500',
    label: 'Medium Priority',
    sortOrder: 2,
  },
  low: {
    dot: 'bg-gray-400',
    label: 'Low Priority',
    sortOrder: 3,
  },
};
