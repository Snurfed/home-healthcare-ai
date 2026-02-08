import { Router } from 'express';
import * as patientController from '../controllers/patient.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../generated/prisma';

// ===========================================
// TYPE DEFINITIONS (kept for API documentation)
// ===========================================

// Demographics
export interface PatientDemographics {
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string; // ISO 8601 format
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  ssn?: string; // Last 4 digits only for display, encrypted in DB
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed' | 'separated';
  preferredLanguage: string;
  ethnicity?: string;
  race?: string;
}

// Contact Information
export interface ContactInfo {
  address: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zipCode: string;
    county?: string;
  };
  phoneHome?: string;
  phoneMobile: string;
  phoneWork?: string;
  email?: string;
  preferredContactMethod: 'phone' | 'email' | 'text';
}

// Emergency Contact
export interface EmergencyContact {
  id?: string;
  firstName: string;
  lastName: string;
  relationship: 'spouse' | 'child' | 'parent' | 'sibling' | 'friend' | 'caregiver' | 'other';
  phoneHome?: string;
  phoneMobile: string;
  phoneWork?: string;
  email?: string;
  isPrimaryContact: boolean;
  hasPowerOfAttorney: boolean;
  isHealthcareProxy: boolean;
}

// Insurance Information
export interface InsuranceInfo {
  id?: string;
  insuranceType: 'medicare' | 'medicaid' | 'private' | 'tricare' | 'va' | 'workers_comp' | 'other';
  isPrimary: boolean;
  companyName: string;
  planName?: string;
  policyNumber: string;
  groupNumber?: string;
  subscriberId: string;
  subscriberName: string;
  subscriberRelationship: 'self' | 'spouse' | 'child' | 'other';
  effectiveDate: string;
  terminationDate?: string;
  copay?: number;
  deductible?: number;
  coinsurance?: number;
  preAuthorizationRequired: boolean;
  preAuthorizationNumber?: string;
  contactPhone?: string;
}

// Care Plan Details
export interface CarePlanDetails {
  id?: string;
  startDate: string;
  endDate?: string;
  status: 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  primaryDiagnosis: DiagnosisCode;
  secondaryDiagnoses?: DiagnosisCode[];
  attendingPhysician: PhysicianInfo;
  referringPhysician?: PhysicianInfo;
  certificationPeriod: {
    startDate: string;
    endDate: string;
  };
  servicesAuthorized: AuthorizedService[];
  goals: CareGoal[];
  visitFrequency: VisitFrequency;
  specialInstructions?: string;
  dnrStatus: boolean;
  advanceDirectives?: string;
}

export interface DiagnosisCode {
  code: string; // ICD-10 code
  description: string;
  isPrimary: boolean;
  onsetDate?: string;
}

export interface PhysicianInfo {
  npi: string;
  firstName: string;
  lastName: string;
  specialty?: string;
  phone: string;
  fax?: string;
  address?: {
    street1: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export interface AuthorizedService {
  serviceType: 'skilled_nursing' | 'physical_therapy' | 'occupational_therapy' | 'speech_therapy' | 'home_health_aide' | 'medical_social_work';
  frequency: string; // e.g., "2x weekly", "3x weekly for 4 weeks"
  duration: string; // e.g., "60 minutes"
  authorizedVisits: number;
  usedVisits: number;
  remainingVisits: number;
  startDate: string;
  endDate: string;
}

export interface CareGoal {
  id?: string;
  category: 'mobility' | 'self_care' | 'medication' | 'wound_care' | 'pain_management' | 'safety' | 'nutrition' | 'other';
  description: string;
  targetDate: string;
  status: 'not_started' | 'in_progress' | 'achieved' | 'not_achieved' | 'revised';
  measurableOutcome: string;
  interventions: string[];
}

export interface VisitFrequency {
  skilledNursing?: string;
  physicalTherapy?: string;
  occupationalTherapy?: string;
  speechTherapy?: string;
  homeHealthAide?: string;
  medicalSocialWork?: string;
}

// Full Patient Record
export interface Patient {
  id: string;
  mrn: string; // Medical Record Number
  demographics: PatientDemographics;
  contact: ContactInfo;
  emergencyContacts: EmergencyContact[];
  insurance: InsuranceInfo[];
  carePlan?: CarePlanDetails;
  status: 'active' | 'inactive' | 'discharged' | 'pending' | 'deceased';
  admissionDate: string;
  dischargeDate?: string;
  assignedClinicians: string[]; // User IDs
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  deletedAt?: string; // Soft delete timestamp
}

// Request/Response Types
export interface CreatePatientRequest {
  demographics: PatientDemographics;
  contact: ContactInfo;
  emergencyContacts: EmergencyContact[];
  insurance: InsuranceInfo[];
  carePlan?: Partial<CarePlanDetails>;
  assignedClinicians?: string[];
}

export interface UpdatePatientRequest {
  demographics?: Partial<PatientDemographics>;
  contact?: Partial<ContactInfo>;
  emergencyContacts?: EmergencyContact[];
  insurance?: InsuranceInfo[];
  carePlan?: Partial<CarePlanDetails>;
  status?: Patient['status'];
  assignedClinicians?: string[];
}

export interface PatientListQuery {
  page?: string;
  limit?: string;
  status?: Patient['status'];
  search?: string;
  assignedTo?: string;
  sortBy?: 'lastName' | 'admissionDate' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
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

// ===========================================
// ROUTER INITIALIZATION
// ===========================================

const router = Router();

// ===========================================
// ROUTES
// ===========================================

/**
 * @route   GET /api/patients
 * @desc    Get all patients with pagination and filtering
 * @access  Private - All authenticated clinical staff
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
  patientController.listPatients
);

/**
 * @route   GET /api/patients/:id
 * @desc    Get a single patient by ID with full details
 * @access  Private - Must be assigned to patient or have admin/supervisor role
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
  patientController.getPatient
);

/**
 * @route   POST /api/patients
 * @desc    Create a new patient
 * @access  Private - Admin, Supervisor, Nurse only
 */
router.post(
  '/',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
  ]),
  patientController.createPatient
);

/**
 * @route   PUT /api/patients/:id
 * @desc    Update an existing patient
 * @access  Private - Must be assigned to patient or have admin/supervisor role
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
  patientController.updatePatient
);

/**
 * @route   DELETE /api/patients/:id
 * @desc    Soft delete a patient (sets deletedAt timestamp)
 * @access  Private - Admin and Supervisor only
 */
router.delete(
  '/:id',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
  ]),
  patientController.deletePatient
);

/**
 * @route   GET /api/patients/:id/assessment-timeline
 * @desc    Get patient assessment timeline grouped by 60-day episodes
 * @access  Private - Clinical staff with patient access
 */
router.get(
  '/:id/assessment-timeline',
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
  patientController.getPatientAssessmentTimeline
);

export default router;
