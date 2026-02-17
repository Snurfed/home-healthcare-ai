/**
 * Clinical Events Hooks
 *
 * React hooks for clinical event detection and management.
 * Uses react-query v3 API.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import * as clinicalEventsService from '../services/clinicalEvents.service';
import type {
  KeywordMatch,
  FullDetectionRequest,
  FullDetectionResponse,
  PendingEventsResponse,
  TriggerConfig,
} from '../types/clinicalEvents.types';

// Query keys
export const clinicalEventsKeys = {
  all: ['clinicalEvents'] as const,
  pending: (patientId: string, episodeId?: string) =>
    [...clinicalEventsKeys.all, 'pending', patientId, episodeId] as const,
  event: (eventId: string) =>
    [...clinicalEventsKeys.all, 'event', eventId] as const,
  triggers: () => [...clinicalEventsKeys.all, 'triggers'] as const,
};

/**
 * Hook for real-time keyword detection during documentation
 * Debounces input and runs detection automatically
 */
export function useRealtimeDetection(
  patientId: string,
  episodeId: string,
  options?: {
    debounceMs?: number;
    enabled?: boolean;
    assessmentId?: string;
    visitId?: string;
  }
) {
  const {
    debounceMs = 500,
    enabled = true,
    assessmentId,
    visitId,
  } = options || {};

  const [text, setText] = useState('');
  const [matches, setMatches] = useState<KeywordMatch[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const runDetection = useCallback(
    async (inputText: string) => {
      if (!inputText || inputText.trim().length < 20 || !enabled) {
        setMatches([]);
        return;
      }

      setIsDetecting(true);
      setError(null);

      try {
        const result = await clinicalEventsService.detectByKeywords({
          text: inputText,
          patientId,
          episodeId,
          assessmentId,
          visitId,
        });
        setMatches(result.matches);
      } catch (err) {
        setError(err as Error);
        setMatches([]);
      } finally {
        setIsDetecting(false);
      }
    },
    [patientId, episodeId, assessmentId, visitId, enabled]
  );

  // Debounced text change handler
  const handleTextChange = useCallback(
    (newText: string) => {
      setText(newText);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        runDetection(newText);
      }, debounceMs);
    },
    [runDetection, debounceMs]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Clear matches when disabled
  useEffect(() => {
    if (!enabled) {
      setMatches([]);
    }
  }, [enabled]);

  return {
    text,
    setText: handleTextChange,
    matches,
    isDetecting,
    error,
    hasHighPriority: matches.some(
      (m) => m.priority === 'CRITICAL' || m.priority === 'HIGH'
    ),
    clearMatches: () => setMatches([]),
  };
}

/**
 * Hook for full AI detection (run after saving documentation)
 */
