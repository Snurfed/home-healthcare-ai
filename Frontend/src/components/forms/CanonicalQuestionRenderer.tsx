/**
 * Canonical Question Renderer
 *
 * Renders form inputs based on canonical question types.
 * Supports all CanonicalAnswerType values with appropriate UI components.
 */

import { useMemo, useCallback } from 'react';
import {
  Input,
  RadioGroup,
  CheckboxGroup,
  NumericInput,
} from '@components/common';
import type {
  BuiltQuestion,
  CanonicalValue,
  CanonicalOption,
} from '@typedefs/index';

// =============================================================================
// ICONS
// =============================================================================

const CheckIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const WarningIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

// =============================================================================
// TYPES
// =============================================================================

interface CanonicalQuestionRendererProps {
  question: BuiltQuestion;
  value?: CanonicalValue;
  onChange: (value: CanonicalValue) => void;
  disabled?: boolean;
  showValidation?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function CanonicalQuestionRenderer({
  question,
  value,
  onChange,
  disabled = false,
  showValidation = true,
}: CanonicalQuestionRendererProps) {
  // Check if has value
  const hasValue = useMemo(() => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  }, [value]);

  // Handle value change based on type
  const handleChange = useCallback(
    (newValue: string | string[] | number | boolean | null) => {
      onChange(newValue as CanonicalValue);
    },
    [onChange]
  );

