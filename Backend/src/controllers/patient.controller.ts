import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  UserRole,
  Gender,
  MaritalStatus,
  PatientStatus,
  ContactRelationship,
  InsuranceType,
  AuditAction,
  PHILevel,
  Prisma,
} from '../generated/prisma';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// ===========================================
// CONFIGURATION
// ===========================================

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// PHI fields that should be tracked in audit logs
const PHI_FIELDS = [
  'firstName',
  'lastName',
  'middleName',
  'dateOfBirth',
  'ssnEncrypted',
  'addressStreet1',
  'addressStreet2',
  'addressCity',
  'addressState',
  'addressZipCode',
  'phoneHome',
  'phoneMobile',
  'phoneWork',
  'email',
  'allergies',
  'primaryPhysicianName',
  'primaryPhysicianPhone',
];

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export interface CreatePatientRequestBody {
  // Demographics
  firstName: string;
  lastName: string;
  middleName?: string;
  preferredName?: string;
  dateOfBirth: string;
  gender: Gender;
  ssnLast4?: string;
  maritalStatus?: MaritalStatus;
  preferredLanguage?: string;
  ethnicity?: string;
  race?: string;
  religion?: string;

  // Contact Information
  addressStreet1: string;
  addressStreet2?: string;
  addressCity: string;
  addressState: string;
  addressZipCode: string;
  addressCounty?: string;
  phoneHome?: string;
  phoneMobile: string;
  phoneWork?: string;
  email?: string;
  preferredContactMethod?: string;

  // Status
  status?: PatientStatus;
  admissionDate?: string;

  // Medical Info
  primaryPhysicianName?: string;
  primaryPhysicianNpi?: string;
  primaryPhysicianPhone?: string;
  primaryPhysicianFax?: string;
  allergies?: string[];
  dnrStatus?: boolean;
  advanceDirectives?: string;

  // Related records
  emergencyContacts?: CreateEmergencyContactInput[];
  insurances?: CreateInsuranceInput[];
}

export interface UpdatePatientRequestBody {
  // Demographics
  firstName?: string;
  lastName?: string;
  middleName?: string;
  preferredName?: string;
  dateOfBirth?: string;
  gender?: Gender;
  ssnLast4?: string;
  maritalStatus?: MaritalStatus;
  preferredLanguage?: string;
  ethnicity?: string;
  race?: string;
  religion?: string;

  // Contact Information
  addressStreet1?: string;
  addressStreet2?: string;
  addressCity?: string;
  addressState?: string;
  addressZipCode?: string;
  addressCounty?: string;
  phoneHome?: string;
  phoneMobile?: string;
  phoneWork?: string;
  email?: string;
  preferredContactMethod?: string;

  // Status
  status?: PatientStatus;
  admissionDate?: string;
  dischargeDate?: string;
  dischargeReason?: string;

  // Medical Info
  primaryPhysicianName?: string;
  primaryPhysicianNpi?: string;
  primaryPhysicianPhone?: string;
  primaryPhysicianFax?: string;
  allergies?: string[];
  dnrStatus?: boolean;
  advanceDirectives?: string;
}

export interface CreateEmergencyContactInput {
  firstName: string;
  lastName: string;
  relationship: ContactRelationship;
  relationshipOther?: string;
  phoneHome?: string;
  phoneMobile: string;
  phoneWork?: string;
  email?: string;
  isPrimaryContact?: boolean;
  hasPowerOfAttorney?: boolean;
  isHealthcareProxy?: boolean;
  canReceivePhiInfo?: boolean;
  notes?: string;
}

export interface CreateInsuranceInput {
  insuranceType: InsuranceType;
  isPrimary?: boolean;
  priority?: number;
  companyName: string;
  planName?: string;
  policyNumber: string;
  groupNumber?: string;
  subscriberId: string;
  subscriberName: string;
  subscriberRelationship?: string;
  subscriberDob?: string;
  effectiveDate: string;
  terminationDate?: string;
  copay?: number;
  deductible?: number;
  coinsurancePercent?: number;
  preAuthRequired?: boolean;
  preAuthNumber?: string;
  preAuthStartDate?: string;
  preAuthEndDate?: string;
  authorizedVisits?: number;
  contactPhone?: string;
  contactFax?: string;
  claimsAddress?: string;
}

