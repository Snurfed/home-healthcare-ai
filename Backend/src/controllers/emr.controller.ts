/**
 * EMR Controller
 *
 * HTTP handlers for EMR integration endpoints.
 * Manages EMR connections, OAuth flow, and patient import.
 */

import { Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { UserRole, Gender, ContactRelationship, PatientStatus, AuditAction } from '../generated/prisma';
import {
  FhirClientService,
  encryptToken,
  fhirPatientToImportData,
  PatientSearchParams,
} from '../services/fhir';

// ===========================================
// TYPE DEFINITIONS
// ===========================================

interface CreateEmrConnectionBody {
  name: string;
  vendor: 'EPIC' | 'CERNER' | 'ALLSCRIPTS' | 'MEDITECH' | 'ATHENAHEALTH' | 'NEXTGEN' | 'CUSTOM';
  fhirBaseUrl: string;
  clientId: string;
  clientSecret?: string;
  scopes: string[];
  authorizationUrl?: string;
  tokenUrl?: string;
}

interface UpdateEmrConnectionBody {
  name?: string;
  fhirBaseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scopes?: string[];
  authorizationUrl?: string;
  tokenUrl?: string;
  isEnabled?: boolean;
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function generateMRN(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `HHC-${timestamp}-${random}`;
}

// ===========================================
// CONNECTION MANAGEMENT (Admin only)
// ===========================================

/**
 * List all EMR connections
 * GET /api/emr/connections
 */
export async function listConnections(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Only admins can see all connections; others see enabled ones
    const where = req.user.role === UserRole.ADMIN
      ? {}
      : { isEnabled: true };

    const connections = await prisma.emrConnection.findMany({
      where,
      select: {
        id: true,
        name: true,
        vendor: true,
        fhirBaseUrl: true,
        isEnabled: true,
        lastConnectedAt: true,
        lastConnectionError: true,
        createdAt: true,
        scopes: true,
        // Don't expose client credentials
      },
      orderBy: { name: 'asc' },
    });

    res.json({ connections });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new EMR connection
 * POST /api/emr/connections
 */
export async function createConnection(
  req: AuthenticatedRequest & { body: CreateEmrConnectionBody },
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Admin only
    if (req.user.role !== UserRole.ADMIN) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const {
      name,
      vendor,
      fhirBaseUrl,
      clientId,
      clientSecret,
      scopes,
      authorizationUrl,
      tokenUrl,
    } = req.body;

    // Validation
    if (!name || !fhirBaseUrl || !clientId) {
      res.status(400).json({
        error: 'Missing required fields: name, fhirBaseUrl, clientId',
      });
      return;
    }

    const connection = await prisma.emrConnection.create({
      data: {
        name,
        vendor,
        fhirBaseUrl: fhirBaseUrl.replace(/\/$/, ''), // Remove trailing slash
        clientId,
        clientSecretEncrypted: clientSecret ? encryptToken(clientSecret) : null,
        scopes: scopes || ['patient/*.read', 'launch/patient'],
        authorizationUrl,
        tokenUrl,
        createdById: req.user.id,
      },
    });

    res.status(201).json({
      message: 'EMR connection created',
      connection: {
        id: connection.id,
        name: connection.name,
        vendor: connection.vendor,
        fhirBaseUrl: connection.fhirBaseUrl,
        isEnabled: connection.isEnabled,
        scopes: connection.scopes,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update an EMR connection
 * PUT /api/emr/connections/:id
 */
export async function updateConnection(
  req: AuthenticatedRequest & { params: { id: string }; body: UpdateEmrConnectionBody },
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (req.user.role !== UserRole.ADMIN) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { id } = req.params;
    const updates = req.body;

    const existing = await prisma.emrConnection.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    const connection = await prisma.emrConnection.update({
      where: { id },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.fhirBaseUrl && { fhirBaseUrl: updates.fhirBaseUrl.replace(/\/$/, '') }),
        ...(updates.clientId && { clientId: updates.clientId }),
        ...(updates.clientSecret && { clientSecretEncrypted: encryptToken(updates.clientSecret) }),
        ...(updates.scopes && { scopes: updates.scopes }),
        ...(updates.authorizationUrl !== undefined && { authorizationUrl: updates.authorizationUrl }),
        ...(updates.tokenUrl !== undefined && { tokenUrl: updates.tokenUrl }),
        ...(updates.isEnabled !== undefined && { isEnabled: updates.isEnabled }),
      },
    });

    res.json({
      message: 'Connection updated',
      connection: {
        id: connection.id,
        name: connection.name,
        vendor: connection.vendor,
        fhirBaseUrl: connection.fhirBaseUrl,
        isEnabled: connection.isEnabled,
        scopes: connection.scopes,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete an EMR connection
 * DELETE /api/emr/connections/:id
 */
export async function deleteConnection(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (req.user.role !== UserRole.ADMIN) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { id } = req.params;

    const existing = await prisma.emrConnection.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    // Delete cascades to tokens, audit logs, and patient links
    await prisma.emrConnection.delete({
      where: { id },
    });

    res.json({ message: 'Connection deleted' });
  } catch (error) {
    next(error);
  }
}

/**
 * Test an EMR connection
 * POST /api/emr/connections/:id/test
 */
export async function testConnection(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (req.user.role !== UserRole.ADMIN) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { id } = req.params;
    const result = await FhirClientService.testConnection(id);

    res.json(result);
  } catch (error) {
    next(error);
  }
}

// ===========================================
// OAUTH FLOW
// ===========================================

/**
 * Get authorization URL for OAuth flow
 * GET /api/emr/connections/:id/authorize
 */
export async function getAuthorizationUrl(
  req: AuthenticatedRequest & { params: { id: string }; query: { redirectUri?: string } },
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const redirectUri = req.query.redirectUri || `${req.protocol}://${req.get('host')}/api/emr/oauth/callback`;

    const authUrl = await FhirClientService.getAuthorizationUrl(
      id,
      req.user.id,
      redirectUri
    );

    res.json({ authorizationUrl: authUrl });
  } catch (error) {
    next(error);
  }
}

/**
 * OAuth callback handler
 * GET /api/emr/oauth/callback
 */
export async function handleOAuthCallback(
  req: AuthenticatedRequest & { query: { code?: string; state?: string; error?: string } },
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      // Redirect to frontend with error
      res.redirect(`/settings/emr?error=${encodeURIComponent(oauthError)}`);
      return;
    }

    if (!code || !state) {
      res.status(400).json({ error: 'Missing code or state parameter' });
      return;
    }

    await FhirClientService.handleOAuthCallback(code, state);

    // Redirect to frontend with success
    res.redirect('/settings/emr?connected=true');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth callback failed';
    res.redirect(`/settings/emr?error=${encodeURIComponent(message)}`);
  }
}

// ===========================================
// PATIENT OPERATIONS
// ===========================================

/**
 * Search patients in EMR
 * GET /api/emr/connections/:id/patients
 */
export async function searchPatients(
  req: AuthenticatedRequest & {
    params: { id: string };
    query: {
      name?: string;
      given?: string;
      family?: string;
      birthdate?: string;
      mrn?: string;
      phone?: string;
      _count?: string;
    };
  },
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { name, given, family, birthdate, mrn, phone, _count } = req.query;

    // Build search params
    const params: PatientSearchParams = {};
    if (name) params.name = name;
    if (given) params.given = given;
    if (family) params.family = family;
    if (birthdate) params.birthdate = birthdate;
    if (mrn) params.identifier = mrn;
    if (phone) params.phone = phone;
    if (_count) params._count = parseInt(_count, 10);

    // Require at least one search parameter
    if (Object.keys(params).length === 0) {
      res.status(400).json({
        error: 'At least one search parameter required (name, given, family, birthdate, mrn, phone)',
      });
      return;
    }

    const results = await FhirClientService.searchPatients(id, req.user.id, params);

    res.json({ patients: results });
  } catch (error) {
    if (error instanceof Error && error.message.includes('re-authorize')) {
      res.status(401).json({
        error: 'EMR authorization required',
        requiresAuth: true,
      });
      return;
    }
    next(error);
  }
}

/**
 * Get a single patient from EMR
 * GET /api/emr/connections/:id/patients/:fhirId
 */
export async function getPatient(
  req: AuthenticatedRequest & { params: { id: string; fhirId: string } },
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id, fhirId } = req.params;

    const patient = await FhirClientService.getPatient(id, req.user.id, fhirId);

    // Also get import data for preview
    const importData = fhirPatientToImportData(patient);

    res.json({
      fhirPatient: patient,
      importPreview: importData,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('re-authorize')) {
      res.status(401).json({
        error: 'EMR authorization required',
        requiresAuth: true,
      });
      return;
    }
    next(error);
  }
}

/**
 * Check for duplicate patients before import
 * POST /api/emr/connections/:id/patients/:fhirId/check-duplicates
 */
export async function checkDuplicates(
  req: AuthenticatedRequest & { params: { id: string; fhirId: string } },
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id, fhirId } = req.params;

    // Get patient data from EMR
    const fhirPatient = await FhirClientService.getPatient(id, req.user.id, fhirId);
    const importData = fhirPatientToImportData(fhirPatient);

    // Check for existing link (already imported)
    const existingLink = await prisma.emrPatientLink.findUnique({
      where: {
        connectionId_fhirPatientId: { connectionId: id, fhirPatientId: fhirId },
      },
      include: { patient: true },
    });

    if (existingLink) {
      res.json({
        isDuplicate: true,
        existingPatient: {
          id: existingLink.patient.id,
          mrn: existingLink.patient.mrn,
          firstName: existingLink.patient.firstName,
          lastName: existingLink.patient.lastName,
        },
        reason: 'already_imported',
      });
      return;
    }

    // Check for potential duplicates by name + DOB
    const potentialDuplicates = await prisma.patient.findMany({
      where: {
        deletedAt: null,
        firstName: { equals: importData.firstName, mode: 'insensitive' },
        lastName: { equals: importData.lastName, mode: 'insensitive' },
        dateOfBirth: new Date(importData.dateOfBirth),
      },
      select: {
        id: true,
        mrn: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        phoneMobile: true,
      },
    });

    if (potentialDuplicates.length > 0) {
      res.json({
        isDuplicate: true,
        potentialMatches: potentialDuplicates,
        reason: 'potential_match',
      });
      return;
    }

    res.json({ isDuplicate: false });
  } catch (error) {
    next(error);
  }
}

