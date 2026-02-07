/**
 * Voice Suggestion Review Component
 *
 * Modal for reviewing AI-extracted OASIS fields with accept/reject/modify actions
 */

import { useState, useMemo } from 'react';
import { Button, Badge, Modal } from '@components/common';
import type { OASISQuestion, OASISResponse } from '@typedefs/index';
import type { OasisFieldMapping } from '@services/voice.service';

// ===========================================
// TYPES
// ===========================================

interface VoiceSuggestionReviewProps {
  transcriptionText: string;
  transcriptionId: string;
  extractedFields: OasisFieldMapping[];
  questions: OASISQuestion[];
  existingResponses: Record<string, OASISResponse> | undefined;
  onAccept: (itemCode: string, field: OasisFieldMapping) => void;
  onReject: (itemCode: string) => void;
  onAcceptAll: (fields: OasisFieldMapping[]) => void;
  onClose: () => void;
}

type FieldState = 'pending' | 'accepted' | 'rejected';

// ===========================================
// HELPER COMPONENTS
// ===========================================

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);

  if (confidence >= 0.9) {
    return <Badge variant="success">AI {percent}%</Badge>;
  }
  if (confidence >= 0.7) {
    return <Badge variant="warning">AI {percent}%</Badge>;
  }
  return <Badge variant="error">AI {percent}%</Badge>;
}

