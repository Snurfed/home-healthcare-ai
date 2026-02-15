/**
 * Question Renderer Component
 *
 * Renders appropriate input based on question type with:
 * - Clear required vs optional visual separation
 * - Inline AI assist actions
 * - Real-time smart suggestions
 * - Animation for auto-filled fields
 */

import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  Input,
  RadioGroup,
  CheckboxGroup,
  NumericInput,
  ICD10Autocomplete,
  Badge,
} from '@components/common';
import SmartSuggestions from './SmartSuggestions';
import AIAssistActions from './AIAssistActions';
import type {
  OASISQuestion,
  OASISResponse,
  QuestionOption,
  ValidationRule,
  QuestionSuggestion,
  DismissalReason,
} from '@typedefs/index';
import type { QuestionValidationError } from '@utils/validation';

// Lock icon for system-populated fields
const LockIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

// Check icon for completed fields
const CheckIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

interface QuestionRendererProps {
  question: OASISQuestion;
  value?: Partial<OASISResponse>;
  onChange: (response: Partial<OASISResponse>) => void;
  disabled?: boolean;
  error?: QuestionValidationError;
  suggestions?: QuestionSuggestion[];
  onDismissSuggestion?: (suggestionId: string, reason: DismissalReason) => void;
  onNavigateToQuestion?: (questionCode: string) => void;
  suggestionsLoading?: boolean;
  onValueChange?: (questionCode: string, value: string | number | null) => void;
  onVoiceFill?: () => void;
}

function hasResponseValue(response: Partial<OASISResponse> | undefined): boolean {
  if (!response) return false;
  return !!(
    response.responseValue ||
    response.responseCode ||
    response.responseText ||
    (response.responseNumeric !== undefined && response.responseNumeric !== null) ||
    response.responseDate
  );
}

