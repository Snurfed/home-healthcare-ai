/**
 * VisitNoteSection Component
 *
 * Renders a section of the visit note form with:
 * - Collapsible accordion behavior
 * - Section-level AI draft generation
 * - Progress tracking
 * - Dynamic question rendering based on responseType
 */

import { useState, useCallback, useMemo } from 'react';
import { Input, RadioGroup, CheckboxGroup, NumericInput, Badge } from '@components/common';
import VitalSignsEntry from './VitalSignsEntry';
import AIDraftButton from './AIDraftButton';
import type {
  VisitFormSection,
  VisitFormQuestion,
  VisitNoteResponse,
  VitalSigns,
  WoundAssessment,
} from '@typedefs/index';

interface VisitNoteSectionProps {
  section: VisitFormSection;
  responses: Record<string, VisitNoteResponse>;
  onChange: (questionCode: string, value: unknown, source?: VisitNoteResponse['source']) => void;
  onGenerateAIDraft?: (sectionId: string, questionCodes?: string[]) => Promise<void>;
  disabled?: boolean;
  defaultExpanded?: boolean;
  vitalSigns?: VitalSigns;
  onVitalSignsChange?: (vitals: VitalSigns) => void;
  wounds?: WoundAssessment[];
  onWoundsChange?: (wounds: WoundAssessment[]) => void;
}

