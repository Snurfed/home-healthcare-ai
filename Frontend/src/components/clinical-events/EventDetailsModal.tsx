/**
 * Event Details Modal
 *
 * Modal for viewing clinical event details and taking actions
 * like acknowledging, dismissing, or drafting a communication.
 */

import { useState } from 'react';
import type {
  DetectedClinicalEvent,
  KeywordMatch,
  ClinicalEventType,
  TriggerPriority,
} from '../../types/clinicalEvents.types';
import {
  PRIORITY_CONFIG,
  EVENT_TYPE_CONFIG,
} from '../../types/clinicalEvents.types';

interface EventDetailsModalProps {
  /** The event to display (can be a saved event or real-time match) */
  event: DetectedClinicalEvent | KeywordMatch | null;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when modal should close */
  onClose: () => void;
  /** Called when user acknowledges the event */
  onAcknowledge?: (eventId: string) => void;
  /** Called when user dismisses the event */
  onDismiss?: (eventId: string, reason: string) => void;
  /** Called when user wants to draft a communication */
  onDraftCommunication?: (event: DetectedClinicalEvent | KeywordMatch) => void;
  /** Whether acknowledge action is loading */
  isAcknowledging?: boolean;
  /** Whether dismiss action is loading */
  isDismissing?: boolean;
}

// Type guard to check if event is a saved DetectedClinicalEvent
function isSavedEvent(
  event: DetectedClinicalEvent | KeywordMatch
): event is DetectedClinicalEvent {
  return 'id' in event && 'createdAt' in event;
}

export function EventDetailsModal({
  event,
  isOpen,
  onClose,
  onAcknowledge,
  onDismiss,
  onDraftCommunication,
  isAcknowledging = false,
  isDismissing = false,
}: EventDetailsModalProps) {
  const [dismissReason, setDismissReason] = useState('');
  const [showDismissForm, setShowDismissForm] = useState(false);

  if (!isOpen || !event) {
    return null;
  }

  const eventType = event.eventType as ClinicalEventType;
  const priority = event.priority as TriggerPriority;
  const eventConfig = EVENT_TYPE_CONFIG[eventType];
  const priorityConfig = PRIORITY_CONFIG[priority];

  const isSaved = isSavedEvent(event);
  const savedEvent = isSaved ? event : null;
  const keywordMatch = !isSaved ? (event as KeywordMatch) : null;

  const handleDismiss = () => {
    if (!dismissReason.trim()) {
      return;
    }
    if (savedEvent) {
      onDismiss?.(savedEvent.id, dismissReason);
    }
    setDismissReason('');
    setShowDismissForm(false);
  };

  const handleAcknowledge = () => {
    if (savedEvent) {
      onAcknowledge?.(savedEvent.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div
            className={`px-6 py-4 border-b ${priorityConfig.bgColor} ${priorityConfig.borderColor}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{eventConfig?.icon || '📋'}</span>
                <div>
                  <h2 className={`text-lg font-semibold ${priorityConfig.color}`}>
                    {eventConfig?.label || eventType}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityConfig.bgColor} ${priorityConfig.color} border ${priorityConfig.borderColor}`}
                    >
                      {priorityConfig.icon} {priorityConfig.label} Priority
                    </span>
                    {savedEvent && (
                      <span className="text-xs text-gray-500">
                        Detected {new Date(savedEvent.createdAt).toLocaleString()}
                      </span>
                    )}
                    {keywordMatch && (
                      <span className="text-xs text-gray-500">Real-time detection</span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
            {/* Event Summary */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Summary</h3>
              <p className="text-gray-900">
                {savedEvent?.eventSummary || eventConfig?.description || 'Clinical event detected'}
              </p>
            </div>

            {/* Detection Details */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Detection Method</h3>
              <div className="flex items-center gap-2">
                {savedEvent?.detectionMethod === 'keyword' && (
                  <span className="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    Keyword Match
                  </span>
                )}
                {savedEvent?.detectionMethod === 'ai' && (
                  <span className="text-sm bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                    AI Analysis
                  </span>
                )}
                {savedEvent?.detectionMethod === 'both' && (
                  <>
                    <span className="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      Keyword
                    </span>
                    <span className="text-gray-400">+</span>
                    <span className="text-sm bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                      AI
                    </span>
                  </>
                )}
                {keywordMatch && (
                  <span className="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    Keyword Match (Live)
                  </span>
                )}
              </div>
            </div>

            {/* Matched Keywords */}
            {((savedEvent?.matchedKeywords?.length || 0) > 0 ||
              (keywordMatch?.matchedKeywords?.length || 0) > 0) && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-1">
                  Matched Keywords
                </h3>
                <div className="flex flex-wrap gap-1">
                  {(savedEvent?.matchedKeywords || keywordMatch?.matchedKeywords || []).map(
                    (keyword, index) => (
                      <span
                        key={index}
                        className="text-sm bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
                      >
                        {keyword}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}

            {/* AI Reasoning */}
            {savedEvent?.aiReasoning && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-1">AI Analysis</h3>
                <p className="text-sm text-gray-700 bg-purple-50 p-3 rounded-lg border border-purple-100">
                  {savedEvent.aiReasoning}
                </p>
                {savedEvent.aiConfidence && (
                  <p className="text-xs text-gray-500 mt-1">
                    Confidence: {(savedEvent.aiConfidence * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            )}

            {/* Source Text */}
            {(savedEvent?.sourceText || keywordMatch?.sourceText) && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-1">
                  Source Documentation
                </h3>
                <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-32 overflow-y-auto">
                  "{savedEvent?.sourceText || keywordMatch?.sourceText}"
                </div>
              </div>
            )}

            {/* Dismiss Form */}
            {showDismissForm && (
              <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h3 className="text-sm font-medium text-yellow-800 mb-2">
                  Dismiss Event
                </h3>
                <p className="text-xs text-yellow-700 mb-2">
                  Please provide a reason for dismissing this event. This will be logged
                  for compliance purposes.
                </p>
                <textarea
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                  placeholder="e.g., False positive - patient was discussing past medical history, not current status"
                  className="w-full px-3 py-2 border border-yellow-300 rounded-md text-sm focus:ring-yellow-500 focus:border-yellow-500"
                  rows={3}
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => {
                      setShowDismissForm(false);
                      setDismissReason('');
                    }}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDismiss}
                    disabled={!dismissReason.trim() || isDismissing}
                    className="px-3 py-1.5 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDismissing ? 'Dismissing...' : 'Confirm Dismiss'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
            <div className="flex items-center gap-2">
              {savedEvent && !savedEvent.isAcknowledged && (
                <button
                  onClick={handleAcknowledge}
                  disabled={isAcknowledging}
                  className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  {isAcknowledging ? 'Acknowledging...' : 'Acknowledge'}
                </button>
              )}
              {savedEvent && !savedEvent.isDismissed && !showDismissForm && (
                <button
                  onClick={() => setShowDismissForm(true)}
                  className="px-4 py-2 text-sm text-yellow-700 bg-white border border-yellow-300 rounded-md hover:bg-yellow-50"
                >
                  Dismiss
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Close
              </button>
              <button
                onClick={() => onDraftCommunication?.(event)}
                className={`px-4 py-2 text-sm text-white rounded-md ${
                  priority === 'CRITICAL'
                    ? 'bg-red-600 hover:bg-red-700'
                    : priority === 'HIGH'
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Draft Physician Communication
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EventDetailsModal;
