/**
 * useVisitNote Hook
 *
 * React Query hooks for visit note operations.
 */

import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useCallback, useEffect, useRef } from 'react';
import visitNoteService from '@services/visitNote.service';
import { useVisitNoteStore } from '@context/stores/visitNoteStore';
import type {
  VisitNote,
  VisitNoteResponse,
  CreateVisitNoteRequest,
  UpdateVisitNoteRequest,
  GenerateAIDraftRequest,
  GenerateAIDraftResponse,
  FinalizeVisitNoteRequest,
  Discipline,
  VisitPurpose,
} from '@typedefs/index';

// =============================================================================
// QUERY KEYS
// =============================================================================

export const visitNoteKeys = {
  all: ['visitNotes'] as const,
  detail: (visitId: string) => [...visitNoteKeys.all, 'detail', visitId] as const,
  episode: (episodeId: string) => [...visitNoteKeys.all, 'episode', episodeId] as const,
  dashboard: (episodeId: string) => ['episodeDashboard', episodeId] as const,
};

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Fetch visit note data
 */
export function useVisitNoteQuery(visitId: string | null) {
  return useQuery({
    queryKey: visitNoteKeys.detail(visitId || ''),
    queryFn: () => visitNoteService.getVisitNote(visitId!),
    enabled: !!visitId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Fetch episode dashboard data
 */
export function useEpisodeDashboard(episodeId: string | null) {
  return useQuery({
    queryKey: visitNoteKeys.dashboard(episodeId || ''),
    queryFn: () => visitNoteService.getEpisodeDashboard(episodeId!),
    enabled: !!episodeId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Fetch visit notes for an episode
 */
export function useEpisodeVisitNotes(episodeId: string | null) {
  return useQuery({
    queryKey: visitNoteKeys.episode(episodeId || ''),
    queryFn: () => visitNoteService.getEpisodeVisitNotes(episodeId!),
    enabled: !!episodeId,
  });
}

/**
 * Create a new visit note
 */
export function useCreateVisitNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVisitNoteRequest) => visitNoteService.createVisitNote(data),
    onSuccess: (result: VisitNote, variables: CreateVisitNoteRequest) => {
      queryClient.setQueryData(visitNoteKeys.detail(variables.visitId), result);
      queryClient.invalidateQueries({ queryKey: visitNoteKeys.episode(variables.episodeId) });
    },
  });
}

/**
 * Update visit note
 */
export function useUpdateVisitNote() {
  const queryClient = useQueryClient();
  const markSaved = useVisitNoteStore((state) => state.markSaved);

  return useMutation({
    mutationFn: ({ visitId, data }: { visitId: string; data: UpdateVisitNoteRequest }) =>
      visitNoteService.updateVisitNote(visitId, data),
    onSuccess: (result: VisitNote, variables: { visitId: string; data: UpdateVisitNoteRequest }) => {
      queryClient.setQueryData(visitNoteKeys.detail(variables.visitId), result);
      markSaved();
    },
  });
}

/**
 * Generate AI draft
 */
export function useGenerateAIDraft() {
  const setBulkResponses = useVisitNoteStore((state) => state.setBulkResponses);

  return useMutation({
    mutationFn: ({ visitId, data }: { visitId: string; data: GenerateAIDraftRequest }) =>
      visitNoteService.generateAIDraft(visitId, data),
    onSuccess: (result: GenerateAIDraftResponse) => {
      if (result.success && result.drafts.length > 0) {
        const responses: Record<string, { value: string; source: 'ai_draft'; aiConfidence: number }> = {};
        for (const draft of result.drafts) {
          responses[draft.questionCode] = {
            value: draft.draftValue,
            source: 'ai_draft',
            aiConfidence: draft.confidence,
          };
        }
        setBulkResponses(responses);
      }
    },
  });
}

/**
 * Finalize visit note
 */
export function useFinalizeVisitNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ visitId, data }: { visitId: string; data: FinalizeVisitNoteRequest }) =>
      visitNoteService.finalizeVisitNote(visitId, data),
    onSuccess: (result: VisitNote, variables: { visitId: string; data: FinalizeVisitNoteRequest }) => {
      queryClient.setQueryData(visitNoteKeys.detail(variables.visitId), result);
    },
  });
}

// =============================================================================
// AUTO-SAVE HOOK
// =============================================================================

interface UseVisitNoteAutoSaveOptions {
  visitId: string | null;
  enabled?: boolean;
  debounceMs?: number;
}

