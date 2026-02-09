/**
 * Assessment Wizard Page
 *
 * Multi-step OASIS assessment form with auto-save and validation
 */

import { useCallback, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  useAssessment,
  useQuestions,
  useAutoSave,
  useAssessmentValidation,
  useSubmitForReview,
} from '@hooks/index';
import { useAssessmentStore } from '@context/stores/assessmentStore';
import { Button, Spinner, Alert, Badge } from '@components/common';
import { OASIS_SECTIONS, STATUS_CONFIG } from '@typedefs/oasis.types';
import SectionStepper from '@components/oasis/SectionStepper';
import SectionContent from '@components/oasis/SectionContent';
import SubmissionValidation from '@components/oasis/SubmissionValidation';
import ValidationModal from '@components/oasis/ValidationModal';
import { ReferralUploadButton } from '@components/oasis/ReferralUpload';
import type { ReferralDocument } from '@typedefs/index';

export default function AssessmentWizardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showReview, setShowReview] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);

  const { data: assessment, isLoading, error } = useAssessment(id);
  // Fetch questions filtered by assessment type for better performance
  const { data: questions, isLoading: questionsLoading, error: questionsError } = useQuestions(
    assessment?.assessmentType ? { assessmentType: assessment.assessmentType } : undefined
  );
  const { currentSectionIndex, draftResponses, navigateToSection } = useAssessmentStore();

  // Submit for review mutation
  const submitForReview = useSubmitForReview(id || '');

  // Assessment validation
  const {
    validationResult,
    isReadyForSubmission,
    submissionBlockers,
    submissionWarnings,
    completionPercentage,
    crossValidationErrors,
    validate,
  } = useAssessmentValidation({
    questions: questions || [],
    savedResponses: assessment?.responses,
    draftResponses,
    assessmentType: assessment?.assessmentType,
    startOfCareDate: assessment?.dates?.m0030_startOfCareDate || undefined,
  });

  // Auto-save callback - cache update is handled in useAutoSave
  const handleSaveSuccess = useCallback(() => {
    // Cache is already updated in useAutoSave before drafts are cleared.
    // No query invalidation needed - this was causing stale data to overwrite selections.
  }, []);

  // Handle submission - now opens validation modal instead of direct submit
  const handleSubmit = useCallback(() => {
    setShowValidationModal(true);
  }, []);

  // Handle successful submission from validation modal
  const handleSubmitSuccess = useCallback(() => {
    setShowValidationModal(false);
    navigate(`/assessments/${id}`);
  }, [navigate, id]);

  // Handle referral extraction complete - refresh assessment data
  const handleReferralExtractionComplete = useCallback((document: ReferralDocument) => {
    // The extraction review component will handle applying fields
    // After apply, the assessment cache will be invalidated
    console.log('Referral extraction complete:', document.id);
  }, []);

  // Handle fix error - navigate to the section containing the error
  const handleFixError = useCallback((itemCode: string) => {
    // Find the question and its section
    const question = questions?.find(q => q.itemCode === itemCode);
    if (question) {
      const sectionIndex = OASIS_SECTIONS.findIndex(s => s.id === question.section);
      if (sectionIndex >= 0) {
        navigateToSection(sectionIndex);
        setShowReview(false);
        // Scroll to the question after a brief delay
        setTimeout(() => {
          const element = document.getElementById(`question-${itemCode}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  }, [questions, navigateToSection]);

  const {
    isSaving,
    lastSavedAt,
    saveError,
    saveNow,
    pendingChanges,
  } = useAutoSave({
    assessmentId: id || '',
    enabled: !!id && !!assessment,
    debounceMs: 2000,
    onSaveSuccess: handleSaveSuccess,
  });

  if (isLoading || questionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" label={isLoading ? "Loading assessment..." : "Loading questions..."} />
      </div>
    );
  }

  if (error || !assessment) {
    // Check if this is a 403 forbidden error (access denied)
    const isForbidden = error?.message?.includes('403') ||
                        error?.message?.toLowerCase().includes('access') ||
                        error?.message?.toLowerCase().includes('forbidden');

    return (
      <div className="max-w-2xl mx-auto">
        <Alert
          variant="error"
          title={isForbidden ? "Access Denied" : "Error loading assessment"}
        >
          {isForbidden
            ? "You do not have access to this patient. Please contact your supervisor to be assigned to this patient's care team."
            : (error?.message || 'Assessment not found')
          }
        </Alert>
        <Link to="/assessments" className="mt-4 inline-block">
          <Button variant="secondary">Back to Assessments</Button>
        </Link>
      </div>
    );
  }

  if (questionsError) {
    return (
      <div className="max-w-2xl mx-auto">
        <Alert variant="error" title="Error loading questions">
          {questionsError.message || 'Failed to load OASIS questions'}
        </Alert>
        <Link to="/assessments" className="mt-4 inline-block">
          <Button variant="secondary">Back to Assessments</Button>
        </Link>
      </div>
    );
  }

  const currentSection = OASIS_SECTIONS[currentSectionIndex]!;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">
                {assessment.patient?.firstName} {assessment.patient?.lastName}
              </h1>
              <Badge variant="status" status={assessment.status}>
                {STATUS_CONFIG[assessment.status].label}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">
              MRN: {assessment.patient?.mrn} | Episode #{assessment.episode?.episodeNumber}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <ReferralUploadButton
              patientId={assessment.patientId}
              assessmentId={assessment.id}
              onExtractionComplete={handleReferralExtractionComplete}
            />
          </div>

          <div className="text-right">
            <div className="flex items-center justify-end gap-2 text-sm">
              {isSaving ? (
                <span className="flex items-center gap-2 text-blue-600">
                  <Spinner size="sm" />
                  <span>Saving...</span>
                </span>
              ) : saveError ? (
                <button
                  onClick={() => saveNow()}
                  className="flex items-center gap-1 text-red-600 hover:text-red-700"
                  title={saveError}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Save failed - Click to retry</span>
                </button>
              ) : pendingChanges > 0 ? (
                <span className="flex items-center gap-2 text-yellow-600">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                  </span>
                  <span>Saving in 2s... ({pendingChanges} changes)</span>
                </span>
              ) : lastSavedAt ? (
                <span className="flex items-center gap-1 text-green-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Saved {lastSavedAt.toLocaleTimeString()}</span>
                </span>
              ) : (
                <span className="text-gray-400">Auto-save enabled</span>
              )}
            </div>
            <div className="mt-1">
              <span className="text-sm font-medium">
                {assessment.completionPercentage}% Complete
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all"
              style={{ width: `${assessment.completionPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-6">
        {/* Section Stepper */}
        <div className="hidden lg:block w-72 flex-shrink-0">
          <div className="sticky top-24 space-y-4">
            <SectionStepper
              sections={OASIS_SECTIONS}
              currentIndex={showReview ? -1 : currentSectionIndex}
              assessment={assessment}
              questions={questions || []}
              onSectionClick={() => {
                setShowReview(false);
              }}
            />

            {/* Review & Submit Button */}
            <button
              onClick={() => setShowReview(true)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-colors ${
                showReview
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-medium">Review & Submit</span>
              {isReadyForSubmission && (
                <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Ready
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Section Content or Review */}
        <div className="flex-1 min-w-0">
          {showReview ? (
            <div className="space-y-4">
              {/* Review Header */}
              <div className="bg-white rounded-lg shadow-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Review & Submit</h2>
                    <p className="text-gray-500">
                      Validate your assessment and submit for supervisor review
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => setShowReview(false)}
                  >
                    Back to Editing
                  </Button>
                </div>
              </div>

              {/* Submission Validation */}
              <SubmissionValidation
                validationResult={validationResult}
                completionPercentage={completionPercentage}
                isReadyForSubmission={isReadyForSubmission}
                blockers={submissionBlockers}
                warnings={submissionWarnings}
                crossValidationErrors={crossValidationErrors}
                onValidate={validate}
                onSubmit={handleSubmit}
                onFixError={handleFixError}
                isSubmitting={submitForReview.isLoading}
              />

              {/* Submission Error */}
              {submitForReview.isError && (
                <Alert variant="error">
                  Failed to submit assessment: {(submitForReview.error as Error)?.message || 'Unknown error'}
                </Alert>
              )}
            </div>
          ) : (
            <SectionContent
              section={currentSection}
              assessment={assessment}
              questions={questions || []}
            />
          )}
        </div>
      </div>

      {/* Mobile Review Button */}
      <div className="lg:hidden fixed bottom-4 right-4">
        <button
          onClick={() => setShowReview(true)}
          className="flex items-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Review</span>
        </button>
      </div>

      {/* Validation Modal */}
      <ValidationModal
        isOpen={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        assessmentId={id || ''}
        onFixError={handleFixError}
        onSubmitSuccess={handleSubmitSuccess}
      />
    </div>
  );
}
