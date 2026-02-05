/**
 * Question Renderer Component
 *
 * Renders appropriate input based on question type
 */

import { Input, RadioGroup, Badge } from '@components/common';
import type { OASISQuestion, OASISResponse, QuestionOption } from '@typedefs/index';

interface QuestionRendererProps {
  question: OASISQuestion;
  value?: Partial<OASISResponse>;
  onChange: (response: Partial<OASISResponse>) => void;
  disabled?: boolean;
}

export default function QuestionRenderer({
  question,
  value,
  onChange,
  disabled = false,
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

  const handleValueChange = (newValue: string | string[] | number | null) => {
    onChange({
      responseValue: typeof newValue === 'string' ? newValue : undefined,
      responseCode: typeof newValue === 'string' ? newValue : undefined,
      responseNumeric: typeof newValue === 'number' ? newValue : undefined,
    });
  };

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
        // For multi-select, we'd use a checkbox group
        // Simplified here - using radio for now
        return (
          <RadioGroup
            name={question.itemCode}
            options={
              question.responses?.map((r: QuestionOption) => ({
                value: r.code,
                label: `${r.code} - ${r.label}`,
              })) || []
            }
            value={value?.responseCode || value?.responseValue || ''}
            onChange={(val) => handleValueChange(val)}
            disabled={disabled}
            orientation="vertical"
          />
        );

      case 'numeric':
        return (
          <Input
            type="number"
            name={question.itemCode}
            value={value?.responseNumeric?.toString() || value?.responseValue || ''}
            onChange={(e) => {
              const num = parseFloat(e.target.value);
              handleValueChange(isNaN(num) ? null : num);
            }}
            disabled={disabled}
            className="max-w-xs"
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
          <Input
            type="text"
            name={question.itemCode}
            value={value?.responseValue || ''}
            onChange={(e) => handleValueChange(e.target.value.toUpperCase())}
            disabled={disabled}
            placeholder="Enter ICD-10 code (e.g., J44.1)"
            className="max-w-xs font-mono"
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

  return (
    <div className="space-y-3">
      {/* Question header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary-600">
              {question.itemCode}
            </span>
            <span className="text-sm font-semibold text-gray-900">
              {question.itemName}
            </span>
          </div>
          <p className="mt-1 text-gray-700">{question.questionText}</p>
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
