/**
 * Voice Suggestion Review Component
 *
 * Redesigned modal for reviewing AI-extracted OASIS fields:
 * - Auto-accepts high confidence (90%+) answers immediately
 * - Shows "Auto-Filled" and "Needs Review" sections
 * - Provides undo functionality
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button, Badge, Modal } from '@components/common';
import type { OASISQuestion, OASISResponse } from '@typedefs/index';
import type { OasisFieldMapping } from '@services/voice.service';

// ===========================================
// CONSTANTS
// ===========================================

const HIGH_CONFIDENCE_THRESHOLD = 0.9;

// Section display names
const SECTION_NAMES: Record<string, string> = {
  administrative: 'Administrative',
  clinical_record: 'Clinical Record',
  patient_tracking: 'Patient Tracking',
  patient_history: 'Patient History',
  financial: 'Financial/Payment Sources',
  living_situation: 'Living Situation',
  hearing_speech_vision: 'Hearing/Speech/Vision',
  sensory_status: 'Sensory Status',
  cognitive: 'Cognitive Patterns',
  mood: 'Mood/Depression',
  behavior: 'Behavior',
  preferences: 'Preferences',
  pain_assessment: 'Pain Assessment',
  integumentary_status: 'Skin Conditions',
  skin_conditions: 'Skin Conditions (Additional)',
  respiratory_status: 'Respiratory',
  cardiac_status: 'Cardiac',
  elimination_status: 'Bladder & Bowel',
  neuro_emotional: 'Neuro/Emotional',
  health_conditions: 'Health Conditions',
  swallowing_nutritional: 'Swallowing/Nutritional',
  functional_abilities: 'Functional Abilities',
  functional_status: 'Functional Status (M18xx)',
  medications: 'Medications',
  medication_management: 'Medications',
  special_treatments: 'Special Treatments',
  care_management: 'Care Management',
  participation: 'Participation',
  therapy_need: 'Therapy Need',
};

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

type TabType = 'auto-filled' | 'needs-review';

// ===========================================
// HELPER COMPONENTS
// ===========================================

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);

  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    return <Badge variant="success">{percent}%</Badge>;
  }
  if (confidence >= 0.7) {
    return <Badge variant="warning">{percent}%</Badge>;
  }
  return <Badge variant="error">{percent}%</Badge>;
}

/** Compact card for auto-filled items - minimal, just shows what was filled */
function AutoFilledCard({
  field,
  question,
  onEdit,
}: {
  field: OasisFieldMapping;
  question?: OASISQuestion;
  onEdit: () => void;
}) {
  const getResponseLabel = (code: string) => {
    if (!question?.responses) return code;
    const option = question.responses.find((r) => r.code === code);
    return option ? option.label : code;
  };

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-green-50 rounded-lg border border-green-200">
      <div className="flex items-center gap-3 min-w-0">
        <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <div className="min-w-0">
          <span className="font-mono text-xs text-gray-500">{field.itemCode}</span>
          <span className="mx-2 text-gray-300">|</span>
          <span className="text-sm font-medium text-gray-900 truncate">
            {getResponseLabel(field.mappedResponseCode)}
          </span>
        </div>
      </div>
      <button
        onClick={onEdit}
        className="text-xs text-gray-500 hover:text-gray-700 flex-shrink-0"
      >
        Edit
      </button>
    </div>
  );
}

