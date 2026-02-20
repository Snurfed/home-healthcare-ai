/**
 * VisitNoteForm Component
 *
 * Main form component for visit documentation.
 * Dynamically renders sections based on discipline and visit purpose.
 */

import { useCallback, useMemo } from 'react';
import { Alert, Spinner, Button } from '@components/common';
import VisitNoteSection from './VisitNoteSection';
import { useVisitNoteStore } from '@context/stores/visitNoteStore';
import { useVisitNote } from '@hooks/useVisitNote';
import { DISCIPLINE_LABELS, VISIT_PURPOSE_LABELS } from '@constants/visitFormConfig';
import type { Discipline, VisitPurpose, VisitNoteResponse } from '@typedefs/index';

interface VisitNoteFormProps {
  visitId: string;
  patientId: string;
  episodeId: string;
  discipline: Discipline;
  visitPurpose: VisitPurpose;
  onComplete?: () => void;
  onOasisRequired?: () => void;
}

// Icons
const SaveIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
    />
  </svg>
);

const ClipboardCheckIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
);

export default function VisitNoteForm({
  visitId,
  patientId,
  episodeId,
  discipline,
  visitPurpose,
  onComplete,
  onOasisRequired,
}: VisitNoteFormProps) {
  // Store state
  const {
    formConfig,
    responses,
    vitalSigns,
    status,
    error,
    activeSectionId,
    sectionProgress,
    isDirty,
    lastSavedAt,
    setResponse,
    setVitalSigns,
    setActiveSectionId,
  } = useVisitNoteStore();

  // Get wounds separately for passing to sections
  const wounds = useVisitNoteStore((state) => state.wounds);

  // Hook for data fetching and mutations
  const {
    isLoading,
    error: fetchError,
    autoSave,
    generateAIDraft,
    isGeneratingDraft,
  } = useVisitNote({
    visitId,
    patientId,
    episodeId,
    discipline,
    visitPurpose,
  });

  // Calculate total progress
  const totalProgress = useMemo(() => {
    let total = 0;
    let completed = 0;
    let required = 0;
    let requiredCompleted = 0;

    for (const progress of Object.values(sectionProgress)) {
      total += progress.totalQuestions;
      completed += progress.completedQuestions;
      required += progress.requiredQuestions;
      requiredCompleted += progress.requiredCompleted;
    }

    const percentage = required > 0 ? Math.round((requiredCompleted / required) * 100) : 0;
    const isComplete = requiredCompleted >= required;

    return { total, completed, required, requiredCompleted, percentage, isComplete };
  }, [sectionProgress]);

  // Handle response change
  const handleResponseChange = useCallback(
    (questionCode: string, value: unknown, source: VisitNoteResponse['source'] = 'manual') => {
      setResponse(questionCode, value, source);
    },
    [setResponse]
  );

  // Handle AI draft generation
  const handleGenerateAIDraft = useCallback(
    async (sectionId: string, questionCodes?: string[]) => {
      await generateAIDraft(sectionId, questionCodes);
    },
    [generateAIDraft]
  );

  // Scroll to section
  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setActiveSectionId(sectionId);
  }, [setActiveSectionId]);

  // Loading state
  if (isLoading || status === 'loading') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Loading visit note...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (fetchError || error) {
    const errorMessage = fetchError instanceof Error ? fetchError.message : (error || 'An unexpected error occurred');
    return (
      <Alert variant="error" title="Error loading visit note">
        {errorMessage}
      </Alert>
    );
  }

  // No config state
  if (!formConfig) {
    return (
      <Alert variant="warning" title="Form not available">
        No form configuration found for {DISCIPLINE_LABELS[discipline]} - {VISIT_PURPOSE_LABELS[visitPurpose]}
      </Alert>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Main Form Content */}
      <div className="flex-1 space-y-4">
        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {DISCIPLINE_LABELS[discipline]} - {VISIT_PURPOSE_LABELS[visitPurpose]}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Complete all required sections to finalize the visit note
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Save status */}
              <div className="text-sm">
                {autoSave.isSaving ? (
                  <span className="flex items-center gap-1.5 text-blue-600">
                    <Spinner size="sm" />
                    Saving...
                  </span>
                ) : isDirty ? (
                  <span className="text-orange-600">Unsaved changes</span>
                ) : lastSavedAt ? (
                  <span className="text-green-600">
                    Saved {lastSavedAt.toLocaleTimeString()}
                  </span>
                ) : null}
              </div>
              {/* Manual save button */}
              {isDirty && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => autoSave.saveNow()}
                  disabled={autoSave.isSaving}
                >
                  <SaveIcon className="w-4 h-4 mr-1" />
                  Save
                </Button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-600">Progress</span>
              <span className="font-medium">
                {totalProgress.requiredCompleted}/{totalProgress.required} required
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  totalProgress.isComplete ? 'bg-green-500' : 'bg-primary-600'
                }`}
                style={{ width: `${totalProgress.percentage}%` }}
              />
            </div>
          </div>

          {/* OASIS Required Banner */}
          {formConfig.requiresOasis && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheckIcon className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-blue-800">
                  This visit requires an OASIS assessment
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={onOasisRequired}
              >
                Open OASIS
              </Button>
            </div>
          )}
        </div>

        {/* Form Sections */}
        <div className="space-y-4">
          {formConfig.sections.map((section, index) => (
            <div key={section.id} id={`section-${section.id}`}>
              <VisitNoteSection
                section={section}
                responses={responses}
                onChange={handleResponseChange}
                onGenerateAIDraft={handleGenerateAIDraft}
                disabled={false}
                defaultExpanded={index < 2} // First two sections expanded by default
                vitalSigns={section.questions.some((q) => q.responseType === 'vitals') ? vitalSigns : undefined}
                onVitalSignsChange={section.questions.some((q) => q.responseType === 'vitals') ? setVitalSigns : undefined}
                wounds={wounds}
              />
            </div>
          ))}
        </div>

        {/* Complete Button */}
        {totalProgress.isComplete && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-green-800">All required fields complete</p>
              <p className="text-sm text-green-600 mt-0.5">
                You can now finalize this visit note
              </p>
            </div>
            <Button
              variant="primary"
              onClick={onComplete}
              disabled={autoSave.isSaving}
            >
              Finalize Visit Note
            </Button>
          </div>
        )}
      </div>

      {/* Section Navigation Sidebar */}
      <div className="lg:w-64 flex-shrink-0">
        <div className="sticky top-4 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Sections</h3>
          <nav className="space-y-1">
            {formConfig.sections.map((section) => {
              const progress = sectionProgress[section.id];
              const isActive = activeSectionId === section.id;
              const isComplete = progress?.isComplete ?? false;

              return (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-sm
                    transition-colors
                    ${isActive ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'}
                  `}
                >
                  <div className="flex items-center gap-2">
                    {isComplete ? (
                      <svg
                        className="w-4 h-4 text-green-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                    )}
                    <span className={isComplete ? 'text-gray-600' : 'text-gray-900'}>
                      {section.name}
                    </span>
                  </div>
                  {progress && (
                    <span className="text-xs text-gray-500">
                      {progress.completedQuestions}/{progress.totalQuestions}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* AI Draft All Button */}
          {formConfig.sections.some((s) => s.aiDraftEnabled) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => {
                  // Generate drafts for all AI-enabled sections
                  const aiSections = formConfig.sections.filter((s) => s.aiDraftEnabled);
                  for (const section of aiSections) {
                    handleGenerateAIDraft(section.id);
                  }
                }}
                disabled={isGeneratingDraft}
              >
                {isGeneratingDraft ? (
                  <>
                    <Spinner size="sm" />
                    <span className="ml-1">Generating...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                      />
                    </svg>
                    Draft All with AI
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
