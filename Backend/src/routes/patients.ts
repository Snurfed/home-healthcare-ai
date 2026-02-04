import { Router, Request, Response, NextFunction } from 'express';

// TODO: Import controllers when implemented
// import * as patientController from '@controllers/patient.controller';

// TODO: Import middleware when implemented
// import { authenticate, authorize } from '@middleware/auth.middleware';
// import { validateRequest } from '@middleware/validation.middleware';

// TODO: Import validators when implemented
// import { createPatientSchema, updatePatientSchema } from '@validators/patient.validator';

// ===========================================
// TYPE DEFINITIONS
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

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
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
 * @access  Private
 */
router.get(
  '/',
  // authenticate,
  // authorize(['nurse', 'therapist', 'admin']),
  async (req: Request<object, object, object, PatientListQuery>, res: Response, next: NextFunction) => {
    try {
      // TODO: Implement list patients logic
      // const result = await patientController.listPatients(req.query, req.user);

      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '20', 10);

      // Placeholder response
      const response: PaginatedResponse<Partial<Patient>> = {
        data: [
          {
            id: 'patient-uuid-1',
            mrn: 'MRN-001234',
            demographics: {
              firstName: 'Jane',
              lastName: 'Doe',
              dateOfBirth: '1945-03-15',
              gender: 'female',
              preferredLanguage: 'English',
            },
            status: 'active',
            admissionDate: '2024-01-15',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        pagination: {
          page,
          limit,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/patients/:id
 * @desc    Get a single patient by ID
 * @access  Private
 */
router.get(
  '/:id',
  // authenticate,
  // authorize(['nurse', 'therapist', 'admin']),
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      // TODO: Implement get patient logic
      // const patient = await patientController.getPatient(req.params.id, req.user);

      const { id } = req.params;

      // Placeholder response
      const patient: Patient = {
        id,
        mrn: 'MRN-001234',
        demographics: {
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1945-03-15',
          gender: 'female',
          preferredLanguage: 'English',
          maritalStatus: 'widowed',
        },
        contact: {
          address: {
            street1: '123 Main Street',
            city: 'Springfield',
            state: 'IL',
            zipCode: '62701',
          },
          phoneMobile: '555-123-4567',
          preferredContactMethod: 'phone',
        },
        emergencyContacts: [
          {
            id: 'ec-uuid-1',
            firstName: 'John',
            lastName: 'Doe',
            relationship: 'child',
            phoneMobile: '555-987-6543',
            isPrimaryContact: true,
            hasPowerOfAttorney: true,
            isHealthcareProxy: true,
          },
        ],
        insurance: [
          {
            id: 'ins-uuid-1',
            insuranceType: 'medicare',
            isPrimary: true,
            companyName: 'Medicare',
            policyNumber: '1EG4-TE5-MK72',
            subscriberId: '1EG4-TE5-MK72',
            subscriberName: 'Jane Doe',
            subscriberRelationship: 'self',
            effectiveDate: '2010-03-15',
            preAuthorizationRequired: false,
          },
        ],
        status: 'active',
        admissionDate: '2024-01-15',
        assignedClinicians: ['clinician-uuid-1'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'admin-uuid',
        updatedBy: 'admin-uuid',
      };

      res.status(200).json(patient);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/patients
 * @desc    Create a new patient
 * @access  Private
 */
router.post(
  '/',
  // authenticate,
  // authorize(['nurse', 'admin']),
  // validateRequest(createPatientSchema),
  async (req: AuthenticatedRequest & { body: CreatePatientRequest }, res: Response, next: NextFunction) => {
    try {
      // TODO: Implement create patient logic
      // const patient = await patientController.createPatient(req.body, req.user);

      const { demographics, contact, emergencyContacts, insurance } = req.body;

      // Placeholder response
      const newPatient: Patient = {
        id: 'new-patient-uuid',
        mrn: `MRN-${Date.now()}`,
        demographics,
        contact,
        emergencyContacts,
        insurance,
        status: 'pending',
        admissionDate: new Date().toISOString().split('T')[0],
        assignedClinicians: req.body.assignedClinicians || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: req.user?.id || 'system',
        updatedBy: req.user?.id || 'system',
      };

      res.status(201).json({
        message: 'Patient created successfully',
        patient: newPatient,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/patients/:id
 * @desc    Update an existing patient
 * @access  Private
 */
router.put(
  '/:id',
  // authenticate,
  // authorize(['nurse', 'admin']),
  // validateRequest(updatePatientSchema),
  async (req: AuthenticatedRequest & Request<{ id: string }, object, UpdatePatientRequest>, res: Response, next: NextFunction) => {
    try {
      // TODO: Implement update patient logic
      // const patient = await patientController.updatePatient(req.params.id, req.body, req.user);

      const { id } = req.params;

      // Placeholder response
      res.status(200).json({
        message: 'Patient updated successfully',
        patient: {
          id,
          ...req.body,
          updatedAt: new Date().toISOString(),
          updatedBy: req.user?.id || 'system',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/patients/:id
 * @desc    Soft delete a patient (sets deletedAt timestamp)
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  // authenticate,
  // authorize(['admin']),
  async (req: AuthenticatedRequest & Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      // TODO: Implement soft delete logic
      // await patientController.deletePatient(req.params.id, req.user);

      const { id } = req.params;

      // Placeholder response - soft delete sets deletedAt, doesn't remove record
      res.status(200).json({
        message: 'Patient record deleted successfully',
        patient: {
          id,
          status: 'inactive',
          deletedAt: new Date().toISOString(),
          deletedBy: req.user?.id || 'system',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
