/**
 * Visit Note Store
 *
 * State management for the visit note documentation form.
 * Tracks responses, completion status, and form state.
 */

import { create } from 'zustand';
import type {
  Discipline,
  VisitPurpose,
  VisitNoteResponse,
  VisitNoteSectionProgress,
  VitalSigns,
  WoundAssessment,
  VisitFormConfig,
} from '@typedefs/index';
import { getVisitFormConfig, calculateSectionCompletion } from '@constants/visitFormConfig';

// =============================================================================
// TYPES
// =============================================================================

export type VisitNoteFormStatus = 'loading' | 'ready' | 'saving' | 'error';

interface VisitNoteStoreState {
  // Current visit context
  visitId: string | null;
  patientId: string | null;
  episodeId: string | null;
  discipline: Discipline | null;
  visitPurpose: VisitPurpose | null;

  // Form configuration
  formConfig: VisitFormConfig | null;

  // Form data
  responses: Record<string, VisitNoteResponse>;
  vitalSigns: VitalSigns;
  wounds: WoundAssessment[];
  visitDate: string | null;
  timeIn: string | null;
  timeOut: string | null;

  // UI state
  status: VisitNoteFormStatus;
  error: string | null;
  activeSectionId: string | null;
  sectionProgress: Record<string, VisitNoteSectionProgress>;
  isDirty: boolean;
  lastSavedAt: Date | null;

  // Actions
  initializeForm: (params: {
    visitId: string;
    patientId: string;
    episodeId: string;
    discipline: Discipline;
    visitPurpose: VisitPurpose;
    existingResponses?: Record<string, VisitNoteResponse>;
    existingVitals?: VitalSigns;
    existingWounds?: WoundAssessment[];
    visitDate?: string;
    timeIn?: string;
    timeOut?: string;
  }) => void;

  // Response management
  setResponse: (
    questionCode: string,
    value: unknown,
    source?: VisitNoteResponse['source']
  ) => void;
  setBulkResponses: (responses: Record<string, Partial<VisitNoteResponse>>) => void;
  clearResponse: (questionCode: string) => void;

  // Vitals management
  setVitalSigns: (vitals: VitalSigns) => void;
  updateVitalSign: (field: keyof VitalSigns, value: unknown) => void;

  // Wound management
  addWound: (wound: WoundAssessment) => void;
  updateWound: (index: number, wound: WoundAssessment) => void;
  removeWound: (index: number) => void;

  // Visit timing
  setVisitDate: (date: string) => void;
  setTimeIn: (time: string) => void;
  setTimeOut: (time: string) => void;

  // UI state
  setActiveSectionId: (sectionId: string | null) => void;
  setStatus: (status: VisitNoteFormStatus) => void;
  setError: (error: string | null) => void;
  markSaved: () => void;

  // Progress calculation
  updateSectionProgress: () => void;
  getTotalProgress: () => { total: number; completed: number; required: number; requiredCompleted: number };

