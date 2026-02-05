-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SUPERVISOR', 'NURSE', 'THERAPIST_PT', 'THERAPIST_OT', 'THERAPIST_ST', 'HOME_HEALTH_AIDE', 'MEDICAL_SOCIAL_WORKER', 'BILLING', 'READONLY');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED', 'DOMESTIC_PARTNER');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('PENDING', 'ACTIVE', 'ON_HOLD', 'DISCHARGED', 'DECEASED', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "ContactRelationship" AS ENUM ('SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'GRANDCHILD', 'FRIEND', 'NEIGHBOR', 'CAREGIVER', 'LEGAL_GUARDIAN', 'OTHER');

-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('MEDICARE', 'MEDICAID', 'MEDICARE_ADVANTAGE', 'PRIVATE', 'TRICARE', 'VA', 'WORKERS_COMP', 'SELF_PAY', 'OTHER');

-- CreateEnum
CREATE TYPE "CarePlanStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'CANCELLED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('SKILLED_NURSING', 'PHYSICAL_THERAPY', 'OCCUPATIONAL_THERAPY', 'SPEECH_THERAPY', 'HOME_HEALTH_AIDE', 'MEDICAL_SOCIAL_WORK', 'SUPERVISORY', 'EVALUATION', 'DISCHARGE');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('START_OF_CARE', 'RESUMPTION_OF_CARE', 'RECERTIFICATION', 'FOLLOW_UP', 'TRANSFER_TO_INPATIENT', 'DISCHARGE_FROM_AGENCY', 'DEATH_AT_HOME');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW', 'NEEDS_CORRECTION', 'APPROVED', 'SUBMITTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('REFERRAL', 'PHYSICIAN_ORDER', 'FACE_TO_FACE', 'PLAN_OF_CARE', 'PROGRESS_NOTE', 'ASSESSMENT', 'CONSENT_FORM', 'INSURANCE_CARD', 'IDENTIFICATION', 'MEDICATION_LIST', 'LAB_RESULT', 'IMAGING', 'WOUND_PHOTO', 'HOME_ENVIRONMENT', 'DISCHARGE_SUMMARY', 'TRANSFER_SUMMARY', 'ADVANCE_DIRECTIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'ACTIVE', 'ARCHIVED', 'DELETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_REVISION');

-- CreateEnum
CREATE TYPE "TranscriptionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TranscriptionProvider" AS ENUM ('GOOGLE', 'AWS', 'OPENAI', 'AZURE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'PRINT', 'SHARE', 'UPLOAD', 'DOWNLOAD', 'SIGN', 'APPROVE', 'REJECT', 'SUBMIT');

-- CreateEnum
CREATE TYPE "PHILevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "middleName" TEXT,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'NURSE',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "licenseNumber" TEXT,
    "licenseState" TEXT,
    "licenseExpiration" TIMESTAMP(3),
    "npiNumber" TEXT,
    "profileImageUrl" TEXT,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "mrn" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "middleName" TEXT,
    "preferredName" TEXT,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "ssnEncrypted" TEXT,
    "maritalStatus" "MaritalStatus",
    "preferredLanguage" TEXT NOT NULL DEFAULT 'English',
    "ethnicity" TEXT,
    "race" TEXT,
    "religion" TEXT,
    "addressStreet1" TEXT NOT NULL,
    "addressStreet2" TEXT,
    "addressCity" TEXT NOT NULL,
    "addressState" TEXT NOT NULL,
    "addressZipCode" TEXT NOT NULL,
    "addressCounty" TEXT,
    "phoneHome" TEXT,
    "phoneMobile" TEXT NOT NULL,
    "phoneWork" TEXT,
    "email" TEXT,
    "preferredContactMethod" TEXT NOT NULL DEFAULT 'phone',
    "status" "PatientStatus" NOT NULL DEFAULT 'PENDING',
    "admissionDate" TIMESTAMP(3),
    "dischargeDate" TIMESTAMP(3),
    "dischargeReason" TEXT,
    "primaryPhysicianName" TEXT,
    "primaryPhysicianNpi" TEXT,
    "primaryPhysicianPhone" TEXT,
    "primaryPhysicianFax" TEXT,
    "allergies" TEXT[],
    "dnrStatus" BOOLEAN NOT NULL DEFAULT false,
    "advanceDirectives" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "relationship" "ContactRelationship" NOT NULL,
    "relationshipOther" TEXT,
    "phoneHome" TEXT,
    "phoneMobile" TEXT NOT NULL,
    "phoneWork" TEXT,
    "email" TEXT,
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "hasPowerOfAttorney" BOOLEAN NOT NULL DEFAULT false,
    "isHealthcareProxy" BOOLEAN NOT NULL DEFAULT false,
    "canReceivePhiInfo" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurances" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "insuranceType" "InsuranceType" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "companyName" TEXT NOT NULL,
    "planName" TEXT,
    "policyNumber" TEXT NOT NULL,
    "groupNumber" TEXT,
    "subscriberId" TEXT NOT NULL,
    "subscriberName" TEXT NOT NULL,
    "subscriberRelationship" TEXT NOT NULL DEFAULT 'self',
    "subscriberDob" TIMESTAMP(3),
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "terminationDate" TIMESTAMP(3),
    "copay" DECIMAL(10,2),
    "deductible" DECIMAL(10,2),
    "coinsurancePercent" INTEGER,
    "preAuthRequired" BOOLEAN NOT NULL DEFAULT false,
    "preAuthNumber" TEXT,
    "preAuthStartDate" TIMESTAMP(3),
    "preAuthEndDate" TIMESTAMP(3),
    "authorizedVisits" INTEGER,
    "usedVisits" INTEGER NOT NULL DEFAULT 0,
    "contactPhone" TEXT,
    "contactFax" TEXT,
    "claimsAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,

    CONSTRAINT "insurances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_assignments" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "discipline" "VisitType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episodes" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "referralDate" TIMESTAMP(3),
    "referralSource" TEXT,
    "referralDiagnosis" TEXT,
    "certPeriodStart" TIMESTAMP(3),
    "certPeriodEnd" TIMESTAMP(3),
    "status" "CarePlanStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_plans" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "status" "CarePlanStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "primaryDiagnosisCode" TEXT NOT NULL,
    "primaryDiagnosisDesc" TEXT NOT NULL,
    "primaryDiagnosisOnset" TIMESTAMP(3),
    "secondaryDiagnoses" JSONB,
    "attendingPhysicianName" TEXT,
    "attendingPhysicianNpi" TEXT,
    "attendingPhysicianPhone" TEXT,
    "referringPhysicianName" TEXT,
    "referringPhysicianNpi" TEXT,
    "authorizedServices" JSONB,
    "goals" JSONB,
    "snFrequency" TEXT,
    "ptFrequency" TEXT,
    "otFrequency" TEXT,
    "stFrequency" TEXT,
    "hhaFrequency" TEXT,
    "mswFrequency" TEXT,
    "specialInstructions" TEXT,
    "physicianSignedAt" TIMESTAMP(3),
    "physicianSignedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "care_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "supervisorId" TEXT,
    "visitType" "VisitType" NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "scheduledStartTime" TIMESTAMP(3),
    "scheduledEndTime" TIMESTAMP(3),
    "actualStartTime" TIMESTAMP(3),
    "actualEndTime" TIMESTAMP(3),
    "checkInTime" TIMESTAMP(3),
    "checkOutTime" TIMESTAMP(3),
    "checkInLatitude" DECIMAL(10,8),
    "checkInLongitude" DECIMAL(11,8),
    "checkOutLatitude" DECIMAL(10,8),
    "checkOutLongitude" DECIMAL(11,8),
    "mileage" DECIMAL(6,2),
    "visitNotes" TEXT,
    "patientCondition" TEXT,
    "interventions" TEXT,
    "patientResponse" TEXT,
    "planForNextVisit" TEXT,
    "vitalSigns" JSONB,
    "clinicianSignedAt" TIMESTAMP(3),
    "patientSignedAt" TIMESTAMP(3),
    "patientSignature" TEXT,
    "missedReason" TEXT,
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oasis_assessments" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "visitId" TEXT,
    "clinicianId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "approverId" TEXT,
    "assessmentType" "AssessmentType" NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "m0030_startOfCareDate" TIMESTAMP(3),
    "m0032_resumptionOfCareDate" TIMESTAMP(3),
    "m0090_completionDate" TIMESTAMP(3),
    "m0906_dischargeDate" TIMESTAMP(3),
    "hippsCode" TEXT,
    "clinicalGrouping" TEXT,
    "functionalLevel" TEXT,
    "comorbidityAdjustment" TEXT,
    "caseMixWeight" DECIMAL(6,4),
    "completionPercentage" INTEGER NOT NULL DEFAULT 0,
    "voicePopulatedFields" JSONB,
    "voiceTranscriptionId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "correctionReason" TEXT,
    "previousVersionId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "oasis_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oasis_responses" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "responseValue" TEXT,
    "responseCode" TEXT,
    "responseText" TEXT,
    "responseNumeric" DECIMAL(10,2),
    "responseDate" TIMESTAMP(3),
    "responseJson" JSONB,
    "confidence" DECIMAL(3,2),
    "sourceType" TEXT,
    "sourceTranscriptionId" TEXT,
    "sourceText" TEXT,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "validationErrors" JSONB,
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oasis_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "originalFileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileExtension" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "storageUrl" TEXT,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "phiLevel" "PHILevel" NOT NULL DEFAULT 'MEDIUM',
    "isEncrypted" BOOLEAN NOT NULL DEFAULT true,
    "encryptionKeyId" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "signatureRequired" BOOLEAN NOT NULL DEFAULT false,
    "signatures" JSONB,
    "ocrProcessed" BOOLEAN NOT NULL DEFAULT false,
    "ocrProcessedAt" TIMESTAMP(3),
    "ocrText" TEXT,
    "ocrConfidence" DECIMAL(3,2),
    "ocrExtractedData" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousVersionId" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletionReason" TEXT,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_transcriptions" (
    "id" TEXT NOT NULL,
    "patientId" TEXT,
    "visitId" TEXT,
    "clinicianId" TEXT NOT NULL,
    "audioFileName" TEXT NOT NULL,
    "audioStoragePath" TEXT NOT NULL,
    "audioMimeType" TEXT NOT NULL,
    "audioDurationSeconds" INTEGER NOT NULL,
    "audioFileSize" INTEGER NOT NULL,
    "status" "TranscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "TranscriptionProvider" NOT NULL,
    "fullText" TEXT,
    "segments" JSONB,
    "wordCount" INTEGER,
    "overallConfidence" DECIMAL(3,2),
    "lowConfidenceFlags" JSONB,
    "medicalTerms" JSONB,
    "speakerSegments" JSONB,
    "audioQuality" TEXT,
    "hasBackgroundNoise" BOOLEAN,
    "processingStartedAt" TIMESTAMP(3),
    "processingCompletedAt" TIMESTAMP(3),
    "processingTimeMs" INTEGER,
    "errorMessage" TEXT,
    "transcriptionContext" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en-US',
    "oasisMappingResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "voice_transcriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "userRole" TEXT,
    "action" "AuditAction" NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "resourceName" TEXT,
    "description" TEXT,
    "previousValues" JSONB,
    "newValues" JSONB,
    "phiAccessed" BOOLEAN NOT NULL DEFAULT false,
    "phiFields" TEXT[],
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "sessionId" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionExpiresAt" TIMESTAMP(3),

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oasis_questions" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "helpText" TEXT,
    "responseType" TEXT NOT NULL,
    "responses" JSONB,
    "skipLogic" JSONB,
    "validationRules" JSONB,
    "scoringRules" JSONB,
    "assessmentTypes" TEXT[],
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "retiredDate" TIMESTAMP(3),
    "cmsGuidance" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oasis_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "patients_mrn_key" ON "patients"("mrn");

-- CreateIndex
CREATE INDEX "patients_mrn_idx" ON "patients"("mrn");

-- CreateIndex
CREATE INDEX "patients_lastName_firstName_idx" ON "patients"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "patients_dateOfBirth_idx" ON "patients"("dateOfBirth");

-- CreateIndex
CREATE INDEX "patients_status_idx" ON "patients"("status");

-- CreateIndex
CREATE INDEX "patients_deletedAt_idx" ON "patients"("deletedAt");

-- CreateIndex
CREATE INDEX "patients_admissionDate_idx" ON "patients"("admissionDate");

-- CreateIndex
CREATE INDEX "emergency_contacts_patientId_idx" ON "emergency_contacts"("patientId");

-- CreateIndex
CREATE INDEX "emergency_contacts_isPrimaryContact_idx" ON "emergency_contacts"("isPrimaryContact");

-- CreateIndex
CREATE INDEX "insurances_patientId_idx" ON "insurances"("patientId");

-- CreateIndex
CREATE INDEX "insurances_insuranceType_idx" ON "insurances"("insuranceType");

-- CreateIndex
CREATE INDEX "insurances_isPrimary_idx" ON "insurances"("isPrimary");

-- CreateIndex
CREATE INDEX "insurances_policyNumber_idx" ON "insurances"("policyNumber");

-- CreateIndex
CREATE INDEX "patient_assignments_patientId_idx" ON "patient_assignments"("patientId");

-- CreateIndex
CREATE INDEX "patient_assignments_userId_idx" ON "patient_assignments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_assignments_patientId_userId_discipline_key" ON "patient_assignments"("patientId", "userId", "discipline");

-- CreateIndex
CREATE INDEX "episodes_patientId_idx" ON "episodes"("patientId");

-- CreateIndex
CREATE INDEX "episodes_startDate_idx" ON "episodes"("startDate");

-- CreateIndex
CREATE INDEX "episodes_status_idx" ON "episodes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "episodes_patientId_episodeNumber_key" ON "episodes"("patientId", "episodeNumber");

-- CreateIndex
CREATE INDEX "care_plans_patientId_idx" ON "care_plans"("patientId");

-- CreateIndex
CREATE INDEX "care_plans_episodeId_idx" ON "care_plans"("episodeId");

-- CreateIndex
CREATE INDEX "care_plans_status_idx" ON "care_plans"("status");

-- CreateIndex
CREATE INDEX "visits_patientId_idx" ON "visits"("patientId");

-- CreateIndex
CREATE INDEX "visits_episodeId_idx" ON "visits"("episodeId");

-- CreateIndex
CREATE INDEX "visits_clinicianId_idx" ON "visits"("clinicianId");

-- CreateIndex
CREATE INDEX "visits_scheduledDate_idx" ON "visits"("scheduledDate");

-- CreateIndex
CREATE INDEX "visits_status_idx" ON "visits"("status");

-- CreateIndex
CREATE INDEX "visits_visitType_idx" ON "visits"("visitType");

-- CreateIndex
CREATE INDEX "oasis_assessments_patientId_idx" ON "oasis_assessments"("patientId");

-- CreateIndex
CREATE INDEX "oasis_assessments_episodeId_idx" ON "oasis_assessments"("episodeId");

-- CreateIndex
CREATE INDEX "oasis_assessments_clinicianId_idx" ON "oasis_assessments"("clinicianId");

-- CreateIndex
CREATE INDEX "oasis_assessments_assessmentType_idx" ON "oasis_assessments"("assessmentType");

-- CreateIndex
CREATE INDEX "oasis_assessments_status_idx" ON "oasis_assessments"("status");

-- CreateIndex
CREATE INDEX "oasis_assessments_m0090_completionDate_idx" ON "oasis_assessments"("m0090_completionDate");

-- CreateIndex
CREATE INDEX "oasis_responses_assessmentId_idx" ON "oasis_responses"("assessmentId");

-- CreateIndex
CREATE INDEX "oasis_responses_itemCode_idx" ON "oasis_responses"("itemCode");

-- CreateIndex
CREATE INDEX "oasis_responses_section_idx" ON "oasis_responses"("section");

-- CreateIndex
CREATE UNIQUE INDEX "oasis_responses_assessmentId_itemCode_key" ON "oasis_responses"("assessmentId", "itemCode");

-- CreateIndex
CREATE INDEX "documents_patientId_idx" ON "documents"("patientId");

-- CreateIndex
CREATE INDEX "documents_visitId_idx" ON "documents"("visitId");

-- CreateIndex
CREATE INDEX "documents_category_idx" ON "documents"("category");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "documents_reviewStatus_idx" ON "documents"("reviewStatus");

-- CreateIndex
CREATE INDEX "documents_createdAt_idx" ON "documents"("createdAt");

-- CreateIndex
CREATE INDEX "documents_deletedAt_idx" ON "documents"("deletedAt");

-- CreateIndex
CREATE INDEX "voice_transcriptions_patientId_idx" ON "voice_transcriptions"("patientId");

-- CreateIndex
CREATE INDEX "voice_transcriptions_visitId_idx" ON "voice_transcriptions"("visitId");

-- CreateIndex
CREATE INDEX "voice_transcriptions_clinicianId_idx" ON "voice_transcriptions"("clinicianId");

-- CreateIndex
CREATE INDEX "voice_transcriptions_status_idx" ON "voice_transcriptions"("status");

-- CreateIndex
CREATE INDEX "voice_transcriptions_createdAt_idx" ON "voice_transcriptions"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_idx" ON "audit_logs"("resourceType");

-- CreateIndex
CREATE INDEX "audit_logs_resourceId_idx" ON "audit_logs"("resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_phiAccessed_idx" ON "audit_logs"("phiAccessed");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE UNIQUE INDEX "oasis_questions_itemCode_key" ON "oasis_questions"("itemCode");

-- CreateIndex
CREATE INDEX "oasis_questions_section_idx" ON "oasis_questions"("section");

-- CreateIndex
CREATE INDEX "oasis_questions_effectiveDate_idx" ON "oasis_questions"("effectiveDate");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurances" ADD CONSTRAINT "insurances_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_assignments" ADD CONSTRAINT "patient_assignments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_assignments" ADD CONSTRAINT "patient_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oasis_assessments" ADD CONSTRAINT "oasis_assessments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oasis_assessments" ADD CONSTRAINT "oasis_assessments_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oasis_assessments" ADD CONSTRAINT "oasis_assessments_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oasis_assessments" ADD CONSTRAINT "oasis_assessments_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oasis_assessments" ADD CONSTRAINT "oasis_assessments_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oasis_assessments" ADD CONSTRAINT "oasis_assessments_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oasis_responses" ADD CONSTRAINT "oasis_responses_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "oasis_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_transcriptions" ADD CONSTRAINT "voice_transcriptions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_transcriptions" ADD CONSTRAINT "voice_transcriptions_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_transcriptions" ADD CONSTRAINT "voice_transcriptions_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