  // Parse multi-select value
  const multiSelectValue = useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) return value as string[];
    if (typeof value === 'string') return value.split(',').filter(Boolean);
    return [];
  }, [value]);

  // Get numeric value
  const numericValue = useMemo(() => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }, [value]);

  // Get string value
  const stringValue = useMemo(() => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return '';
  }, [value]);

  // Get boolean value
  const booleanValue = useMemo(() => {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return undefined;
  }, [value]);

  // Render input based on type
  const renderInput = () => {
    switch (question.type) {
      case 'single_select':
        return (
          <RadioGroup
            name={question.conceptId}
            options={
              question.options?.map((opt: CanonicalOption) => ({
                value: opt.code,
                label: opt.label,
                description: opt.description,
              })) || []
            }
            value={stringValue}
            onChange={(val) => handleChange(val)}
            disabled={disabled || !question.enabled}
            orientation="vertical"
          />
        );

      case 'multi_select':
        return (
          <CheckboxGroup
            name={question.conceptId}
            options={
              question.options?.map((opt: CanonicalOption) => ({
                value: opt.code,
                label: opt.label,
                description: opt.description,
              })) || []
            }
            value={multiSelectValue}
            onChange={(values) => handleChange(values)}
            disabled={disabled || !question.enabled}
          />
        );

      case 'number':
      case 'decimal':
        return (
          <NumericInput
            name={question.conceptId}
            value={numericValue}
            onChange={(num) => handleChange(num)}
            min={question.validation?.min}
            max={question.validation?.max}
            disabled={disabled || !question.enabled}
          />
        );

      case 'scale':
        return (
          <div className="space-y-2">
            <input
              type="range"
              name={question.conceptId}
              value={numericValue ?? question.scaleMin ?? 0}
              onChange={(e) => handleChange(parseInt(e.target.value, 10))}
              min={question.scaleMin ?? 0}
              max={question.scaleMax ?? 10}
              disabled={disabled || !question.enabled}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500">
              {question.scaleLabels ? (
                Object.entries(question.scaleLabels).map(([num, label]) => (
                  <span key={num} className="text-center">
                    <div className="font-medium">{num}</div>
                    <div>{label}</div>
                  </span>
                ))
              ) : (
                <>
                  <span>{question.scaleMin ?? 0}</span>
                  <span className="font-medium text-lg">{numericValue ?? '-'}</span>
                  <span>{question.scaleMax ?? 10}</span>
                </>
              )}
            </div>
          </div>
        );

      case 'boolean':
        return (
          <div className="flex gap-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                name={question.conceptId}
                checked={booleanValue === true}
                onChange={() => handleChange(true)}
                disabled={disabled || !question.enabled}
                className="form-radio h-5 w-5 text-blue-600"
              />
              <span className="ml-2">Yes</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name={question.conceptId}
                checked={booleanValue === false}
                onChange={() => handleChange(false)}
                disabled={disabled || !question.enabled}
                className="form-radio h-5 w-5 text-blue-600"
              />
              <span className="ml-2">No</span>
            </label>
          </div>
        );

      case 'date':
        return (
          <Input
            type="date"
            name={question.conceptId}
            value={stringValue}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled || !question.enabled}
            className="max-w-xs"
          />
        );

      case 'time':
        return (
          <Input
            type="time"
            name={question.conceptId}
            value={stringValue}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled || !question.enabled}
            className="max-w-xs"
          />
        );

      case 'datetime':
        return (
          <Input
            type="datetime-local"
            name={question.conceptId}
            value={stringValue}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled || !question.enabled}
            className="max-w-sm"
          />
        );

      case 'textarea':
        return (
          <textarea
            name={question.conceptId}
            value={stringValue}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled || !question.enabled}
            rows={4}
            className="form-input w-full min-h-[100px] resize-y"
            placeholder={question.helpText || 'Enter your response...'}
          />
        );

      case 'text':
      default:
        return (
          <Input
            type="text"
            name={question.conceptId}
            value={stringValue}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled || !question.enabled}
            placeholder={question.helpText}
          />
        );
    }
  };

  // Skip rendering if not visible
  if (!question.visible) {
    return null;
  }

  // Determine card styling based on state
  const hasErrors = question.errors.length > 0;
  const hasWarnings = question.warnings.length > 0;

  const cardClasses = useMemo(() => {
    const baseClasses = 'relative p-4 rounded-xl transition-all duration-200';

    if (hasErrors) {
      return `${baseClasses} bg-red-50 border-2 border-red-300`;
    }
    if (hasWarnings) {
      return `${baseClasses} bg-yellow-50 border-2 border-yellow-300`;
    }
    if (question.required && !hasValue) {
      return `${baseClasses} bg-white border-2 border-l-4 border-gray-200 border-l-red-400`;
    }
    if (hasValue) {
      return `${baseClasses} bg-gray-50 border border-gray-200`;
    }
    return `${baseClasses} bg-white border border-gray-200 hover:shadow-sm`;
  }, [hasErrors, hasWarnings, question.required, hasValue]);

  return (
    <div
      id={`question-${question.conceptId}`}
      className={cardClasses}
      role="group"
      aria-labelledby={`question-label-${question.conceptId}`}
    >
      {/* Question Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {/* Concept ID badge */}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold ${
                hasErrors
                  ? 'bg-red-100 text-red-700'
                  : question.required
                    ? 'bg-red-50 text-red-600'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {question.shortLabel || question.conceptId.split('.').pop()}
            </span>

            {/* Required/Optional badge */}
            {question.required ? (
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
            {hasValue && !hasErrors && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                <CheckIcon className="w-3 h-3" />
                Complete
              </span>
            )}

            {/* OASIS indicator */}
            {question.oasisItemCode && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                OASIS: {question.oasisItemCode}
              </span>
            )}
          </div>

          {/* Question label */}
          <h3
            id={`question-label-${question.conceptId}`}
            className={`text-base font-semibold ${hasErrors ? 'text-red-900' : 'text-gray-900'}`}
          >
            {question.label}
          </h3>

          {/* Help text */}
          {question.helpText && (
            <p className={`mt-1 text-sm ${hasErrors ? 'text-red-700' : 'text-gray-600'}`}>
              {question.helpText}
            </p>
          )}
        </div>
      </div>

      {/* Input Section */}
      <div className="mt-3">{renderInput()}</div>

      {/* Validation Messages */}
      {showValidation && hasErrors && (
        <div className="mt-3 space-y-1">
          {question.errors.map((error, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 p-2 bg-red-100 border border-red-200 rounded-lg text-sm text-red-700"
            >
              <WarningIcon className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ))}
        </div>
      )}

      {showValidation && hasWarnings && !hasErrors && (
        <div className="mt-3 space-y-1">
          {question.warnings.map((warning, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 p-2 bg-yellow-100 border border-yellow-200 rounded-lg text-sm text-yellow-700"
            >
              <WarningIcon className="w-4 h-4 flex-shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