  // Reset
  resetForm: () => void;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialVitalSigns: VitalSigns = {
  temperatureUnit: 'F',
  weightUnit: 'lbs',
  oxygenSaturationOnRoom: true,
};

const initialState = {
  visitId: null,
  patientId: null,
  episodeId: null,
  discipline: null,
  visitPurpose: null,
  formConfig: null,
  responses: {},
  vitalSigns: initialVitalSigns,
  wounds: [],
  visitDate: null,
  timeIn: null,
  timeOut: null,
  status: 'loading' as VisitNoteFormStatus,
  error: null,
  activeSectionId: null,
  sectionProgress: {},
  isDirty: false,
  lastSavedAt: null,
};

// =============================================================================
// STORE
// =============================================================================

export const useVisitNoteStore = create<VisitNoteStoreState>()((set, get) => ({
  ...initialState,

  // Initialize form with visit context
  initializeForm: (params) => {
    const {
      visitId,
      patientId,
      episodeId,
      discipline,
      visitPurpose,
      existingResponses,
      existingVitals,
      existingWounds,
      visitDate,
      timeIn,
      timeOut,
    } = params;

    const formConfig = getVisitFormConfig(discipline, visitPurpose);

    if (!formConfig) {
      set({
        ...initialState,
        status: 'error',
        error: `No form configuration found for ${discipline} ${visitPurpose}`,
      });
      return;
    }

    // Set initial active section to first section
    const firstSectionId = formConfig.sections[0]?.id || null;

    set({
      visitId,
      patientId,
      episodeId,
      discipline,
      visitPurpose,
      formConfig,
      responses: existingResponses || {},
      vitalSigns: existingVitals || initialVitalSigns,
      wounds: existingWounds || [],
      visitDate: visitDate || new Date().toISOString().split('T')[0],
      timeIn: timeIn || null,
      timeOut: timeOut || null,
      status: 'ready',
      error: null,
      activeSectionId: firstSectionId,
      isDirty: false,
      lastSavedAt: null,
    });

    // Calculate initial section progress
    get().updateSectionProgress();
  },

  // Set a single response
  setResponse: (questionCode, value, source = 'manual') => {
    const now = new Date().toISOString();

    set((state) => ({
      responses: {
        ...state.responses,
        [questionCode]: {
          questionCode,
          value: value as VisitNoteResponse['value'],
          source,
          updatedAt: now,
          updatedBy: 'current_user', // Would be populated from auth context
        },
      },
      isDirty: true,
    }));

    // Update progress after setting response
    get().updateSectionProgress();
  },

  // Set multiple responses at once (e.g., from AI draft)
  setBulkResponses: (responses) => {
    const now = new Date().toISOString();
    const updatedResponses: Record<string, VisitNoteResponse> = {};

    for (const [questionCode, partial] of Object.entries(responses)) {
      updatedResponses[questionCode] = {
        questionCode,
        value: partial.value as VisitNoteResponse['value'],
        source: partial.source || 'manual',
        aiConfidence: partial.aiConfidence,
        updatedAt: now,
        updatedBy: 'current_user',
      };
    }

    set((state) => ({
      responses: {
        ...state.responses,
        ...updatedResponses,
      },
      isDirty: true,
    }));

    get().updateSectionProgress();
  },

  // Clear a response
  clearResponse: (questionCode) => {
    set((state) => {
      const newResponses = { ...state.responses };
      delete newResponses[questionCode];
      return { responses: newResponses, isDirty: true };
    });

    get().updateSectionProgress();
  },

  // Set all vital signs
  setVitalSigns: (vitals) => {
    set({ vitalSigns: vitals, isDirty: true });
    get().updateSectionProgress();
  },

  // Update a single vital sign
  updateVitalSign: (field, value) => {
    set((state) => ({
      vitalSigns: {
        ...state.vitalSigns,
        [field]: value,
      },
      isDirty: true,
    }));
    get().updateSectionProgress();
  },

  // Wound management
  addWound: (wound) => {
    set((state) => ({
      wounds: [...state.wounds, wound],
      isDirty: true,
    }));
  },

  updateWound: (index, wound) => {
    set((state) => {
      const newWounds = [...state.wounds];
      newWounds[index] = wound;
      return { wounds: newWounds, isDirty: true };
    });
  },

  removeWound: (index) => {
    set((state) => ({
      wounds: state.wounds.filter((_, i) => i !== index),
      isDirty: true,
    }));
  },

  // Visit timing
  setVisitDate: (date) => set({ visitDate: date, isDirty: true }),
  setTimeIn: (time) => set({ timeIn: time, isDirty: true }),
  setTimeOut: (time) => set({ timeOut: time, isDirty: true }),

  // UI state
  setActiveSectionId: (sectionId) => set({ activeSectionId: sectionId }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: error ? 'error' : 'ready' }),

  // Mark as saved
  markSaved: () => set({ isDirty: false, lastSavedAt: new Date() }),

  // Update section progress
  updateSectionProgress: () => {
    const { formConfig, responses } = get();
    if (!formConfig) return;

    const sectionProgress: Record<string, VisitNoteSectionProgress> = {};

    for (const section of formConfig.sections) {
      // Convert responses to simple key-value for calculation
      const responseValues: Record<string, unknown> = {};
      for (const [code, response] of Object.entries(responses)) {
        responseValues[code] = response.value;
      }

      const progress = calculateSectionCompletion(section, responseValues);

      sectionProgress[section.id] = {
        sectionId: section.id,
        totalQuestions: progress.total,
        completedQuestions: progress.completed,
        requiredQuestions: progress.required,
        requiredCompleted: progress.requiredCompleted,
        isComplete: progress.requiredCompleted >= progress.required,
      };
    }

    set({ sectionProgress });
  },

  // Get total progress across all sections
  getTotalProgress: () => {
    const { sectionProgress } = get();
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

    return { total, completed, required, requiredCompleted };
  },

  // Reset form
  resetForm: () => {
    set(initialState);
  },
}));
