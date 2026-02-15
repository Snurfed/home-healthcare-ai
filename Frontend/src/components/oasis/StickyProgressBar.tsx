/**
 * Sticky Progress Bar Component
 *
 * Bottom sticky bar showing:
 * - Required completion progress
 * - Estimated time remaining
 * - Quick navigation actions
 */

import { useMemo } from 'react';
import { Button, Badge } from '@components/common';
import type { OASISQuestion, OASISResponse } from '@typedefs/index';

interface StickyProgressBarProps {
  questions: OASISQuestion[];
  responses: Record<string, Partial<OASISResponse>>;
  draftResponses: Record<string, Partial<OASISResponse>>;
  onNextRequired: () => void;
  onReview: () => void;
  isReviewReady: boolean;
  currentSectionName: string;
}

// Average time per question type (in seconds)
const TIME_PER_QUESTION: Record<string, number> = {
  single_select: 15,
  multi_select: 25,
  numeric: 10,
  date: 8,
  text: 45,
  icd10: 60,
};

function hasValue(response: Partial<OASISResponse> | undefined): boolean {
  if (!response) return false;
  return !!(
    response.responseValue ||
    response.responseCode ||
    response.responseText ||
    (response.responseNumeric !== undefined && response.responseNumeric !== null) ||
    response.responseDate
  );
}

export default function StickyProgressBar({
  questions,
  responses,
  draftResponses,
  onNextRequired,
  onReview,
  isReviewReady: _isReviewReady,
  currentSectionName,
}: StickyProgressBarProps) {
  const mergedResponses = useMemo(
    () => ({ ...responses, ...draftResponses }),
    [responses, draftResponses]
  );

  // Calculate required vs optional stats
  const stats = useMemo(() => {
    let requiredTotal = 0;
    let requiredComplete = 0;
    let optionalTotal = 0;
    let optionalComplete = 0;
    let estimatedSecondsRemaining = 0;

    for (const q of questions) {
      const isRequired = q.validationRules?.some((r) => r.ruleType === 'required');
      const isComplete = hasValue(mergedResponses[q.itemCode]);
      const timeEstimate = TIME_PER_QUESTION[q.responseType] || 20;

      if (isRequired) {
        requiredTotal++;
        if (isComplete) {
          requiredComplete++;
        } else {
          estimatedSecondsRemaining += timeEstimate;
        }
      } else {
        optionalTotal++;
        if (isComplete) {
          optionalComplete++;
        }
      }
    }

    const requiredPercentage = requiredTotal > 0 ? Math.round((requiredComplete / requiredTotal) * 100) : 100;
    const estimatedMinutes = Math.ceil(estimatedSecondsRemaining / 60);

    return {
      requiredTotal,
      requiredComplete,
      requiredRemaining: requiredTotal - requiredComplete,
      optionalTotal,
      optionalComplete,
      requiredPercentage,
      estimatedMinutes,
    };
  }, [questions, mergedResponses]);

  const progressColor = stats.requiredPercentage === 100
    ? 'bg-green-500'
    : stats.requiredPercentage >= 75
      ? 'bg-blue-500'
      : stats.requiredPercentage >= 50
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg lg:left-72">
      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className={`h-full transition-all duration-500 ${progressColor}`}
          style={{ width: `${stats.requiredPercentage}%` }}
        />
      </div>

      <div className="px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Stats */}
          <div className="flex items-center gap-4 min-w-0">
            {/* Required Progress */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-sm font-medium text-gray-900">Required</span>
              </div>
              <Badge
                variant={stats.requiredRemaining === 0 ? 'success' : 'warning'}
              >
                {stats.requiredComplete}/{stats.requiredTotal}
              </Badge>
            </div>

            {/* Optional Progress */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                <span className="text-sm text-gray-600">Optional</span>
              </div>
              <span className="text-sm text-gray-500">
                {stats.optionalComplete}/{stats.optionalTotal}
              </span>
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px h-6 bg-gray-200" />

            {/* Time Estimate */}
            {stats.estimatedMinutes > 0 && (
              <div className="hidden md:flex items-center gap-1.5 text-sm text-gray-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>~{stats.estimatedMinutes} min remaining</span>
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {stats.requiredRemaining > 0 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={onNextRequired}
                className="flex items-center gap-2 min-h-touch"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <span className="hidden sm:inline">Next Required</span>
                <span className="sm:hidden">Next</span>
                <span className="px-1.5 py-0.5 text-xs bg-white/20 rounded">
                  {stats.requiredRemaining}
                </span>
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={onReview}
                className="flex items-center gap-2 min-h-touch bg-green-600 hover:bg-green-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Review & Submit</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Current Section Indicator (Mobile) */}
      <div className="lg:hidden px-4 pb-2">
        <p className="text-xs text-gray-500 text-center truncate">
          {currentSectionName}
        </p>
      </div>
    </div>
  );
}
