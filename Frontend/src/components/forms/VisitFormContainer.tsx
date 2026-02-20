/**
 * Visit Form Container
 *
 * Main container component for visit documentation forms.
 * Integrates with form engine API and manages form state.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useVisitForm, useSaveResponses, useToggleModule } from '@hooks/queries/useFormEngine';
import FormSection from './FormSection';
import ModuleToggles from './ModuleToggles';
import FormProgressSidebar from './FormProgressSidebar';
import type {
  Discipline,
  VisitType,
  CanonicalValue,
  CanonicalResponse,
  BuiltSection,
} from '@typedefs/index';

// =============================================================================
// TYPES
// =============================================================================

interface VisitFormContainerProps {
  visitId: string;
  discipline?: Discipline;
  visitType?: VisitType;
  onSaveSuccess?: () => void;
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
  autoSave?: boolean;
  autoSaveDelay?: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function VisitFormContainer({
  visitId,
  discipline,
  visitType,
  onSaveSuccess,
  onValidationChange,
  autoSave = true,
  autoSaveDelay = 2000,
}: VisitFormContainerProps) {
  // Local state for responses (optimistic updates)
  const [localResponses, setLocalResponses] = useState<Record<string, CanonicalValue>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState<string | null>(null);

  // Fetch form data
  const {
    data: formData,
    isLoading,
    error,
    refetch,
  } = useVisitForm(visitId, {
    discipline,
    visitType,
    enabled: !!visitId,
  });

  // Save mutation
  const saveResponses = useSaveResponses(visitId);

  // Module toggle mutation
  const toggleModule = useToggleModule(visitId);

  // Initialize local responses from fetched data
  useEffect(() => {
    if (formData?.visitNote?.responses) {
      const initialResponses: Record<string, CanonicalValue> = {};
      for (const [conceptId, response] of Object.entries(formData.visitNote.responses)) {
        initialResponses[conceptId] = (response as CanonicalResponse).value;
      }
      setLocalResponses(initialResponses);
    }
  }, [formData?.visitNote?.responses]);

  // Set initial active section
  useEffect(() => {
    if (formData?.form?.sections && !activeSection) {
      const firstSection = formData.form.sections.find((s: BuiltSection) => s.visible);
      if (firstSection) {
        setActiveSection(firstSection.sectionId);
      }
    }
  }, [formData?.form?.sections, activeSection]);

  // Report validation changes
  useEffect(() => {
    if (formData?.form?.validationState && onValidationChange) {
      onValidationChange(
        formData.form.validationState.isValid,
        formData.form.validationState.errors.map((e) => e.message)
      );
    }
  }, [formData?.form?.validationState, onValidationChange]);

  // Auto-save effect
  useEffect(() => {
    if (!autoSave || !isDirty || saveResponses.isLoading) {
      return;
    }

    const timer = setTimeout(() => {
      handleSave();
    }, autoSaveDelay);

    return () => clearTimeout(timer);
  }, [autoSave, isDirty, autoSaveDelay, localResponses]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle response change
  const handleResponseChange = useCallback((conceptId: string, value: CanonicalValue) => {
    setLocalResponses((prev) => ({
      ...prev,
      [conceptId]: value,
    }));
    setIsDirty(true);
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!visitId || Object.keys(localResponses).length === 0) {
      return;
    }

    try {
      const responsesToSave: Record<string, { value: unknown; source: CanonicalResponse['source'] }> = {};

      for (const [conceptId, value] of Object.entries(localResponses)) {
        responsesToSave[conceptId] = {
          value,
          source: 'manual',
        };
      }

      await saveResponses.mutateAsync({
        responses: responsesToSave,
        activeModules: formData?.form?.activeModules,
      });

      setIsDirty(false);
      setLastSavedAt(new Date());
      onSaveSuccess?.();
    } catch (error) {
      console.error('Failed to save responses:', error);
    }
  }, [visitId, localResponses, formData?.form?.activeModules, saveResponses, onSaveSuccess]);

  // Handle module toggle
  const handleModuleToggle = useCallback(
    async (moduleId: string, active: boolean) => {
      try {
        await toggleModule.mutateAsync({ moduleId, active });
        refetch();
      } catch (error) {
        console.error('Failed to toggle module:', error);
      }
    },
    [toggleModule, refetch]
  );

  // Handle AI draft generation
  const handleGenerateAIDraft = useCallback(async (sectionId: string) => {
    setIsGeneratingDraft(sectionId);
    try {
      // TODO: Implement AI draft generation API call
      // For now, just simulate a delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log('AI draft requested for section:', sectionId);
    } catch (error) {
      console.error('Failed to generate AI draft:', error);
    } finally {
      setIsGeneratingDraft(null);
    }
  }, []);

  // Handle section navigation
  const handleSectionClick = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(`section-${sectionId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    if (!formData?.form?.sections) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    let totalQuestions = 0;
    let completedQuestions = 0;

    for (const section of formData.form.sections) {
      if (!section.visible) continue;

      for (const question of section.questions) {
        if (!question.visible) continue;
        totalQuestions++;

        const value = localResponses[question.conceptId];
        if (value !== null && value !== undefined && value !== '' &&
            !(Array.isArray(value) && value.length === 0)) {
          completedQuestions++;
        }
      }
    }

    return {
      completed: completedQuestions,
      total: totalQuestions,
      percentage: totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0,
    };
  }, [formData?.form?.sections, localResponses]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-600">Loading form...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 font-medium mb-2">Failed to load form</div>
        <p className="text-gray-600 mb-4">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // No form data
  if (!formData?.form) {
    return (
      <div className="p-8 text-center text-gray-600">
        No form configuration found for this visit type.
      </div>
    );
  }

  const { form } = formData;

  return (
    <div className="flex gap-6">
      {/* Main Form Content */}
      <div className="flex-1 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{form.definition.name}</h1>
            <p className="text-gray-600">
              {form.definition.discipline} - {form.definition.visitType}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Save status */}
            <div className="text-sm text-gray-500">
              {saveResponses.isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                  Saving...
                </span>
              ) : isDirty ? (
                <span className="text-yellow-600">Unsaved changes</span>
              ) : lastSavedAt ? (
                <span className="text-green-600">
                  Saved {lastSavedAt.toLocaleTimeString()}
                </span>
              ) : null}
            </div>

            {/* Manual save button */}
            <button
              onClick={handleSave}
              disabled={!isDirty || saveResponses.isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>

        {/* OASIS Banner */}
        {form.requiresOasis && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-medium text-blue-800">
                This visit type requires OASIS assessment completion
              </span>
            </div>
          </div>
        )}

        {/* Module Toggles */}
        {form.definition.moduleToggles && form.definition.moduleToggles.length > 0 && (
          <ModuleToggles
            modules={form.definition.moduleToggles}
            activeModules={form.activeModules}
            onToggle={handleModuleToggle}
            disabled={toggleModule.isLoading}
          />
        )}

        {/* Form Sections */}
        <div className="space-y-4">
          {form.sections
            .filter((section: BuiltSection) => section.visible)
            .map((section: BuiltSection) => (
              <FormSection
                key={section.sectionId}
                section={section}
                responses={localResponses}
                onResponseChange={handleResponseChange}
                onGenerateAIDraft={
                  section.aiDraftEnabled ? handleGenerateAIDraft : undefined
                }
                isGeneratingDraft={isGeneratingDraft === section.sectionId}
                disabled={saveResponses.isLoading}
              />
            ))}
        </div>
      </div>

      {/* Progress Sidebar */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-4">
          <FormProgressSidebar
            sections={form.sections}
            responses={localResponses}
            activeSection={activeSection}
            onSectionClick={handleSectionClick}
            overallProgress={overallProgress}
            validationState={form.validationState}
          />
        </div>
      </div>
    </div>
  );
}