export interface ListPatientsQuery {
  page?: string;
  limit?: string;
  search?: string;
  status?: PatientStatus;
  sortBy?: 'lastName' | 'firstName' | 'dateOfBirth' | 'admissionDate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  assignedToMe?: string;
}

export interface PatientResponse {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  preferredName: string | null;
  dateOfBirth: Date;
  gender: Gender;
  maritalStatus: MaritalStatus | null;
  preferredLanguage: string;
  ethnicity: string | null;
  race: string | null;
  religion: string | null;
  addressStreet1: string;
  addressStreet2: string | null;
  addressCity: string;
  addressState: string;
  addressZipCode: string;
  addressCounty: string | null;
  phoneHome: string | null;
  phoneMobile: string;
  phoneWork: string | null;
  email: string | null;
  preferredContactMethod: string;
  status: PatientStatus;
  admissionDate: Date | null;
  dischargeDate: Date | null;
  dischargeReason: string | null;
  primaryPhysicianName: string | null;
  primaryPhysicianNpi: string | null;
  primaryPhysicianPhone: string | null;
  primaryPhysicianFax: string | null;
  allergies: string[];
  dnrStatus: boolean;
  advanceDirectives: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Generate a unique Medical Record Number (MRN)
 */
function generateMRN(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `HHC-${timestamp}-${random}`;
}

/**
 * Create HIPAA-compliant audit log entry for PHI access
 */
async function createPHIAuditLog(
  action: AuditAction,
  userId: string,
  userEmail: string,
  userRole: string,
  resourceId: string,
  resourceName: string,
  success: boolean,
  req: AuthenticatedRequest,
  options: {
    description?: string;
    previousValues?: object;
    newValues?: object;
    phiFields?: string[];
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
        resourceType: 'patient',
        resourceId,
        resourceName,
        description: options.description,
        previousValues: options.previousValues ? JSON.parse(JSON.stringify(options.previousValues)) : null,
        newValues: options.newValues ? JSON.parse(JSON.stringify(options.newValues)) : null,
        phiAccessed: true,
        phiFields: options.phiFields || PHI_FIELDS,
        success,
        errorMessage: options.errorMessage,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.get('user-agent') || null,
        timestamp: new Date(),
        // HIPAA requires 6 years retention
        retentionExpiresAt: new Date(Date.now() + 6 * 365 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (error) {
    console.error('[PHI Audit Log Error]', error);
  }
}

/**
 * Check if user has access to patient based on assignment or role
 */
async function checkPatientAccess(
  userId: string,
  userRole: UserRole,
  patientId: string
): Promise<boolean> {
  // Admins, supervisors, and billing have access to all patients
  if ([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.BILLING].includes(userRole)) {
    return true;
  }

  // Clinical staff need to be assigned to the patient
  const assignment = await prisma.patientAssignment.findFirst({
    where: {
      patientId,
      userId,
      endDate: null, // Active assignment
    },
  });

  return !!assignment;
}

/**
 * Format patient for response (mask sensitive data based on role)
 */
function formatPatientResponse(
  patient: Prisma.PatientGetPayload<{ include: { emergencyContacts: true; insurances: true; assignments: { include: { user: true } } } }>,
  includeSensitive: boolean = true
): object {
  const base: PatientResponse = {
    id: patient.id,
    mrn: patient.mrn,
    firstName: patient.firstName,
    lastName: patient.lastName,
    middleName: patient.middleName,
    preferredName: patient.preferredName,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    maritalStatus: patient.maritalStatus,
    preferredLanguage: patient.preferredLanguage,
    ethnicity: patient.ethnicity,
    race: patient.race,
    religion: patient.religion,
    addressStreet1: includeSensitive ? patient.addressStreet1 : '***',
    addressStreet2: includeSensitive ? patient.addressStreet2 : null,
    addressCity: patient.addressCity,
    addressState: patient.addressState,
    addressZipCode: includeSensitive ? patient.addressZipCode : patient.addressZipCode.substring(0, 3) + '**',
    addressCounty: patient.addressCounty,
    phoneHome: includeSensitive ? patient.phoneHome : patient.phoneHome ? '***-***-' + patient.phoneHome.slice(-4) : null,
    phoneMobile: includeSensitive ? patient.phoneMobile : '***-***-' + patient.phoneMobile.slice(-4),
    phoneWork: includeSensitive ? patient.phoneWork : patient.phoneWork ? '***-***-' + patient.phoneWork.slice(-4) : null,
    email: includeSensitive ? patient.email : patient.email ? '***@***' : null,
    preferredContactMethod: patient.preferredContactMethod,
    status: patient.status,
    admissionDate: patient.admissionDate,
    dischargeDate: patient.dischargeDate,
    dischargeReason: patient.dischargeReason,
    primaryPhysicianName: patient.primaryPhysicianName,
    primaryPhysicianNpi: patient.primaryPhysicianNpi,
    primaryPhysicianPhone: patient.primaryPhysicianPhone,
    primaryPhysicianFax: patient.primaryPhysicianFax,
    allergies: patient.allergies,
    dnrStatus: patient.dnrStatus,
    advanceDirectives: patient.advanceDirectives,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
  };

  return {
    ...base,
    emergencyContacts: patient.emergencyContacts?.filter(ec => !ec.deletedAt) || [],
    insurances: patient.insurances?.filter(ins => !ins.deletedAt) || [],
    assignments: patient.assignments?.map(a => ({
      id: a.id,
      discipline: a.discipline,
      isPrimary: a.isPrimary,
      startDate: a.startDate,
      clinician: {
        id: a.user.id,
        firstName: a.user.firstName,
        lastName: a.user.lastName,
        role: a.user.role,
      },
    })) || [],
  };
}

/**
 * Validate required fields for patient creation
 */
function validateCreatePatientInput(body: CreatePatientRequestBody): string[] {
  const errors: string[] = [];

  if (!body.firstName?.trim()) errors.push('First name is required');
  if (!body.lastName?.trim()) errors.push('Last name is required');
  if (!body.dateOfBirth) errors.push('Date of birth is required');
  if (!body.gender) errors.push('Gender is required');
  if (!body.addressStreet1?.trim()) errors.push('Street address is required');
  if (!body.addressCity?.trim()) errors.push('City is required');
  if (!body.addressState?.trim()) errors.push('State is required');
  if (!body.addressZipCode?.trim()) errors.push('ZIP code is required');
  if (!body.phoneMobile?.trim()) errors.push('Mobile phone is required');

  // Validate date format
  if (body.dateOfBirth && isNaN(Date.parse(body.dateOfBirth))) {
    errors.push('Invalid date of birth format');
  }

  // Validate ZIP code format
  if (body.addressZipCode && !/^\d{5}(-\d{4})?$/.test(body.addressZipCode)) {
    errors.push('Invalid ZIP code format');
  }

  // Validate phone format
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  if (body.phoneMobile && !phoneRegex.test(body.phoneMobile)) {
    errors.push('Invalid mobile phone format');
  }

  // Validate email format if provided
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push('Invalid email format');
  }

  return errors;
}

// ===========================================
// CONTROLLER FUNCTIONS
// ===========================================

/**
 * List patients with pagination, filtering, and search
 * GET /api/patients
 */
export async function listPatients(
  req: AuthenticatedRequest & { query: ListPatientsQuery },
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
      limit = String(DEFAULT_PAGE_SIZE),
      search,
      status,
      sortBy = 'lastName',
      sortOrder = 'asc',
      assignedToMe,
    } = req.query;

    // Parse pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: Prisma.PatientWhereInput = {
      deletedAt: null,
    };

