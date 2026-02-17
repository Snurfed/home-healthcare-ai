/**
 * Clinical Event Alert Banner
 *
 * Non-intrusive banner that appears during documentation when
 * clinical events are detected that may require physician notification.
 */

import { useState } from 'react';
import type {
  TriggerPriority,
  KeywordMatch,
  DetectedClinicalEvent,
} from '../../types/clinicalEvents.types';
import {
  PRIORITY_CONFIG,
  EVENT_TYPE_CONFIG,
} from '../../types/clinicalEvents.types';

interface EventAlertBannerProps {
  /** Real-time keyword matches (not yet saved) */
  realtimeMatches?: KeywordMatch[];
  /** Saved pending events from database */
  pendingEvents?: DetectedClinicalEvent[];
  /** Called when user clicks to review an event */
  onReviewEvent?: (event: KeywordMatch | DetectedClinicalEvent) => void;
  /** Called when user dismisses a real-time match */
  onDismissMatch?: (match: KeywordMatch) => void;
  /** Called when user dismisses the entire banner */
  onDismissBanner?: () => void;
  /** Whether detection is currently running */
  isDetecting?: boolean;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

export function EventAlertBanner({
  realtimeMatches = [],
  pendingEvents = [],
  onReviewEvent,
  onDismissMatch,
  onDismissBanner,
  isDetecting = false,
  compact = false,
}: EventAlertBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [expandedView, setExpandedView] = useState(false);

  // Combine and deduplicate events
  const allEvents = [
    ...realtimeMatches.map((match) => ({
      id: `rt-${match.eventType}`,
      eventType: match.eventType,
      priority: match.priority,
      title: match.triggerName,
      summary: `Detected: ${match.matchedKeywords.slice(0, 3).join(', ')}`,
      isRealtime: true,
      original: match,
    })),
    ...pendingEvents.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      priority: event.priority,
      title: EVENT_TYPE_CONFIG[event.eventType]?.label || event.eventType,
      summary: event.eventSummary?.substring(0, 80) || 'Event detected',
      isRealtime: false,
      original: event,
    })),
  ];

  // Deduplicate by event type (prefer saved over realtime)
  const uniqueEvents = allEvents.reduce((acc, event) => {
    const existing = acc.find((e) => e.eventType === event.eventType);
    if (!existing) {
      return [...acc, event];
    }
    if (!event.isRealtime && existing.isRealtime) {
      return [...acc.filter((e) => e.eventType !== event.eventType), event];
    }
    return acc;
  }, [] as typeof allEvents);

  // Sort by priority
  const priorityOrder: Record<TriggerPriority, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  uniqueEvents.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Don't show if dismissed or no events
  if (isDismissed || uniqueEvents.length === 0) {
    return null;
  }

  // Get highest priority for banner styling
  const highestPriority = uniqueEvents[0]?.priority || 'MEDIUM';
  const priorityConfig = PRIORITY_CONFIG[highestPriority];

  const handleDismissBanner = () => {
    setIsDismissed(true);
    onDismissBanner?.();
  };

  const handleReviewEvent = (event: typeof uniqueEvents[0]) => {
    onReviewEvent?.(event.original as KeywordMatch | DetectedClinicalEvent);
  };

  // Compact single-line view
  if (compact) {
    return (
      <div
        className={`flex items-center justify-between px-3 py-2 rounded-lg border ${priorityConfig.bgColor} ${priorityConfig.borderColor}`}
      >
        <div className="flex items-center gap-2">
          <span>{priorityConfig.icon}</span>
          <span className={`text-sm font-medium ${priorityConfig.color}`}>
            {uniqueEvents.length} event{uniqueEvents.length > 1 ? 's' : ''} detected
          </span>
          {isDetecting && (
            <span className="text-xs text-gray-500 animate-pulse">analyzing...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpandedView(true)}
            className={`text-sm font-medium ${priorityConfig.color} hover:underline`}
          >
            Review
          </button>
          <button
            onClick={handleDismissBanner}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Full banner view
  return (
    <div
      className={`rounded-lg border-l-4 ${priorityConfig.bgColor} ${priorityConfig.borderColor} p-4 mb-4 shadow-sm`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{priorityConfig.icon}</span>
          <div>
            <h3 className={`font-semibold ${priorityConfig.color}`}>
              AI Detected: {uniqueEvents[0]?.title}
              {uniqueEvents.length > 1 && (
                <span className="ml-1 text-sm font-normal">
                  (+{uniqueEvents.length - 1} more)
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-600 mt-0.5">
              {uniqueEvents[0]?.summary}
            </p>
          </div>
        </div>

        <button
          onClick={handleDismissBanner}
          className="text-gray-400 hover:text-gray-600 p-1"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Expanded event list */}
      {(expandedView || uniqueEvents.length > 1) && (
        <div className="mt-3 space-y-2">
          {uniqueEvents.map((event) => {
            const eventConfig = EVENT_TYPE_CONFIG[event.eventType];
            const eventPriorityConfig = PRIORITY_CONFIG[event.priority];

            return (
              <div
                key={event.id}
                className="flex items-center justify-between bg-white rounded-md p-2 border border-gray-200"
              >
                <div className="flex items-center gap-2">
                  <span>{eventConfig?.icon || '📋'}</span>
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {eventConfig?.label || event.eventType}
                    </span>
                    <span
                      className={`ml-2 text-xs px-1.5 py-0.5 rounded ${eventPriorityConfig.bgColor} ${eventPriorityConfig.color}`}
                    >
                      {eventPriorityConfig.label}
                    </span>
                    {event.isRealtime && (
                      <span className="ml-1 text-xs text-gray-400">(live)</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReviewEvent(event)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Review
                  </button>
                  {event.isRealtime && onDismissMatch && (
                    <button
                      onClick={() => onDismissMatch(event.original as KeywordMatch)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => uniqueEvents[0] && handleReviewEvent(uniqueEvents[0])}
          className={`px-4 py-1.5 rounded-md text-sm font-medium text-white ${
            highestPriority === 'CRITICAL'
              ? 'bg-red-600 hover:bg-red-700'
              : highestPriority === 'HIGH'
              ? 'bg-orange-600 hover:bg-orange-700'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          Review & Draft Communication
        </button>

        {uniqueEvents.length > 1 && !expandedView && (
          <button
            onClick={() => setExpandedView(true)}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            View all {uniqueEvents.length} events
          </button>
        )}

        {isDetecting && (
          <span className="text-sm text-gray-500 flex items-center gap-1">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Analyzing...
          </span>
        )}
      </div>
    </div>
  );
}

export default EventAlertBanner;
