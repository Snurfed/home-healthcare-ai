/**
 * Referral Documents Controller
 *
 * Handles CRUD operations for referral document uploads and extraction.
 */

import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  UserRole,
  ReferralDocumentType,
  ExtractionStatus,
  PHILevel,
  AuditAction,
  Prisma,
} from '../generated/prisma';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { extractFromDocument } from '../services/referralExtraction.service';

// ===========================================
// CONFIGURATION
// ===========================================

const UPLOAD_DIR = process.env['REFERRAL_UPLOAD_DIR'] || './uploads/referrals';
const MAX_FILE_SIZE = parseInt(process.env['MAX_REFERRAL_SIZE'] || '52428800', 10); // 50MB default

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MIME_TO_FILE_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/tiff': 'tiff',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export interface FileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
}

export type UploadReferralRequest = AuthenticatedRequest & {
  params: { patientId: string };
  body: {
    assessmentId?: string;
    documentType?: ReferralDocumentType;
    title?: string;
    description?: string;
    processExtraction?: boolean;
  };
  file?: FileUpload;
};

export interface ListReferralsQuery {
  page?: string;
  limit?: string;
  documentType?: ReferralDocumentType;
  extractionStatus?: ExtractionStatus;
  startDate?: string;
  endDate?: string;
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Create audit log for referral document operations
 */
async function createReferralAuditLog(
  action: AuditAction,
  userId: string,
  userEmail: string,
  userRole: string,
  resourceId: string,
  _patientId: string | null,
  success: boolean,
  req: AuthenticatedRequest,
  options: {
    description?: string;
    previousValues?: object;
    newValues?: object;
    errorMessage?: string;
  } = {}
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        userEmail,
        userRole,
        action,
        resourceType: 'referral_document',
        resourceId,
        description: options.description,
        previousValues: options.previousValues ? JSON.parse(JSON.stringify(options.previousValues)) : null,
        newValues: options.newValues ? JSON.parse(JSON.stringify(options.newValues)) : null,
        phiAccessed: true,
        phiFields: ['document_content', 'patient_data'],
        success,
        errorMessage: options.errorMessage,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.get('user-agent') || null,
        timestamp: new Date(),
        retentionExpiresAt: new Date(Date.now() + 6 * 365 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (error) {
    console.error('[Referral Audit Log Error]', error);
  }
}

/**
 * Ensure upload directory exists
 */
function ensureUploadDir(patientId: string): string {
  const patientDir = path.join(UPLOAD_DIR, patientId);
  if (!fs.existsSync(patientDir)) {
    fs.mkdirSync(patientDir, { recursive: true });
  }
  return patientDir;
}

/**
 * Calculate file checksum (SHA-256)
 */
function calculateChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Validate file upload
 */
function validateFile(file?: FileUpload): string[] {
  const errors: string[] = [];

  if (!file) {
    errors.push('No file provided');
    return errors;
  }

  if (!SUPPORTED_MIME_TYPES.includes(file.mimetype)) {
    errors.push(`Unsupported file type: ${file.mimetype}. Supported: PDF, JPEG, PNG, TIFF, DOC, DOCX`);
  }

  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)`);
  }

  if (file.size === 0) {
    errors.push('File is empty');
  }

  return errors;
}

/**
 * Save file to storage
 */
async function saveFile(
  file: FileUpload,
  patientId: string,
  documentId: string
): Promise<{ filePath: string; checksum: string }> {
  const uploadDir = ensureUploadDir(patientId);
  const ext = path.extname(file.originalname) || `.${MIME_TO_FILE_TYPE[file.mimetype] || 'bin'}`;
  const storedFileName = `${documentId}${ext}`;
  const filePath = path.join(uploadDir, storedFileName);

  let buffer: Buffer;
  if (file.buffer) {
    buffer = file.buffer;
  } else if (file.path) {
    buffer = await fs.promises.readFile(file.path);
  } else {
    throw new Error('No file data provided');
  }

  const checksum = calculateChecksum(buffer);
  await fs.promises.writeFile(filePath, buffer);

  return { filePath, checksum };
}

/**
 * Check if user has access to patient's referral documents
 */
async function checkPatientAccess(
  userId: string,
  userRole: UserRole,
  patientId: string
): Promise<boolean> {
  if (userRole === UserRole.ADMIN || userRole === UserRole.SUPERVISOR) {
    return true;
  }

  const assignment = await prisma.patientAssignment.findFirst({
    where: {
      patientId,
      userId,
      endDate: null,
    },
  });

  return !!assignment;
}

// ===========================================
// CONTROLLER FUNCTIONS
// ===========================================

/**
 * Upload a referral document
 * POST /api/patients/:patientId/referrals/upload
 */
export async function uploadReferral(
  req: UploadReferralRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const patientId = req.params['patientId'];

    // Validate file
    const fileErrors = validateFile(req.file);
    if (fileErrors.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid file',
        errors: fileErrors,
      });
    }

    const file = req.file!;
    const {
      assessmentId,
      documentType = ReferralDocumentType.REFERRAL,
      title,
      description,
      processExtraction = false,
    } = req.body;

    // Validate patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, firstName: true, lastName: true, deletedAt: true },
    });

    if (!patient || patient.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Patient not found',
      });
    }

    // Check access
    const hasAccess = await checkPatientAccess(req.user.id, req.user.role, patient.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to upload documents for this patient',
      });
    }

    // Validate assessment if provided
    if (assessmentId) {
      const assessment = await prisma.oasisAssessment.findUnique({
        where: { id: assessmentId },
        select: { id: true, patientId: true, deletedAt: true },
      });
      if (!assessment || assessment.deletedAt) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Assessment not found',
        });
      }
      if (assessment.patientId !== patient.id) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Assessment does not belong to the specified patient',
        });
      }
    }

    const documentId = uuidv4();
    const fileType = MIME_TO_FILE_TYPE[file.mimetype] || 'unknown';

    // Save file
    const { filePath, checksum } = await saveFile(file, patient.id, documentId);

    // Create referral document record
    const referralDoc = await prisma.referralDocument.create({
      data: {
        id: documentId,
        patient: { connect: { id: patient.id } },
        assessment: assessmentId ? { connect: { id: assessmentId } } : undefined,
        fileName: file.originalname,
        fileType,
        fileUrl: filePath,
        fileSize: file.size,
        checksum,
        uploadedBy: { connect: { id: req.user.id } },
        documentType,
        title: title?.trim() || file.originalname,
        description: description?.trim() || null,
        extractionStatus: processExtraction ? ExtractionStatus.PENDING : ExtractionStatus.PENDING,
        phiLevel: PHILevel.HIGH,
        isEncrypted: true,
      },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, mrn: true },
        },
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Always trigger extraction asynchronously (don't block the upload response)
    // Update status to processing
    await prisma.referralDocument.update({
      where: { id: documentId },
      data: { extractionStatus: ExtractionStatus.PROCESSING },
    });

    // Run extraction (fire and forget - frontend can poll for status)
    extractFromDocument(filePath, { documentType, mapToOasisCodes: true })
      .then(async (result) => {
        await prisma.referralDocument.update({
          where: { id: documentId },
          data: {
            extractionStatus: result.success ? ExtractionStatus.COMPLETED : ExtractionStatus.FAILED,
            extractedData: result.extractedData as unknown as Prisma.InputJsonValue,
            rawText: result.rawText,
            extractionError: result.error || null,
            extractedAt: new Date(),
          },
        });
        console.log(`[Referral Upload] Extraction completed for ${documentId}: ${result.extractedFields.length} fields extracted`);
      })
      .catch(async (error) => {
        console.error(`[Referral Upload] Extraction failed for ${documentId}:`, error);
        await prisma.referralDocument.update({
          where: { id: documentId },
          data: {
            extractionStatus: ExtractionStatus.FAILED,
            extractionError: error.message,
          },
        });
      });

    // Audit log
    await createReferralAuditLog(
      AuditAction.UPLOAD,
      req.user.id,
      req.user.email,
      req.user.role,
      documentId,
      patient.id,
      true,
      req,
      {
        description: `Uploaded referral document: ${file.originalname} for patient ${patient.lastName}, ${patient.firstName}`,
        newValues: {
          documentType,
          fileName: file.originalname,
          fileSize: file.size,
        },
      }
    );

    return res.status(201).json({
      message: 'Referral document uploaded successfully',
      referralDocument: {
        id: referralDoc.id,
        patientId: referralDoc.patientId,
        assessmentId: referralDoc.assessmentId,
        fileName: referralDoc.fileName,
        fileType: referralDoc.fileType,
        fileSize: referralDoc.fileSize,
        documentType: referralDoc.documentType,
        title: referralDoc.title,
        description: referralDoc.description,
        extractionStatus: referralDoc.extractionStatus,
        patient: referralDoc.patient,
        uploadedBy: referralDoc.uploadedBy,
        uploadedAt: referralDoc.uploadedAt,
        createdAt: referralDoc.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List referral documents for a patient
 * GET /api/patients/:patientId/referrals
 */
export async function listReferrals(
  req: AuthenticatedRequest & { params: { patientId: string }; query: ListReferralsQuery },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const patientId = req.params['patientId'];
    const {
      page = '1',
      limit = '20',
      documentType,
      extractionStatus,
      startDate,
      endDate,
    } = req.query;

    // Validate patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, deletedAt: true },
    });

    if (!patient || patient.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Patient not found',
      });
    }

    // Check access
    const hasAccess = await checkPatientAccess(req.user.id, req.user.role, patient.id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to view documents for this patient',
      });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: Prisma.ReferralDocumentWhereInput = {
      patientId: patient.id,
      deletedAt: null,
    };

    if (documentType) where.documentType = documentType;
    if (extractionStatus) where.extractionStatus = extractionStatus;

    if (startDate || endDate) {
      where.uploadedAt = {};
      if (startDate) where.uploadedAt.gte = new Date(startDate);
      if (endDate) where.uploadedAt.lte = new Date(endDate);
    }

    const [referrals, total] = await Promise.all([
      prisma.referralDocument.findMany({
        where,
        orderBy: { uploadedAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true,
          patientId: true,
          assessmentId: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          documentType: true,
          title: true,
          description: true,
          extractionStatus: true,
          uploadedAt: true,
          createdAt: true,
          uploadedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.referralDocument.count({ where }),
    ]);

    // Audit log
    await createReferralAuditLog(
      AuditAction.READ,
      req.user.id,
      req.user.email,
      req.user.role,
      'list',
      patient.id,
      true,
      req,
      {
        description: `Listed ${referrals.length} referral documents for patient`,
      }
    );

    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      data: referrals,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single referral document with extracted data
 * GET /api/referrals/:id
 */
export async function getReferral(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { id } = req.params;

    const referral = await prisma.referralDocument.findUnique({
      where: { id },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, mrn: true },
        },
        assessment: {
          select: { id: true, assessmentType: true, status: true },
        },
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!referral || referral.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Referral document not found',
      });
    }

    // Check access
    const hasAccess = await checkPatientAccess(req.user.id, req.user.role, referral.patientId);
    if (!hasAccess) {
      await createReferralAuditLog(
        AuditAction.READ,
        req.user.id,
        req.user.email,
        req.user.role,
        id,
        referral.patientId,
        false,
        req,
        { errorMessage: 'Access denied' }
      );

      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this document',
      });
    }

    // Audit log
    await createReferralAuditLog(
      AuditAction.READ,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      referral.patientId,
      true,
      req,
      {
        description: `Viewed referral document: ${referral.title}`,
      }
    );

    // DEBUG: Log extracted data
    console.log('\n[GetReferral] Returning document:', referral.id);
    console.log('[GetReferral] extractedData type:', typeof referral.extractedData);
    if (referral.extractedData && typeof referral.extractedData === 'object') {
      const data = referral.extractedData as Record<string, unknown>;
      console.log('[GetReferral] extractedData keys:', Object.keys(data));
      console.log('[GetReferral] oasisMappings count:', data.oasisMappings ? Object.keys(data.oasisMappings as object).length : 'none');
      console.log('[GetReferral] diagnoses count:', Array.isArray(data.diagnoses) ? data.diagnoses.length : 'none');
    }

    // Map backend fields to frontend expected fields
    const mimeTypeMap: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      tiff: 'image/tiff',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    return res.status(200).json({
      id: referral.id,
      patientId: referral.patientId,
      assessmentId: referral.assessmentId,
      fileName: referral.fileName,
      originalFileName: referral.fileName, // Frontend expects this
      fileType: referral.fileType,
      mimeType: mimeTypeMap[referral.fileType] || 'application/octet-stream', // Frontend expects this
      fileSize: referral.fileSize,
      filePath: referral.fileUrl, // Frontend expects filePath
      documentType: referral.documentType,
      title: referral.title,
      description: referral.description,
      extractionStatus: referral.extractionStatus,
      extractedData: referral.extractedData,
      rawText: referral.rawText,
      extractionError: referral.extractionError,
      extractedAt: referral.extractedAt,
      patient: referral.patient,
      assessment: referral.assessment,
      uploadedBy: referral.uploadedBy,
      uploadedById: referral.uploadedById,
      uploadedAt: referral.uploadedAt,
      createdAt: referral.createdAt,
      updatedAt: referral.updatedAt,
      isDeleted: !!referral.deletedAt,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update referral document (extraction status or extracted data)
 * PATCH /api/referrals/:id
 */
export async function updateReferral(
  req: AuthenticatedRequest & {
    params: { id: string };
    body: {
      extractionStatus?: ExtractionStatus;
      extractedData?: object;
      title?: string;
      description?: string;
      assessmentId?: string;
    };
  },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { id } = req.params;
    const body = req.body;

    const referral = await prisma.referralDocument.findUnique({
      where: { id },
    });

    if (!referral || referral.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Referral document not found',
      });
    }

    // Check access
    const hasAccess = await checkPatientAccess(req.user.id, req.user.role, referral.patientId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to update this document',
      });
    }

    // Build update data
    const updateData: Prisma.ReferralDocumentUpdateInput = {};

    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.extractionStatus !== undefined) updateData.extractionStatus = body.extractionStatus;
    if (body.extractedData !== undefined) {
      updateData.extractedData = body.extractedData as Prisma.InputJsonValue;
      updateData.extractedAt = new Date();
    }
    if (body.assessmentId !== undefined) {
      if (body.assessmentId) {
        const assessment = await prisma.oasisAssessment.findUnique({
          where: { id: body.assessmentId },
          select: { patientId: true },
        });
        if (!assessment || assessment.patientId !== referral.patientId) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid assessment ID',
          });
        }
        updateData.assessment = { connect: { id: body.assessmentId } };
      } else {
        updateData.assessment = { disconnect: true };
      }
    }

    const updatedReferral = await prisma.referralDocument.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await createReferralAuditLog(
      AuditAction.UPDATE,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      referral.patientId,
      true,
      req,
      {
        description: `Updated referral document: ${updatedReferral.title}`,
        previousValues: {
          extractionStatus: referral.extractionStatus,
          title: referral.title,
        },
        newValues: {
          extractionStatus: updatedReferral.extractionStatus,
          title: updatedReferral.title,
        },
      }
    );

    return res.status(200).json({
      message: 'Referral document updated successfully',
      referralDocument: {
        id: updatedReferral.id,
        title: updatedReferral.title,
        description: updatedReferral.description,
        extractionStatus: updatedReferral.extractionStatus,
        assessmentId: updatedReferral.assessmentId,
        updatedAt: updatedReferral.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a referral document (soft delete)
 * DELETE /api/referrals/:id
 */
export async function deleteReferral(
  req: AuthenticatedRequest & { params: { id: string }; body: { reason?: string } },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { id } = req.params;
    const { reason } = req.body;

    const referral = await prisma.referralDocument.findUnique({
      where: { id },
    });

    if (!referral) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Referral document not found',
      });
    }

    if (referral.deletedAt) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Document has already been deleted',
      });
    }

    // Only uploader, admins, or supervisors can delete
    const canDelete =
      referral.uploadedById === req.user.id ||
      req.user.role === UserRole.ADMIN ||
      req.user.role === UserRole.SUPERVISOR;

    if (!canDelete) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to delete this document',
      });
    }

    // Soft delete
    await prisma.referralDocument.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    // Audit log
    await createReferralAuditLog(
      AuditAction.DELETE,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      referral.patientId,
      true,
      req,
      {
        description: `Deleted referral document: ${referral.title}. Reason: ${reason || 'Not specified'}`,
      }
    );

    return res.status(200).json({
      message: 'Referral document deleted successfully',
      referralDocumentId: id,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Trigger extraction processing for a document
 * POST /api/referrals/:id/extract
 */
export async function triggerExtraction(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { id } = req.params;

    const referral = await prisma.referralDocument.findUnique({
      where: { id },
    });

    if (!referral || referral.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Referral document not found',
      });
    }

    // Check access
    const hasAccess = await checkPatientAccess(req.user.id, req.user.role, referral.patientId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to process this document',
      });
    }

    // Update status to processing
    await prisma.referralDocument.update({
      where: { id },
      data: {
        extractionStatus: ExtractionStatus.PROCESSING,
        extractionError: null,
      },
    });

    // Run extraction (fire and forget)
    extractFromDocument(referral.fileUrl, {
      documentType: referral.documentType,
      mapToOasisCodes: true,
    })
      .then(async (result) => {
        await prisma.referralDocument.update({
          where: { id },
          data: {
            extractionStatus: result.success ? ExtractionStatus.COMPLETED : ExtractionStatus.FAILED,
            extractedData: result.extractedData as unknown as Prisma.InputJsonValue,
            rawText: result.rawText,
            extractionError: result.error || null,
            extractedAt: new Date(),
          },
        });
        console.log(`[Referral Extraction] Completed for document ${id}: ${result.extractedFields.length} fields extracted`);
      })
      .catch(async (error) => {
        console.error(`[Referral Extraction] Failed for document ${id}:`, error);
        await prisma.referralDocument.update({
          where: { id },
          data: {
            extractionStatus: ExtractionStatus.FAILED,
            extractionError: error.message,
          },
        });
      });

    // Audit log
    await createReferralAuditLog(
      AuditAction.UPDATE,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      referral.patientId,
      true,
      req,
      {
        description: `Triggered extraction for referral document: ${referral.title}`,
      }
    );

    return res.status(202).json({
      message: 'Extraction processing started',
      referralDocumentId: id,
      status: ExtractionStatus.PROCESSING,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get extraction status for polling
 * GET /api/referrals/:id/status
 */
export async function getExtractionStatus(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { id } = req.params;

    const referral = await prisma.referralDocument.findUnique({
      where: { id },
      select: {
        id: true,
        patientId: true,
        extractionStatus: true,
        extractionError: true,
        extractedAt: true,
        extractedData: true,
        deletedAt: true,
      },
    });

    if (!referral || referral.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Referral document not found',
      });
    }

    // Check access
    const hasAccess = await checkPatientAccess(req.user.id, req.user.role, referral.patientId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this document',
      });
    }

    // Calculate extracted field count
    let extractedFieldCount = 0;
    if (referral.extractedData && typeof referral.extractedData === 'object') {
      const data = referral.extractedData as Record<string, unknown>;
      const mappings = data['oasisMappings'];
      if (mappings && typeof mappings === 'object') {
        extractedFieldCount = Object.keys(mappings as object).length;
      }
    }

    return res.status(200).json({
      id: referral.id,
      extractionStatus: referral.extractionStatus,
      extractionError: referral.extractionError,
      extractedAt: referral.extractedAt,
      extractedFieldCount,
      isComplete: referral.extractionStatus === ExtractionStatus.COMPLETED,
      isFailed: referral.extractionStatus === ExtractionStatus.FAILED,
      isProcessing: referral.extractionStatus === ExtractionStatus.PROCESSING,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Apply extracted data to an assessment
 * POST /api/referrals/:id/apply
 */
export async function applyToAssessment(
  req: AuthenticatedRequest & {
    params: { id: string };
    body: {
      assessmentId: string;
      acceptedFields: Record<string, string>;
    };
  },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { id } = req.params;
    const { assessmentId, acceptedFields } = req.body;

    // DEBUG LOGGING
    console.log('\n' + '='.repeat(80));
    console.log('[Apply to Assessment] REQUEST RECEIVED');
    console.log('='.repeat(80));
    console.log(`[Apply] Referral ID: ${id}`);
    console.log(`[Apply] Assessment ID: ${assessmentId}`);
    console.log(`[Apply] Accepted Fields count: ${Object.keys(acceptedFields || {}).length}`);
    console.log(`[Apply] Accepted Fields:`, JSON.stringify(acceptedFields, null, 2));
    console.log('='.repeat(80));

    if (!assessmentId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Assessment ID is required',
      });
    }

    if (!acceptedFields || typeof acceptedFields !== 'object' || Object.keys(acceptedFields).length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'At least one accepted field is required',
      });
    }

    // Get referral document
    const referral = await prisma.referralDocument.findUnique({
      where: { id },
    });

    if (!referral || referral.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Referral document not found',
      });
    }

    if (referral.extractionStatus !== ExtractionStatus.COMPLETED) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Extraction must be completed before applying to assessment',
      });
    }

    // Get assessment
    const assessment = await prisma.oasisAssessment.findUnique({
      where: { id: assessmentId },
      select: { id: true, patientId: true, deletedAt: true },
    });

    if (!assessment || assessment.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Assessment not found',
      });
    }

    // Verify patient matches
    if (assessment.patientId !== referral.patientId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Assessment patient does not match referral document patient',
      });
    }

    // Check access
    const hasAccess = await checkPatientAccess(req.user.id, req.user.role, referral.patientId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to modify this assessment',
      });
    }

    // Get extracted data to find source text for each field
    const extractedData = referral.extractedData as Record<string, unknown> | null;
    const oasisMappings = extractedData?.['oasisMappings'] as Record<string, { value: string; sourceText?: string; confidence?: number }> | undefined;

    // Create/update OASIS responses using upsert
    const responsePromises = Object.entries(acceptedFields).map(async ([itemCode, fieldValue]) => {
      const value = fieldValue as string;
      // Find the section for this item code
      let section = 'unknown';
      if (itemCode.startsWith('GG0130')) section = 'functional_abilities';
      else if (itemCode.startsWith('GG0170')) section = 'functional_abilities';
      else if (itemCode.startsWith('GG0100')) section = 'functional_abilities';
      else if (itemCode.startsWith('GG0110')) section = 'functional_abilities';
      else if (itemCode.startsWith('M18')) section = 'functional_status';
      else if (itemCode.startsWith('M1')) section = 'patient_history';
      else if (itemCode.startsWith('M2')) section = 'care_management';
      else if (itemCode.startsWith('M0')) section = 'administrative';
      else if (itemCode.startsWith('A1')) section = 'administrative';
      else if (itemCode.startsWith('N0')) section = 'medications';

      const sourceMapping = oasisMappings?.[itemCode];

      return prisma.oasisResponse.upsert({
        where: {
          assessmentId_itemCode: {
            assessmentId,
            itemCode,
          },
        },
        create: {
          assessmentId,
          itemCode,
          section,
          responseCode: value,
          responseValue: value,
          sourceType: 'ocr', // 'ocr' indicates it came from document extraction
          sourceText: sourceMapping?.sourceText || null,
          confidence: sourceMapping?.confidence ? new Prisma.Decimal(sourceMapping.confidence) : null,
          requiresReview: (sourceMapping?.confidence || 0) < 0.8,
          reviewReason: (sourceMapping?.confidence || 0) < 0.8 ? 'Low confidence extraction from referral document' : null,
        },
        update: {
          responseCode: value,
          responseValue: value,
          sourceType: 'ocr',
          sourceText: sourceMapping?.sourceText || null,
          confidence: sourceMapping?.confidence ? new Prisma.Decimal(sourceMapping.confidence) : null,
          requiresReview: (sourceMapping?.confidence || 0) < 0.8,
          reviewReason: (sourceMapping?.confidence || 0) < 0.8 ? 'Low confidence extraction from referral document' : null,
          updatedAt: new Date(),
        },
      });
    });

    const createdResponses = await Promise.all(responsePromises);

    // DEBUG: Log what was saved
    console.log('\n[Apply] RESPONSES SAVED:');
    console.log(`[Apply] Total responses created/updated: ${createdResponses.length}`);
    for (const resp of createdResponses.slice(0, 5)) {
      console.log(`  - ${resp.itemCode}: "${resp.responseValue}" (section: ${resp.section})`);
    }
    if (createdResponses.length > 5) {
      console.log(`  ... and ${createdResponses.length - 5} more`);
    }

    // Link referral to assessment if not already linked
    if (!referral.assessmentId) {
      await prisma.referralDocument.update({
        where: { id },
        data: { assessment: { connect: { id: assessmentId } } },
      });
    }

    // Update assessment completion percentage (simplified calculation)
    const totalResponses = await prisma.oasisResponse.count({
      where: { assessmentId },
    });

    // Estimate completion based on responses (rough approximation)
    const estimatedCompletion = Math.min(100, Math.round((totalResponses / 150) * 100));

    await prisma.oasisAssessment.update({
      where: { id: assessmentId },
      data: {
        completionPercentage: estimatedCompletion,
      },
    });

    // DEBUG: Verify database state
    console.log('\n[Apply] DATABASE STATE AFTER SAVE:');
    console.log(`[Apply] Total responses for assessment: ${totalResponses}`);
    console.log(`[Apply] Estimated completion: ${estimatedCompletion}%`);

    // Query actual responses to verify
    const verifyResponses = await prisma.oasisResponse.findMany({
      where: { assessmentId },
      select: { itemCode: true, responseValue: true, sourceType: true },
      take: 10,
    });
    console.log(`[Apply] Sample responses in DB:`);
    for (const r of verifyResponses) {
      console.log(`  - ${r.itemCode}: "${r.responseValue}" (source: ${r.sourceType})`);
    }
    console.log('='.repeat(80) + '\n');

    // Audit log
    await createReferralAuditLog(
      AuditAction.UPDATE,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      referral.patientId,
      true,
      req,
      {
        description: `Applied ${createdResponses.length} extracted fields to assessment ${assessmentId}`,
        newValues: {
          assessmentId,
          fieldsApplied: Object.keys(acceptedFields),
        },
      }
    );

    return res.status(200).json({
      message: 'Extracted data applied to assessment successfully',
      appliedFields: createdResponses.length, // Frontend expects 'appliedFields' not 'appliedCount'
      appliedCount: createdResponses.length, // Keep for backwards compatibility
      assessmentId,
      referralDocumentId: id,
      updatedFields: Object.keys(acceptedFields),
      assessmentCompletion: estimatedCompletion,
    });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  uploadReferral,
  listReferrals,
  getReferral,
  updateReferral,
  deleteReferral,
  triggerExtraction,
  getExtractionStatus,
  applyToAssessment,
};
