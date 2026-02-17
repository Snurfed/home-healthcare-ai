/**
 * Integration Service
 *
 * API client for email/fax integration management.
 */

import apiClient from './api/client';
import type {
  IntegrationStatus,
  SMTPConfigRequest,
  SendNotificationRequest,
  SendNotificationResponse,
  SendLogEntry,
} from '../types/integration.types';

const BASE_URL = '/integrations';

/**
 * Get all email integration statuses
 */
export async function getEmailIntegrationStatus(): Promise<IntegrationStatus[]> {
  const response = await apiClient.get<{ integrations: IntegrationStatus[] }>(
    `${BASE_URL}/email/status`
  );
  return response.data.integrations;
}

/**
 * Configure SMTP settings
 */
export async function configureSMTP(config: SMTPConfigRequest): Promise<{
  message: string;
  integration: {
    id: string;
    provider: string;
    isEnabled: boolean;
    isPrimary: boolean;
    host: string;
    port: number;
    fromEmail: string;
  };
}> {
  const response = await apiClient.post(`${BASE_URL}/email/smtp/configure`, config);
  return response.data;
}

/**
 * Test SMTP connection
 */
export async function testSMTPConnection(): Promise<{
  success: boolean;
  error?: string;
  testedAt: string;
}> {
  const response = await apiClient.post(`${BASE_URL}/email/smtp/test`);
  return response.data;
}

/**
 * Enable an integration
 */
export async function enableIntegration(provider: string): Promise<{ message: string }> {
  const response = await apiClient.post(`${BASE_URL}/${provider}/enable`);
  return response.data;
}

/**
 * Disable an integration
 */
export async function disableIntegration(provider: string): Promise<{ message: string }> {
  const response = await apiClient.post(`${BASE_URL}/${provider}/disable`);
  return response.data;
}

/**
 * Set an integration as primary
 */
export async function setPrimaryIntegration(
  provider: string,
  channel: string = 'EMAIL'
): Promise<{ message: string }> {
  const response = await apiClient.post(`${BASE_URL}/${provider}/set-primary`, { channel });
  return response.data;
}

/**
 * Send a communication
 */
export async function sendCommunication(
  communicationId: string,
  request: Omit<SendNotificationRequest, 'communicationId'>
): Promise<SendNotificationResponse> {
  const response = await apiClient.post<SendNotificationResponse>(
    `/communications/${communicationId}/send`,
    { ...request, communicationId }
  );
  return response.data;
}

/**
 * Get send history for a communication
 */
export async function getCommunicationSendHistory(
  communicationId: string
): Promise<SendLogEntry[]> {
  const response = await apiClient.get<{ history: SendLogEntry[] }>(
    `/communications/${communicationId}/send-history`
  );
  return response.data.history;
}

/**
 * Open mailto URL (helper for mailto fallback)
 * This opens the user's default email client
 */
export function openMailtoUrl(url: string): void {
  window.location.href = url;
}

/**
 * Check if we should use mailto fallback
 * Returns true if no server-side email integration is configured
 */
export async function shouldUseMailtoFallback(): Promise<boolean> {
  try {
    const statuses = await getEmailIntegrationStatus();
    const hasServerIntegration = statuses.some(
      (s) =>
        s.isEnabled &&
        s.isConfigured &&
        s.provider !== 'MAILTO'
    );
    return !hasServerIntegration;
  } catch {
    // If we can't check, default to mailto
    return true;
  }
}

export default {
  getEmailIntegrationStatus,
  configureSMTP,
  testSMTPConnection,
  enableIntegration,
  disableIntegration,
  setPrimaryIntegration,
  sendCommunication,
  getCommunicationSendHistory,
  openMailtoUrl,
  shouldUseMailtoFallback,
};
