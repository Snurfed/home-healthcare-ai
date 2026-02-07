/**
 * Question Renderer Component
 *
 * Renders appropriate input based on question type
 */

import { useMemo } from 'react';
import {
  Input,
  RadioGroup,
  CheckboxGroup,
  NumericInput,
  ICD10Autocomplete,
  Badge,
} from '@components/common';
import type { OASISQuestion, OASISResponse, QuestionOption, ValidationRule } from '@typedefs/index';
import type { QuestionValidationError } from '@utils/validation';

interface QuestionRendererProps {
  question: OASISQuestion;
  value?: Partial<OASISResponse>;
  onChange: (response: Partial<OASISResponse>) => void;
  disabled?: boolean;
  error?: QuestionValidationError;
}

export default function QuestionRenderer({
  question,
  value,
  onChange,
  disabled = false,
  error,
}: QuestionRendererProps) {
  const hasAIConfidence = value?.confidence !== undefined && value.confidence !== null;
  const confidenceLevel =
    hasAIConfidence && value.confidence! >= 0.9
      ? 'high'
      : hasAIConfidence && value.confidence! >= 0.7
      ? 'medium'
      : hasAIConfidence
      ? 'low'
      : null;

  // Extract min/max from validation rules for numeric inputs
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

  const handleValueChange = (newValue: string | string[] | number | null) => {
    if (Array.isArray(newValue)) {
      // Multi-select: store as comma-separated string
      onChange({
        responseValue: newValue.join(','),
        responseCode: newValue.join(','),
      });
    } else {
      onChange({
        responseValue: typeof newValue === 'string' ? newValue : undefined,
        responseCode: typeof newValue === 'string' ? newValue : undefined,
        responseNumeric: typeof newValue === 'number' ? newValue : undefined,
      });
    }
  };

  // Parse multi-select value from comma-separated string
  const multiSelectValue = useMemo(() => {
    if (!value?.responseValue && !value?.responseCode) return [];
    const val = value.responseCode || value.responseValue || '';
    return val.split(',').filter(Boolean);
  }, [value?.responseValue, value?.responseCode]);

  // Render based on response type
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
            className="form-input"
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

  return (
    <div
      id={`question-${question.itemCode}`}
      className={`space-y-3 p-4 -m-4 rounded-lg transition-colors ${
        hasError ? 'bg-red-50 border border-red-200' : ''
      }`}
    >
      {/* Question header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${hasError ? 'text-red-600' : 'text-primary-600'}`}>
              {question.itemCode}
            </span>
            <span className={`text-sm font-semibold ${hasError ? 'text-red-900' : 'text-gray-900'}`}>
              {question.itemName}
            </span>
            {hasError && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                Required
              </span>
            )}
          </div>
          <p className={`mt-1 ${hasError ? 'text-red-700' : 'text-gray-700'}`}>
            {question.questionText}
          </p>
        </div>

        {/* AI confidence badge */}
        {confidenceLevel && (
          <Badge
            variant={
              confidenceLevel === 'high'
                ? 'success'
                : confidenceLevel === 'medium'
                ? 'warning'
                : 'error'
            }
            className="flex-shrink-0"
          >
            AI {Math.round(value?.confidence! * 100)}%
          </Badge>
        )}
      </div>

      {/* Help text */}
      {question.helpText && (
        <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
          {question.helpText}
        </p>
      )}

      {/* Input */}
      <div className="mt-2">{renderInput()}</div>

      {/* Validation error message */}
      {hasError && (
        <div className="flex items-center gap-2 text-sm text-red-600">
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

      {/* AI source text */}
      {value?.sourceText && value.sourceType === 'voice' && (
        <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
          <span className="font-medium">Voice transcription: </span>
          "{value.sourceText}"
        </div>
      )}
    </div>
  );
}