/**
 * Import a patient from EMR
 * POST /api/emr/connections/:id/patients/:fhirId/import
 */
export async function importPatient(
  req: AuthenticatedRequest & {
    params: { id: string; fhirId: string };
    body: { overrides?: Record<string, unknown>; forceImport?: boolean };
  },
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check permission (only roles that can create patients)
    const allowedRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE];
    if (!allowedRoles.includes(req.user.role as UserRole)) {
      res.status(403).json({ error: 'You do not have permission to import patients' });
      return;
    }

    const { id: connectionId, fhirId } = req.params;
    const { overrides, forceImport } = req.body;

    // Check if already imported
    const existingLink = await prisma.emrPatientLink.findUnique({
      where: {
        connectionId_fhirPatientId: { connectionId, fhirPatientId: fhirId },
      },
    });

    if (existingLink && !forceImport) {
      res.status(409).json({
        error: 'Patient already imported',
        patientId: existingLink.patientId,
      });
      return;
    }

    // Get patient data from EMR
    const fhirPatient = await FhirClientService.getPatient(connectionId, req.user.id, fhirId);
    const importData = fhirPatientToImportData(fhirPatient);

    // Apply overrides
    const finalData = { ...importData, ...overrides };

    // Generate MRN
    let mrn = generateMRN();
    let mrnExists = await prisma.patient.findUnique({ where: { mrn } });
    while (mrnExists) {
      mrn = generateMRN();
      mrnExists = await prisma.patient.findUnique({ where: { mrn } });
    }

    // Create patient in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create patient
      const patient = await tx.patient.create({
        data: {
          mrn,
          firstName: finalData.firstName,
          lastName: finalData.lastName,
          middleName: finalData.middleName || null,
          dateOfBirth: new Date(finalData.dateOfBirth),
          gender: finalData.gender as Gender,
          phoneMobile: finalData.phoneMobile,
          phoneHome: finalData.phoneHome || null,
          email: finalData.email || null,
          addressStreet1: finalData.addressStreet1,
          addressStreet2: finalData.addressStreet2 || null,
          addressCity: finalData.addressCity,
          addressState: finalData.addressState,
          addressZipCode: finalData.addressZipCode,
          preferredLanguage: finalData.preferredLanguage || 'English',
          primaryPhysicianName: finalData.primaryPhysicianName || null,
          primaryPhysicianPhone: finalData.primaryPhysicianPhone || null,
          status: PatientStatus.PENDING,
          createdById: req.user!.id,
          updatedById: req.user!.id,
        },
      });

      // Create emergency contacts
      if (finalData.emergencyContacts && finalData.emergencyContacts.length > 0) {
        type EmergencyContactInput = {
          firstName: string;
          lastName: string;
          relationship: string;
          phoneMobile: string;
          isPrimaryContact: boolean;
        };
        await tx.emergencyContact.createMany({
          data: finalData.emergencyContacts.map((ec: EmergencyContactInput, index: number) => ({
            patientId: patient.id,
            firstName: ec.firstName,
            lastName: ec.lastName,
            relationship: ec.relationship as ContactRelationship,
            phoneMobile: ec.phoneMobile,
            isPrimaryContact: ec.isPrimaryContact || index === 0,
          })),
        });
      }

      // Create EMR link
      const link = await tx.emrPatientLink.create({
        data: {
          patientId: patient.id,
          connectionId,
          fhirPatientId: fhirId,
          mrn: importData.phoneMobile, // Store original EMR MRN if different
          fhirResourceJson: fhirPatient as object,
        },
      });

      // Audit log
      await tx.emrAuditLog.create({
        data: {
          connectionId,
          userId: req.user!.id,
          action: 'IMPORT',
          resourceType: 'Patient',
          resourceId: fhirId,
          requestUrl: `Patient/${fhirId}/import`,
          responseStatus: 201,
          patientFhirId: fhirId,
          patientLocalId: patient.id,
        },
      });

      // HIPAA audit log
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          userEmail: req.user!.email,
          userRole: req.user!.role,
          action: AuditAction.CREATE,
          resourceType: 'patient',
          resourceId: patient.id,
          resourceName: `${patient.lastName}, ${patient.firstName}`,
          description: `Imported patient from EMR (FHIR ID: ${fhirId})`,
          phiAccessed: true,
          phiFields: ['firstName', 'lastName', 'dateOfBirth', 'address', 'phone'],
          success: true,
          ipAddress: req.ip || null,
          userAgent: req.get('user-agent') || null,
          retentionExpiresAt: new Date(Date.now() + 6 * 365 * 24 * 60 * 60 * 1000), // 6 years
        },
      });

      return { patient, link };
    });

    res.status(201).json({
      message: 'Patient imported successfully',
      patient: {
        id: result.patient.id,
        mrn: result.patient.mrn,
        firstName: result.patient.firstName,
        lastName: result.patient.lastName,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get connection status for current user
 * GET /api/emr/connections/:id/status
 */
export async function getConnectionStatus(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const connection = await prisma.emrConnection.findUnique({
      where: { id },
    });

    if (!connection) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    // Check if user has valid token
    const token = await prisma.emrAccessToken.findUnique({
      where: {
        connectionId_userId: { connectionId: id, userId: req.user.id },
      },
    });

    const isAuthorized = token && !token.isRevoked && token.expiresAt > new Date();

    res.json({
      connectionId: id,
      connectionName: connection.name,
      isEnabled: connection.isEnabled,
      isAuthorized,
      lastConnectedAt: connection.lastConnectedAt,
      tokenExpiresAt: token?.expiresAt,
    });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  listConnections,
  createConnection,
  updateConnection,
  deleteConnection,
  testConnection,
  getAuthorizationUrl,
  handleOAuthCallback,
  searchPatients,
  getPatient,
  checkDuplicates,
  importPatient,
  getConnectionStatus,
};
