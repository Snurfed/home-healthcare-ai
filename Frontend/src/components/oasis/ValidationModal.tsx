/**
 * Validation Modal Component
 *
 * Pre-submission validation modal that checks assessment completeness
 * and displays errors/warnings before allowing submission
 */

import { useEffect } from 'react';
import { useValidateAssessment, useSubmitForReview } from '@hooks/index';
import { Modal, Button, Badge, Spinner, Alert } from '@components/common';
import { OASIS_SECTIONS } from '@typedefs/oasis.types';
import type { ValidationError } from '@typedefs/oasis.types';

interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessmentId: string;
  onFixError: (itemCode: string) => void;
  onSubmitSuccess: () => void;
}

export default function ValidationModal({
  isOpen,
  onClose,
  assessmentId,
  onFixError,
  onSubmitSuccess,
}: ValidationModalProps) {
  const validateMutation = useValidateAssessment(assessmentId);
  const submitMutation = useSubmitForReview(assessmentId);

  // Trigger validation when modal opens
  useEffect(() => {
    if (isOpen && !validateMutation.data && !validateMutation.isLoading) {
      validateMutation.mutate();
    }
  }, [isOpen]);

  // Reset mutations when modal closes
  useEffect(() => {
    if (!isOpen) {
      validateMutation.reset();
      submitMutation.reset();
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    try {
      await submitMutation.mutateAsync({
        attestation: true,
        notes: 'Submitted via validation modal',
      });
      onSubmitSuccess();
    } catch {
      // Error handled by mutation
    }
  };

  const handleFixAndClose = (itemCode: string) => {
    onFixError(itemCode);
    onClose();
  };

  const validation = validateMutation.data;
  const isLoading = validateMutation.isLoading;
  const isError = validateMutation.isError;

  // Group errors by section
  const errorsBySection = new Map<string, ValidationError[]>();
  if (validation?.errors) {
    for (const error of validation.errors) {
      // Determine section from item code prefix
      const section = error.itemCode.startsWith('GG') ? 'functional_abilities' :
        error.itemCode.startsWith('M0') ? 'clinical_record' :
        error.itemCode.startsWith('M1') ? 'patient_history' :
        error.itemCode.startsWith('M2') ? 'medications' :
        'unknown';

      if (!errorsBySection.has(section)) {
        errorsBySection.set(section, []);
      }
      errorsBySection.get(section)!.push(error);
    }
  }

  const getSectionName = (sectionId: string) => {
    return OASIS_SECTIONS.find(s => s.id === sectionId)?.name || sectionId;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Validate & Submit Assessment"
      size="lg"
    >
      <div className="space-y-6">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Spinner size="lg" />
            <p className="mt-4 text-gray-500">Validating assessment...</p>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <Alert variant="error">
            Failed to validate assessment. Please try again.
            <div className="mt-2">
              <Button variant="secondary" size="sm" onClick={() => validateMutation.mutate()}>
                Retry Validation
              </Button>
            </div>
          </Alert>
        )}

        {/* Validation Results */}
        {validation && (
          <>
            {/* Completion Progress */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Completion Progress</span>
                <span className="text-sm font-bold text-gray-900">
                  {validation.completionPercentage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    validation.completionPercentage >= 80 ? 'bg-green-500' :
                    validation.completionPercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${validation.completionPercentage}%` }}
                />
              </div>
              {validation.completionPercentage < 80 && (
                <p className="mt-2 text-sm text-gray-500">
                  Complete at least 80% of the assessment to submit.
                </p>
              )}
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className={`p-4 rounded-lg ${validation.errors.length === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-sm font-medium text-gray-500">Errors</p>
                <p className={`text-2xl font-bold ${validation.errors.length === 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {validation.errors.length}
                </p>
              </div>
              <div className={`p-4 rounded-lg ${validation.warnings.length === 0 ? 'bg-green-50' : 'bg-yellow-50'}`}>
                <p className="text-sm font-medium text-gray-500">Warnings</p>
                <p className={`text-2xl font-bold ${validation.warnings.length === 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {validation.warnings.length}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-blue-50">
                <p className="text-sm font-medium text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-blue-600">
                  {validation.completedItems}
                </p>
              </div>
            </div>

            {/* Errors List */}
            {validation.errors.length > 0 && (
              <div className="border border-red-200 rounded-lg overflow-hidden">
                <div className="bg-red-50 px-4 py-3 border-b border-red-200">
                  <h3 className="font-semibold text-red-800">
                    Errors (must fix before submission)
                  </h3>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-red-100">
                  {Array.from(errorsBySection.entries()).map(([sectionId, errors]) => (
                    <div key={sectionId}>
                      <div className="bg-red-50/50 px-4 py-2">
                        <span className="text-sm font-medium text-red-700">
                          {getSectionName(sectionId)}
                        </span>
                      </div>
                      {errors.map((error, i) => (
                        <div
                          key={i}
                          className="px-4 py-3 flex items-center justify-between hover:bg-red-50"
                        >
                          <div className="flex-1 min-w-0 mr-4">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {error.itemCode}: {error.itemName}
                            </p>
                            <p className="text-sm text-red-600">{error.message}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFixAndClose(error.itemCode)}
                            className="text-red-600 hover:text-red-700 flex-shrink-0"
                          >
                            Fix
                          </Button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings List */}
            {validation.warnings.length > 0 && (
              <div className="border border-yellow-200 rounded-lg overflow-hidden">
                <div className="bg-yellow-50 px-4 py-3 border-b border-yellow-200">
                  <h3 className="font-semibold text-yellow-800">
                    Warnings (review recommended)
                  </h3>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-yellow-100">
                  {validation.warnings.map((warning, i) => (
                    <div
                      key={i}
                      className="px-4 py-3 flex items-center justify-between hover:bg-yellow-50"
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {warning.itemCode}: {warning.itemName}
                        </p>
                        <p className="text-sm text-yellow-700">{warning.message}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFixAndClose(warning.itemCode)}
                        className="text-yellow-600 hover:text-yellow-700 flex-shrink-0"
                      >
                        Review
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ready State */}
            {validation.isValid && validation.canSubmit && (
              <Alert variant="success">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Assessment is ready for submission!</span>
                </div>
              </Alert>
            )}

            {/* Submit Error */}
            {submitMutation.isError && (
              <Alert variant="error">
                Failed to submit assessment: {(submitMutation.error as Error)?.message || 'Unknown error'}
              </Alert>
            )}
          </>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex items-center gap-3">
            {validation && !validation.isValid && (
              <Badge variant="error">
                {validation.errors.length} error{validation.errors.length !== 1 ? 's' : ''} to fix
              </Badge>
            )}
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!validation?.canSubmit || submitMutation.isLoading}
            >
              {submitMutation.isLoading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Submitting...
                </>
              ) : (
                'Submit for Review'
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