    // Status filter
    if (status) {
      where.status = status;
    }

    // Search filter (name, MRN, phone)
    if (search) {
      const searchTerm = search.trim();
      where.OR = [
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
        { mrn: { contains: searchTerm, mode: 'insensitive' } },
        { phoneMobile: { contains: searchTerm } },
        { phoneHome: { contains: searchTerm } },
      ];
    }

    // Assigned to current user filter
    if (assignedToMe === 'true') {
      where.assignments = {
        some: {
          userId: req.user.id,
          endDate: null,
        },
      };
    }

    // Role-based filtering for non-admin users
    if (![UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.BILLING].includes(req.user.role)) {
      where.assignments = {
        some: {
          userId: req.user.id,
          endDate: null,
        },
      };
    }

    // Build order by
    const orderBy: Prisma.PatientOrderByWithRelationInput = {};
    if (sortBy === 'lastName') orderBy.lastName = sortOrder;
    else if (sortBy === 'firstName') orderBy.firstName = sortOrder;
    else if (sortBy === 'dateOfBirth') orderBy.dateOfBirth = sortOrder;
    else if (sortBy === 'admissionDate') orderBy.admissionDate = sortOrder;
    else if (sortBy === 'createdAt') orderBy.createdAt = sortOrder;

    // Execute query with count
    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        select: {
          id: true,
          mrn: true,
          firstName: true,
          lastName: true,
          middleName: true,
          preferredName: true,
          dateOfBirth: true,
          gender: true,
          phoneMobile: true,
          addressCity: true,
          addressState: true,
          status: true,
          admissionDate: true,
          primaryPhysicianName: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              visits: true,
              assessments: true,
            },
          },
        },
      }),
      prisma.patient.count({ where }),
    ]);

    // Audit log for PHI access (list view)
    await createPHIAuditLog(
      AuditAction.READ,
      req.user.id,
      req.user.email,
      req.user.role,
      'list',
      `Patient list query`,
      true,
      req,
      {
        description: `Listed ${patients.length} patients (page ${pageNum})`,
        phiFields: ['firstName', 'lastName', 'dateOfBirth', 'phoneMobile'],
      }
    );

    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      data: patients,
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
 * Get a single patient by ID with full details
 * GET /api/patients/:id
 */
