import { Router } from 'express';
import * as documentController from '../controllers/document.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../generated/prisma';

// ===========================================
// TYPE DEFINITIONS (kept for API documentation)
// ===========================================

// File Metadata Types
export interface FileMetadata {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: DocumentMimeType;
  size: number;
  sizeFormatted: string;
  extension: string;
  checksum: string;
  storageProvider: StorageProvider;
  storagePath: string;
  storageUrl?: string;
  dimensions?: ImageDimensions;
}

export type DocumentMimeType =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'image/tiff'
  | 'image/heic'
  | 'image/webp'
  | 'application/msword'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'text/plain'
  | 'application/dicom';

export type StorageProvider = 'local' | 's3' | 'azure' | 'gcs';

export interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: string;
}

// Document Categories
export type DocumentCategory =
  | 'referral'
  | 'physician_order'
  | 'face_to_face'
  | 'plan_of_care'
  | 'progress_note'
  | 'assessment'
  | 'consent_form'
  | 'insurance_card'
  | 'identification'
  | 'medication_list'
  | 'lab_result'
  | 'imaging'
  | 'wound_photo'
  | 'home_environment'
  | 'discharge_summary'
  | 'transfer_summary'
  | 'advance_directive'
  | 'other';

export interface DocumentCategoryMetadata {
  category: DocumentCategory;
  displayName: string;
  description: string;
  retentionPeriodDays: number;
  requiresPhysicianSignature: boolean;
  phiLevel: PHILevel;
}

// PHI Encryption Types
export type PHILevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface PHIEncryptionInfo {
  isEncrypted: boolean;
  encryptionMethod: EncryptionMethod;
  encryptionKeyId: string;
  phiLevel: PHILevel;
  phiCategories: PHICategory[];
  lastEncryptedAt: string;
  encryptedFields?: string[];
}

export type EncryptionMethod =
  | 'AES-256-GCM'
  | 'AES-256-CBC'
  | 'AWS-KMS'
  | 'AZURE-KEY-VAULT'
  | 'GCP-KMS';

export type PHICategory =
  | 'patient_name'
  | 'date_of_birth'
  | 'ssn'
  | 'address'
  | 'phone_number'
  | 'email'
  | 'medical_record_number'
  | 'health_plan_number'
  | 'account_number'
  | 'diagnosis'
  | 'treatment'
  | 'medication'
  | 'lab_results'
  | 'imaging'
  | 'photograph'
  | 'biometric';

// Document Entity
export interface Document {
  id: string;
  patientId: string;
  visitId?: string;
  category: DocumentCategory;
  title: string;
  description?: string;
  file: FileMetadata;
  phi: PHIEncryptionInfo;
  ocr?: OCRResult;
  tags: string[];
  status: DocumentStatus;
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  expirationDate?: string;
  effectiveDate?: string;
  signatureRequired: boolean;
  signedBy?: SignatureInfo[];
  version: number;
  previousVersionId?: string;
  audit: DocumentAuditInfo;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deletedBy?: string;
  deletionReason?: string;
}

export type DocumentStatus = 'pending' | 'active' | 'archived' | 'deleted' | 'expired';
export type ReviewStatus = 'pending_review' | 'approved' | 'rejected' | 'needs_revision';

export interface SignatureInfo {
  signerId: string;
  signerName: string;
  signerRole: string;
  signedAt: string;
  signatureType: 'electronic' | 'digital' | 'wet';
  signatureData?: string;
  ipAddress?: string;
}

export interface DocumentAuditInfo {
  createdBy: string;
  createdByName: string;
  updatedBy: string;
  updatedByName: string;
  accessLog: DocumentAccessEntry[];
}

export interface DocumentAccessEntry {
  userId: string;
  userName: string;
  action: DocumentAction;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}

export type DocumentAction =
  | 'view'
  | 'download'
  | 'print'
  | 'upload'
  | 'update'
  | 'delete'
  | 'restore'
  | 'share'
  | 'sign'
  | 'ocr_process';

// OCR Result Types
export interface OCRResult {
  id: string;
  documentId: string;
  status: OCRStatus;
  provider: OCRProvider;
  processedAt: string;
  processingTimeMs: number;
  fullText: string;
  confidence: number;
  pages: OCRPage[];
  extractedData?: ExtractedDocumentData;
  detectedLanguages: string[];
  warnings: string[];
}

export type OCRStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
export type OCRProvider = 'google_vision' | 'aws_textract' | 'azure_vision' | 'tesseract';

export interface OCRPage {
  pageNumber: number;
  width: number;
  height: number;
  text: string;
  confidence: number;
  blocks: OCRBlock[];
}

