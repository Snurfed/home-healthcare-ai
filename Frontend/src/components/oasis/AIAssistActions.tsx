/**
 * AI Assist Actions Component
 *
 * Inline AI assist buttons under each question:
 * - Auto-fill from voice
 * - Suggest typical answer
 * - Mark as N/A (if applicable)
 */

import { useState, useCallback } from 'react';
import type { OASISQuestion, OASISResponse } from '@typedefs/index';

interface AIAssistActionsProps {
  question: OASISQuestion;
  onAutoFillVoice: () => void;
  onSuggestTypical: (suggestion: Partial<OASISResponse>) => void;
  onMarkNA?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  hasValue?: boolean;
}

// Typical answers based on response type and common patterns
const TYPICAL_SUGGESTIONS: Record<string, Record<string, string>> = {
  // Pain assessment
  J0520: { code: '0', label: 'No pain' },
  J0530: { code: '4', label: 'Does not interfere' },
  // Cognitive
  M1700: { code: '0', label: 'Intact' },
  M1710: { code: '0', label: 'Never' },
  M1720: { code: '0', label: 'Never' },
  M1730: { code: '0', label: 'Never' },
  // Functional - often defaults to patient capability
  GG0170A: { code: '06', label: 'Independent' },
  GG0170B: { code: '06', label: 'Independent' },
  GG0170C: { code: '06', label: 'Independent' },
  // Wounds
  M1306: { code: '0', label: 'No pressure ulcer' },
  M1307: { code: '00', label: 'Zero ulcers' },
  // Medication management
  M2001: { code: '0', label: 'Compliant' },
  M2003: { code: '0', label: 'Able to take meds' },
  M2005: { code: '0', label: 'Able to take injectable' },
};

export default function AIAssistActions({
  question,
  onAutoFillVoice,
  onSuggestTypical,
  onMarkNA,
  disabled = false,
  isLoading = false,
  hasValue = false,
}: AIAssistActionsProps) {
  const [showingTooltip, setShowingTooltip] = useState<string | null>(null);
  const [suggestingTypical, setSuggestingTypical] = useState(false);

  const typicalSuggestion = TYPICAL_SUGGESTIONS[question.itemCode];

  const handleSuggestTypical = useCallback(async () => {
    if (!typicalSuggestion) return;

    setSuggestingTypical(true);
    // Brief delay for visual feedback
    await new Promise((r) => setTimeout(r, 300));

    onSuggestTypical({
      responseCode: typicalSuggestion.code,
      responseValue: typicalSuggestion.label,
      sourceType: 'manual',
    });
    setSuggestingTypical(false);
  }, [typicalSuggestion, onSuggestTypical]);

  // Don't show if question already has a value
  if (hasValue) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      {/* Voice Auto-fill */}
      <button
        type="button"
        onClick={onAutoFillVoice}
        disabled={disabled || isLoading}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-md border border-primary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-touch sm:min-h-0"
        onMouseEnter={() => setShowingTooltip('voice')}
        onMouseLeave={() => setShowingTooltip(null)}
        aria-label="Auto-fill from voice recording"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        <span>Voice Fill</span>
      </button>

      {/* Suggest Typical Answer */}
      {typicalSuggestion && (
        <button
          type="button"
          onClick={handleSuggestTypical}
          disabled={disabled || isLoading || suggestingTypical}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md border border-amber-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-touch sm:min-h-0"
          onMouseEnter={() => setShowingTooltip('typical')}
          onMouseLeave={() => setShowingTooltip(null)}
          aria-label={`Suggest typical answer: ${typicalSuggestion.label}`}
        >
          {suggestingTypical ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          )}
          <span>Typical: {typicalSuggestion.label}</span>
        </button>
      )}

      {/* Mark as N/A (if applicable) */}
      {onMarkNA && (
        <button
          type="button"
          onClick={onMarkNA}
          disabled={disabled || isLoading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-md border border-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-touch sm:min-h-0"
          aria-label="Mark as not applicable"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <span>N/A</span>
        </button>
      )}

      {/* Tooltip */}
      {showingTooltip && (
        <div className="sr-only" role="tooltip">
          {showingTooltip === 'voice' && 'Use voice recording to auto-fill this field'}
          {showingTooltip === 'typical' && `Suggest typical answer: ${typicalSuggestion?.label}`}
        </div>
      )}
    </div>
  );
}