export default function QuestionRenderer({
  question,
  value,
  onChange,
  disabled = false,
  error,
  suggestions = [],
  onDismissSuggestion,
  onNavigateToQuestion,
  suggestionsLoading = false,
  onValueChange,
  onVoiceFill,
}: QuestionRendererProps) {
  const [isEditingSystemField, setIsEditingSystemField] = useState(false);
  const [showAIConfirmation, setShowAIConfirmation] = useState(false);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const prevValueRef = useRef<Partial<OASISResponse> | undefined>(undefined);

  // Check if required
  const isRequired = useMemo(
    () => question.validationRules?.some((r) => r.ruleType === 'required') ?? false,
    [question.validationRules]
  );

  // Check if has value
  const hasValue = hasResponseValue(value);

  // Check if system-populated
  const isSystemPopulated = value?.sourceType === 'system';
  const isReadOnly = isSystemPopulated && !isEditingSystemField;

  // AI confidence
  const hasAIConfidence = value?.confidence !== undefined && value.confidence !== null;
  const confidenceLevel =
    hasAIConfidence && value.confidence! >= 0.9
      ? 'high'
      : hasAIConfidence && value.confidence! >= 0.7
        ? 'medium'
        : hasAIConfidence
          ? 'low'
          : null;

  // Detect when AI fills a field
  useEffect(() => {
    if (
      value?.sourceType &&
      ['voice', 'ocr', 'emr', 'system'].includes(value.sourceType) &&
      hasResponseValue(value) &&
      !hasResponseValue(prevValueRef.current)
    ) {
      setShowAIConfirmation(true);
      setIsCollapsing(true);
      const timer = setTimeout(() => {
        setShowAIConfirmation(false);
        setIsCollapsing(false);
      }, 2000);
      prevValueRef.current = value;
      return () => clearTimeout(timer);
    }
    prevValueRef.current = value;
    return undefined;
  }, [value]);

  // Extract numeric validation
  const numericValidation = useMemo(() => {
    if (question.responseType !== 'numeric' || !question.validationRules) {
      return { min: undefined, max: undefined };
    }

    let min: number | undefined;
    let max: number | undefined;

    question.validationRules.forEach((rule: ValidationRule) => {
      if (rule.ruleType === 'min' && typeof rule.value === 'number') {
        min = rule.value;
      }
      if (rule.ruleType === 'max' && typeof rule.value === 'number') {
        max = rule.value;
      }
    });

    return { min, max };
  }, [question.responseType, question.validationRules]);

  const handleValueChange = useCallback(
    (newValue: string | string[] | number | null) => {
      if (Array.isArray(newValue)) {
        const joinedValue = newValue.join(',');
        onChange({
          responseValue: joinedValue,
          responseCode: joinedValue,
        });
        onValueChange?.(question.itemCode, joinedValue);
      } else {
        onChange({
          responseValue: typeof newValue === 'string' ? newValue : undefined,
          responseCode: typeof newValue === 'string' ? newValue : undefined,
          responseNumeric: typeof newValue === 'number' ? newValue : undefined,
        });
        onValueChange?.(question.itemCode, newValue);
      }
    },
    [onChange, onValueChange, question.itemCode]
  );

  const handleDismissSuggestion = useCallback(
    (suggestionId: string, reason: DismissalReason) => {
      onDismissSuggestion?.(suggestionId, reason);
    },
    [onDismissSuggestion]
  );

  // Handle AI suggestion accept
  const handleAISuggestion = useCallback(
    (suggestion: Partial<OASISResponse>) => {
      onChange({
        ...suggestion,
        sourceType: suggestion.sourceType || 'manual',
      });
    },
    [onChange]
  );

  // Parse multi-select value
  const multiSelectValue = useMemo(() => {
    if (!value?.responseValue && !value?.responseCode) return [];
    const val = value.responseCode || value.responseValue || '';
    return val.split(',').filter(Boolean);
  }, [value?.responseValue, value?.responseCode]);

  // Render input based on type
  const renderInput = () => {
    switch (question.responseType) {
      case 'single_select':
        return (
          <RadioGroup
            name={question.itemCode}
            options={
              question.responses?.map((r: QuestionOption) => ({
                value: r.code,
                label: `${r.code} - ${r.label}`,
                description: r.description,
              })) || []
            }
            value={value?.responseCode || value?.responseValue || ''}
            onChange={(val) => handleValueChange(val)}
            disabled={disabled}
            orientation="vertical"
          />
        );

      case 'multi_select':
        return (
          <CheckboxGroup
            name={question.itemCode}
            options={
              question.responses?.map((r: QuestionOption) => ({
                value: r.code,
                label: `${r.code} - ${r.label}`,
                description: r.description,
              })) || []
            }
            value={multiSelectValue}
            onChange={(values) => handleValueChange(values)}
            disabled={disabled}
          />
        );

      case 'numeric':
        return (
          <NumericInput
            name={question.itemCode}
            value={value?.responseNumeric ?? null}
            onChange={(num) => handleValueChange(num)}
            min={numericValidation.min}
            max={numericValidation.max}
            disabled={disabled}
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            name={question.itemCode}
            value={value?.responseValue || ''}
            onChange={(e) => handleValueChange(e.target.value)}
            disabled={disabled}
            className="max-w-xs"
          />
        );

      case 'text':
        return (
          <textarea
            name={question.itemCode}
            value={value?.responseText || value?.responseValue || ''}
            onChange={(e) =>
              onChange({
                responseText: e.target.value,
                responseValue: e.target.value,
              })
            }
            disabled={disabled}
            rows={3}
            className="form-input min-h-touch"
            placeholder="Enter your response..."
          />
        );

      case 'icd10':
        return (
          <ICD10Autocomplete
            name={question.itemCode}
            value={value?.responseValue || ''}
            onChange={(code, description) => {
              onChange({
                responseValue: code,
                responseCode: code,
                responseText: description,
              });
            }}
            disabled={disabled}
            placeholder="Search or enter ICD-10 code..."
          />
        );

      default:
        return (
          <Input
            type="text"
            name={question.itemCode}
            value={value?.responseValue || ''}
            onChange={(e) => handleValueChange(e.target.value)}
            disabled={disabled}
          />
        );
    }
  };

  const hasError = !!error;

  // Determine card styling based on state
  const cardClasses = useMemo(() => {
    const baseClasses = 'relative p-4 rounded-xl transition-all duration-300';

    if (hasError) {
      return `${baseClasses} bg-red-50 border-2 border-red-300 shadow-sm`;
    }
    if (showAIConfirmation) {
      return `${baseClasses} bg-green-50 border-2 border-green-400 shadow-md ring-2 ring-green-200`;
    }
    if (isRequired && !hasValue) {
      return `${baseClasses} bg-white border-2 border-l-4 border-gray-200 border-l-red-400 shadow-sm hover:shadow-md`;
    }
    if (hasValue) {
      return `${baseClasses} bg-gray-50 border border-gray-200 ${isCollapsing ? 'animate-pulse' : ''}`;
    }
    return `${baseClasses} bg-white border border-gray-200 shadow-sm hover:shadow-md`;
  }, [hasError, showAIConfirmation, isRequired, hasValue, isCollapsing]);

  return (
    <div
      id={`question-${question.itemCode}`}
      className={cardClasses}
      role="group"
      aria-labelledby={`question-label-${question.itemCode}`}
    >
      {/* AI Confirmation Animation */}
      {showAIConfirmation && (
        <div className="absolute -top-3 left-4 flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs font-medium rounded-full shadow-lg animate-bounce">
          <CheckIcon className="w-3 h-3" />
          Auto-filled
        </div>
      )}

      {/* Question Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {/* Item code */}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold ${
                hasError
                  ? 'bg-red-100 text-red-700'
                  : isRequired
                    ? 'bg-red-50 text-red-600'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {question.itemCode}
            </span>

            {/* Required/Optional badge */}
            {isRequired ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Required
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                Optional
              </span>
            )}

            {/* Completion indicator */}
            {hasValue && !hasError && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                <CheckIcon className="w-3 h-3" />
                Complete
              </span>
            )}
          </div>

          {/* Question name */}
          <h3
            id={`question-label-${question.itemCode}`}
            className={`text-base font-semibold ${hasError ? 'text-red-900' : 'text-gray-900'}`}
          >
            {question.itemName}
          </h3>

          {/* Question text */}
          <p className={`mt-1 text-sm ${hasError ? 'text-red-700' : 'text-gray-600'}`}>
            {question.questionText}
          </p>
        </div>

        {/* AI confidence badge */}
        {confidenceLevel && (
          <div className="flex-shrink-0">
            <Badge
              variant={
                confidenceLevel === 'high'
                  ? 'success'
                  : confidenceLevel === 'medium'
                    ? 'warning'
                    : 'error'
              }
            >
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                {Math.round(value?.confidence! * 100)}%
              </span>
            </Badge>
          </div>
        )}
      </div>

      {/* Help text */}
      {question.helpText && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-sm text-blue-800">{question.helpText}</p>
        </div>
      )}

      {/* Input Section */}
      <div className="mt-3">
        {isReadOnly ? (
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex-1">
              <div className="font-medium text-gray-900">
                {value?.responseText || value?.responseValue || value?.responseCode || 'N/A'}
              </div>
              {value?.responseValue &&
                value?.responseText &&
                value.responseValue !== value.responseText && (
                  <div className="text-sm text-gray-500 mt-0.5">Code: {value.responseValue}</div>
                )}
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                <LockIcon className="w-3 h-3" />
                Auto-filled
              </span>
              <button
                type="button"
                onClick={() => setIsEditingSystemField(true)}
                className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 bg-white rounded border border-gray-300 hover:bg-gray-50 transition-colors min-h-touch sm:min-h-0"
              >
                Edit
              </button>
            </div>
          </div>
        ) : (
          renderInput()
        )}

        {/* Editing system field warning */}
        {isEditingSystemField && isSystemPopulated && (
          <div className="mt-2 flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>Editing system auto-filled field</span>
            <button
              type="button"
              onClick={() => setIsEditingSystemField(false)}
              className="ml-auto underline hover:text-amber-900"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* AI Assist Actions - only show for empty fields */}
      {!hasValue && !disabled && (
        <AIAssistActions
          question={question}
          onAutoFillVoice={onVoiceFill || (() => {})}
          onSuggestTypical={handleAISuggestion}
          hasValue={hasValue}
        />
      )}

      {/* Validation Error */}
      {hasError && (
        <div className="mt-3 flex items-center gap-2 p-2 bg-red-100 border border-red-200 rounded-lg text-sm text-red-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>{error.message}</span>
        </div>
      )}

      {/* AI Source Text */}
      {value?.sourceText && value.sourceType === 'voice' && (
        <div className="mt-3 p-2 bg-purple-50 border border-purple-100 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <p className="text-xs text-purple-700">
              <span className="font-medium">Voice: </span>
              "{value.sourceText}"
            </p>
          </div>
        </div>
      )}

      {/* Smart Suggestions */}
      {(suggestions.length > 0 || suggestionsLoading) && (
        <div className="mt-3">
          <SmartSuggestions
            suggestions={suggestions}
            onDismiss={handleDismissSuggestion}
            onNavigate={onNavigateToQuestion}
            isLoading={suggestionsLoading}
          />
        </div>
      )}
    </div>
  );
}