export function useVisitNoteAutoSave({
  visitId,
  enabled = true,
  debounceMs = 2000,
}: UseVisitNoteAutoSaveOptions) {
  const queryClient = useQueryClient();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDataRef = useRef<UpdateVisitNoteRequest | null>(null);

  const {
    responses,
    vitalSigns,
    timeIn,
    timeOut,
    isDirty,
    markSaved,
    setStatus,
  } = useVisitNoteStore();

  // Get wounds from the store
  const wounds = useVisitNoteStore((state) => state.wounds);

  // Mutation for saving
  const { mutateAsync: save, isLoading: isSaving } = useMutation<
    { success: boolean; savedAt: string },
    Error,
    UpdateVisitNoteRequest
  >(
    (data: UpdateVisitNoteRequest) => visitNoteService.autoSaveVisitNote(visitId!, data),
    {
      onSuccess: (_result, variables) => {
        // Update cache
        const oldData = queryClient.getQueryData<VisitNote>(visitNoteKeys.detail(visitId!));
        if (oldData) {
          queryClient.setQueryData<VisitNote>(visitNoteKeys.detail(visitId!), {
            ...oldData,
            responses: (variables.responses as Record<string, VisitNoteResponse>) || oldData.responses,
            vitalSigns: variables.vitalSigns || oldData.vitalSigns,
            wounds: variables.wounds || oldData.wounds,
            timeIn: variables.timeIn || oldData.timeIn,
            timeOut: variables.timeOut || oldData.timeOut,
            updatedAt: new Date().toISOString(),
          });
        }
        markSaved();
        setStatus('ready');
      },
      onError: () => {
        setStatus('error');
      },
    }
  );

  // Save function
  const saveNow = useCallback(async () => {
    if (!visitId || !isDirty) return;

    // Clear any pending timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const data: UpdateVisitNoteRequest = {
      responses,
      vitalSigns,
      wounds,
      timeIn: timeIn || undefined,
      timeOut: timeOut || undefined,
    };

    setStatus('saving');
    await save(data);
  }, [visitId, isDirty, responses, vitalSigns, wounds, timeIn, timeOut, save, setStatus]);

  // Debounced auto-save effect
  useEffect(() => {
    if (!enabled || !visitId || !isDirty) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout
    saveTimeoutRef.current = setTimeout(() => {
      saveNow();
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [enabled, visitId, isDirty, debounceMs, saveNow]);

  // Save on unmount if dirty
  useEffect(() => {
    return () => {
      if (isDirty && visitId) {
        // Synchronous save attempt on unmount
        pendingDataRef.current = {
          responses,
          vitalSigns,
          wounds,
          timeIn: timeIn || undefined,
          timeOut: timeOut || undefined,
        };
      }
    };
  }, [isDirty, visitId, responses, vitalSigns, wounds, timeIn, timeOut]);

  return {
    isSaving,
    saveNow,
    isDirty,
  };
}

// =============================================================================
// COMBINED HOOK
// =============================================================================

interface UseVisitNoteOptions {
  visitId: string;
  patientId: string;
  episodeId: string;
  discipline: Discipline;
  visitPurpose: VisitPurpose;
}

export function useVisitNote(options: UseVisitNoteOptions) {
  const { visitId, patientId, episodeId, discipline, visitPurpose } = options;
  const initializeForm = useVisitNoteStore((state) => state.initializeForm);

  // Fetch existing note
  const {
    data: existingNote,
    isLoading,
    error,
  } = useVisitNoteQuery(visitId);

  // Create mutation
  const createMutation = useCreateVisitNote();

  // Initialize or create note
  useEffect(() => {
    if (isLoading) return;

    if (existingNote) {
      // Initialize with existing data
      initializeForm({
        visitId,
        patientId,
        episodeId,
        discipline,
        visitPurpose,
        existingResponses: existingNote.responses,
        existingVitals: existingNote.vitalSigns,
        existingWounds: existingNote.wounds,
        visitDate: existingNote.visitDate,
        timeIn: existingNote.timeIn || undefined,
        timeOut: existingNote.timeOut || undefined,
      });
    } else if (!createMutation.isLoading) {
      // Create new note
      createMutation.mutate(
        {
          visitId,
          patientId,
          episodeId,
          discipline,
          visitPurpose,
          visitDate: new Date().toISOString().split('T')[0]!,
        },
        {
          onSuccess: (newNote: VisitNote) => {
            initializeForm({
              visitId,
              patientId,
              episodeId,
              discipline,
              visitPurpose,
              visitDate: newNote.visitDate,
            });
          },
        }
      );
    }
  }, [
    visitId,
    patientId,
    episodeId,
    discipline,
    visitPurpose,
    existingNote,
    isLoading,
    initializeForm,
    createMutation,
  ]);

  // Auto-save
  const autoSave = useVisitNoteAutoSave({
    visitId,
    enabled: !isLoading && !error,
  });

  // AI Draft
  const generateAIDraftMutation = useGenerateAIDraft();

  const generateAIDraft = useCallback(
    async (sectionId: string, questionCodes?: string[]) => {
      await generateAIDraftMutation.mutateAsync({
        visitId,
        data: { sectionId, questionCodes },
      });
    },
    [visitId, generateAIDraftMutation]
  );

  // Finalize
  const finalizeMutation = useFinalizeVisitNote();

  return {
    isLoading: isLoading || createMutation.isLoading,
    error: error || createMutation.error,
    existingNote,
    autoSave,
    generateAIDraft,
    isGeneratingDraft: generateAIDraftMutation.isLoading,
    finalize: finalizeMutation.mutateAsync,
    isFinalizing: finalizeMutation.isLoading,
  };
}

export default useVisitNote;
