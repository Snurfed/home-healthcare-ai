/**
 * Smart Suggestions Component
 *
 * Displays real-time suggestions, optimization opportunities, and
 * consistency warnings below OASIS questions.
 */

import { useState, useCallback } from 'react';
import type {
  QuestionSuggestion,
  DismissalReason,
  SuggestionType,
  SuggestionPriority,
} from '@typedefs/index';
import { SUGGESTION_TYPE_CONFIG, SUGGESTION_PRIORITY_CONFIG } from '@typedefs/index';

interface SmartSuggestionsProps {
  /** Suggestions to display */
  suggestions: QuestionSuggestion[];
  /** Called when a suggestion is dismissed */
  onDismiss: (suggestionId: string, reason: DismissalReason) => void;
  /** Called when user wants to navigate to a related question */
  onNavigate?: (questionCode: string) => void;
  /** Whether suggestions are currently loading */
  isLoading?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * Get the icon for a suggestion type
 */
function getSuggestionIcon(type: SuggestionType): string {
  return SUGGESTION_TYPE_CONFIG[type]?.icon || '💡';
}

/**
 * Get colors for a suggestion type
 */
function getSuggestionColors(type: SuggestionType) {
  return SUGGESTION_TYPE_CONFIG[type] || SUGGESTION_TYPE_CONFIG.HELP;
}

/**
 * Get priority indicator
 */
function getPriorityConfig(priority: SuggestionPriority) {
  return SUGGESTION_PRIORITY_CONFIG[priority] || SUGGESTION_PRIORITY_CONFIG.low;
}

/**
 * Single Suggestion Card Component
 */
function SuggestionCard({
  suggestion,
  onDismiss,
  onNavigate,
}: {
  suggestion: QuestionSuggestion;
  onDismiss: (suggestionId: string, reason: DismissalReason) => void;
  onNavigate?: (questionCode: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDismissOptions, setShowDismissOptions] = useState(false);

  const colors = getSuggestionColors(suggestion.type);
  const priorityConfig = getPriorityConfig(suggestion.priority);
  const icon = getSuggestionIcon(suggestion.type);

  const handleDismiss = useCallback(
    (reason: DismissalReason) => {
      onDismiss(suggestion.id, reason);
      setShowDismissOptions(false);
    },
    [suggestion.id, onDismiss]
  );

  const handleNavigate = useCallback(() => {
    if (onNavigate && suggestion.actionTarget) {
      onNavigate(suggestion.actionTarget);
    }
  }, [onNavigate, suggestion.actionTarget]);

  return (
    <div
      className={`
        rounded-lg border p-3 transition-all duration-200
        ${colors.bgColor} ${colors.borderColor}
        hover:shadow-sm
      `}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        {/* Icon */}
        <span className="text-lg flex-shrink-0" role="img" aria-label={colors.label}>
          {icon}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title and priority */}
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={`text-sm font-medium ${colors.color}`}>
              {suggestion.title}
            </h4>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${colors.bgColor} ${colors.color}`}
            >
              {colors.label}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs`}
              title={priorityConfig.label}
            >
              <span className={`w-2 h-2 rounded-full ${priorityConfig.dot}`} />
              <span className="text-gray-600">{suggestion.priority}</span>
            </span>
          </div>

          {/* Message */}
          <p className={`mt-1 text-sm ${colors.color}`}>{suggestion.message}</p>

          {/* Financial Impact Badge */}
          {suggestion.financialImpact && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/50 text-xs">
              {suggestion.financialImpact.direction === 'positive' ? (
                <span className="text-green-600 font-semibold">
                  +${suggestion.financialImpact.estimatedDelta}
                </span>
              ) : suggestion.financialImpact.direction === 'negative' ? (
                <span className="text-red-600 font-semibold">
                  -${suggestion.financialImpact.estimatedDelta}
                </span>
              ) : (
                <span className="text-gray-600">
                  ${suggestion.financialImpact.estimatedDelta}
                </span>
              )}
              <span className="text-gray-500">potential</span>
            </div>
          )}