function SuggestionCard({
  field,
  question,
  existingValue,
  state,
  onAccept,
  onReject,
}: {
  field: OasisFieldMapping;
  question?: OASISQuestion;
  existingValue?: OASISResponse;
  state: FieldState;
  onAccept: () => void;
  onReject: () => void;
}) {
  const getResponseLabel = (code: string) => {
    if (!question?.responses) return code;
    const option = question.responses.find((r) => r.code === code);
    return option ? `${code} - ${option.label}` : code;
  };

  const hasExisting = existingValue?.responseCode || existingValue?.responseValue;

  return (
    <div
      className={`border rounded-lg p-4 transition-all ${
        state === 'accepted'
          ? 'border-green-300 bg-green-50'
          : state === 'rejected'
          ? 'border-red-300 bg-red-50 opacity-60'
          : 'border-gray-200 bg-white'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-gray-500">{field.itemCode}</span>
            <ConfidenceBadge confidence={field.confidence} />
            {field.requiresReview && (
              <Badge variant="warning">Review</Badge>
            )}
          </div>
          <h4 className="font-medium text-gray-900">{field.itemName}</h4>
        </div>

        {/* State indicator */}
        {state === 'accepted' && (
          <span className="text-green-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
        {state === 'rejected' && (
          <span className="text-red-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        )}
      </div>

      {/* Suggested value */}
      <div className="mb-3">
        <div className="text-sm text-gray-500 mb-1">Suggested:</div>
        <div className="font-medium text-gray-900">
          {getResponseLabel(field.mappedResponseCode)}
        </div>
      </div>

      {/* Existing value (if different) */}
      {hasExisting && (
        <div className="mb-3 p-2 bg-yellow-50 rounded text-sm">
          <div className="text-yellow-700">
            Current value: {getResponseLabel(existingValue.responseCode || existingValue.responseValue || '')}
          </div>
        </div>
      )}

      {/* Source text */}
      <div className="mb-4 p-2 bg-blue-50 rounded">
        <div className="text-xs text-blue-600 mb-1">From transcription:</div>
        <div className="text-sm text-blue-800 italic">"{field.sourceText}"</div>
      </div>

      {/* Alternative values */}
      {field.alternativeValues && field.alternativeValues.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-gray-500 mb-1">Alternative interpretations:</div>
          <div className="flex flex-wrap gap-2">
            {field.alternativeValues.map((alt, idx) => (
              <span key={idx} className="text-xs px-2 py-1 bg-gray-100 rounded">
                {getResponseLabel(alt.responseCode)} ({Math.round(alt.confidence * 100)}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Review reason */}
      {field.reviewReason && (
        <div className="mb-4 p-2 bg-amber-50 rounded text-sm text-amber-700">
          <span className="font-medium">Review reason:</span> {field.reviewReason}
        </div>
      )}

      {/* Actions */}
      {state === 'pending' && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="primary" onClick={onAccept}>
            Accept
          </Button>
          <Button size="sm" variant="ghost" onClick={onReject}>
            Reject
          </Button>
        </div>
      )}

      {state !== 'pending' && (
        <button
          className="text-sm text-gray-500 hover:text-gray-700"
          onClick={state === 'accepted' ? onReject : onAccept}
        >
          {state === 'accepted' ? 'Undo accept' : 'Undo reject'}
        </button>
      )}
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export default function VoiceSuggestionReview({
  transcriptionText,
  extractedFields,
  questions,
  existingResponses,
  onAccept,
  onReject,
  onAcceptAll,
  onClose,
}: VoiceSuggestionReviewProps) {
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>(
    Object.fromEntries(extractedFields.map((f) => [f.itemCode, 'pending']))
  );
  const [showTranscription, setShowTranscription] = useState(false);

  // Group fields by status
  const { reviewFields, highConfidenceFields, pendingCount, acceptedCount, rejectedCount } =
    useMemo(() => {
      const review = extractedFields.filter((f) => f.requiresReview);
      const highConf = extractedFields.filter((f) => !f.requiresReview);
      const pending = Object.values(fieldStates).filter((s) => s === 'pending').length;
      const accepted = Object.values(fieldStates).filter((s) => s === 'accepted').length;
      const rejected = Object.values(fieldStates).filter((s) => s === 'rejected').length;

      return {
        reviewFields: review,
        highConfidenceFields: highConf,
        pendingCount: pending,
        acceptedCount: accepted,
        rejectedCount: rejected,
      };
    }, [extractedFields, fieldStates]);

  const handleAccept = (itemCode: string) => {
    const field = extractedFields.find((f) => f.itemCode === itemCode);
    if (field) {
      setFieldStates((prev) => ({ ...prev, [itemCode]: 'accepted' }));
      onAccept(itemCode, field);
    }
  };

  const handleReject = (itemCode: string) => {
    setFieldStates((prev) => ({ ...prev, [itemCode]: 'rejected' }));
    onReject(itemCode);
  };

  const handleAcceptAllHighConfidence = () => {
    const fieldsToAccept = highConfidenceFields.filter(
      (f) => fieldStates[f.itemCode] === 'pending'
    );

    const newStates = { ...fieldStates };
    fieldsToAccept.forEach((f) => {
      newStates[f.itemCode] = 'accepted';
    });
    setFieldStates(newStates);

    onAcceptAll(fieldsToAccept);
  };

  const handleDone = () => {
    onClose();
  };

  return (
    <Modal isOpen={true} size="xl" onClose={onClose} title="Voice Extraction Results">
      <div className="space-y-6">
        {/* Header actions */}
        <div className="flex items-center justify-between pb-4 border-b">
          <p className="text-sm text-gray-500">
            {extractedFields.length} fields extracted • {pendingCount} pending review
          </p>
          <div className="flex items-center gap-2">
            {highConfidenceFields.some((f) => fieldStates[f.itemCode] === 'pending') && (
              <Button size="sm" variant="secondary" onClick={handleAcceptAllHighConfidence}>
                Accept All High Confidence ({highConfidenceFields.filter((f) => fieldStates[f.itemCode] === 'pending').length})
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={handleDone}>
              Done
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{extractedFields.length}</div>
            <div className="text-xs text-gray-500">Extracted</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{acceptedCount}</div>
            <div className="text-xs text-gray-500">Accepted</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{rejectedCount}</div>
            <div className="text-xs text-gray-500">Rejected</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-400">{pendingCount}</div>
            <div className="text-xs text-gray-500">Pending</div>
          </div>
        </div>

        {/* Transcription toggle */}
        <div>
          <button
            onClick={() => setShowTranscription(!showTranscription)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showTranscription ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            View full transcription
          </button>
          {showTranscription && (
            <div className="mt-2 p-4 bg-gray-50 rounded-lg text-sm text-gray-700 max-h-40 overflow-y-auto">
              {transcriptionText}
            </div>
          )}
        </div>

        {/* Fields needing review */}
        {reviewFields.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 text-lg font-medium text-amber-700 mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              Needs Review ({reviewFields.length})
            </h3>
            <div className="space-y-4">
              {reviewFields.map((field) => (
                <SuggestionCard
                  key={field.itemCode}
                  field={field}
                  question={questions.find((q) => q.itemCode === field.itemCode)}
                  existingValue={existingResponses?.[field.itemCode]}
                  state={fieldStates[field.itemCode] || 'pending'}
                  onAccept={() => handleAccept(field.itemCode)}
                  onReject={() => handleReject(field.itemCode)}
                />
              ))}
            </div>
          </div>
        )}

        {/* High confidence fields */}
        {highConfidenceFields.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 text-lg font-medium text-green-700 mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              High Confidence ({highConfidenceFields.length})
            </h3>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {highConfidenceFields.map((field) => (
                <SuggestionCard
                  key={field.itemCode}
                  field={field}
                  question={questions.find((q) => q.itemCode === field.itemCode)}
                  existingValue={existingResponses?.[field.itemCode]}
                  state={fieldStates[field.itemCode] || 'pending'}
                  onAccept={() => handleAccept(field.itemCode)}
                  onReject={() => handleReject(field.itemCode)}
                />
              ))}
            </div>
          </div>
        )}

        {/* No fields extracted */}
        {extractedFields.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <svg
              className="w-12 h-12 mx-auto mb-4 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p>No OASIS fields could be extracted from the recording.</p>
            <p className="text-sm mt-2">
              Try recording with more specific clinical details.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
