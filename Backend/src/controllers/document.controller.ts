import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import Anthropic from '@anthropic-ai/sdk';
import { extractTextFromDocument } from '../services/referralExtraction.service';
import {
  UserRole,
  DocumentCategory,
  DocumentStatus,
  ReviewStatus,
  PHILevel,
  AuditAction,
  Prisma,
} from '../generated/prisma';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

import { MODELS } from '../config/models';
// ===========================================
// CONFIGURATION
// ===========================================

const UPLOAD_DIR = process.env.DOCUMENT_UPLOAD_DIR || './uploads/documents';
const MAX_FILE_SIZE = parseInt(process.env.MAX_DOCUMENT_SIZE || '52428800', 10); // 50MB default
const DEFAULT_STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local';

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/heic',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

// Document category metadata with retention and PHI levels
const CATEGORY_METADATA: Record<DocumentCategory, { retentionDays: number; phiLevel: PHILevel; requiresSignature: boolean }> = {
  REFERRAL: { retentionDays: 2555, phiLevel: PHILevel.HIGH, requiresSignature: true },
  PHYSICIAN_ORDER: { retentionDays: 2555, phiLevel: PHILevel.HIGH, requiresSignature: true },
  FACE_TO_FACE: { retentionDays: 2555, phiLevel: PHILevel.HIGH, requiresSignature: true },
  PLAN_OF_CARE: { retentionDays: 2555, phiLevel: PHILevel.HIGH, requiresSignature: true },
  PROGRESS_NOTE: { retentionDays: 2555, phiLevel: PHILevel.HIGH, requiresSignature: false },
  ASSESSMENT: { retentionDays: 2555, phiLevel: PHILevel.HIGH, requiresSignature: false },
  CONSENT_FORM: { retentionDays: 2555, phiLevel: PHILevel.MEDIUM, requiresSignature: false },
  INSURANCE_CARD: { retentionDays: 365, phiLevel: PHILevel.HIGH, requiresSignature: false },
  IDENTIFICATION: { retentionDays: 365, phiLevel: PHILevel.CRITICAL, requiresSignature: false },
  MEDICATION_LIST: { retentionDays: 2555, phiLevel: PHILevel.HIGH, requiresSignature: false },
  LAB_RESULT: { retentionDays: 2555, phiLevel: PHILevel.HIGH, requiresSignature: false },
  IMAGING: { retentionDays: 2555, phiLevel: PHILevel.HIGH, requiresSignature: false },
  WOUND_PHOTO: { retentionDays: 2555, phiLevel: PHILevel.HIGH, requiresSignature: false },
  HOME_ENVIRONMENT: { retentionDays: 730, phiLevel: PHILevel.MEDIUM, requiresSignature: false },
  DISCHARGE_SUMMARY: { retentionDays: 2555, phiLevel: PHILevel.HIGH, requiresSignature: true },
  TRANSFER_SUMMARY: { retentionDays: 2555, phiLevel: PHILevel.HIGH, requiresSignature: false },
  ADVANCE_DIRECTIVE: { retentionDays: 2555, phiLevel: PHILevel.HIGH, requiresSignature: false },
  OTHER: { retentionDays: 2555, phiLevel: PHILevel.MEDIUM, requiresSignature: false },
};

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export interface UploadDocumentRequestBody {
  patientId: string;
  visitId?: string;
  category: DocumentCategory;
  title: string;
  description?: string;
  tags?: string[];
  effectiveDate?: string;
  expirationDate?: string;
  signatureRequired?: boolean;
  performOcr?: boolean;
}

export interface UpdateDocumentRequestBody {
  title?: string;
  description?: string;
  category?: DocumentCategory;
  tags?: string[];
  effectiveDate?: string;
  expirationDate?: string;
  status?: DocumentStatus;
  reviewStatus?: ReviewStatus;
  reviewNotes?: string;
}