/** Detailed card for items needing review */
function ReviewCard({
  field,
  question,
  existingValue,
  onAccept,
  onSkip,
}: {
  field: OasisFieldMapping;
  question?: OASISQuestion;
  existingValue?: OASISResponse;
  onAccept: () => void;
  onSkip: () => void;
}) {
  const getResponseLabel = (code: string) => {
    if (!question?.responses) return code;
    const option = question.responses.find((r) => r.code === code);
    return option ? `${code} - ${option.label}` : code;
  };

  const hasExisting = existingValue?.responseCode || existingValue?.responseValue;

  return (
    <div className="border border-amber-200 rounded-lg p-4 bg-amber-50">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-gray-500">{field.itemCode}</span>
            <ConfidenceBadge confidence={field.confidence} />
          </div>
          <h4 className="font-medium text-gray-900">{field.itemName}</h4>
        </div>
      </div>

      {/* Suggested value */}
      <div className="mb-3">
        <div className="text-sm text-gray-500 mb-1">AI Suggestion:</div>
        <div className="font-medium text-gray-900 bg-white p-2 rounded border">
          {getResponseLabel(field.mappedResponseCode)}
        </div>
      </div>

      {/* Existing value warning */}
      {hasExisting && (
        <div className="mb-3 p-2 bg-yellow-100 rounded text-sm border border-yellow-200">
          <span className="font-medium text-yellow-800">Current value:</span>{' '}
          <span className="text-yellow-700">
            {getResponseLabel(existingValue.responseCode || existingValue.responseValue || '')}
          </span>
        </div>
      )}

      {/* Source text */}
      <div className="mb-3 p-2 bg-blue-50 rounded border border-blue-100">
        <div className="text-xs text-blue-600 mb-1">
          {field.inferredFrom ? 'Inferred from:' : 'From transcription:'}
        </div>
        <div className="text-sm text-blue-800 italic">"{field.sourceText}"</div>
        {field.inferredFrom && (
          <div className="text-xs text-purple-600 mt-1 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Part of {field.inferredFrom.itemCount} questions from "{field.inferredFrom.category.replace(/_/g, ' ')}"
          </div>
        )}
      </div>

      {/* Review reason */}
      {field.reviewReason && (
        <div className="mb-3 p-2 bg-amber-100 rounded text-sm text-amber-800 border border-amber-200">
          <span className="font-medium">Why review needed:</span> {field.reviewReason}
        </div>
      )}

      {/* Alternative values */}
      {field.alternativeValues && field.alternativeValues.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">Other possibilities:</div>
          <div className="flex flex-wrap gap-2">
            {field.alternativeValues.map((alt, idx) => (
              <span key={idx} className="text-xs px-2 py-1 bg-gray-100 rounded border">
                {getResponseLabel(alt.responseCode)} ({Math.round(alt.confidence * 100)}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-amber-200">
        <Button size="sm" variant="primary" onClick={onAccept}>
          Accept
        </Button>
        <Button size="sm" variant="ghost" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export default function VoiceSuggestionReview({
  transcriptionText,
  transcriptionId: _transcriptionId,
  extractedFields,
  questions,
  existingResponses,
  onAccept,
  onReject,
  onAcceptAll,
  onClose,
}: VoiceSuggestionReviewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('needs-review');
  const [showTranscription, setShowTranscription] = useState(false);
  const [autoFilledItems, setAutoFilledItems] = useState<Set<string>>(new Set());
  const [reviewedItems, setReviewedItems] = useState<Set<string>>(new Set());
  const [skippedItems, setSkippedItems] = useState<Set<string>>(new Set());
  const [hasInitialized, setHasInitialized] = useState(false);

  // Separate fields by confidence
  const { highConfidenceFields, lowConfidenceFields } = useMemo(() => {
    const high: OasisFieldMapping[] = [];
    const low: OasisFieldMapping[] = [];

    extractedFields.forEach((field) => {
      if (field.confidence >= HIGH_CONFIDENCE_THRESHOLD && !field.requiresReview) {
        high.push(field);
      } else {
        low.push(field);
      }
    });

    return { highConfidenceFields: high, lowConfidenceFields: low };
  }, [extractedFields]);

  // Group auto-filled items by section and by inference source
  const { autoFilledBySection, inferenceGroups } = useMemo(() => {
    const grouped: Record<string, OasisFieldMapping[]> = {};
    const inferences: Record<string, { statement: string; category: string; fields: OasisFieldMapping[] }> = {};

    highConfidenceFields
      .filter((f) => autoFilledItems.has(f.itemCode))
      .forEach((field) => {
        // Group by inference source if present
        if (field.inferredFrom) {
          const key = field.inferredFrom.statement;
          if (!inferences[key]) {
            inferences[key] = {
              statement: field.inferredFrom.statement,
              category: field.inferredFrom.category,
              fields: [],
            };
          }
          inferences[key].fields.push(field);
        } else {
          // Regular grouping by section
          const section = field.section || 'other';
          if (!grouped[section]) grouped[section] = [];
          grouped[section].push(field);
        }
      });

    return { autoFilledBySection: grouped, inferenceGroups: Object.values(inferences) };
  }, [highConfidenceFields, autoFilledItems]);

  // Items still needing review
  const pendingReviewItems = useMemo(() => {
    return lowConfidenceFields.filter(
      (f) => !reviewedItems.has(f.itemCode) && !skippedItems.has(f.itemCode)
    );
  }, [lowConfidenceFields, reviewedItems, skippedItems]);

  // Auto-accept high confidence items on mount
  useEffect(() => {
    if (hasInitialized || highConfidenceFields.length === 0) return;

    // Auto-accept all high confidence fields
    const itemsToAutoFill = new Set<string>();
    highConfidenceFields.forEach((field) => {
      itemsToAutoFill.add(field.itemCode);
    });

    setAutoFilledItems(itemsToAutoFill);
    onAcceptAll(highConfidenceFields);
    setHasInitialized(true);

    // If there are no low confidence items, show the auto-filled tab
    if (lowConfidenceFields.length === 0) {
      setActiveTab('auto-filled');
    }
  }, [hasInitialized, highConfidenceFields, lowConfidenceFields.length, onAcceptAll]);

  // Handle accepting a review item
  const handleAcceptReviewItem = useCallback((itemCode: string) => {
    const field = lowConfidenceFields.find((f) => f.itemCode === itemCode);
    if (field) {
      onAccept(itemCode, field);
      setReviewedItems((prev) => new Set([...prev, itemCode]));
    }
  }, [lowConfidenceFields, onAccept]);

  // Handle skipping a review item
  const handleSkipReviewItem = useCallback((itemCode: string) => {
    setSkippedItems((prev) => new Set([...prev, itemCode]));
    onReject(itemCode);
  }, [onReject]);

  // Handle undo all auto-filled
  const handleUndoAll = useCallback(() => {
    autoFilledItems.forEach((itemCode) => {
      onReject(itemCode);
    });
    setAutoFilledItems(new Set());
    setHasInitialized(false);
  }, [autoFilledItems, onReject]);

  // Handle editing an auto-filled item (remove from auto-filled, add to review)
  const handleEditAutoFilled = useCallback((itemCode: string) => {
    onReject(itemCode);
    setAutoFilledItems((prev) => {
      const next = new Set(prev);
      next.delete(itemCode);
      return next;
    });
  }, [onReject]);

  // Stats
  const autoFilledCount = autoFilledItems.size;
  const needsReviewCount = pendingReviewItems.length;
  const reviewedCount = reviewedItems.size;
  const skippedCount = skippedItems.size;

  return (
    <Modal isOpen={true} size="xl" onClose={onClose} title="Voice Extraction Results">
      <div className="space-y-4">
        {/* Summary Bar */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-700">{autoFilledCount}</div>
                <div className="text-xs text-green-600">Auto-filled</div>
              </div>
            </div>
            {needsReviewCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-700">{needsReviewCount}</div>
                  <div className="text-xs text-amber-600">Need review</div>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {autoFilledCount > 0 && (
              <Button size="sm" variant="ghost" onClick={handleUndoAll}>
                Undo All
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('needs-review')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'needs-review'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Needs Review
            {needsReviewCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                {needsReviewCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('auto-filled')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'auto-filled'
                ? 'border-green-500 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Auto-Filled
            {autoFilledCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                {autoFilledCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="max-h-[60vh] overflow-y-auto">
          {activeTab === 'needs-review' && (
            <div className="space-y-4">
              {pendingReviewItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-4 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="font-medium text-green-600">All done!</p>
                  <p className="text-sm mt-1">
                    {reviewedCount > 0 && `${reviewedCount} accepted. `}
                    {skippedCount > 0 && `${skippedCount} skipped.`}
                    {reviewedCount === 0 && skippedCount === 0 && 'No items needed review.'}
                  </p>
                </div>
              ) : (
                pendingReviewItems.map((field) => (
                  <ReviewCard
                    key={field.itemCode}
                    field={field}
                    question={questions.find((q) => q.itemCode === field.itemCode)}
                    existingValue={existingResponses?.[field.itemCode]}
                    onAccept={() => handleAcceptReviewItem(field.itemCode)}
                    onSkip={() => handleSkipReviewItem(field.itemCode)}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'auto-filled' && (
            <div className="space-y-4">
              {autoFilledCount === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No items were auto-filled.</p>
                </div>
              ) : (
                <>
                  {/* Inferred groups - items derived from aggregate statements */}
                  {inferenceGroups.map((group, idx) => (
                    <div key={`inference-${idx}`} className="border border-purple-200 rounded-lg overflow-hidden">
                      {/* Inference source header */}
                      <div className="px-4 py-2 bg-purple-50 border-b border-purple-200">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="text-sm font-medium text-purple-800">
                            Inferred from: "{group.statement}"
                          </span>
                        </div>
                        <div className="text-xs text-purple-600 mt-1">
                          {group.fields.length} questions auto-filled from {group.category.replace(/_/g, ' ')}
                        </div>
                      </div>
                      {/* Inferred items */}
                      <div className="p-2 space-y-2 bg-purple-25">
                        {group.fields.map((field) => (
                          <AutoFilledCard
                            key={field.itemCode}
                            field={field}
                            question={questions.find((q) => q.itemCode === field.itemCode)}
                            onEdit={() => handleEditAutoFilled(field.itemCode)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Regular auto-filled items by section */}
                  {Object.entries(autoFilledBySection).map(([sectionId, fields]) => (
                    <div key={sectionId}>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        {SECTION_NAMES[sectionId] || sectionId}
                      </h4>
                      <div className="space-y-2">
                        {fields.map((field) => (
                          <AutoFilledCard
                            key={field.itemCode}
                            field={field}
                            question={questions.find((q) => q.itemCode === field.itemCode)}
                            onEdit={() => handleEditAutoFilled(field.itemCode)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Transcription toggle */}
        <div className="pt-4 border-t">
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
