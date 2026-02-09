/**
 * Auto-Save Hook
 *
 * Provides debounced auto-save functionality for assessments
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from 'react-query';
import { useAssessmentStore } from '@context/stores/assessmentStore';
import { oasisService } from '@services/index';
import { queryKeys } from '@context/QueryProvider';
import type { OASISResponse, OASISAssessment } from '@typedefs/index';

interface UseAutoSaveOptions {
  assessmentId: string;
  enabled?: boolean;
  debounceMs?: number;
  onSaveStart?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
}

interface UseAutoSaveReturn {
  isSaving: boolean;
  lastSavedAt: Date | null;
  saveError: string | null;
  saveNow: () => Promise<void>;
  pendingChanges: number;
}

export function useAutoSave({
  assessmentId,
  enabled = true,
  debounceMs = 2000,
  onSaveStart,
  onSaveSuccess,
  onSaveError,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const queryClient = useQueryClient();
  const {
    draftResponses,
    isDirty,
    isSaving,
    lastSavedAt,
    saveError,
    setSaving,
    markSaved,
    setSaveError,
    setDraftResponses,
    currentAssessment,
  } = useAssessmentStore();

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const pendingResponsesRef = useRef<Record<string, Partial<OASISResponse>>>({});
  // Track timestamps when each draft was last modified to detect changes during save
  const draftTimestampsRef = useRef<Record<string, number>>({});
  // Track when save started to compare against draft timestamps
  const saveStartTimeRef = useRef<number>(0);

  // Track pending changes count
  const pendingChanges = Object.keys(draftResponses).length;

  // Save function
  const performSave = useCallback(async () => {
    // Capture exactly what we're saving at this moment (snapshot)
    const responsesToSave = { ...pendingResponsesRef.current };
    const savedItemCodes = Object.keys(responsesToSave);
    // Record save start time to compare against draft timestamps
    const saveStartTime = Date.now();
    saveStartTimeRef.current = saveStartTime;

    if (savedItemCodes.length === 0) {
      return;
    }

    try {
      setSaving(true);
      onSaveStart?.();

      const apiResponse = await oasisService.updateAssessment(assessmentId, {
        items: responsesToSave,
      });

      if (isMountedRef.current) {
        // CRITICAL FIX: Only clear drafts that weren't modified AFTER save started
        // Use timestamps for reliable detection of changes during save
        const currentDrafts = useAssessmentStore.getState().draftResponses;
        const remainingDrafts: Record<string, Partial<OASISResponse>> = {};

        for (const [code, response] of Object.entries(currentDrafts)) {
          const draftTimestamp = draftTimestampsRef.current[code] || 0;
          const wasInSaveBatch = savedItemCodes.includes(code);

          if (!wasInSaveBatch) {
            // Item wasn't in our save batch - keep it (new item added during save)
            remainingDrafts[code] = response;
          } else if (draftTimestamp > saveStartTime) {
            // Draft was modified AFTER save started - keep the new value
            remainingDrafts[code] = response;
          } else {
            // Draft was saved and not modified since - safe to clear
            delete draftTimestampsRef.current[code];
          }
        }

        // Clear saved items from pending ref (only those not modified during save)
        for (const code of savedItemCodes) {
          const draftTimestamp = draftTimestampsRef.current[code] || 0;
          if (draftTimestamp <= saveStartTime) {
            delete pendingResponsesRef.current[code];
          }
        }

        // CRITICAL: Update the query cache with saved responses BEFORE clearing drafts
        const existingData = queryClient.getQueryData<OASISAssessment>(
          queryKeys.assessments.detail(assessmentId)
        );

        if (existingData) {
          // Merge saved responses into the cached assessment
          const updatedResponses = { ...existingData.responses };
          for (const [code, response] of Object.entries(responsesToSave)) {
            // Only update cache if this item wasn't modified during save
            const draftTimestamp = draftTimestampsRef.current[code] || 0;
            if (draftTimestamp <= saveStartTime) {
              updatedResponses[code] = {
                ...updatedResponses[code],
                ...response,
                itemCode: code,
              } as OASISResponse;
            }
          }

          queryClient.setQueryData(
            queryKeys.assessments.detail(assessmentId),
            {
              ...existingData,
              responses: updatedResponses,
              completionPercentage: apiResponse.completionPercentage,
              updatedAt: apiResponse.updatedAt,
            }
          );
        }

        // Update store with remaining drafts (preserves changes made during save)
        setDraftResponses(remainingDrafts);

        // Only mark as fully saved if no remaining drafts
        if (Object.keys(remainingDrafts).length === 0) {
          markSaved();
        } else {
          // Still have pending changes, just clear saving state
          setSaving(false);
        }

        onSaveSuccess?.();
      }
    } catch (error) {
      console.error('[useAutoSave] Save failed:', error);
      if (isMountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to save';
        setSaveError(errorMessage);
        onSaveError?.(error instanceof Error ? error : new Error(errorMessage));
      }
    }
  }, [assessmentId, setSaving, markSaved, setDraftResponses, setSaveError, onSaveStart, onSaveSuccess, onSaveError, queryClient]);

  // Debounced save effect
  useEffect(() => {
    if (!enabled || !isDirty || !currentAssessment) {
      return;
    }

    const now = Date.now();

    // Update pending responses AND record timestamps for each draft
    for (const [code, response] of Object.entries(draftResponses)) {
      pendingResponsesRef.current[code] = response;
      // Record when this draft was last modified
      draftTimestampsRef.current[code] = now;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for debounced save
    timeoutRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, isDirty, draftResponses, currentAssessment, debounceMs, performSave]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Save before page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && Object.keys(pendingResponsesRef.current).length > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Manual save function
  const saveNow = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // Get latest draft responses from store for immediate save
    const currentDrafts = useAssessmentStore.getState().draftResponses;
    pendingResponsesRef.current = { ...pendingResponsesRef.current, ...currentDrafts };
    await performSave();
  }, [performSave]);

  return {
    isSaving,
    lastSavedAt,
    saveError,
    saveNow,
    pendingChanges,
  };
}

export default useAutoSave;
