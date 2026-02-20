/**
 * Form Section Component
 *
 * Renders a collapsible section with questions and progress indicator.
 */

import { useState, useCallback, useMemo } from 'react';
import CanonicalQuestionRenderer from './CanonicalQuestionRenderer';
import type { BuiltSection, CanonicalValue } from '@typedefs/index';

// =============================================================================
// ICONS
// =============================================================================

const ChevronDownIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const CheckCircleIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const SparklesIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
    />
  </svg>
);

// =============================================================================
// TYPES
// =============================================================================

interface FormSectionProps {
  section: BuiltSection;
  responses: Record<string, CanonicalValue>;
  onResponseChange: (conceptId: string, value: CanonicalValue) => void;
  onGenerateAIDraft?: (sectionId: string) => void;
  isGeneratingDraft?: boolean;
  disabled?: boolean;
  defaultExpanded?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function FormSection({
  section,
  responses,
  onResponseChange,
  onGenerateAIDraft,
  isGeneratingDraft = false,
  disabled = false,
  defaultExpanded = true,
}: FormSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded && !section.collapsed);

  // Calculate visible questions
  const visibleQuestions = useMemo(
    () => section.questions.filter((q) => q.visible),
    [section.questions]
  );

  // Calculate completion
  const completionInfo = useMemo(() => {
    const total = visibleQuestions.length;
    const completed = visibleQuestions.filter((q) => {
      const value = responses[q.conceptId];
      if (value === null || value === undefined) return false;
      if (typeof value === 'string' && value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }).length;

    const requiredTotal = visibleQuestions.filter((q) => q.required).length;
    const requiredCompleted = visibleQuestions.filter((q) => {
      if (!q.required) return false;
      const value = responses[q.conceptId];
      if (value === null || value === undefined) return false;
      if (typeof value === 'string' && value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }).length;

    return {
      total,
      completed,
      requiredTotal,
      requiredCompleted,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      isComplete: requiredCompleted >= requiredTotal,
    };
  }, [visibleQuestions, responses]);

  // Handle toggle
  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Handle AI draft generation
  const handleGenerateDraft = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onGenerateAIDraft?.(section.sectionId);
    },
    [onGenerateAIDraft, section.sectionId]
  );

  // Don't render if section is not visible
  if (!section.visible) {
    return null;
  }

  return (
    <div
      id={`section-${section.sectionId}`}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden"
    >
      {/* Section Header */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={isExpanded}
        aria-controls={`section-content-${section.sectionId}`}
      >
        <div className="flex items-center gap-3">
          {/* Completion indicator */}
          {completionInfo.isComplete ? (
            <CheckCircleIcon className="w-6 h-6 text-green-500" />
          ) : (
            <div className="relative w-6 h-6">
              <svg className="w-6 h-6 transform -rotate-90">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="2"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke={section.required ? '#3b82f6' : '#9ca3af'}
                  strokeWidth="2"
                  strokeDasharray={`${completionInfo.percentage * 0.628} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-gray-600">
                {completionInfo.percentage}
              </span>
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold text-gray-900">{section.name}</h2>
            {section.description && (
              <p className="text-sm text-gray-500">{section.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress indicator */}
          <div className="text-right text-sm">
            <div className="font-medium text-gray-700">
              {completionInfo.completed}/{completionInfo.total}
            </div>
            {completionInfo.requiredTotal > 0 && (
              <div className="text-xs text-gray-500">
                {completionInfo.requiredCompleted}/{completionInfo.requiredTotal} required
              </div>
            )}
          </div>

          {/* Required badge */}
          {section.required && !completionInfo.isComplete && (
            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">
              Required
            </span>
          )}

          {/* AI Draft button */}
          {section.aiDraftEnabled && onGenerateAIDraft && (
            <button
              type="button"
              onClick={handleGenerateDraft}
              disabled={disabled || isGeneratingDraft}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded hover:bg-purple-200 transition-colors disabled:opacity-50"
            >
              <SparklesIcon className="w-3 h-3" />
              {isGeneratingDraft ? 'Generating...' : 'AI Draft'}
            </button>
          )}

          {/* Expand/collapse icon */}
          <ChevronDownIcon
            className={`w-5 h-5 text-gray-400 transition-transform ${
              isExpanded ? 'transform rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Section Content */}
      {isExpanded && (
        <div
          id={`section-content-${section.sectionId}`}
          className="border-t border-gray-200 p-4 space-y-4"
        >
          {visibleQuestions.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No questions in this section.
            </p>
          ) : (
            visibleQuestions.map((question) => (
              <CanonicalQuestionRenderer
                key={question.conceptId}
                question={question}
                value={responses[question.conceptId]}
                onChange={(value) => onResponseChange(question.conceptId, value)}
                disabled={disabled}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