export async function getPatient(
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
        message: 'Invalid patient ID format',
      });
    }

    // Fetch patient with related data
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        emergencyContacts: {
          where: { deletedAt: null },
          orderBy: [{ isPrimaryContact: 'desc' }, { createdAt: 'asc' }],
        },
        insurances: {
          where: { deletedAt: null },
          orderBy: [{ isPrimary: 'desc' }, { priority: 'asc' }],
        },
        assignments: {
          where: { endDate: null },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
                phone: true,
                email: true,
              },
            },
          },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        updatedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!patient || patient.deletedAt) {
      await createPHIAuditLog(
        AuditAction.READ,
        req.user.id,
        req.user.email,
        req.user.role,
        id,
        'Unknown',
        false,
        req,
        { errorMessage: 'Patient not found' }
      );

      return res.status(404).json({
        error: 'Not Found',
        message: 'Patient not found',
      });
    }

    // Check access permissions
    const hasAccess = await checkPatientAccess(req.user.id, req.user.role, id);
    if (!hasAccess) {
      await createPHIAuditLog(
        AuditAction.READ,
        req.user.id,
        req.user.email,
        req.user.role,
        id,
        `${patient.lastName}, ${patient.firstName}`,
        false,
        req,
        { errorMessage: 'Access denied - not assigned to patient' }
      );

      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this patient',
      });
    }

    // Audit log for PHI access
    await createPHIAuditLog(
      AuditAction.READ,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      `${patient.lastName}, ${patient.firstName}`,
      true,
      req,
      {
        description: `Viewed patient record: ${patient.mrn}`,
      }
    );

    // Determine if sensitive data should be shown
    const showSensitive = [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE].includes(req.user.role);

    return res.status(200).json(formatPatientResponse(patient, showSensitive));
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new patient
 * POST /api/patients
 */
