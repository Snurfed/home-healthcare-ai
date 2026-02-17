/**
 * Email Service
 *
 * Unified email sender that routes to:
 * 1. MAILTO - Browser-based fallback (opens user's email client)
 * 2. SMTP - Direct email sending via configured SMTP server
 * 3. Microsoft Graph - Office 365 API (future)
 *
 * The mailto fallback is always available and requires no server config.
 */

import nodemailer from 'nodemailer';
import prisma from '../config/prisma';
import { safeDecryptCredentials } from '../utils/encryption';
import { IntegrationProvider, NotificationChannel } from '../generated/prisma';

// Email content structure
export interface EmailContent {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

// Send result structure
export interface SendResult {
  success: boolean;
  provider: IntegrationProvider;
  method: 'server' | 'mailto';
  messageId?: string;
  mailtoUrl?: string; // For mailto fallback
  error?: string;
  timestamp: Date;
}

// SMTP credentials structure
interface SMTPCredentials {
  username: string;
  password: string;
}

// ===========================================
// MAILTO FALLBACK (Always available)
// ===========================================

/**
 * Generate a mailto: URL for browser-based email
 * This is the fallback that always works - it opens the user's email client
 */
export function generateMailtoUrl(email: EmailContent): string {
  const params = new URLSearchParams();

  if (email.subject) {
    params.set('subject', email.subject);
  }

  if (email.body) {
    params.set('body', email.body);
  }

  if (email.cc) {
    params.set('cc', email.cc);
  }

  if (email.bcc) {
    params.set('bcc', email.bcc);
  }

  const queryString = params.toString();
  return `mailto:${encodeURIComponent(email.to)}${queryString ? '?' + queryString : ''}`;
}

/**
 * "Send" via mailto - returns the URL for the frontend to open
 * This doesn't actually send, but provides a working send experience
 */
export async function sendViaMailto(email: EmailContent): Promise<SendResult> {
  const mailtoUrl = generateMailtoUrl(email);

  // Log the "send" attempt
  console.log(`[Email] Generated mailto URL for: ${email.to}`);

  return {
    success: true,
    provider: IntegrationProvider.MAILTO,
    method: 'mailto',
    mailtoUrl,
    timestamp: new Date(),
  };
}

// ===========================================
// SMTP SENDING
// ===========================================

/**
 * Get SMTP transporter from integration settings
 */
async function getSMTPTransporter(): Promise<nodemailer.Transporter | null> {
  const settings = await prisma.integrationSettings.findFirst({
    where: {
      provider: IntegrationProvider.SMTP,
      channel: NotificationChannel.EMAIL,
      isEnabled: true,
    },
  });

  if (!settings || !settings.smtpHost || !settings.smtpPort) {
    return null;
  }

  // Decrypt credentials if stored
  let auth: { user: string; pass: string } | undefined;
  if (settings.credentials) {
    const creds = safeDecryptCredentials<SMTPCredentials>(
      typeof settings.credentials === 'string'
        ? settings.credentials
        : JSON.stringify(settings.credentials)
    );
    if (creds?.username && creds?.password) {
      auth = { user: creds.username, pass: creds.password };
    }
  }

  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    auth,
  });
}

/**
 * Send email via SMTP
 */
