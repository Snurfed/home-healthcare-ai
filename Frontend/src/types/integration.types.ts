/**
 * Integration Types
 *
 * TypeScript interfaces for email/fax integration settings.
 */

export type IntegrationProvider =
  | 'MICROSOFT_365'
  | 'GOOGLE_WORKSPACE'
  | 'SMTP'
  | 'MAILTO'
  | 'PHAXIO'
  | 'SRFAX'
  | 'TWILIO_FAX';

export type NotificationChannel = 'EMAIL' | 'FAX' | 'SECURE_MESSAGE' | 'IN_APP';

export type SendMethod = 'auto' | 'mailto' | 'smtp' | 'microsoft';

// Integration status returned from API
export interface IntegrationStatus {
  provider: IntegrationProvider;
  isConfigured: boolean;
  isEnabled: boolean;
  isPrimary: boolean;
  lastTested?: string;
  lastTestPassed?: boolean;
  lastTestError?: string;
}

// SMTP configuration request
export interface SMTPConfigRequest {
  host: string;
  port: number;
  secure: boolean;
  username?: string;
  password?: string;
  fromEmail: string;
  fromName?: string;
}

// Send notification request
export interface SendNotificationRequest {
  communicationId: string;
  method?: SendMethod;
  recipientEmail: string;
  recipientName?: string;
  ccEmails?: string[];
}

// Send notification response
export interface SendNotificationResponse {
  success: boolean;
  method: 'server' | 'mailto';
  provider: IntegrationProvider;
  mailtoUrl?: string; // For mailto fallback - frontend opens this
  messageId?: string;
  error?: string;
}

// Communication send log entry
export interface SendLogEntry {
  id: string;
  communicationId: string;
  channel: NotificationChannel;
  provider: IntegrationProvider;
  recipientAddress: string;
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'mailto_opened';
  attemptNumber: number;
  queuedAt: string;
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

// Provider display config
export const PROVIDER_CONFIG: Record<IntegrationProvider, {
  label: string;
  description: string;
  icon: string;
  requiresConfig: boolean;
}> = {
  MAILTO: {
    label: 'Open in Mail App',
    description: 'Opens your default email client (Outlook, Apple Mail, etc.)',
    icon: '📧',
    requiresConfig: false,
  },
  SMTP: {
    label: 'SMTP Server',
    description: 'Send directly via your email server',
    icon: '📤',
    requiresConfig: true,
  },
  MICROSOFT_365: {
    label: 'Microsoft 365',
    description: 'Send via Outlook/Office 365',
    icon: '🔷',
    requiresConfig: true,
  },
  GOOGLE_WORKSPACE: {
    label: 'Google Workspace',
    description: 'Send via Gmail',
    icon: '🔴',
    requiresConfig: true,
  },
  PHAXIO: {
    label: 'Phaxio',
    description: 'Cloud fax service',
    icon: '📠',
    requiresConfig: true,
  },
  SRFAX: {
    label: 'SRFax',
    description: 'Healthcare fax service',
    icon: '📠',
    requiresConfig: true,
  },
  TWILIO_FAX: {
    label: 'Twilio Fax',
    description: 'Twilio-powered fax',
    icon: '📠',
    requiresConfig: true,
  },
};
