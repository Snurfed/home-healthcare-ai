/**
 * Communication Store
 *
 * Zustand store for managing physician communication state.
 */

import { create } from 'zustand';
import type {
  CommunicationTriggerWithStatus,
  TriggerSummary,
  PhysicianCommunication,
} from '../../types/communication.types';

interface CommunicationState {
  // Triggers
  triggers: CommunicationTriggerWithStatus[];
  triggerSummary: TriggerSummary | null;
  triggersLoading: boolean;
  triggersError: string | null;

  // Active communication being edited
  activeCommunication: PhysicianCommunication | null;
  communicationLoading: boolean;
  communicationError: string | null;

  // UI State
  showTriggerBanner: boolean;
  showDraftEditor: boolean;
  selectedTriggerId: string | null;

  // Actions - Triggers
  setTriggers: (triggers: CommunicationTriggerWithStatus[]) => void;
  setTriggerSummary: (summary: TriggerSummary | null) => void;
  setTriggersLoading: (loading: boolean) => void;
  setTriggersError: (error: string | null) => void;
  addTrigger: (trigger: CommunicationTriggerWithStatus) => void;
  dismissTriggerLocally: (ruleId: string) => void;
  clearTriggers: () => void;

  // Actions - Communication
  setActiveCommunication: (communication: PhysicianCommunication | null) => void;
  setCommunicationLoading: (loading: boolean) => void;
  setCommunicationError: (error: string | null) => void;
  updateActiveCommunication: (updates: Partial<PhysicianCommunication>) => void;

  // Actions - UI
  showBanner: () => void;
  hideBanner: () => void;
  openDraftEditor: (triggerId?: string) => void;
  closeDraftEditor: () => void;

  // Computed
  activeTriggers: () => CommunicationTriggerWithStatus[];
  emergentTriggers: () => CommunicationTriggerWithStatus[];
  hasActiveTriggers: () => boolean;
  hasEmergentTriggers: () => boolean;
}

export const useCommunicationStore = create<CommunicationState>()((set, get) => ({
  // Initial state
  triggers: [],
  triggerSummary: null,
  triggersLoading: false,
  triggersError: null,

  activeCommunication: null,
  communicationLoading: false,
  communicationError: null,

  showTriggerBanner: true,
  showDraftEditor: false,
  selectedTriggerId: null,

  // Trigger actions
  setTriggers: (triggers) => set({ triggers }),
  setTriggerSummary: (summary) => set({ triggerSummary: summary }),
  setTriggersLoading: (loading) => set({ triggersLoading: loading }),
  setTriggersError: (error) => set({ triggersError: error }),

  addTrigger: (trigger) =>
    set((state) => {
      // Check if trigger already exists
      const exists = state.triggers.some((t) => t.ruleId === trigger.ruleId);
      if (exists) return state;
      return {
        triggers: [...state.triggers, trigger],
        showTriggerBanner: true,
      };
    }),

  dismissTriggerLocally: (ruleId) =>
    set((state) => ({
      triggers: state.triggers.map((t) =>
        t.ruleId === ruleId
          ? { ...t, dismissed: true, dismissedAt: new Date().toISOString() }
          : t
      ),
    })),

  clearTriggers: () =>
    set({
      triggers: [],
      triggerSummary: null,
      triggersError: null,
    }),

  // Communication actions
  setActiveCommunication: (communication) => set({ activeCommunication: communication }),
  setCommunicationLoading: (loading) => set({ communicationLoading: loading }),
  setCommunicationError: (error) => set({ communicationError: error }),

  updateActiveCommunication: (updates) =>
    set((state) => {
      if (!state.activeCommunication) return state;
      return {
        activeCommunication: { ...state.activeCommunication, ...updates },
      };
    }),

  // UI actions
  showBanner: () => set({ showTriggerBanner: true }),
  hideBanner: () => set({ showTriggerBanner: false }),

  openDraftEditor: (triggerId) =>
    set({
      showDraftEditor: true,
      selectedTriggerId: triggerId || null,
    }),

  closeDraftEditor: () =>
    set({
      showDraftEditor: false,
      selectedTriggerId: null,
      activeCommunication: null,
      communicationError: null,
    }),

  // Computed values (as functions for reactivity)
  activeTriggers: () => get().triggers.filter((t) => !t.dismissed),
  emergentTriggers: () =>
    get().triggers.filter((t) => !t.dismissed && t.urgency === 'EMERGENT'),
  hasActiveTriggers: () => get().triggers.some((t) => !t.dismissed),
  hasEmergentTriggers: () =>
    get().triggers.some((t) => !t.dismissed && t.urgency === 'EMERGENT'),
}));

export default useCommunicationStore;
