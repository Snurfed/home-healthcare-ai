/**
 * Assessment Store
 *
 * Zustand store for managing current assessment state
 */

import { create } from 'zustand';
import type {
  OASISAssessment,
  OASISResponse,
  OASISSectionId,
  ValidationError,
  SectionProgress,
} from '@typedefs/index';
import { OASIS_SECTIONS } from '@typedefs/oasis.types';

interface AssessmentState {
  // Current assessment
  currentAssessment: OASISAssessment | null;

  // Draft responses (unsaved changes)
  draftResponses: Record<string, Partial<OASISResponse>>;

  // Navigation
  currentSectionIndex: number;

  // Validation
  validationErrors: ValidationError[];

  // Save status
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  saveError: string | null;

  // Actions
  setAssessment: (assessment: OASISAssessment) => void;
  clearAssessment: () => void;
  updateResponse: (itemCode: string, response: Partial<OASISResponse>) => void;
  updateResponses: (responses: Record<string, Partial<OASISResponse>>) => void;
  setDraftResponses: (responses: Record<string, Partial<OASISResponse>>) => void;
  clearDraftResponses: () => void;
  navigateToSection: (index: number) => void;
  nextSection: () => void;
  previousSection: () => void;
  setValidationErrors: (errors: ValidationError[]) => void;
  clearValidationErrors: () => void;
  setSaving: (isSaving: boolean) => void;
  markSaved: () => void;
  setSaveError: (error: string | null) => void;
  getSectionProgress: () => SectionProgress[];
  getCurrentSection: () => OASISSectionId;
  getResponseValue: (itemCode: string) => Partial<OASISResponse> | undefined;
}

export const useAssessmentStore = create<AssessmentState>()((set, get) => ({
  // Initial state
  currentAssessment: null,
  draftResponses: {},
  currentSectionIndex: 0,
  validationErrors: [],
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  saveError: null,

  // Set assessment
  setAssessment: (assessment: OASISAssessment) => {
    set({
      currentAssessment: assessment,
      draftResponses: {},
      validationErrors: assessment.validationErrors || [],
      isDirty: false,
      lastSavedAt: new Date(),
    });
  },

  // Clear assessment
  clearAssessment: () => {
    set({
      currentAssessment: null,
      draftResponses: {},
      currentSectionIndex: 0,
      validationErrors: [],
      isDirty: false,
      isSaving: false,
      lastSavedAt: null,
      saveError: null,
    });
  },

  // Update single response
  updateResponse: (itemCode: string, response: Partial<OASISResponse>) => {
    set((state) => ({
      draftResponses: {
        ...state.draftResponses,
        [itemCode]: {
          ...state.draftResponses[itemCode],
          ...response,
          itemCode,
        },
      },
      isDirty: true,
    }));
  },

  // Update multiple responses
  updateResponses: (responses: Record<string, Partial<OASISResponse>>) => {
    set((state) => ({
      draftResponses: {
        ...state.draftResponses,
        ...responses,
      },
      isDirty: true,
    }));
  },

  // Set draft responses (replace all)
  setDraftResponses: (responses: Record<string, Partial<OASISResponse>>) => {
    set({
      draftResponses: responses,
      isDirty: Object.keys(responses).length > 0,
    });
  },

  // Clear draft responses
  clearDraftResponses: () => {
    set({
      draftResponses: {},
      isDirty: false,
    });
  },

  // Navigate to section
  navigateToSection: (index: number) => {
    const maxIndex = OASIS_SECTIONS.length - 1;
    const newIndex = Math.max(0, Math.min(index, maxIndex));
    set({ currentSectionIndex: newIndex });
  },

  // Next section
  nextSection: () => {
    const { currentSectionIndex } = get();
    const maxIndex = OASIS_SECTIONS.length - 1;
    if (currentSectionIndex < maxIndex) {
      set({ currentSectionIndex: currentSectionIndex + 1 });
    }
  },

  // Previous section
  previousSection: () => {
    const { currentSectionIndex } = get();
    if (currentSectionIndex > 0) {
      set({ currentSectionIndex: currentSectionIndex - 1 });
    }
  },

  // Set validation errors
  setValidationErrors: (errors: ValidationError[]) => {
    set({ validationErrors: errors });
  },

  // Clear validation errors
  clearValidationErrors: () => {
    set({ validationErrors: [] });
  },

  // Set saving state
  setSaving: (isSaving: boolean) => {
    set({ isSaving, saveError: null });
  },

  // Mark as saved
  markSaved: () => {
    set({
      isDirty: false,
      isSaving: false,
      lastSavedAt: new Date(),
      saveError: null,
    });
  },

  // Set save error
  setSaveError: (error: string | null) => {
    set({ saveError: error, isSaving: false });
  },

  // Get section progress
  getSectionProgress: (): SectionProgress[] => {
    const { currentAssessment, draftResponses, validationErrors } = get();
    const responses = currentAssessment?.responses || {};

    return OASIS_SECTIONS.map((section) => {
      // Count answered questions for this section
      const sectionResponses = Object.entries({ ...responses, ...draftResponses })
        .filter(([_code]) => {
          // Match item codes to sections (simplified - in production would use question library)
          // M0xxx items are in clinical_record, patient_tracking, patient_history
          // GGxxxx items are in functional_abilities
          // etc.
          return true; // Would implement proper section matching
        });

      const sectionErrors = validationErrors.filter((_err) => {
        // Would match error itemCodes to section
        return true;
      });

      return {
        sectionId: section.id,
        totalQuestions: section.requiredItems,
        answeredQuestions: sectionResponses.length,
        hasErrors: sectionErrors.some((e) => e.severity === 'error'),
        isComplete: sectionResponses.length >= section.requiredItems,
      };
    });
  },

  // Get current section
  getCurrentSection: (): OASISSectionId => {
    const { currentSectionIndex } = get();
    return OASIS_SECTIONS[currentSectionIndex]?.id || 'clinical_record';
  },

  // Get response value (merged from assessment and draft)
  getResponseValue: (itemCode: string): Partial<OASISResponse> | undefined => {
    const { currentAssessment, draftResponses } = get();
    const savedResponse = currentAssessment?.responses?.[itemCode];
    const draftResponse = draftResponses[itemCode];

    if (draftResponse) {
      return { ...savedResponse, ...draftResponse };
    }
    return savedResponse;
  },
}));

export default useAssessmentStore;
