/**
 * Assessment Wizard Page
 *
 * Multi-step OASIS assessment form with auto-save
 */

import { useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQueryClient } from 'react-query';
import { useAssessment, useQuestions, useAutoSave } from '@hooks/index';
import { useAssessmentStore } from '@context/stores/assessmentStore';
import { queryKeys } from '@context/QueryProvider';
import { Button, Spinner, Alert, Badge } from '@components/common';
import { OASIS_SECTIONS, STATUS_CONFIG } from '@typedefs/oasis.types';
import SectionStepper from '@components/oasis/SectionStepper';
import SectionContent from '@components/oasis/SectionContent';

export default function AssessmentWizardPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: assessment, isLoading, error } = useAssessment(id);
  // Fetch questions filtered by assessment type for better performance
  const { data: questions, isLoading: questionsLoading, error: questionsError } = useQuestions(
    assessment?.assessmentType ? { assessmentType: assessment.assessmentType } : undefined
  );
  const { currentSectionIndex } = useAssessmentStore();

  // Auto-save with 2 second debounce
  const handleSaveSuccess = useCallback(() => {
    // Invalidate assessment query to refresh completion percentage
    if (id) {
      queryClient.invalidateQueries(queryKeys.assessments.detail(id));
    }
  }, [id, queryClient]);

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
    return (
      <div className="max-w-2xl mx-auto">
        <Alert variant="error" title="Error loading assessment">
          {error?.message || 'Assessment not found'}
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
          <SectionStepper
            sections={OASIS_SECTIONS}
            currentIndex={currentSectionIndex}
            assessment={assessment}
            questions={questions || []}
          />
        </div>

        {/* Section Content */}
        <div className="flex-1 min-w-0">
          <SectionContent
            section={currentSection}
            assessment={assessment}
            questions={questions || []}
          />
        </div>
      </div>
    </div>
  );
}
