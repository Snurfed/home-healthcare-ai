/**
 * Submission Validation Component
 *
 * Displays validation status and readiness for assessment submission
 */

import { useMemo } from 'react';
import { Button, Alert, Badge } from '@components/common';
import type { AssessmentValidationResult, QuestionValidationError } from '@utils/validation';
import { OASIS_SECTIONS } from '@typedefs/oasis.types';

interface SubmissionValidationProps {
  validationResult: AssessmentValidationResult | null;
  completionPercentage: number;
  isReadyForSubmission: boolean;
  blockers: string[];
  warnings: string[];
  crossValidationErrors: QuestionValidationError[];
  onValidate: () => void;
  onSubmit: () => void;
  onFixError: (itemCode: string) => void;
  isSubmitting?: boolean;
}

export default function SubmissionValidation({
  validationResult,
  completionPercentage,
  isReadyForSubmission,
  blockers,
  warnings,
  crossValidationErrors,
  onValidate,
  onSubmit,
  onFixError,
  isSubmitting = false,
}: SubmissionValidationProps) {
  // Group errors by section
  const errorsBySection = useMemo(() => {
    if (!validationResult) return new Map<string, QuestionValidationError[]>();

    const grouped = new Map<string, QuestionValidationError[]>();
    for (const error of validationResult.errors) {
      const section = error.itemCode.startsWith('GG') ? 'functional_abilities' :
        OASIS_SECTIONS.find(s =>
          validationResult.sectionResults[s.id]?.errors.some(e => e.itemCode === error.itemCode)
        )?.id || 'unknown';

      if (!grouped.has(section)) {
        grouped.set(section, []);
      }
      grouped.get(section)!.push(error);
    }
    return grouped;
  }, [validationResult]);

  // Get section name
  const getSectionName = (sectionId: string) => {
    return OASIS_SECTIONS.find(s => s.id === sectionId)?.name || sectionId;
  };

  return (
    <div className="space-y-6">
      {/* Completion Status */}
      <div className="bg-white rounded-lg shadow-card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Assessment Completion</h3>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm font-semibold text-gray-900">{completionPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  completionPercentage >= 80 ? 'bg-green-500' :
                  completionPercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
          <Badge
            variant={completionPercentage >= 80 ? 'success' : completionPercentage >= 50 ? 'warning' : 'error'}
          >
            {completionPercentage >= 80 ? 'Ready' : completionPercentage >= 50 ? 'In Progress' : 'Incomplete'}
          </Badge>
        </div>

        {completionPercentage < 80 && (
          <p className="text-sm text-gray-500">
            Complete at least 80% of the assessment to submit for review.
          </p>
        )}
      </div>

      {/* Validation Button */}
      {!validationResult && (
        <div className="bg-white rounded-lg shadow-card p-6">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Validate Assessment</h3>
            <p className="mt-1 text-sm text-gray-500">
              Run validation to check for errors and missing required fields.
            </p>
            <div className="mt-4">
              <Button variant="primary" onClick={onValidate}>
                Run Validation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Results */}
      {validationResult && (
        <>
          {/* Summary */}
          <div className="bg-white rounded-lg shadow-card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Validation Summary</h3>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className={`p-4 rounded-lg ${validationResult.errorCount === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-sm font-medium text-gray-500">Errors</p>
                <p className={`text-2xl font-bold ${validationResult.errorCount === 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {validationResult.errorCount}
                </p>
              </div>
              <div className={`p-4 rounded-lg ${validationResult.warningCount === 0 ? 'bg-green-50' : 'bg-yellow-50'}`}>
                <p className="text-sm font-medium text-gray-500">Warnings</p>
                <p className={`text-2xl font-bold ${validationResult.warningCount === 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {validationResult.warningCount}
                </p>
              </div>
              <div className={`p-4 rounded-lg ${validationResult.missingRequiredCount === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-sm font-medium text-gray-500">Missing Required</p>
                <p className={`text-2xl font-bold ${validationResult.missingRequiredCount === 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {validationResult.missingRequiredCount}
                </p>
              </div>
            </div>

            <Button variant="secondary" size="sm" onClick={onValidate}>
              Re-validate
            </Button>
          </div>

          {/* Blockers */}
          {blockers.length > 0 && (
            <Alert variant="error">
              <div>
                <p className="font-medium">Cannot submit - please fix the following:</p>
                <ul className="mt-2 list-disc list-inside text-sm">
                  {blockers.map((blocker, i) => (
                    <li key={i}>{blocker}</li>
                  ))}
                </ul>
              </div>
            </Alert>
          )}

          {/* Warnings */}
          {warnings.length > 0 && blockers.length === 0 && (
            <Alert variant="warning">
              <div>
                <p className="font-medium">Review before submitting:</p>
                <ul className="mt-2 list-disc list-inside text-sm">
                  {warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </div>
            </Alert>
          )}

          {/* Errors by Section */}
          {validationResult.errorCount > 0 && (
            <div className="bg-white rounded-lg shadow-card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Validation Errors</h3>

              <div className="space-y-4">
                {Array.from(errorsBySection.entries()).map(([sectionId, errors]) => (
                  <div key={sectionId} className="border border-red-200 rounded-lg overflow-hidden">
                    <div className="bg-red-50 px-4 py-2 flex items-center justify-between">
                      <span className="font-medium text-red-800">{getSectionName(sectionId)}</span>
                      <Badge variant="error">{errors.length} error{errors.length > 1 ? 's' : ''}</Badge>
                    </div>
                    <ul className="divide-y divide-red-100">
                      {errors.map((error, i) => (
                        <li key={i} className="px-4 py-3 flex items-center justify-between hover:bg-red-50">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {error.itemCode}: {error.itemName}
                            </p>
                            <p className="text-sm text-red-600">{error.message}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onFixError(error.itemCode)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Fix
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cross-Validation Errors */}
          {crossValidationErrors.length > 0 && (
            <div className="bg-white rounded-lg shadow-card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Consistency Issues</h3>
              <p className="text-sm text-gray-500 mb-4">
                These are potential inconsistencies between related questions.
              </p>

              <ul className="space-y-3">
                {crossValidationErrors.map((error, i) => (
                  <li
                    key={i}
                    className={`p-3 rounded-lg ${
                      error.severity === 'error' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {error.itemCode}
                          {error.relatedItemCode && (
                            <span className="text-gray-500"> ↔ {error.relatedItemCode}</span>
                          )}
                        </p>
                        <p className={`text-sm ${error.severity === 'error' ? 'text-red-600' : 'text-yellow-700'}`}>
                          {error.message}
                        </p>
                      </div>
                      <Badge variant={error.severity === 'error' ? 'error' : 'warning'}>
                        {error.severity}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Success State */}
          {isReadyForSubmission && (
            <Alert variant="success">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Assessment is ready for submission!</p>
                  <p className="text-sm mt-1">All required fields are complete and no errors found.</p>
                </div>
              </div>
            </Alert>
          )}
        </>
      )}

      {/* Submit Button */}
      <div className="bg-white rounded-lg shadow-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Submit for Review</h3>
            <p className="text-sm text-gray-500">
              {isReadyForSubmission
                ? 'Your assessment is ready to be submitted for supervisor review.'
                : 'Complete validation and fix any errors before submitting.'}
            </p>
          </div>
          <Button
            variant="primary"
            disabled={!isReadyForSubmission || isSubmitting}
            onClick={onSubmit}
          >
            {isSubmitting ? 'Submitting...' : 'Submit for Review'}
          </Button>
        </div>
      </div>
    </div>
  );
}
