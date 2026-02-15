/**
 * Question Card Component (NestMed Style)
 *
 * Clean card for individual questions/tasks:
 * - Title with green checkmark when completed
 * - AI Explanation sparkle button
 * - Required badge
 * - Collapsible when completed
 */

import { useState, useCallback } from 'react';
import { useEpisodeStore } from '@context/stores/episodeStore';

export interface QuestionCardProps {
  id: string;
  title: string;
  helperText?: string;
  required?: boolean;
  isCompleted?: boolean;
  aiExplanation?: string;
  children: React.ReactNode;
  onComplete?: (completed: boolean) => void;
}

export default function QuestionCard({
  id,
  title,
  helperText,
  required = false,
  isCompleted = false,
  aiExplanation,
  children,
  onComplete,
}: QuestionCardProps) {
  const [showAiExplanation, setShowAiExplanation] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { hideCompletedCards } = useEpisodeStore();

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  // Hide completely if setting is on and card is completed
  if (hideCompletedCards && isCompleted) {
    return null;
  }

  return (
    <div
      id={`question-card-${id}`}
      className={`
        bg-white rounded-xl border transition-all duration-200
        ${isCompleted
          ? 'border-green-200 bg-green-50/30'
          : required
            ? 'border-l-4 border-l-green-500 border-gray-200 shadow-sm'
            : 'border-gray-200 shadow-sm'
        }
      `}
    >
      {/* Card Header */}
      <div
        className={`
          flex items-start justify-between gap-4 p-4
          ${isCollapsed && isCompleted ? 'cursor-pointer' : ''}
        `}
        onClick={isCompleted ? handleToggleCollapse : undefined}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            {/* Completion indicator */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onComplete?.(!isCompleted);
              }}
              className={`
                flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center
                transition-colors
                ${isCompleted
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-gray-300 hover:border-green-400'
                }
              `}
            >
              {isCompleted && (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>

            {/* Title */}
            <h3
              className={`text-base font-medium ${
                isCompleted ? 'text-gray-500' : 'text-gray-900'
              }`}
            >
              {title}
            </h3>

            {/* Required badge */}
            {required && !isCompleted && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                Required
              </span>
            )}
          </div>

          {/* Helper text */}
          {helperText && !isCollapsed && (
            <p className="mt-1 ml-9 text-sm text-gray-500">{helperText}</p>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* AI Explanation sparkle button */}
          {aiExplanation && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAiExplanation(!showAiExplanation);
              }}
              className={`
                inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg
                transition-colors min-h-[44px]
                ${showAiExplanation
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-500 hover:text-purple-600 hover:bg-purple-50'
                }
              `}
            >
              {/* Sparkle icon */}
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L13.09 8.26L19 9L13.09 9.74L12 16L10.91 9.74L5 9L10.91 8.26L12 2Z" />
                <path d="M5 16L5.54 18.54L8 19L5.54 19.46L5 22L4.46 19.46L2 19L4.46 18.54L5 16Z" />
                <path d="M19 16L19.36 17.64L21 18L19.36 18.36L19 20L18.64 18.36L17 18L18.64 17.64L19 16Z" />
              </svg>
              <span className="hidden sm:inline">AI Explanation</span>
            </button>
          )}

          {/* Collapse toggle for completed */}
          {isCompleted && (
            <button
              type="button"
              onClick={handleToggleCollapse}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <svg
                className={`w-5 h-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* AI Explanation */}
      {showAiExplanation && aiExplanation && (
        <div className="px-4 pb-4">
          <div className="ml-9 p-3 bg-purple-50 border border-purple-100 rounded-lg">
            <div className="flex items-start gap-2">
              <svg
                className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2L13.09 8.26L19 9L13.09 9.74L12 16L10.91 9.74L5 9L10.91 8.26L12 2Z" />
              </svg>
              <p className="text-sm text-purple-800">{aiExplanation}</p>
            </div>
          </div>
        </div>
      )}

      {/* Card Content */}
      {!isCollapsed && (
        <div className="px-4 pb-4">
          <div className="ml-9">{children}</div>
        </div>
      )}
    </div>
  );
}