export interface ListDocumentsQuery {
  page?: string;
  limit?: string;
  patientId?: string;
  visitId?: string;
  category?: DocumentCategory;
  status?: DocumentStatus;
  reviewStatus?: ReviewStatus;
  search?: string;
  tags?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'category';
  sortOrder?: 'asc' | 'desc';
}

export interface OcrProcessRequest {
  provider?: 'google_vision' | 'aws_textract' | 'azure_vision' | 'tesseract';
  extractStructuredData?: boolean;
  detectHandwriting?: boolean;
  detectTables?: boolean;
  languages?: string[];
}

export interface FileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
}

// Extended request types
export interface UploadRequest extends AuthenticatedRequest {
  body: UploadDocumentRequestBody;
  file?: FileUpload;
}

export interface UpdateRequest extends AuthenticatedRequest {
  params: { id: string };
  body: UpdateDocumentRequestBody;
}

export interface OcrRequest extends AuthenticatedRequest {
  params: { id: string };
  body: OcrProcessRequest;
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Create audit log for document access
 */
async function createDocumentAuditLog(
  action: AuditAction,
  userId: string,
  userEmail: string,
  userRole: string,
  resourceId: string,
  patientId: string | null,
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
        resourceType: 'document',
        resourceId,
        description: options.description,
        previousValues: options.previousValues ? JSON.parse(JSON.stringify(options.previousValues)) : null,
        newValues: options.newValues ? JSON.parse(JSON.stringify(options.newValues)) : null,
        phiAccessed: true,
        phiFields: ['document_content', 'file_data'],
        success,
        errorMessage: options.errorMessage,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.get('user-agent') || null,
        timestamp: new Date(),
        retentionExpiresAt: new Date(Date.now() + 6 * 365 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (error) {
    console.error('[Document Audit Log Error]', error);
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
 * Save file to storage
 */
async function saveFile(
  file: FileUpload,
  patientId: string,
  documentId: string
): Promise<{ storagePath: string; storedFileName: string; checksum: string }> {
  const uploadDir = ensureUploadDir(patientId);
  const ext = path.extname(file.originalname) || '';
  const storedFileName = `${documentId}${ext}`;
  const storagePath = path.join(uploadDir, storedFileName);

  let buffer: Buffer;
  if (file.buffer) {
    buffer = file.buffer;
  } else if (file.path) {
    buffer = await fs.promises.readFile(file.path);
  } else {
    throw new Error('No file data provided');
  }

  const checksum = calculateChecksum(buffer);
  await fs.promises.writeFile(storagePath, buffer);

  return { storagePath, storedFileName, checksum };
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
    errors.push(`Unsupported file type: ${file.mimetype}`);
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
 * Get image dimensions (placeholder - would use sharp in production)
 */
function getImageDimensions(mimeType: string): { width: number; height: number } | null {
  if (!mimeType.startsWith('image/')) {
    return null;
  }
  // In production, use sharp or similar to get actual dimensions
  return null;
}

/**
 * Check if user has access to document
 */
async function checkDocumentAccess(
  userId: string,
  userRole: UserRole,
  document: { uploadedById: string; patientId: string }
): Promise<boolean> {
  // Admins and supervisors have full access
  if ([UserRole.ADMIN, UserRole.SUPERVISOR].includes(userRole)) {
    return true;
  }

  // Uploader has access
  if (document.uploadedById === userId) {
    return true;
  }

  // Check patient assignment
  const assignment = await prisma.patientAssignment.findFirst({
    where: {
      patientId: document.patientId,
      userId,
      endDate: null,
    },
  });

  return !!assignment;
}

/**
 * Process OCR (placeholder for external service integration)
 */
async function processOcrService(
  documentPath: string,
  options: OcrProcessRequest
): Promise<{
  fullText: string;
  confidence: number;
  processingTimeMs: number;
  extractedData?: object;
}> {
  const startTime = Date.now();

  // TODO: Implement actual OCR service integration
  // This would call Google Vision, AWS Textract, Azure Vision, or Tesseract

  await new Promise(resolve => setTimeout(resolve, 100));

  return {
    fullText: '[OCR processing pending - service integration required]',
    confidence: 0,
    processingTimeMs: Date.now() - startTime,
    extractedData: options.extractStructuredData ? {} : undefined,
  };
}

// ===========================================
// CONTROLLER FUNCTIONS
// ===========================================

/**
 * Upload a new document
 * POST /api/documents/upload
 */
export async function uploadDocument(
  req: UploadRequest,
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
      patientId,
      visitId,
      category,
      title,
      description,
      tags = [],
      effectiveDate,
      expirationDate,
      signatureRequired,
      performOcr = false,
    } = req.body;

    // Validate required fields
    if (!patientId || !category || !title) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Patient ID, category, and title are required',
      });
    }

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

    // Validate visit if provided
    if (visitId) {
      const visit = await prisma.visit.findUnique({
        where: { id: visitId },
        select: { id: true, patientId: true, deletedAt: true },
      });
      if (!visit || visit.deletedAt) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Visit not found',
        });
      }
      if (visit.patientId !== patientId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Visit does not belong to the specified patient',
        });
      }
    }

    const documentId = uuidv4();
    const categoryMeta = CATEGORY_METADATA[category];

    // Save file
    const { storagePath, storedFileName, checksum } = await saveFile(file, patientId, documentId);

    // Get image dimensions if applicable
    const dimensions = getImageDimensions(file.mimetype);

    // Create document record
    const document = await prisma.document.create({
      data: {
        id: documentId,
        patientId,
        visitId: visitId || null,
        uploadedById: req.user.id,
        category,
        title: title.trim(),
        description: description?.trim() || null,
        originalFileName: file.originalname,
        storedFileName,
        mimeType: file.mimetype,
        fileSize: file.size,
        fileExtension: path.extname(file.originalname).replace('.', ''),
        checksum,
        storageProvider: DEFAULT_STORAGE_PROVIDER,
        storagePath,
        imageWidth: dimensions?.width || null,
        imageHeight: dimensions?.height || null,
        phiLevel: categoryMeta.phiLevel,
        isEncrypted: true,
        encryptionKeyId: 'default-key', // In production, use proper key management
        status: DocumentStatus.ACTIVE,
        reviewStatus: categoryMeta.requiresSignature ? ReviewStatus.PENDING_REVIEW : ReviewStatus.APPROVED,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        signatureRequired: signatureRequired ?? categoryMeta.requiresSignature,
        tags,
        version: 1,
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

    // Process OCR if requested
    let ocrResult = null;
    if (performOcr && (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/'))) {
      try {
        ocrResult = await processOcrService(storagePath, { extractStructuredData: true });
        await prisma.document.update({
          where: { id: documentId },
          data: {
            ocrProcessed: true,
            ocrProcessedAt: new Date(),
            ocrText: ocrResult.fullText,
            ocrConfidence: ocrResult.confidence,
            ocrExtractedData: ocrResult.extractedData as Prisma.InputJsonValue,
          },
        });
      } catch (ocrError) {
        console.error('[OCR Error]', ocrError);
        // Continue without OCR - don't fail the upload
      }
    }

    // Audit log
    await createDocumentAuditLog(
      AuditAction.UPLOAD,
      req.user.id,
      req.user.email,
      req.user.role,
      documentId,
      patientId,
      true,
      req,
      {
        description: `Uploaded document: ${title} for patient ${patient.lastName}, ${patient.firstName}`,
        newValues: {
          category,
          title,
          fileName: file.originalname,
          fileSize: file.size,
        },
      }
    );

    return res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        id: document.id,
        patientId: document.patientId,
        visitId: document.visitId,
        category: document.category,
        title: document.title,
        description: document.description,
        fileName: document.originalFileName,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        checksum: document.checksum,
        phiLevel: document.phiLevel,
        status: document.status,
        reviewStatus: document.reviewStatus,
        signatureRequired: document.signatureRequired,
        tags: document.tags,
        version: document.version,
        patient: document.patient,
        uploadedBy: document.uploadedBy,
        ocrProcessed: document.ocrProcessed,
        createdAt: document.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List documents with filtering and pagination
 * GET /api/documents
 */
export async function listDocuments(
  req: AuthenticatedRequest & { query: ListDocumentsQuery },
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

    const {
      page = '1',
      limit = '20',
      patientId,
      visitId,
      category,
      status,
      reviewStatus,
      search,
      tags,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: Prisma.DocumentWhereInput = {
      deletedAt: null,
    };

    // Role-based filtering
    if (![UserRole.ADMIN, UserRole.SUPERVISOR].includes(req.user.role)) {
      where.OR = [
        { uploadedById: req.user.id },
        {
          patient: {
            assignments: {
              some: {
                userId: req.user.id,
                endDate: null,
              },
            },
          },
        },
      ];
    }

    if (patientId) where.patientId = patientId;
    if (visitId) where.visitId = visitId;
    if (category) where.category = category;
    if (status) where.status = status;
    if (reviewStatus) where.reviewStatus = reviewStatus;

    if (search) {
      where.OR = [
        ...(where.OR || []),
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { originalFileName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tags) {
      const tagList = tags.split(',').map(t => t.trim());
      where.tags = { hasSome: tagList };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Build order by
    const orderBy: Prisma.DocumentOrderByWithRelationInput = {};
    if (sortBy === 'createdAt') orderBy.createdAt = sortOrder;
    else if (sortBy === 'updatedAt') orderBy.updatedAt = sortOrder;
    else if (sortBy === 'title') orderBy.title = sortOrder;
    else if (sortBy === 'category') orderBy.category = sortOrder;

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        select: {
          id: true,
          patientId: true,
          visitId: true,
          category: true,
          title: true,
          description: true,
          originalFileName: true,
          fileSize: true,
          mimeType: true,
          phiLevel: true,
          status: true,
          reviewStatus: true,
          signatureRequired: true,
          tags: true,
          version: true,
          ocrProcessed: true,
          createdAt: true,
          updatedAt: true,
          patient: {
            select: { id: true, firstName: true, lastName: true, mrn: true },
          },
          uploadedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.document.count({ where }),
    ]);

    // Audit log
    await createDocumentAuditLog(
      AuditAction.READ,
      req.user.id,
      req.user.email,
      req.user.role,
      'list',
      patientId || null,
      true,
      req,
      {
        description: `Listed ${documents.length} documents`,
      }
    );

    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      data: documents,
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
 * Get a document by ID
 * GET /api/documents/:id
 */
export async function getDocument(
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

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid document ID format',
      });
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, mrn: true },
        },
        visit: {
          select: { id: true, visitType: true, scheduledDate: true },
        },
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!document || document.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Document not found',
      });
    }

    // Check access
    const hasAccess = await checkDocumentAccess(
      req.user.id,
      req.user.role,
      { uploadedById: document.uploadedById, patientId: document.patientId }
    );

    if (!hasAccess) {
      await createDocumentAuditLog(
        AuditAction.READ,
        req.user.id,
        req.user.email,
        req.user.role,
        id,
        document.patientId,
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
    await createDocumentAuditLog(
      AuditAction.READ,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      document.patientId,
      true,
      req,
      {
        description: `Viewed document: ${document.title}`,
      }
    );

    return res.status(200).json({
      id: document.id,
      patientId: document.patientId,
      visitId: document.visitId,
      category: document.category,
      title: document.title,
      description: document.description,
      file: {
        originalName: document.originalFileName,
        storedName: document.storedFileName,
        mimeType: document.mimeType,
        size: document.fileSize,
        extension: document.fileExtension,
        checksum: document.checksum,
        dimensions: document.imageWidth && document.imageHeight
          ? { width: document.imageWidth, height: document.imageHeight }
          : null,
      },
      phiLevel: document.phiLevel,
      isEncrypted: document.isEncrypted,
      status: document.status,
      reviewStatus: document.reviewStatus,
      reviewedById: document.reviewedById,
      reviewedAt: document.reviewedAt,
      reviewNotes: document.reviewNotes,
      effectiveDate: document.effectiveDate,
      expirationDate: document.expirationDate,
      signatureRequired: document.signatureRequired,
      signatures: document.signatures,
      tags: document.tags,
      version: document.version,
      previousVersionId: document.previousVersionId,
      ocr: document.ocrProcessed ? {
        processed: true,
        processedAt: document.ocrProcessedAt,
        text: document.ocrText,
        confidence: document.ocrConfidence,
        extractedData: document.ocrExtractedData,
      } : null,
      patient: document.patient,
      visit: document.visit,
      uploadedBy: document.uploadedBy,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update document metadata
 * PUT /api/documents/:id
 */
export async function updateDocument(
  req: UpdateRequest,
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

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document || document.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Document not found',
      });
    }

    // Check access
    const hasAccess = await checkDocumentAccess(
      req.user.id,
      req.user.role,
      { uploadedById: document.uploadedById, patientId: document.patientId }
    );

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to update this document',
      });
    }

    // Only admins/supervisors can change review status
    if (body.reviewStatus && ![UserRole.ADMIN, UserRole.SUPERVISOR].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only administrators can update review status',
      });
    }

    // Build update data
    const updateData: Prisma.DocumentUpdateInput = {};

    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.category !== undefined) {
      updateData.category = body.category;
      const meta = CATEGORY_METADATA[body.category];
      updateData.phiLevel = meta.phiLevel;
    }
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.effectiveDate !== undefined) updateData.effectiveDate = body.effectiveDate ? new Date(body.effectiveDate) : null;
    if (body.expirationDate !== undefined) updateData.expirationDate = body.expirationDate ? new Date(body.expirationDate) : null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.reviewStatus !== undefined) {
      updateData.reviewStatus = body.reviewStatus;
      updateData.reviewedById = req.user.id;
      updateData.reviewedAt = new Date();
    }
    if (body.reviewNotes !== undefined) updateData.reviewNotes = body.reviewNotes;

    const updatedDocument = await prisma.document.update({
      where: { id },
      data: updateData,
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, mrn: true },
        },
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Audit log
    await createDocumentAuditLog(
      AuditAction.UPDATE,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      document.patientId,
      true,
      req,
      {
        description: `Updated document: ${updatedDocument.title}`,
        previousValues: {
          title: document.title,
          category: document.category,
          status: document.status,
          reviewStatus: document.reviewStatus,
        },
        newValues: {
          title: updatedDocument.title,
          category: updatedDocument.category,
          status: updatedDocument.status,
          reviewStatus: updatedDocument.reviewStatus,
        },
      }
    );

    return res.status(200).json({
      message: 'Document updated successfully',
      document: {
        id: updatedDocument.id,
        title: updatedDocument.title,
        description: updatedDocument.description,
        category: updatedDocument.category,
        tags: updatedDocument.tags,
        status: updatedDocument.status,
        reviewStatus: updatedDocument.reviewStatus,
        reviewNotes: updatedDocument.reviewNotes,
        effectiveDate: updatedDocument.effectiveDate,
        expirationDate: updatedDocument.expirationDate,
        updatedAt: updatedDocument.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Soft delete a document
 * DELETE /api/documents/:id
 */
export async function deleteDocument(
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

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Document not found',
      });
    }

    if (document.deletedAt) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Document has already been deleted',
      });
    }

    // Only uploader, admins, or supervisors can delete
    const canDelete =
      document.uploadedById === req.user.id ||
      [UserRole.ADMIN, UserRole.SUPERVISOR].includes(req.user.role);

    if (!canDelete) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to delete this document',
      });
    }

    // Soft delete
    await prisma.document.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: req.user.id,
        deletionReason: reason || 'User requested deletion',
        status: DocumentStatus.DELETED,
      },
    });

    // Audit log
    await createDocumentAuditLog(
      AuditAction.DELETE,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      document.patientId,
      true,
      req,
      {
        description: `Deleted document: ${document.title}. Reason: ${reason || 'Not specified'}`,
      }
    );

    return res.status(200).json({
      message: 'Document deleted successfully',
      documentId: id,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Process OCR on a document
 * POST /api/documents/:id/ocr
 */
export async function processOcr(
  req: OcrRequest,
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
    const {
      provider = 'google_vision',
      extractStructuredData = true,
      detectHandwriting = false,
      detectTables = false,
      languages = ['en'],
    } = req.body;

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document || document.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Document not found',
      });
    }

    // Check access
    const hasAccess = await checkDocumentAccess(
      req.user.id,
      req.user.role,
      { uploadedById: document.uploadedById, patientId: document.patientId }
    );

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to process this document',
      });
    }

    // Only images and PDFs can be OCR'd
    const ocrableTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'image/webp'];
    if (!ocrableTypes.includes(document.mimeType)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Document type does not support OCR processing',
      });
    }

    // Process OCR
    const ocrResult = await processOcrService(document.storagePath, {
      provider,
      extractStructuredData,
      detectHandwriting,
      detectTables,
      languages,
    });

    // Update document with OCR results
    const updatedDocument = await prisma.document.update({
      where: { id },
      data: {
        ocrProcessed: true,
        ocrProcessedAt: new Date(),
        ocrText: ocrResult.fullText,
        ocrConfidence: ocrResult.confidence,
        ocrExtractedData: ocrResult.extractedData as Prisma.InputJsonValue,
      },
    });

    // Audit log
    await createDocumentAuditLog(
      AuditAction.UPDATE,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      document.patientId,
      true,
      req,
      {
        description: `OCR processed document: ${document.title}`,
      }
    );

    return res.status(200).json({
      message: 'OCR processing completed',
      result: {
        documentId: id,
        processed: true,
        processedAt: updatedDocument.ocrProcessedAt,
        provider,
        fullText: ocrResult.fullText,
        confidence: ocrResult.confidence,
        processingTimeMs: ocrResult.processingTimeMs,
        extractedData: ocrResult.extractedData,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Download a document (generate signed URL or stream)
 * GET /api/documents/:id/download
 */
export async function downloadDocument(
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

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document || document.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Document not found',
      });
    }

    // Check access
    const hasAccess = await checkDocumentAccess(
      req.user.id,
      req.user.role,
      { uploadedById: document.uploadedById, patientId: document.patientId }
    );

    if (!hasAccess) {
      await createDocumentAuditLog(
        AuditAction.DOWNLOAD,
        req.user.id,
        req.user.email,
        req.user.role,
        id,
        document.patientId,
        false,
        req,
        { errorMessage: 'Access denied' }
      );

      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to download this document',
      });
    }

    // Verify file exists
    if (!fs.existsSync(document.storagePath)) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Document file not found on storage',
      });
    }

    // Audit log
    await createDocumentAuditLog(
      AuditAction.DOWNLOAD,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      document.patientId,
      true,
      req,
      {
        description: `Downloaded document: ${document.title}`,
      }
    );

    // Set headers and stream file
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalFileName}"`);
    res.setHeader('Content-Length', document.fileSize);

    const fileStream = fs.createReadStream(document.storagePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
}

