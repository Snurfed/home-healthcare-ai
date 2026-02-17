/**
 * Clinical Events Service
 *
 * API client for clinical event detection and management.
 */

import apiClient from './api/client';
import type {
  KeywordDetectionRequest,
  KeywordDetectionResponse,
  FullDetectionRequest,
  FullDetectionResponse,
  PendingEventsResponse,
  DetectedClinicalEvent,
  TriggerConfig,
} from '../types/clinicalEvents.types';

const BASE_URL = '/clinical-events';

/**
 * Run fast keyword-based detection (for real-time use)
 */
export async function detectByKeywords(
  request: KeywordDetectionRequest
): Promise<KeywordDetectionResponse> {
  const response = await apiClient.post<KeywordDetectionResponse>(
    `${BASE_URL}/detect/keywords`,
    request
  );
  return response.data;
}

/**
 * Run full detection with AI analysis (for post-save use)
 */
export async function detectFull(
  request: FullDetectionRequest
): Promise<FullDetectionResponse> {
  const response = await apiClient.post<FullDetectionResponse>(
    `${BASE_URL}/detect/full`,
    request
  );
  return response.data;
}

/**
 * Get pending (unacknowledged) events for a patient
 */
export async function getPendingEvents(
  patientId: string,
  episodeId?: string
): Promise<PendingEventsResponse> {
  const params = episodeId ? { episodeId } : {};
  const response = await apiClient.get<PendingEventsResponse>(
    `${BASE_URL}/pending/${patientId}`,
    { params }
  );
  return response.data;
}

/**
 * Get a single event by ID
 */
export async function getEvent(eventId: string): Promise<DetectedClinicalEvent> {
  const response = await apiClient.get<DetectedClinicalEvent>(
    `${BASE_URL}/${eventId}`
  );
  return response.data;
}

/**
 * Acknowledge an event (mark as seen)
 */
export async function acknowledgeEvent(
  eventId: string
): Promise<{ message: string; event: Partial<DetectedClinicalEvent> }> {
  const response = await apiClient.post<{
    message: string;
    event: Partial<DetectedClinicalEvent>;
  }>(`${BASE_URL}/${eventId}/acknowledge`);
  return response.data;
}

/**
 * Dismiss an event with a reason
 */
export async function dismissEvent(
  eventId: string,
  reason: string
): Promise<{ message: string; event: Partial<DetectedClinicalEvent> }> {
  const response = await apiClient.post<{
    message: string;
    event: Partial<DetectedClinicalEvent>;
  }>(`${BASE_URL}/${eventId}/dismiss`, { reason });
  return response.data;
}

/**
 * Get all trigger configurations (admin only)
 */
export async function getTriggerConfigs(): Promise<{ triggers: TriggerConfig[] }> {
  const response = await apiClient.get<{ triggers: TriggerConfig[] }>(
    `${BASE_URL}/triggers`
  );
  return response.data;
}

/**
 * Update a trigger configuration (admin only)
 */
export async function updateTriggerConfig(
  eventType: string,
  updates: Partial<TriggerConfig>
): Promise<{ message: string; trigger: TriggerConfig }> {
  const response = await apiClient.patch<{
    message: string;
    trigger: TriggerConfig;
  }>(`${BASE_URL}/triggers/${eventType}`, updates);
  return response.data;
}

export default {
  detectByKeywords,
  detectFull,
  getPendingEvents,
  getEvent,
  acknowledgeEvent,
  dismissEvent,
  getTriggerConfigs,
  updateTriggerConfig,
};