          {/* Expandable Help Text */}
          {suggestion.helpText && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className={`text-xs ${colors.color} hover:underline focus:outline-none`}
              >
                {isExpanded ? 'Hide CMS guidance' : 'Show CMS guidance'}
              </button>
              {isExpanded && (
                <div className="mt-2 p-2 bg-white/50 rounded text-xs text-gray-700">
                  {suggestion.helpText}
                </div>
              )}
            </div>
          )}

          {/* Related Questions */}
          {suggestion.relatedQuestions && suggestion.relatedQuestions.length > 0 && (
            <div className="mt-2 text-xs text-gray-600">
              <span className="font-medium">Related: </span>
              {suggestion.relatedQuestions.map((rq, idx) => (
                <span key={rq.itemCode}>
                  {idx > 0 && ', '}
                  <button
                    type="button"
                    onClick={() => onNavigate?.(rq.itemCode)}
                    className="text-blue-600 hover:underline"
                  >
                    {rq.itemCode}
                  </button>
                  <span className="text-gray-400"> ({rq.action})</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Navigate Button */}
          {suggestion.actionLabel && suggestion.actionTarget && onNavigate && (
            <button
              type="button"
              onClick={handleNavigate}
              className={`
                px-2 py-1 text-xs font-medium rounded
                ${colors.color} hover:bg-white/50
                transition-colors
              `}
            >
              {suggestion.actionLabel}
            </button>
          )}

          {/* Dismiss Button */}
          {suggestion.dismissible && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDismissOptions(!showDismissOptions)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-white/50"
                title="Dismiss suggestion"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              {/* Dismiss Options Dropdown */}
              {showDismissOptions && (
                <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border z-10">
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => handleDismiss('addressed')}
                      className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Addressed
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDismiss('not_applicable')}
                      className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Not Applicable
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDismiss('reviewed')}
                      className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Reviewed
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Loading Skeleton for suggestions
 */
function SuggestionSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 bg-gray-200 rounded" />
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * Main SmartSuggestions Component
 */
export default function SmartSuggestions({
  suggestions,
  onDismiss,
  onNavigate,
  isLoading = false,
  className = '',
}: SmartSuggestionsProps) {
  // Don't render if no suggestions and not loading
  if (!isLoading && suggestions.length === 0) {
    return null;
  }

  return (
    <div className={`mt-2 space-y-2 ${className}`}>
      {isLoading ? (
        <SuggestionSkeleton />
      ) : (
        suggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onDismiss={onDismiss}
            onNavigate={onNavigate}
          />
        ))
      )}
    </div>
  );
}

/**
 * Compact version for inline display
 */
export function SmartSuggestionsCompact({
  suggestions,
  onDismiss,
  onNavigate,
  className = '',
}: Omit<SmartSuggestionsProps, 'isLoading'>) {
  if (suggestions.length === 0) {
    return null;
  }

  // Only show high priority suggestions inline
  const highPriority = suggestions.filter((s) => s.priority === 'high');
  if (highPriority.length === 0) {
    return null;
  }

  return (
    <div className={`mt-1 ${className}`}>
      {highPriority.slice(0, 2).map((suggestion) => {
        const colors = getSuggestionColors(suggestion.type);
        const icon = getSuggestionIcon(suggestion.type);

        return (
          <div
            key={suggestion.id}
            className={`
              flex items-center gap-2 px-2 py-1 rounded text-xs
              ${colors.bgColor} ${colors.color}
            `}
          >
            <span>{icon}</span>
            <span className="flex-1 truncate">{suggestion.title}</span>
            {suggestion.dismissible && (
              <button
                type="button"
                onClick={() => onDismiss(suggestion.id, 'reviewed')}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
            {suggestion.actionTarget && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate(suggestion.actionTarget!)}
                className="text-blue-600 hover:underline"
              >
                Go
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
