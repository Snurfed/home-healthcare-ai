/**
 * Episode Store
 *
 * State management for the 3-step episode workflow:
 * Prepare → Visit → Documentation
 */

import { create } from 'zustand';

export type EpisodeTab = 'prepare' | 'visit' | 'documentation';
export type SectionFilter = 'all' | 'remaining' | 'required';
export type VisitType = 'SOC' | 'ROC' | 'RECERT' | 'FOLLOWUP' | 'DISCHARGE';

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  SOC: 'Start of Care',
  ROC: 'Resumption of Care',
  RECERT: 'Recertification',
  FOLLOWUP: 'Follow-up Visit',
  DISCHARGE: 'Discharge',
};

export interface EpisodeSection {
  id: string;
  name: string;
  icon?: string;
  questionCount: number;
  completedCount: number;
  requiredCount: number;
  requiredCompletedCount: number;
}

interface EpisodeState {
  // Current patient/episode
  currentPatientId: string | null;
  currentEpisodeId: string | null;
  currentVisitType: VisitType | null;

  // Tab navigation
  activeTab: EpisodeTab;
  setActiveTab: (tab: EpisodeTab) => void;

  // Section navigation
  activeSectionId: string | null;
  setActiveSectionId: (id: string | null) => void;
  sectionFilter: SectionFilter;
  setSectionFilter: (filter: SectionFilter) => void;

  // Completion tracking
  sectionCompletion: Record<string, EpisodeSection>;
  updateSectionCompletion: (sectionId: string, data: Partial<EpisodeSection>) => void;

  // Card visibility
  hideCompletedCards: boolean;
  setHideCompletedCards: (hide: boolean) => void;

  // Recording state
  isRecording: boolean;
  recordingDuration: number;
  setIsRecording: (recording: boolean) => void;
  setRecordingDuration: (duration: number) => void;

  // Sidebar visibility (mobile)
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Load episode
  loadEpisode: (patientId: string, episodeId: string, visitType?: VisitType) => void;
  setVisitType: (visitType: VisitType) => void;
  clearEpisode: () => void;
}

export const useEpisodeStore = create<EpisodeState>()((set) => ({
  // Initial state
  currentPatientId: null,
  currentEpisodeId: null,
  currentVisitType: null,
  activeTab: 'prepare',
  activeSectionId: null,
  sectionFilter: 'all',
  sectionCompletion: {},
  hideCompletedCards: false,
  isRecording: false,
  recordingDuration: 0,
  sidebarOpen: false,

  // Tab navigation
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Section navigation
  setActiveSectionId: (id) => set({ activeSectionId: id }),
  setSectionFilter: (filter) => set({ sectionFilter: filter }),

  // Completion tracking
  updateSectionCompletion: (sectionId, data) =>
    set((state) => ({
      sectionCompletion: {
        ...state.sectionCompletion,
        [sectionId]: {
          ...state.sectionCompletion[sectionId],
          ...data,
        } as EpisodeSection,
      },
    })),

  // Card visibility
  setHideCompletedCards: (hide) => set({ hideCompletedCards: hide }),

  // Recording state
  setIsRecording: (recording) => set({ isRecording: recording }),
  setRecordingDuration: (duration) => set({ recordingDuration: duration }),

  // Sidebar
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Episode management
  loadEpisode: (patientId, episodeId, visitType) =>
    set({
      currentPatientId: patientId,
      currentEpisodeId: episodeId,
      currentVisitType: visitType || null,
      activeTab: 'prepare',
      activeSectionId: null,
      sectionCompletion: {},
    }),

  setVisitType: (visitType) => set({ currentVisitType: visitType }),

  clearEpisode: () =>
    set({
      currentPatientId: null,
      currentEpisodeId: null,
      currentVisitType: null,
      activeTab: 'prepare',
      activeSectionId: null,
      sectionCompletion: {},
      isRecording: false,
      recordingDuration: 0,
    }),
}));