export function useFullDetection() {
  const queryClient = useQueryClient();

  const mutation = useMutation<FullDetectionResponse, Error, FullDetectionRequest>(
    (request) => clinicalEventsService.detectFull(request),
    {
      onSuccess: (_data, variables) => {
        // Invalidate pending events query to refresh the list
        queryClient.invalidateQueries(
          clinicalEventsKeys.pending(variables.patientId, variables.episodeId)
        );
      },
    }
  );

  return {
    detect: mutation.mutate,
    detectAsync: mutation.mutateAsync,
    isDetecting: mutation.isLoading,
    result: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook for fetching pending events for a patient
 */
export function usePendingEvents(
  patientId: string,
  episodeId?: string,
  options?: { enabled?: boolean; refetchInterval?: number }
) {
  const { enabled = true, refetchInterval } = options || {};

  return useQuery<PendingEventsResponse, Error>(
    clinicalEventsKeys.pending(patientId, episodeId),
    () => clinicalEventsService.getPendingEvents(patientId, episodeId),
    {
      enabled: enabled && !!patientId,
      refetchInterval,
      staleTime: 30000, // Consider data fresh for 30 seconds
    }
  );
}

/**
 * Hook for acknowledging an event
 */
export function useAcknowledgeEvent() {
  const queryClient = useQueryClient();

  return useMutation(
    (eventId: string) => clinicalEventsService.acknowledgeEvent(eventId),
    {
      onSuccess: () => {
        // Invalidate all pending events queries
        queryClient.invalidateQueries(clinicalEventsKeys.all);
      },
    }
  );
}

/**
 * Hook for dismissing an event
 */
export function useDismissEvent() {
  const queryClient = useQueryClient();

  return useMutation(
    ({ eventId, reason }: { eventId: string; reason: string }) =>
      clinicalEventsService.dismissEvent(eventId, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(clinicalEventsKeys.all);
      },
    }
  );
}

/**
 * Hook for managing clinical event alerts in the UI
 * Combines real-time detection with pending events
 */
export function useClinicalEventAlerts(
  patientId: string,
  episodeId: string,
  options?: {
    enableRealtime?: boolean;
    enablePolling?: boolean;
    pollingInterval?: number;
  }
) {
  const {
    enableRealtime = true,
    enablePolling = true,
    pollingInterval = 60000, // 1 minute
  } = options || {};

  // Real-time detection state
  const realtime = useRealtimeDetection(patientId, episodeId, {
    enabled: enableRealtime,
  });

  // Pending events from database
  const pendingQuery = usePendingEvents(patientId, episodeId, {
    enabled: enablePolling,
    refetchInterval: pollingInterval,
  });

  // Acknowledge mutation
  const acknowledgeMutation = useAcknowledgeEvent();

  // Dismiss mutation
  const dismissMutation = useDismissEvent();

  // Combine real-time matches with pending events
  const allAlerts = [
    // Real-time keyword matches (not yet saved)
    ...realtime.matches.map((match) => ({
      id: `realtime-${match.eventType}-${match.triggerId}`,
      eventType: match.eventType,
      priority: match.priority,
      title: match.triggerName,
      summary: `Detected: ${match.matchedKeywords.join(', ')}`,
      isRealtime: true,
      isSaved: false,
    })),
    // Pending saved events
    ...(pendingQuery.data?.events || []).map((event) => ({
      id: event.id,
      eventType: event.eventType,
      priority: event.priority,
      title: event.eventSummary,
      summary: event.sourceText?.substring(0, 100) || '',
      isRealtime: false,
      isSaved: true,
    })),
  ];

  // Deduplicate by event type (prefer saved events)
  type AlertType = typeof allAlerts[number];
  const uniqueAlerts = allAlerts.reduce<AlertType[]>((acc, alert) => {
    const existing = acc.find((a) => a.eventType === alert.eventType);
    if (!existing || (alert.isSaved && !existing.isSaved)) {
      return [...acc.filter((a) => a.eventType !== alert.eventType), alert];
    }
    return acc;
  }, []);

  return {
    alerts: uniqueAlerts,
    realtimeMatches: realtime.matches,
    pendingEvents: pendingQuery.data?.events || [],
    isLoading: pendingQuery.isLoading,
    isDetecting: realtime.isDetecting,
    hasCritical: pendingQuery.data?.hasCritical || realtime.matches.some((m) => m.priority === 'CRITICAL'),
    hasHigh: pendingQuery.data?.hasHigh || realtime.matches.some((m) => m.priority === 'HIGH'),
    setText: realtime.setText,
    acknowledge: acknowledgeMutation.mutate,
    dismiss: dismissMutation.mutate,
    refetch: pendingQuery.refetch,
  };
}

/**
 * Hook for trigger configuration (admin)
 */
export function useTriggerConfigs() {
  return useQuery<{ triggers: TriggerConfig[] }, Error>(
    clinicalEventsKeys.triggers(),
    () => clinicalEventsService.getTriggerConfigs()
  );
}

/**
 * Hook for updating trigger configuration (admin)
 */
export function useUpdateTriggerConfig() {
  const queryClient = useQueryClient();

  return useMutation(
    ({
      eventType,
      updates,
    }: {
      eventType: string;
      updates: Partial<TriggerConfig>;
    }) => clinicalEventsService.updateTriggerConfig(eventType, updates),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(clinicalEventsKeys.triggers());
      },
    }
  );
}