/**
 * Get document categories with metadata
 * GET /api/documents/categories
 */
export async function getCategories(
  req: AuthenticatedRequest,
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

    const categories = Object.entries(CATEGORY_METADATA).map(([key, meta]) => ({
      value: key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      retentionDays: meta.retentionDays,
      phiLevel: meta.phiLevel,
      requiresSignature: meta.requiresSignature,
    }));

    return res.status(200).json({ categories });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// EXTRACT DOCUMENT TEXT (for Capture Workflow)
// ===========================================

/**
 * Extract text from an uploaded document for the capture workflow
 * POST /api/capture/extract-document
 */
export async function extractDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  let tempFilePath: string | null = null;

  try {
    const file = req.file as FileUpload | undefined;

    if (!file) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
      return;
    }

    console.log(`[Document Extract] Processing ${file.originalname} (${file.mimetype})`);

    // Determine document type from mimetype
    let docType: 'pdf' | 'docx' | 'jpg' | 'png' = 'pdf';
    if (file.mimetype.includes('image/jpeg') || file.mimetype.includes('image/jpg')) {
      docType = 'jpg';
    } else if (file.mimetype.includes('image/png')) {
      docType = 'png';
    } else if (file.mimetype.includes('word') || file.mimetype.includes('docx')) {
      docType = 'docx';
    }

    // Save buffer to temp file for extraction
    const tempDir = os.tmpdir();
    tempFilePath = path.join(tempDir, `doc_${Date.now()}_${file.originalname}`);

    if (file.buffer) {
      await fs.promises.writeFile(tempFilePath, file.buffer);
    } else if (file.path) {
      // File already on disk, use its path
      tempFilePath = file.path;
    } else {
      res.status(400).json({
        success: false,
        error: 'No file data available',
      });
      return;
    }

    // Extract text from the document
    const result = await extractTextFromDocument(tempFilePath, docType);
    let extractedText = result.text;
    let usedVision = false;

    // For scanned PDFs or images with no text, use Claude Vision
    if ((!extractedText || extractedText.trim().length < 50) && (docType === 'pdf' || docType === 'jpg' || docType === 'png')) {
      console.log('[Document Extract] Insufficient text, using Claude Vision API...');

      try {
        const apiKey = process.env['ANTHROPIC_API_KEY'];
        if (apiKey) {
          const anthropic = new Anthropic({ apiKey });
          const buffer = await fs.promises.readFile(tempFilePath);
          const base64Data = buffer.toString('base64');

          const mediaType = docType === 'pdf' ? 'application/pdf' :
                           docType === 'jpg' ? 'image/jpeg' : 'image/png';

          const response = await anthropic.messages.create({
            model: MODELS.EXTRACTION,
            max_tokens: 8192,
            messages: [{
              role: 'user',
              content: [
                {
                  type: docType === 'pdf' ? 'document' : 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: base64Data,
                  },
                } as Anthropic.DocumentBlockParam | Anthropic.ImageBlockParam,
                {
                  type: 'text',
                  text: 'Please extract all text from this document. Return only the raw text content, preserving the structure and formatting as much as possible. Do not add any commentary or analysis.',
                },
              ],
            }],
          });

          const content = response.content[0];
          if (content && content.type === 'text') {
            extractedText = content.text;
            usedVision = true;
            console.log(`[Document Extract] Claude Vision extracted ${extractedText.length} characters`);
          }
        } else {
          console.log('[Document Extract] No ANTHROPIC_API_KEY, cannot use Vision API');
        }
      } catch (visionError) {
        console.error('[Document Extract] Claude Vision failed:', visionError);
        // Continue with empty text
      }
    }

    // Clean up temp file (only if we created it from buffer)
    if (file.buffer && tempFilePath && fs.existsSync(tempFilePath)) {
      await fs.promises.unlink(tempFilePath);
      tempFilePath = null;
    }

    if (!extractedText || extractedText.trim().length === 0) {
      res.status(200).json({
        success: true,
        fileName: file.originalname,
        fileType: docType,
        extractedText: '',
        pageCount: result.pageCount,
        warning: 'No text could be extracted from the document. It may be a scanned image and ANTHROPIC_API_KEY may not be configured.',
      });
      return;
    }

    console.log(`[Document Extract] Extracted ${extractedText.length} characters from ${result.pageCount || 1} pages${usedVision ? ' (via Claude Vision)' : ''}`);

    res.json({
      success: true,
      fileName: file.originalname,
      fileType: docType,
      extractedText,
      textLength: extractedText.length,
      pageCount: result.pageCount,
      usedVision,
    });
  } catch (error) {
    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        await fs.promises.unlink(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }

    console.error('[Document Extract Error]', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Document extraction failed',
    });
  }
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  uploadDocument,
  listDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  processOcr,
  downloadDocument,
  getCategories,
  extractDocument,
};