export interface OCRBlock {
  id: string;
  type: OCRBlockType;
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  words?: OCRWord[];
}

export type OCRBlockType = 'text' | 'table' | 'form_field' | 'signature' | 'handwriting' | 'barcode';

export interface OCRWord {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  isHandwritten: boolean;
}

export interface BoundingBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface ExtractedDocumentData {
  documentType?: string;
  documentDate?: string;
  patientInfo?: {
    name?: string;
    dateOfBirth?: string;
    mrn?: string;
    address?: string;
  };
  providerInfo?: {
    name?: string;
    npi?: string;
    facility?: string;
    phone?: string;
    fax?: string;
  };
  insuranceInfo?: {
    companyName?: string;
    planName?: string;
    policyNumber?: string;
    groupNumber?: string;
    subscriberId?: string;
    effectiveDate?: string;
  };
  diagnoses?: { code: string; description: string }[];
  medications?: { name: string; dosage?: string; frequency?: string }[];
  procedures?: { code: string; description: string; date?: string }[];
  labResults?: { test: string; value: string; unit?: string; date?: string }[];
  dates?: { type: string; date: string }[];
  formFields?: { fieldName: string; value: string; confidence: number }[];
  tables?: {
    rows: { cells: string[] }[];
    headers?: string[];
  }[];
  signatures?: {
    location: BoundingBox;
    signerLabel?: string;
    dated?: string;
  }[];
}

// Request/Response Types
export interface UploadDocumentRequest {
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

export interface DocumentListQuery {
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
  includeDeleted?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface OCRProcessRequest {
  provider?: OCRProvider;
  extractStructuredData?: boolean;
  detectHandwriting?: boolean;
  detectTables?: boolean;
  detectSignatures?: boolean;
  languages?: string[];
}

// ===========================================
// ROUTER INITIALIZATION
// ===========================================

const router = Router();

// ===========================================
// ROUTES
// ===========================================

/**
 * @route   GET /api/documents/categories
 * @desc    Get all document categories with metadata
 * @access  Private - All authenticated users
 */
router.get(
  '/categories',
  authenticate,
  documentController.getCategories
);

/**
 * @route   POST /api/documents/upload
 * @desc    Upload a document (photo, referral, etc.)
 * @access  Private - Clinical staff only
 */
router.post(
  '/upload',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.HOME_HEALTH_AIDE,
    UserRole.MEDICAL_SOCIAL_WORKER,
  ]),
  // TODO: Add multer middleware for file upload
  // uploadDocument.single('file'),
  documentController.uploadDocument
);

/**
 * @route   GET /api/documents
 * @desc    List all documents with filtering and pagination
 * @access  Private - All clinical staff
 */
router.get(
  '/',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.HOME_HEALTH_AIDE,
    UserRole.MEDICAL_SOCIAL_WORKER,
    UserRole.BILLING,
    UserRole.READONLY,
  ]),
  documentController.listDocuments
);

/**
 * @route   GET /api/documents/:id
 * @desc    Get a single document by ID
 * @access  Private - Must have access to patient or be uploader
 */
router.get(
  '/:id',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.HOME_HEALTH_AIDE,
    UserRole.MEDICAL_SOCIAL_WORKER,
    UserRole.BILLING,
    UserRole.READONLY,
  ]),
  documentController.getDocument
);

/**
 * @route   GET /api/documents/:id/download
 * @desc    Download a document file
 * @access  Private - Must have access to patient or be uploader
 */
router.get(
  '/:id/download',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.HOME_HEALTH_AIDE,
    UserRole.MEDICAL_SOCIAL_WORKER,
    UserRole.BILLING,
  ]),
  documentController.downloadDocument
);

/**
 * @route   PUT /api/documents/:id
 * @desc    Update document metadata
 * @access  Private - Uploader or admin/supervisor
 */
router.put(
  '/:id',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.MEDICAL_SOCIAL_WORKER,
  ]),
  documentController.updateDocument
);

/**
 * @route   DELETE /api/documents/:id
 * @desc    Soft delete a document
 * @access  Private - Uploader or admin/supervisor
 */
router.delete(
  '/:id',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.MEDICAL_SOCIAL_WORKER,
  ]),
  documentController.deleteDocument
);

/**
 * @route   POST /api/documents/:id/ocr
 * @desc    Extract text from document using OCR
 * @access  Private - Clinical staff only
 */
router.post(
  '/:id/ocr',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.MEDICAL_SOCIAL_WORKER,
  ]),
  documentController.processOcr
);

export default router;
