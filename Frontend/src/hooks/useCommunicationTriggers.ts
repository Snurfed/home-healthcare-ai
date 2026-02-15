/**
 * useCommunicationTriggers Hook
 *
 * Hook for detecting and managing physician communication triggers
 * during OASIS assessment documentation.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useCommunicationStore } from '../context/stores/communicationStore';
import { communicationService } from '../services/communication.service';
import type {
  CommunicationTriggerWithStatus,
  DetectTriggersRequest,
} from '../types/communication.types';

interface UseCommunicationTriggersOptions {
  assessmentId: string;
  enabled?: boolean;
  debounceMs?: number;
  autoFetch?: boolean;
}

interface UseCommunicationTriggersReturn {
  // State
  triggers: CommunicationTriggerWithStatus[];
  activeTriggers: CommunicationTriggerWithStatus[];
  emergentTriggers: CommunicationTriggerWithStatus[];
  isLoading: boolean;
  error: string | null;

  // Counts
  activeCount: number;
  emergentCount: number;
  hasActiveTriggers: boolean;
  hasEmergentTriggers: boolean;

  // Actions
  fetchTriggers: () => Promise<void>;
  detectTriggers: (questionCode: string, allResponses: Record<string, string | null>) => void;
  dismissTrigger: (ruleId: string, reason?: string) => Promise<void>;
  clearTriggers: () => void;

  // UI helpers
  getTriggerByRuleId: (ruleId: string) => CommunicationTriggerWithStatus | undefined;
}

export function useCommunicationTriggers(
  options: UseCommunicationTriggersOptions
): UseCommunicationTriggersReturn {
  const { assessmentId, enabled = true, debounceMs = 500, autoFetch = true } = options;

  const {
    triggers,
    triggersLoading,
    triggersError,
    setTriggers,
    setTriggerSummary,
    setTriggersLoading,
    setTriggersError,
    addTrigger,
    dismissTriggerLocally,
    clearTriggers,
  } = useCommunicationStore();

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDetectionRef = useRef<DetectTriggersRequest | null>(null);

  /**
   * Fetch all triggers for the assessment
   */
  const fetchTriggers = useCallback(async () => {
    if (!enabled || !assessmentId) return;

    setTriggersLoading(true);
    setTriggersError(null);

    try {
      const response = await communicationService.getTriggers(assessmentId);
      setTriggers(response.triggers);
      setTriggerSummary(response.summary);
    } catch (error) {
      console.error('[Communication Triggers] Fetch error:', error);
      setTriggersError(
        error instanceof Error ? error.message : 'Failed to fetch triggers'
      );
    } finally {
      setTriggersLoading(false);
    }
  }, [
    assessmentId,
    enabled,
    setTriggers,
    setTriggerSummary,
    setTriggersLoading,
    setTriggersError,
  ]);

  /**
   * Detect triggers for a question change (debounced)
   */
  const detectTriggers = useCallback(
    (questionCode: string, allResponses: Record<string, string | null>) => {
      if (!enabled || !assessmentId) return;

      // Store pending detection request
      pendingDetectionRef.current = { questionCode, allResponses };

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new debounce timer
      debounceTimerRef.current = setTimeout(async () => {
        const request = pendingDetectionRef.current;
        if (!request) return;

        try {
          const response = await communicationService.detectTriggers(
            assessmentId,
            request
          );

          // Add any new triggers to the store
          for (const trigger of response.triggers) {
            const existingTrigger = triggers.find(
              (t) => t.ruleId === trigger.ruleId
            );
            if (!existingTrigger || existingTrigger.dismissed) {
              addTrigger({
                ...trigger,
                dismissed: false,
              });
            }
          }
        } catch (error) {
          console.error('[Communication Triggers] Detection error:', error);
          // Don't set error state for detection failures - non-blocking
        }
      }, debounceMs);
    },
    [assessmentId, enabled, debounceMs, triggers, addTrigger]
  );

  /**
   * Dismiss a trigger
   */
  const dismissTrigger = useCallback(
    async (ruleId: string, reason?: string) => {
      if (!assessmentId) return;

      try {
        // Optimistically update UI
        dismissTriggerLocally(ruleId);

        // Send to server
        await communicationService.dismissTrigger(ruleId, {
          assessmentId,
          ruleId,
          reason,
        });
      } catch (error) {
        console.error('[Communication Triggers] Dismiss error:', error);
        // Refetch to restore accurate state
        await fetchTriggers();
      }
    },
    [assessmentId, dismissTriggerLocally, fetchTriggers]
  );

  /**
   * Get trigger by rule ID
   */
  const getTriggerByRuleId = useCallback(
    (ruleId: string) => triggers.find((t) => t.ruleId === ruleId),
    [triggers]
  );

  // Computed values
  const activeTriggers = triggers.filter((t) => !t.dismissed);
  const emergentTriggers = activeTriggers.filter((t) => t.urgency === 'EMERGENT');
  const activeCount = activeTriggers.length;
  const emergentCount = emergentTriggers.length;
  const hasActiveTriggers = activeCount > 0;
  const hasEmergentTriggers = emergentCount > 0;

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && enabled && assessmentId) {
      fetchTriggers();
    }
  }, [autoFetch, enabled, assessmentId, fetchTriggers]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    triggers,
    activeTriggers,
    emergentTriggers,
    isLoading: triggersLoading,
    error: triggersError,
    activeCount,
    emergentCount,
    hasActiveTriggers,
    hasEmergentTriggers,
    fetchTriggers,
    detectTriggers,
    dismissTrigger,
    clearTriggers,
    getTriggerByRuleId,
  };
}

export default useCommunicationTriggers;