export async function sendViaSMTP(
  email: EmailContent,
  fromEmail?: string,
  fromName?: string
): Promise<SendResult> {
  const transporter = await getSMTPTransporter();

  if (!transporter) {
    return {
      success: false,
      provider: IntegrationProvider.SMTP,
      method: 'server',
      error: 'SMTP not configured',
      timestamp: new Date(),
    };
  }

  // Get from address from settings if not provided
  const settings = await prisma.integrationSettings.findFirst({
    where: {
      provider: IntegrationProvider.SMTP,
      channel: NotificationChannel.EMAIL,
      isEnabled: true,
    },
  });

  const from = fromEmail || settings?.fromEmail;
  const fromDisplayName = fromName || settings?.fromName || 'Home Health AI';

  if (!from) {
    return {
      success: false,
      provider: IntegrationProvider.SMTP,
      method: 'server',
      error: 'No from email configured',
      timestamp: new Date(),
    };
  }

  try {
    const result = await transporter.sendMail({
      from: `"${fromDisplayName}" <${from}>`,
      to: email.to,
      cc: email.cc,
      bcc: email.bcc,
      replyTo: email.replyTo,
      subject: email.subject,
      text: email.body,
      html: email.bodyHtml,
      attachments: email.attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      })),
    });

    console.log(`[Email] Sent via SMTP to ${email.to}, messageId: ${result.messageId}`);

    return {
      success: true,
      provider: IntegrationProvider.SMTP,
      method: 'server',
      messageId: result.messageId,
      timestamp: new Date(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Email] SMTP send failed:`, error);

    return {
      success: false,
      provider: IntegrationProvider.SMTP,
      method: 'server',
      error: errorMessage,
      timestamp: new Date(),
    };
  }
}

// ===========================================
// MICROSOFT GRAPH (Future)
// ===========================================

/**
 * Send email via Microsoft Graph API
 * Placeholder for future implementation
 */
export async function sendViaMicrosoftGraph(email: EmailContent): Promise<SendResult> {
  // TODO: Implement Microsoft Graph API integration
  return {
    success: false,
    provider: IntegrationProvider.MICROSOFT_365,
    method: 'server',
    error: 'Microsoft 365 integration not yet implemented',
    timestamp: new Date(),
  };
}

// ===========================================
// UNIFIED SEND FUNCTION
// ===========================================

export type SendMethod = 'auto' | 'mailto' | 'smtp' | 'microsoft';

/**
 * Send email using the best available method
 *
 * @param email - Email content
 * @param method - Preferred send method ('auto' tries server-side first, falls back to mailto)
 * @param fromEmail - Override from email
 * @param fromName - Override from name
 */
export async function sendEmail(
  email: EmailContent,
  method: SendMethod = 'auto',
  fromEmail?: string,
  fromName?: string
): Promise<SendResult> {
  // If explicitly requesting mailto, use it
  if (method === 'mailto') {
    return sendViaMailto(email);
  }

  // If explicitly requesting SMTP
  if (method === 'smtp') {
    return sendViaSMTP(email, fromEmail, fromName);
  }

  // If explicitly requesting Microsoft
  if (method === 'microsoft') {
    return sendViaMicrosoftGraph(email);
  }

  // Auto mode: try configured providers in order, fall back to mailto
  // Check for enabled email integrations
  const enabledIntegration = await prisma.integrationSettings.findFirst({
    where: {
      channel: NotificationChannel.EMAIL,
      isEnabled: true,
      isPrimary: true,
    },
  });

  if (enabledIntegration) {
    switch (enabledIntegration.provider) {
      case IntegrationProvider.SMTP:
        const smtpResult = await sendViaSMTP(email, fromEmail, fromName);
        if (smtpResult.success) return smtpResult;
        // Fall through to mailto on failure
        break;

      case IntegrationProvider.MICROSOFT_365:
        const msResult = await sendViaMicrosoftGraph(email);
        if (msResult.success) return msResult;
        // Fall through to mailto on failure
        break;
    }
  }

  // Fallback to mailto
  console.log('[Email] Using mailto fallback');
  return sendViaMailto(email);
}

// ===========================================
// INTEGRATION STATUS
// ===========================================

export interface IntegrationStatus {
  provider: IntegrationProvider;
  isConfigured: boolean;
  isEnabled: boolean;
  isPrimary: boolean;
  lastTested?: Date;
  lastTestPassed?: boolean;
  lastTestError?: string;
}

/**
 * Get status of all email integrations
 */
export async function getEmailIntegrationStatus(): Promise<IntegrationStatus[]> {
  const integrations = await prisma.integrationSettings.findMany({
    where: { channel: NotificationChannel.EMAIL },
  });

  // Always include mailto as an option
  const statuses: IntegrationStatus[] = [
    {
      provider: IntegrationProvider.MAILTO,
      isConfigured: true, // Always configured
      isEnabled: true, // Always enabled as fallback
      isPrimary: !integrations.some((i) => i.isPrimary && i.isEnabled),
    },
  ];

  // Add configured integrations
  for (const integration of integrations) {
    const isConfigured =
      integration.provider === IntegrationProvider.SMTP
        ? !!(integration.smtpHost && integration.smtpPort)
        : integration.provider === IntegrationProvider.MICROSOFT_365
        ? !!(integration.clientId && integration.tenantId)
        : false;

    statuses.push({
      provider: integration.provider,
      isConfigured,
      isEnabled: integration.isEnabled,
      isPrimary: integration.isPrimary,
      lastTested: integration.lastTestedAt || undefined,
      lastTestPassed: integration.lastTestResult || undefined,
      lastTestError: integration.lastTestError || undefined,
    });
  }

  return statuses;
}

/**
 * Test SMTP connection
 */
export async function testSMTPConnection(): Promise<{ success: boolean; error?: string }> {
  const transporter = await getSMTPTransporter();

  if (!transporter) {
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    await transporter.verify();
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

export default {
  sendEmail,
  sendViaMailto,
  sendViaSMTP,
  sendViaMicrosoftGraph,
  generateMailtoUrl,
  getEmailIntegrationStatus,
  testSMTPConnection,
};
