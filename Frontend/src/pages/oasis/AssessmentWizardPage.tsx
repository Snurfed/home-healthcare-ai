/**
 * Assessment Wizard Page
 *
 * Multi-step OASIS assessment form
 */

import { useParams, Link } from 'react-router-dom';
import { useAssessment, useQuestions } from '@hooks/index';
import { useAssessmentStore } from '@context/stores/assessmentStore';
import { Button, Spinner, Alert, Badge } from '@components/common';
import { OASIS_SECTIONS, STATUS_CONFIG } from '@typedefs/oasis.types';
import SectionStepper from '@components/oasis/SectionStepper';
import SectionContent from '@components/oasis/SectionContent';

export default function AssessmentWizardPage() {
  const { id } = useParams<{ id: string }>();
  const { data: assessment, isLoading, error } = useAssessment(id);
  // Fetch questions filtered by assessment type for better performance
  const { data: questions, isLoading: questionsLoading, error: questionsError } = useQuestions(
    assessment?.assessmentType ? { assessmentType: assessment.assessmentType } : undefined
  );
  const { currentSectionIndex, isDirty, isSaving, lastSavedAt } = useAssessmentStore();

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
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {isSaving ? (
                <>
                  <Spinner size="sm" />
                  <span>Saving...</span>
                </>
              ) : isDirty ? (
                <span className="text-yellow-600">Unsaved changes</span>
              ) : lastSavedAt ? (
                <span className="text-green-600">
                  Saved {lastSavedAt.toLocaleTimeString()}
                </span>
              ) : null}
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
