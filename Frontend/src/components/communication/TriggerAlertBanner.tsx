/**
 * TriggerAlertBanner Component
 *
 * Non-intrusive alert banner displayed during OASIS documentation
 * when AI detects conditions requiring physician communication.
 */

import React from 'react';
import type {
  CommunicationTriggerWithStatus,
  CommunicationUrgency,
} from '../../types/communication.types';
import {
  COMMUNICATION_TYPE_CONFIG,
  COMMUNICATION_URGENCY_CONFIG,
} from '../../types/communication.types';

// Inline SVG icons
const AlertTriangleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const AlertCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const BellIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

interface TriggerAlertBannerProps {
  triggers: CommunicationTriggerWithStatus[];
  onReviewDraft: (trigger: CommunicationTriggerWithStatus) => void;
  onDismiss: (ruleId: string) => void;
  onDismissAll: () => void;
  onClose: () => void;
  className?: string;
}

const UrgencyIcon: React.FC<{ urgency: CommunicationUrgency }> = ({ urgency }) => {
  switch (urgency) {
    case 'EMERGENT':
      return <AlertCircleIcon className="h-5 w-5 text-red-500 animate-pulse" />;
    case 'URGENT':
      return <AlertTriangleIcon className="h-5 w-5 text-orange-500" />;
    default:
      return <BellIcon className="h-5 w-5 text-blue-500" />;
  }
};

export const TriggerAlertBanner: React.FC<TriggerAlertBannerProps> = ({
  triggers,
  onReviewDraft,
  onDismiss,
  onDismissAll,
  onClose,
  className = '',
}) => {
  // Sort by urgency (emergent first, then urgent, then routine)
  const sortedTriggers = [...triggers].sort(
    (a, b) =>
      COMMUNICATION_URGENCY_CONFIG[a.urgency].sortOrder -
      COMMUNICATION_URGENCY_CONFIG[b.urgency].sortOrder
  );

  const primaryTrigger = sortedTriggers[0];

  // Don't render if no triggers
  if (!primaryTrigger) return null;

  const additionalCount = sortedTriggers.length - 1;

  // Determine banner style based on highest urgency
  const urgencyConfig = COMMUNICATION_URGENCY_CONFIG[primaryTrigger.urgency];
  const typeConfig = COMMUNICATION_TYPE_CONFIG[primaryTrigger.type];

  const bannerClasses = {
    EMERGENT: 'bg-red-50 border-red-300',
    URGENT: 'bg-orange-50 border-orange-300',
    ROUTINE: 'bg-blue-50 border-blue-300',
  };

  return (
    <div
      className={`
        relative border-l-4 rounded-r-lg p-4 shadow-sm
        ${bannerClasses[primaryTrigger.urgency]}
        ${className}
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Icon and Content */}
        <div className="flex items-start gap-3 flex-1">
          <UrgencyIcon urgency={primaryTrigger.urgency} />

          <div className="flex-1 min-w-0">
            {/* Title Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`
                  text-xs font-semibold px-2 py-0.5 rounded-full
                  ${urgencyConfig.bgColor} ${urgencyConfig.color}
                `}
              >
                {urgencyConfig.label}
              </span>
              <h4 className="text-sm font-medium text-gray-900">
                AI Detected: {primaryTrigger.title}
              </h4>
              {additionalCount > 0 && (
                <span className="text-xs text-gray-500">
                  (+{additionalCount} more)
                </span>
              )}
            </div>

            {/* Description */}
            <p className="mt-1 text-sm text-gray-600 line-clamp-2">
              {primaryTrigger.description}
            </p>

            {/* Actions */}
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <button
                onClick={() => onReviewDraft(primaryTrigger)}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                  rounded-md transition-colors
                  ${typeConfig.color} ${typeConfig.bgColor} hover:opacity-80
                  border ${typeConfig.borderColor}
                `}
              >
                Review Draft
                <ChevronRightIcon className="h-4 w-4" />
              </button>

              <button
                onClick={() => onDismiss(primaryTrigger.ruleId)}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Dismiss
              </button>

              {additionalCount > 0 && (
                <button
                  onClick={onDismissAll}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Dismiss All
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Close alert"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Additional Triggers Preview */}
      {additionalCount > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Also detected:</span>
            {sortedTriggers.slice(1, 4).map((trigger) => (
              <button
                key={trigger.ruleId}
                onClick={() => onReviewDraft(trigger)}
                className={`
                  text-xs px-2 py-1 rounded-full
                  ${COMMUNICATION_TYPE_CONFIG[trigger.type].bgColor}
                  ${COMMUNICATION_TYPE_CONFIG[trigger.type].color}
                  hover:opacity-80 transition-opacity
                `}
              >
                {trigger.title}
              </button>
            ))}
            {additionalCount > 3 && (
              <span className="text-xs text-gray-500">
                +{additionalCount - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Compact version of the banner for smaller spaces
 */
export const TriggerAlertBannerCompact: React.FC<{
  triggers: CommunicationTriggerWithStatus[];
  onReviewDraft: (trigger: CommunicationTriggerWithStatus) => void;
  onDismiss: (ruleId: string) => void;
  className?: string;
}> = ({ triggers, onReviewDraft, onDismiss, className = '' }) => {
  const sortedTriggers = [...triggers].sort(
    (a, b) =>
      COMMUNICATION_URGENCY_CONFIG[a.urgency].sortOrder -
      COMMUNICATION_URGENCY_CONFIG[b.urgency].sortOrder
  );

  const primaryTrigger = sortedTriggers[0];

  // Don't render if no triggers
  if (!primaryTrigger) return null;

  return (
    <div
      className={`
        flex items-center gap-3 px-3 py-2 rounded-lg
        ${COMMUNICATION_URGENCY_CONFIG[primaryTrigger.urgency].bgColor}
        ${className}
      `}
    >
      <UrgencyIcon urgency={primaryTrigger.urgency} />
      <span className="text-sm font-medium text-gray-900 flex-1 truncate">
        {primaryTrigger.title}
        {sortedTriggers.length > 1 && (
          <span className="text-gray-500 ml-1">
            (+{sortedTriggers.length - 1})
          </span>
        )}
      </span>
      <button
        onClick={() => onReviewDraft(primaryTrigger)}
        className="text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        Review
      </button>
      <button
        onClick={() => onDismiss(primaryTrigger.ruleId)}
        className="text-gray-400 hover:text-gray-600"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
};

export default TriggerAlertBanner;