export async function createPatient(
  req: AuthenticatedRequest & { body: CreatePatientRequestBody },
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

    // Only certain roles can create patients
    const allowedRoles = [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to create patients',
      });
    }

    const body = req.body;

    // Validate input
    const validationErrors = validateCreatePatientInput(body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Validation failed',
        errors: validationErrors,
      });
    }

    // Generate unique MRN
    let mrn = generateMRN();
    let mrnExists = await prisma.patient.findUnique({ where: { mrn } });
    while (mrnExists) {
      mrn = generateMRN();
      mrnExists = await prisma.patient.findUnique({ where: { mrn } });
    }

    // Create patient with transaction
    const patient = await prisma.$transaction(async (tx) => {
      // Create patient
      const newPatient = await tx.patient.create({
        data: {
          mrn,
          firstName: body.firstName.trim(),
          lastName: body.lastName.trim(),
          middleName: body.middleName?.trim() || null,
          preferredName: body.preferredName?.trim() || null,
          dateOfBirth: new Date(body.dateOfBirth),
          gender: body.gender,
          ssnEncrypted: body.ssnLast4 || null, // In production, encrypt this
          maritalStatus: body.maritalStatus || null,
          preferredLanguage: body.preferredLanguage || 'English',
          ethnicity: body.ethnicity || null,
          race: body.race || null,
          religion: body.religion || null,
          addressStreet1: body.addressStreet1.trim(),
          addressStreet2: body.addressStreet2?.trim() || null,
          addressCity: body.addressCity.trim(),
          addressState: body.addressState.toUpperCase().trim(),
          addressZipCode: body.addressZipCode.trim(),
          addressCounty: body.addressCounty?.trim() || null,
          phoneHome: body.phoneHome?.trim() || null,
          phoneMobile: body.phoneMobile.trim(),
          phoneWork: body.phoneWork?.trim() || null,
          email: body.email?.toLowerCase().trim() || null,
          preferredContactMethod: body.preferredContactMethod || 'phone',
          status: body.status || PatientStatus.PENDING,
          admissionDate: body.admissionDate ? new Date(body.admissionDate) : null,
          primaryPhysicianName: body.primaryPhysicianName?.trim() || null,
          primaryPhysicianNpi: body.primaryPhysicianNpi?.trim() || null,
          primaryPhysicianPhone: body.primaryPhysicianPhone?.trim() || null,
          primaryPhysicianFax: body.primaryPhysicianFax?.trim() || null,
          allergies: body.allergies || [],
          dnrStatus: body.dnrStatus || false,
          advanceDirectives: body.advanceDirectives || null,
          createdById: req.user!.id,
          updatedById: req.user!.id,
        },
      });

      // Create emergency contacts if provided
      if (body.emergencyContacts && body.emergencyContacts.length > 0) {
        await tx.emergencyContact.createMany({
          data: body.emergencyContacts.map((ec, index) => ({
            patientId: newPatient.id,
            firstName: ec.firstName.trim(),
            lastName: ec.lastName.trim(),
            relationship: ec.relationship,
            relationshipOther: ec.relationshipOther?.trim() || null,
            phoneHome: ec.phoneHome?.trim() || null,
            phoneMobile: ec.phoneMobile.trim(),
            phoneWork: ec.phoneWork?.trim() || null,
            email: ec.email?.toLowerCase().trim() || null,
            isPrimaryContact: ec.isPrimaryContact || index === 0,
            hasPowerOfAttorney: ec.hasPowerOfAttorney || false,
            isHealthcareProxy: ec.isHealthcareProxy || false,
            canReceivePhiInfo: ec.canReceivePhiInfo !== false,
            notes: ec.notes?.trim() || null,
          })),
        });
      }

      // Create insurance records if provided
      if (body.insurances && body.insurances.length > 0) {
        await tx.insurance.createMany({
          data: body.insurances.map((ins, index) => ({
            patientId: newPatient.id,
            insuranceType: ins.insuranceType,
            isPrimary: ins.isPrimary || index === 0,
            priority: ins.priority || index + 1,
            companyName: ins.companyName.trim(),
            planName: ins.planName?.trim() || null,
            policyNumber: ins.policyNumber.trim(),
            groupNumber: ins.groupNumber?.trim() || null,
            subscriberId: ins.subscriberId.trim(),
            subscriberName: ins.subscriberName.trim(),
            subscriberRelationship: ins.subscriberRelationship || 'self',
            subscriberDob: ins.subscriberDob ? new Date(ins.subscriberDob) : null,
            effectiveDate: new Date(ins.effectiveDate),
            terminationDate: ins.terminationDate ? new Date(ins.terminationDate) : null,
            copay: ins.copay || null,
            deductible: ins.deductible || null,
            coinsurancePercent: ins.coinsurancePercent || null,
            preAuthRequired: ins.preAuthRequired || false,
            preAuthNumber: ins.preAuthNumber?.trim() || null,
            preAuthStartDate: ins.preAuthStartDate ? new Date(ins.preAuthStartDate) : null,
            preAuthEndDate: ins.preAuthEndDate ? new Date(ins.preAuthEndDate) : null,
            authorizedVisits: ins.authorizedVisits || null,
            contactPhone: ins.contactPhone?.trim() || null,
            contactFax: ins.contactFax?.trim() || null,
            claimsAddress: ins.claimsAddress?.trim() || null,
          })),
        });
      }

      // Fetch complete patient with relations
      return tx.patient.findUnique({
        where: { id: newPatient.id },
        include: {
          emergencyContacts: { where: { deletedAt: null } },
          insurances: { where: { deletedAt: null } },
          assignments: {
            where: { endDate: null },
            include: { user: true },
          },
        },
      });
    });

    if (!patient) {
      throw new Error('Failed to create patient');
    }

    // Audit log for PHI creation
    await createPHIAuditLog(
      AuditAction.CREATE,
      req.user.id,
      req.user.email,
      req.user.role,
      patient.id,
      `${patient.lastName}, ${patient.firstName}`,
      true,
      req,
      {
        description: `Created new patient: ${patient.mrn}`,
        newValues: {
          mrn: patient.mrn,
          name: `${patient.lastName}, ${patient.firstName}`,
          dateOfBirth: patient.dateOfBirth,
          status: patient.status,
        },
      }
    );

    return res.status(201).json({
      message: 'Patient created successfully',
      patient: formatPatientResponse(patient, true),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update an existing patient
 * PUT /api/patients/:id
 */
export async function updatePatient(
  req: AuthenticatedRequest & { params: { id: string }; body: UpdatePatientRequestBody },
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

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid patient ID format',
      });
    }

    // Fetch existing patient
    const existingPatient = await prisma.patient.findUnique({
      where: { id },
      include: {
        emergencyContacts: { where: { deletedAt: null } },
        insurances: { where: { deletedAt: null } },
        assignments: {
          where: { endDate: null },
          include: { user: true },
        },
      },
    });

    if (!existingPatient || existingPatient.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Patient not found',
      });
    }

    // Check access permissions
    const hasAccess = await checkPatientAccess(req.user.id, req.user.role, id);
    if (!hasAccess) {
      await createPHIAuditLog(
        AuditAction.UPDATE,
        req.user.id,
        req.user.email,
        req.user.role,
        id,
        `${existingPatient.lastName}, ${existingPatient.firstName}`,
        false,
        req,
        { errorMessage: 'Access denied - not assigned to patient' }
      );

      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to update this patient',
      });
    }

    // Only certain roles can update critical fields
    const criticalFields = ['status', 'dischargeDate', 'dischargeReason', 'dnrStatus', 'advanceDirectives'];
    const hasCriticalUpdates = criticalFields.some(field => body[field as keyof UpdatePatientRequestBody] !== undefined);

    if (hasCriticalUpdates && ![UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.NURSE].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to update critical patient fields',
      });
    }

    // Build update data
    const updateData: Prisma.PatientUpdateInput = {
      updatedById: req.user.id,
    };

    // Only include fields that are explicitly provided
    if (body.firstName !== undefined) updateData.firstName = body.firstName.trim();
    if (body.lastName !== undefined) updateData.lastName = body.lastName.trim();
    if (body.middleName !== undefined) updateData.middleName = body.middleName?.trim() || null;
    if (body.preferredName !== undefined) updateData.preferredName = body.preferredName?.trim() || null;
    if (body.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(body.dateOfBirth);
    if (body.gender !== undefined) updateData.gender = body.gender;
    if (body.ssnLast4 !== undefined) updateData.ssnEncrypted = body.ssnLast4 || null;
    if (body.maritalStatus !== undefined) updateData.maritalStatus = body.maritalStatus || null;
    if (body.preferredLanguage !== undefined) updateData.preferredLanguage = body.preferredLanguage;
    if (body.ethnicity !== undefined) updateData.ethnicity = body.ethnicity || null;
    if (body.race !== undefined) updateData.race = body.race || null;
    if (body.religion !== undefined) updateData.religion = body.religion || null;
    if (body.addressStreet1 !== undefined) updateData.addressStreet1 = body.addressStreet1.trim();
    if (body.addressStreet2 !== undefined) updateData.addressStreet2 = body.addressStreet2?.trim() || null;
    if (body.addressCity !== undefined) updateData.addressCity = body.addressCity.trim();
    if (body.addressState !== undefined) updateData.addressState = body.addressState.toUpperCase().trim();
    if (body.addressZipCode !== undefined) updateData.addressZipCode = body.addressZipCode.trim();
    if (body.addressCounty !== undefined) updateData.addressCounty = body.addressCounty?.trim() || null;
    if (body.phoneHome !== undefined) updateData.phoneHome = body.phoneHome?.trim() || null;
    if (body.phoneMobile !== undefined) updateData.phoneMobile = body.phoneMobile.trim();
    if (body.phoneWork !== undefined) updateData.phoneWork = body.phoneWork?.trim() || null;
    if (body.email !== undefined) updateData.email = body.email?.toLowerCase().trim() || null;
    if (body.preferredContactMethod !== undefined) updateData.preferredContactMethod = body.preferredContactMethod;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.admissionDate !== undefined) updateData.admissionDate = body.admissionDate ? new Date(body.admissionDate) : null;
    if (body.dischargeDate !== undefined) updateData.dischargeDate = body.dischargeDate ? new Date(body.dischargeDate) : null;
    if (body.dischargeReason !== undefined) updateData.dischargeReason = body.dischargeReason || null;
    if (body.primaryPhysicianName !== undefined) updateData.primaryPhysicianName = body.primaryPhysicianName?.trim() || null;
    if (body.primaryPhysicianNpi !== undefined) updateData.primaryPhysicianNpi = body.primaryPhysicianNpi?.trim() || null;
    if (body.primaryPhysicianPhone !== undefined) updateData.primaryPhysicianPhone = body.primaryPhysicianPhone?.trim() || null;
    if (body.primaryPhysicianFax !== undefined) updateData.primaryPhysicianFax = body.primaryPhysicianFax?.trim() || null;
    if (body.allergies !== undefined) updateData.allergies = body.allergies;
    if (body.dnrStatus !== undefined) updateData.dnrStatus = body.dnrStatus;
    if (body.advanceDirectives !== undefined) updateData.advanceDirectives = body.advanceDirectives || null;

    // Update patient
    const updatedPatient = await prisma.patient.update({
      where: { id },
      data: updateData,
      include: {
        emergencyContacts: { where: { deletedAt: null } },
        insurances: { where: { deletedAt: null } },
        assignments: {
          where: { endDate: null },
          include: { user: true },
        },
      },
    });

    // Track what fields changed for audit
    const changedFields = Object.keys(body).filter(key => body[key as keyof UpdatePatientRequestBody] !== undefined);

    // Audit log for PHI update
    await createPHIAuditLog(
      AuditAction.UPDATE,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      `${updatedPatient.lastName}, ${updatedPatient.firstName}`,
      true,
      req,
      {
        description: `Updated patient: ${updatedPatient.mrn}`,
        previousValues: {
          ...changedFields.reduce((acc, field) => {
            acc[field] = existingPatient[field as keyof typeof existingPatient];
            return acc;
          }, {} as Record<string, unknown>),
        },
        newValues: {
          ...changedFields.reduce((acc, field) => {
            acc[field] = updatedPatient[field as keyof typeof updatedPatient];
            return acc;
          }, {} as Record<string, unknown>),
        },
        phiFields: changedFields.filter(f => PHI_FIELDS.includes(f)),
      }
    );

    return res.status(200).json({
      message: 'Patient updated successfully',
      patient: formatPatientResponse(updatedPatient, true),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Soft delete a patient
 * DELETE /api/patients/:id
 */
export async function deletePatient(
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

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid patient ID format',
      });
    }

    // Only admins and supervisors can delete patients
    if (![UserRole.ADMIN, UserRole.SUPERVISOR].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to delete patients',
      });
    }

    // Fetch existing patient
    const existingPatient = await prisma.patient.findUnique({
      where: { id },
    });

    if (!existingPatient) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Patient not found',
      });
    }

    if (existingPatient.deletedAt) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Patient has already been deleted',
      });
    }

    // Soft delete patient (HIPAA requires retention, never hard delete)
    const deletedPatient = await prisma.patient.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedById: req.user.id,
        status: PatientStatus.DISCHARGED,
        dischargeDate: existingPatient.dischargeDate || new Date(),
        dischargeReason: reason || 'Record deleted',
      },
    });

    // Audit log for PHI deletion
    await createPHIAuditLog(
      AuditAction.DELETE,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      `${deletedPatient.lastName}, ${deletedPatient.firstName}`,
      true,
      req,
      {
        description: `Soft deleted patient: ${deletedPatient.mrn}. Reason: ${reason || 'Not specified'}`,
        previousValues: {
          status: existingPatient.status,
          deletedAt: existingPatient.deletedAt,
        },
        newValues: {
          status: deletedPatient.status,
          deletedAt: deletedPatient.deletedAt,
          dischargeReason: deletedPatient.dischargeReason,
        },
      }
    );

    return res.status(200).json({
      message: 'Patient deleted successfully',
      patientId: id,
    });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
};
