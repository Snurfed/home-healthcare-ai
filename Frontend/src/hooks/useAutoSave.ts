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
    clearDraftResponses,
    currentAssessment,
  } = useAssessmentStore();

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const pendingResponsesRef = useRef<Record<string, Partial<OASISResponse>>>({});

  // Track pending changes count
  const pendingChanges = Object.keys(draftResponses).length;

  // Save function
  const performSave = useCallback(async () => {
    const responsesToSave = { ...pendingResponsesRef.current };

    if (Object.keys(responsesToSave).length === 0) {
      return;
    }

    try {
      setSaving(true);
      onSaveStart?.();

      await oasisService.updateAssessment(assessmentId, {
        items: responsesToSave,
      });

      if (isMountedRef.current) {
        // Clear the saved responses from pending
        pendingResponsesRef.current = {};
        markSaved();
        clearDraftResponses();
        onSaveSuccess?.();
      }
    } catch (error) {
      if (isMountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to save';
        setSaveError(errorMessage);
        onSaveError?.(error instanceof Error ? error : new Error(errorMessage));
      }
    }
  }, [assessmentId, setSaving, markSaved, clearDraftResponses, setSaveError, onSaveStart, onSaveSuccess, onSaveError]);

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
    pendingResponsesRef.current = { ...pendingResponsesRef.current, ...draftResponses };
    await performSave();
  }, [draftResponses, performSave]);

  return {
    isSaving,
    lastSavedAt,
    saveError,
    saveNow,
    pendingChanges,
  };
}

export default useAutoSave;