// Icons
const ChevronIcon = ({ expanded, className = 'w-5 h-5' }: { expanded: boolean; className?: string }) => (
  <svg
    className={`${className} transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
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

export default function VisitNoteSection({
  section,
  responses,
  onChange,
  onGenerateAIDraft,
  disabled = false,
  defaultExpanded = true,
  vitalSigns,
  onVitalSignsChange,
  wounds: _wounds,
  onWoundsChange: _onWoundsChange,
}: VisitNoteSectionProps) {
  // Note: wounds and onWoundsChange are reserved for future wound assessment features
  void _wounds;
  void _onWoundsChange;
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Calculate section progress
  const progress = useMemo(() => {
    let total = 0;
    let completed = 0;
    let required = 0;
    let requiredCompleted = 0;

    for (const question of section.questions) {
      // Skip vitals question as it's tracked separately
      if (question.responseType === 'vitals') continue;

      total++;
      const response = responses[question.code];
      const hasValue =
        response?.value !== undefined && response?.value !== null && response?.value !== '';

      if (hasValue) completed++;

      if (question.required) {
        required++;
        if (hasValue) requiredCompleted++;
      }
    }

    // Add vitals tracking if present
    if (section.questions.some((q) => q.responseType === 'vitals') && vitalSigns) {
      const hasAnyVital =
        vitalSigns.bloodPressureSystolic !== undefined ||
        vitalSigns.heartRate !== undefined ||
        vitalSigns.respiratoryRate !== undefined;
      if (hasAnyVital) {
        completed++;
        requiredCompleted++;
      }
      total++;
      required++;
    }

    const isComplete = requiredCompleted >= required;

    return { total, completed, required, requiredCompleted, isComplete };
  }, [section.questions, responses, vitalSigns]);

  // Check if question should be displayed based on conditional logic
  const shouldShowQuestion = useCallback(
    (question: VisitFormQuestion): boolean => {
      if (!question.conditionalDisplay) return true;

      const { dependsOn, showWhen } = question.conditionalDisplay;
      const dependentResponse = responses[dependsOn];

      if (!dependentResponse?.value) return false;

      const showWhenArray = Array.isArray(showWhen) ? showWhen : [showWhen];
      const responseValue = dependentResponse.value;

      // Handle multi-select (array values)
      if (Array.isArray(responseValue)) {
        return showWhenArray.some((sw) => responseValue.includes(sw));
      }

      return showWhenArray.includes(String(responseValue));
    },
    [responses]
  );

  // Get AI-draftable questions in this section
  const aiDraftableQuestions = useMemo(
    () => section.questions.filter((q) => q.aiDraftEnabled && shouldShowQuestion(q)),
    [section.questions, shouldShowQuestion]
  );

  const handleSectionAIDraft = useCallback(async () => {
    if (!onGenerateAIDraft) return;
    await onGenerateAIDraft(
      section.id,
      aiDraftableQuestions.map((q) => q.code)
    );
  }, [onGenerateAIDraft, section.id, aiDraftableQuestions]);

  // Render question input based on responseType
  const renderQuestionInput = (question: VisitFormQuestion) => {
    const response = responses[question.code];
    const currentValue = response?.value;

    const commonProps = {
      disabled,
      required: question.required,
    };

    switch (question.responseType) {
      case 'vitals':
        return vitalSigns && onVitalSignsChange ? (
          <VitalSignsEntry
            value={vitalSigns}
            onChange={onVitalSignsChange}
            disabled={disabled}
            showPain={true}
          />
        ) : null;

      case 'single_select':
        return (
          <RadioGroup
            {...commonProps}
            name={question.code}
            options={
              question.options?.map((opt) => ({
                value: opt.code,
                label: opt.label,
              })) ?? []
            }
            value={(currentValue as string) ?? ''}
            onChange={(value) => onChange(question.code, value, 'manual')}
          />
        );

      case 'multi_select':
        return (
          <CheckboxGroup
            {...commonProps}
            name={question.code}
            options={
              question.options?.map((opt) => ({
                value: opt.code,
                label: opt.label,
              })) ?? []
            }
            value={(currentValue as string[]) ?? []}
            onChange={(value) => onChange(question.code, value, 'manual')}
          />
        );

      case 'numeric':
        return (
          <NumericInput
            {...commonProps}
            value={(currentValue as number) ?? null}
            onChange={(value) => onChange(question.code, value, 'manual')}
            min={question.validation?.min}
            max={question.validation?.max}
            helpText={question.helpText}
          />
        );

      case 'text':
        return (
          <div className="relative">
            <textarea
              {...commonProps}
              value={(currentValue as string) ?? ''}
              onChange={(e) => onChange(question.code, e.target.value, 'manual')}
              placeholder={question.placeholder}
              rows={3}
              maxLength={question.validation?.maxLength}
              className={`
                w-full px-3 py-2 border rounded-md resize-y
                focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
                ${response?.source === 'ai_draft' ? 'border-purple-300 bg-purple-50' : 'border-gray-300'}
              `}
            />
            {response?.source === 'ai_draft' && (
              <span className="absolute top-2 right-2 px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                AI Draft
              </span>
            )}
            {question.aiDraftEnabled && onGenerateAIDraft && !currentValue && (
              <div className="mt-1">
                <AIDraftButton
                  onGenerate={() => onGenerateAIDraft(section.id, [question.code])}
                  disabled={disabled}
                  size="sm"
                />
              </div>
            )}
          </div>
        );

      case 'date':
        return (
          <Input
            {...commonProps}
            type="date"
            value={(currentValue as string) ?? ''}
            onChange={(e) => onChange(question.code, e.target.value, 'manual')}
          />
        );

      case 'time':
        return (
          <Input
            {...commonProps}
            type="time"
            value={(currentValue as string) ?? ''}
            onChange={(e) => onChange(question.code, e.target.value, 'manual')}
          />
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(currentValue as boolean) ?? false}
              onChange={(e) => onChange(question.code, e.target.checked, 'manual')}
              disabled={disabled}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">{question.label}</span>
          </label>
        );

      case 'pain_scale':
        return (
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => onChange(question.code, level, 'manual')}
                disabled={disabled}
                className={`
                  w-8 h-8 rounded-md text-sm font-medium transition-all
                  ${
                    currentValue === level
                      ? level <= 3
                        ? 'bg-green-500 text-white ring-2 ring-green-600'
                        : level <= 6
                          ? 'bg-yellow-500 text-white ring-2 ring-yellow-600'
                          : 'bg-red-500 text-white ring-2 ring-red-600'
                      : level <= 3
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : level <= 6
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {level}
              </button>
            ))}
          </div>
        );

      case 'signature':
        // Signature handling would typically use a signature pad component
        return (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <p className="text-sm text-gray-500">
              {currentValue ? 'Signature captured' : 'Tap to sign'}
            </p>
            {currentValue && (
              <p className="text-xs text-gray-400 mt-1">
                Signed at {new Date().toLocaleString()}
              </p>
            )}
          </div>
        );

      case 'wound_assessment':
      case 'medication_list':
        // These would have their own dedicated components
        return (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <p className="text-sm text-gray-500">
              {question.responseType === 'wound_assessment'
                ? 'Wound assessment component'
                : 'Medication list component'}
            </p>
          </div>
        );

      default:
        return (
          <Input
            {...commonProps}
            type="text"
            value={(currentValue as string) ?? ''}
            onChange={(e) => onChange(question.code, e.target.value, 'manual')}
            placeholder={question.placeholder}
          />
        );
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Section Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          w-full flex items-center justify-between px-4 py-3
          text-left transition-colors
          ${progress.isComplete ? 'bg-green-50' : 'bg-gray-50'}
          hover:bg-gray-100
        `}
      >
        <div className="flex items-center gap-3">
          {progress.isComplete ? (
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
          )}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{section.name}</h3>
            {section.description && (
              <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress indicator */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {progress.completed}/{progress.total}
            </span>
            {progress.required > 0 && (
              <Badge
                variant={progress.requiredCompleted >= progress.required ? 'success' : 'warning'}
                size="sm"
              >
                {progress.requiredCompleted}/{progress.required} required
              </Badge>
            )}
          </div>

          {/* Section-level AI draft button */}
          {section.aiDraftEnabled && aiDraftableQuestions.length > 0 && onGenerateAIDraft && (
            <div onClick={(e) => e.stopPropagation()}>
              <AIDraftButton
                onGenerate={handleSectionAIDraft}
                disabled={disabled}
                size="sm"
                label="Draft All"
              />
            </div>
          )}

          <ChevronIcon expanded={isExpanded} className="w-5 h-5 text-gray-400" />
        </div>
      </button>

      {/* Section Content */}
      {isExpanded && (
        <div className="px-4 py-4 space-y-4 border-t border-gray-200">
          {section.questions.map((question) => {
            // Check conditional display
            if (!shouldShowQuestion(question)) return null;

            // Special handling for checkbox type - render inline
            if (question.responseType === 'checkbox') {
              return (
                <div key={question.id} className="py-1">
                  {renderQuestionInput(question)}
                  {question.helpText && (
                    <p className="text-xs text-gray-500 ml-6 mt-0.5">{question.helpText}</p>
                  )}
                </div>
              );
            }

            return (
              <div key={question.id} className="space-y-1.5">
                <label className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-700">{question.label}</span>
                  {question.required && <span className="text-red-500 text-sm">*</span>}
                  {responses[question.code]?.source === 'ai_draft' && (
                    <Badge variant="info" size="sm">
                      AI
                    </Badge>
                  )}
                </label>
                {question.helpText && question.responseType !== 'text' && (
                  <p className="text-xs text-gray-500">{question.helpText}</p>
                )}
                {renderQuestionInput(question)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
