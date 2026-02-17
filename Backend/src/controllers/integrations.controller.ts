/**
 * Integrations Controller
 *
 * Handles email/fax integration configuration, OAuth flows, and status.
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import prisma from '../config/prisma';
import { encryptCredentials, safeDecryptCredentials } from '../utils/encryption';
import * as emailService from '../services/email.service';
import { IntegrationProvider, NotificationChannel } from '../generated/prisma';

// ===========================================
// GET INTEGRATION STATUS
// ===========================================

/**
 * Get all email integration statuses
 * GET /api/integrations/email/status
 */
export async function getEmailIntegrationStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const statuses = await emailService.getEmailIntegrationStatus();

    return res.json({ integrations: statuses });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// SMTP CONFIGURATION
// ===========================================

interface SMTPConfigRequest {
  host: string;
  port: number;
  secure: boolean;
  username?: string;
  password?: string;
  fromEmail: string;
  fromName?: string;
}

/**
 * Configure SMTP settings
 * POST /api/integrations/email/smtp/configure
 */
export async function configureSMTP(
  req: AuthenticatedRequest & { body: SMTPConfigRequest },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { host, port, secure, username, password, fromEmail, fromName } = req.body;

    if (!host || !port || !fromEmail) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'host, port, and fromEmail are required',
      });
    }

    // Encrypt credentials if provided
    let encryptedCredentials: string | null = null;
    if (username && password) {
      encryptedCredentials = encryptCredentials({ username, password });
    }

    // Upsert SMTP configuration
    const integration = await prisma.integrationSettings.upsert({
      where: {
        provider_channel: {
          provider: IntegrationProvider.SMTP,
          channel: NotificationChannel.EMAIL,
        },
      },
      create: {
        provider: IntegrationProvider.SMTP,
        channel: NotificationChannel.EMAIL,
        name: 'SMTP Email',
        isEnabled: true,
        isPrimary: true,
        smtpHost: host,
        smtpPort: port,
        smtpSecure: secure,
        fromEmail,
        fromName: fromName || 'Home Health AI',
        credentials: encryptedCredentials ? JSON.parse(encryptedCredentials) : null,
        configuredById: req.user.id,
      },
      update: {
        smtpHost: host,
        smtpPort: port,
        smtpSecure: secure,
        fromEmail,
        fromName: fromName || 'Home Health AI',
        credentials: encryptedCredentials ? JSON.parse(encryptedCredentials) : undefined,
        configuredById: req.user.id,
        isEnabled: true,
      },
    });

    // Set other email integrations as non-primary
    await prisma.integrationSettings.updateMany({
      where: {
        channel: NotificationChannel.EMAIL,
        NOT: { id: integration.id },
      },
      data: { isPrimary: false },
    });

    return res.json({
      message: 'SMTP configured successfully',
      integration: {
        id: integration.id,
        provider: integration.provider,
        isEnabled: integration.isEnabled,
        isPrimary: integration.isPrimary,
        host: integration.smtpHost,
        port: integration.smtpPort,
        fromEmail: integration.fromEmail,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Test SMTP connection
 * POST /api/integrations/email/smtp/test
 */
export async function testSMTP(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await emailService.testSMTPConnection();

    // Update test result in database
    await prisma.integrationSettings.updateMany({
      where: {
        provider: IntegrationProvider.SMTP,
        channel: NotificationChannel.EMAIL,
      },
      data: {
        lastTestedAt: new Date(),
        lastTestResult: result.success,
        lastTestError: result.error || null,
      },
    });

    return res.json({
      success: result.success,
      error: result.error,
      testedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// ENABLE/DISABLE INTEGRATIONS
// ===========================================

/**
 * Enable an integration
 * POST /api/integrations/:provider/enable
 */
export async function enableIntegration(
  req: AuthenticatedRequest & { params: { provider: string } },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const provider = req.params['provider'].toUpperCase() as IntegrationProvider;

    const integration = await prisma.integrationSettings.updateMany({
      where: { provider },
      data: { isEnabled: true },
    });

    if (integration.count === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    return res.json({ message: 'Integration enabled', provider });
  } catch (error) {
    next(error);
  }
}

/**
 * Disable an integration
 * POST /api/integrations/:provider/disable
 */
export async function disableIntegration(
  req: AuthenticatedRequest & { params: { provider: string } },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const provider = req.params['provider'].toUpperCase() as IntegrationProvider;

    const integration = await prisma.integrationSettings.updateMany({
      where: { provider },
      data: { isEnabled: false, isPrimary: false },
    });

    if (integration.count === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    return res.json({ message: 'Integration disabled', provider });
  } catch (error) {
    next(error);
  }
}

/**
 * Set an integration as primary
 * POST /api/integrations/:provider/set-primary
 */
export async function setPrimaryIntegration(
  req: AuthenticatedRequest & { params: { provider: string }; body: { channel: string } },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const provider = req.params['provider'].toUpperCase() as IntegrationProvider;
    const channel = (req.body.channel?.toUpperCase() || 'EMAIL') as NotificationChannel;

    // Clear primary from all integrations of this channel
    await prisma.integrationSettings.updateMany({
      where: { channel },
      data: { isPrimary: false },
    });

    // Set this one as primary
    const integration = await prisma.integrationSettings.updateMany({
      where: { provider, channel },
      data: { isPrimary: true, isEnabled: true },
    });

    if (integration.count === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    return res.json({ message: 'Integration set as primary', provider, channel });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// SEND NOTIFICATION
// ===========================================

interface SendNotificationRequest {
  communicationId: string;
  method?: 'auto' | 'mailto' | 'smtp' | 'microsoft';
  recipientEmail: string;
  recipientName?: string;
  ccEmails?: string[];
}

/**
 * Send a notification/communication
 * POST /api/notifications/:id/send
 */
export async function sendNotification(
  req: AuthenticatedRequest & { params: { id: string }; body: SendNotificationRequest },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const communicationId = req.params['id'];
    const { method = 'auto', recipientEmail, recipientName, ccEmails } = req.body;

    if (!recipientEmail) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'recipientEmail is required',
      });
    }

    // Get the communication
    const communication = await prisma.physicianCommunication.findUnique({
      where: { id: communicationId },
      include: {
        patient: { select: { firstName: true, lastName: true, mrn: true } },
      },
    });

    if (!communication) {
      return res.status(404).json({ error: 'Communication not found' });
    }

    // Build email content
    const emailContent: emailService.EmailContent = {
      to: recipientEmail,
      cc: ccEmails?.join(', '),
      subject: communication.subject,
      body: communication.detailedContent,
      bodyHtml: `<html><body>${communication.detailedContent.replace(/\n/g, '<br>')}</body></html>`,
    };

    // Send the email
    const result = await emailService.sendEmail(emailContent, method);

    // Log the send attempt
    await prisma.communicationSendLog.create({
      data: {
        communicationId,
        channel: NotificationChannel.EMAIL,
        provider: result.provider,
        recipientAddress: recipientEmail,
        status: result.success ? (result.method === 'mailto' ? 'mailto_opened' : 'sent') : 'failed',
        sentAt: result.success && result.method === 'server' ? new Date() : null,
        providerMessageId: result.messageId || null,
        errorMessage: result.error || null,
      },
    });

    // Update communication status
    if (result.success && result.method === 'server') {
      await prisma.physicianCommunication.update({
        where: { id: communicationId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      });
    }

    return res.json({
      success: result.success,
      method: result.method,
      provider: result.provider,
      mailtoUrl: result.mailtoUrl, // For frontend to open
      messageId: result.messageId,
      error: result.error,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get send history for a communication
 * GET /api/communications/:id/send-history
 */
export async function getCommunicationSendHistory(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const communicationId = req.params['id'];

    const history = await prisma.communicationSendLog.findMany({
      where: { communicationId },
      orderBy: { queuedAt: 'desc' },
    });

    return res.json({ history });
  } catch (error) {
    next(error);
  }
}

export default {
  getEmailIntegrationStatus,
  configureSMTP,
  testSMTP,
  enableIntegration,
  disableIntegration,
  setPrimaryIntegration,
  sendNotification,
  getCommunicationSendHistory,
};
