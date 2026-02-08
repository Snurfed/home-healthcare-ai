/**
 * Auto-Save Hook
 *
 * Provides debounced auto-save functionality for assessments
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAssessmentStore } from '@context/stores/assessmentStore';
import { oasisService } from '@services/index';
import type { OASISResponse } from '@typedefs/index';

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

  // Track pending changes count
  const pendingChanges = Object.keys(draftResponses).length;

  // Save function
  const performSave = useCallback(async () => {
    // Capture exactly what we're saving at this moment (snapshot)
    const responsesToSave = { ...pendingResponsesRef.current };
    const savedItemCodes = Object.keys(responsesToSave);

    if (savedItemCodes.length === 0) {
      return;
    }

    try {
      setSaving(true);
      onSaveStart?.();

      await oasisService.updateAssessment(assessmentId, {
        items: responsesToSave,
      });

      if (isMountedRef.current) {
        // CRITICAL FIX: Only clear drafts that haven't changed since we started saving
        // This prevents losing changes typed during the save operation
        const currentDrafts = useAssessmentStore.getState().draftResponses;
        const remainingDrafts: Record<string, Partial<OASISResponse>> = {};

        for (const [code, response] of Object.entries(currentDrafts)) {
          const savedResponse = responsesToSave[code];

          if (!savedResponse) {
            // Item wasn't in our save batch - keep it
            remainingDrafts[code] = response;
          } else {
            // Compare current value with what we saved
            // If values differ, user changed it during save - keep the new value
            const currentValue = response.responseValue || response.responseCode || '';
            const savedValue = savedResponse.responseValue || savedResponse.responseCode || '';

            if (currentValue !== savedValue) {
              remainingDrafts[code] = response;
            }
            // If values match, don't keep it (it was saved successfully)
          }
        }

        // Clear saved items from pending ref
        for (const code of savedItemCodes) {
          delete pendingResponsesRef.current[code];
        }

        // Update store with remaining drafts (preserves changes made during save)
        setDraftResponses(remainingDrafts);
        markSaved();
        onSaveSuccess?.();
      }
    } catch (error) {
      if (isMountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to save';
        setSaveError(errorMessage);
        onSaveError?.(error instanceof Error ? error : new Error(errorMessage));
      }
    }
  }, [assessmentId, setSaving, markSaved, setDraftResponses, setSaveError, onSaveStart, onSaveSuccess, onSaveError]);

  // Debounced save effect
  useEffect(() => {
    if (!enabled || !isDirty || !currentAssessment) {
      return;
    }

    // Update pending responses
    pendingResponsesRef.current = { ...pendingResponsesRef.current, ...draftResponses };

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
