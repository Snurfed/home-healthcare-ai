/**
 * Medicare Compliance Validation Service
 *
 * Comprehensive Medicare compliance validation for home health care including:
 * - Homebound status documentation validation
 * - Skilled care necessity validation
 * - OASIS assessment completeness checks
 * - Face-to-face encounter requirements
 * - Certification period date validation
 *
 * Based on Medicare Benefit Policy Manual Chapter 7 and CMS guidelines.
 */

import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/prisma';
import type {
  ComplianceIssue,
  ValidationResult,
  HomeboundCheckInput,
  HomeboundCheckResult,
  SkilledCareValidationResult,
  SkilledCareRequirement,
  FaceToFaceRequirement,
  CertificationPeriodValidation,
} from '../../types/compliance.types';
import { COMMON_DENIAL_REASONS } from '../../types/compliance.types';

// ===========================================
// CONSTANTS
// ===========================================

/** Medicare certification period length in days */
const CERTIFICATION_PERIOD_DAYS = 60;

/** Face-to-face encounter window: 90 days before SOC */
const F2F_DAYS_BEFORE_SOC = 90;

/** Face-to-face encounter window: 30 days after SOC */
const F2F_DAYS_AFTER_SOC = 30;

/** Days before recertification deadline to warn */
const RECERT_WARNING_DAYS = 10;

/** OASIS items indicating homebound status */
const HOMEBOUND_OASIS_ITEMS = [
  'GG0170A', // Mobility: Lying to sitting on side of bed
  'GG0170B', // Mobility: Sitting to lying on side of bed
  'GG0170C', // Mobility: Lying to sitting on side of bed
  'GG0170I', // Walk 10 feet
  'GG0170J', // Walk 50 feet with two turns
  'M1800',   // Grooming
  'M1810',   // Current ability to dress upper body
  'M1820',   // Current ability to dress lower body
  'M1830',   // Bathing
  'M1840',   // Toilet transferring
  'M1850',   // Transferring
  'M1860',   // Ambulation/Locomotion
];

/**
 * OASIS items for skilled care necessity
 * Exported for potential use by other services
 */
export const SKILLED_CARE_OASIS_ITEMS = {
  nursing: ['M1021', 'M1023', 'M1033', 'M2001', 'M2003', 'M2005', 'M2010', 'M2015'],
  therapy: ['GG0130', 'GG0170', 'M1800', 'M1810', 'M1820', 'M1830', 'M1840', 'M1850', 'M1860'],
  wounds: ['M1306', 'M1307', 'M1308', 'M1309', 'M1320', 'M1322', 'M1324', 'M1330', 'M1332', 'M1334', 'M1340', 'M1342'],
};

/** Functional scores indicating dependency (GG items) */
const DEPENDENT_SCORES = ['01', '02', '03', '04', '07', '09', '88'];

// ===========================================
// MAIN VALIDATION FUNCTION
// ===========================================

/**
 * Comprehensive Medicare compliance validation for a visit
 */
export async function validateVisitCompliance(
  visitId: string,
  options: {
    includeOasisCheck?: boolean;
    includeBillingCheck?: boolean;
  } = {}
): Promise<ValidationResult> {
  const issues: ComplianceIssue[] = [];
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      patient: true,
      episode: true,
    },
  });

  if (!visit) {
    return {
      valid: false,
      issues: [{
        id: uuidv4(),
        field: 'visitId',
        code: 'VISIT_NOT_FOUND',
        severity: 'error',
        category: 'documentation',
        message: 'Visit not found',
        suggestion: 'Verify the visit ID and try again',
        source: 'medicareCompliance.validateVisitCompliance',
      }],
      score: 0,
      summary: { errors: 1, warnings: 0, info: 0 },
      validatedAt: new Date().toISOString(),
      entityType: 'visit',
      entityId: visitId,
    };
  }

  // Validate homebound status
  const homeboundResult = await validateHomeboundStatus({
    patientId: visit.patientId,
    visitId: visit.id,
  });
  issues.push(...homeboundResult.issues);

  // Validate skilled care necessity
  const skilledCareResult = await validateSkilledCareNecessity(
    visit.episodeId,
    visit.id
  );
  issues.push(...skilledCareResult.issues);

  // Validate face-to-face requirements
  const f2fResult = await validateFaceToFaceRequirements(visit.episodeId);
  issues.push(...f2fResult.issues);

  // Validate certification period
  const certResult = await validateCertificationPeriod(visit.episodeId);
  issues.push(...certResult.issues);

  // Check OASIS assessment completeness if requested
  if (options.includeOasisCheck && visit.episode) {
    const latestAssessment = await prisma.oasisAssessment.findFirst({
      where: { episodeId: visit.episodeId },
      orderBy: { createdAt: 'desc' },
    });
    if (latestAssessment) {
      const oasisIssues = await checkOasisCompleteness(latestAssessment.id);
      issues.push(...oasisIssues);
    }
  }

  // Calculate compliance score
  const score = calculateComplianceScore(issues);

  return {
    valid: !issues.some((i) => i.severity === 'error'),
    issues,
    score,
    summary: {
      errors: issues.filter((i) => i.severity === 'error').length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
      info: issues.filter((i) => i.severity === 'info').length,
    },
    validatedAt: new Date().toISOString(),
    entityType: 'visit',
    entityId: visitId,
  };
}

// ===========================================
// HOMEBOUND STATUS VALIDATION
// ===========================================

/**
 * Validate homebound status documentation per Medicare requirements
 *
 * Per Medicare Benefit Policy Manual Ch. 7 Section 30.1.1:
 * Patient is considered "confined to the home" if:
 * 1. Leaving home requires considerable and taxing effort, OR
 * 2. Leaving home is medically contraindicated
 *
 * AND one of these criteria:
 * - Needs supportive devices (walker, crutches, wheelchair)
 * - Needs special transportation or assistance
 * - Has a medical condition limiting ability to leave
 */
export async function validateHomeboundStatus(
  input: HomeboundCheckInput
): Promise<HomeboundCheckResult> {
  const issues: ComplianceIssue[] = [];
  const qualifyingCriteria: string[] = [];
  const missingDocumentation: string[] = [];
  const recommendations: string[] = [];

  // Fetch patient data
  const patient = await prisma.patient.findUnique({
    where: { id: input.patientId },
  });

  if (!patient) {
    return {
      isValid: false,
      confidence: 0,
      qualifyingCriteria: [],
      missingDocumentation: ['Patient record not found'],
      issues: [{
        id: uuidv4(),
        field: 'patientId',
        code: 'PATIENT_NOT_FOUND',
        severity: 'error',
        category: 'homebound_status',
        message: 'Patient not found',
        suggestion: 'Verify patient ID',
        source: 'medicareCompliance.validateHomeboundStatus',
      }],
      recommendations: [],
      policyReference: 'Medicare Benefit Policy Manual Ch. 7 Section 30.1.1',
    };
  }

  // Fetch latest episode and assessment
  const latestEpisode = await prisma.episode.findFirst({
    where: { patientId: input.patientId },
    orderBy: { createdAt: 'desc' },
  });

  let responses: Array<{ itemCode: string; responseCode: string | null; responseValue: string | null }> = [];

  if (latestEpisode) {
    const assessment = await prisma.oasisAssessment.findFirst({
      where: { episodeId: latestEpisode.id },
      orderBy: { createdAt: 'desc' },
      include: { responses: true },
    });
    responses = assessment?.responses || [];
  }

  // Build response map
  const responseMap: Record<string, string | null> = {};
  for (const response of responses) {
    responseMap[response.itemCode] = response.responseCode || response.responseValue;
  }

  // Check mobility/functional items
  let mobilityIssueFound = false;
  let assistiveDeviceDocumented = false;
  let dependentScoreCount = 0;

  for (const itemCode of HOMEBOUND_OASIS_ITEMS) {
    const value = responseMap[itemCode];
    if (value && DEPENDENT_SCORES.includes(value)) {
      dependentScoreCount++;
      mobilityIssueFound = true;
    }
  }

  // Check for assistive device documentation (M1860)
  const ambulationStatus = responseMap['M1860'];
  if (ambulationStatus && ['01', '02', '03', '04'].includes(ambulationStatus)) {
    assistiveDeviceDocumented = true;
    qualifyingCriteria.push('Uses assistive device for ambulation');
  }

  // Analyze functional scores
  if (dependentScoreCount >= 3) {
    qualifyingCriteria.push('Multiple functional limitations documented');
  } else if (dependentScoreCount > 0) {
    qualifyingCriteria.push(`${dependentScoreCount} functional limitation(s) documented`);
  }

  // Check for explicit homebound documentation
  if (!mobilityIssueFound && !assistiveDeviceDocumented) {
    missingDocumentation.push('Mobility limitations not clearly documented');
    issues.push({
      id: uuidv4(),
      field: 'homebound_status',
      code: 'HOMEBOUND_MOBILITY_MISSING',
      severity: 'warning',
      category: 'homebound_status',
      message: 'Homebound status: mobility limitations not clearly documented',
      suggestion: 'Document specific mobility limitations that make leaving home a considerable effort',
      denialRisk: 'HOMEBOUND_NOT_DOCUMENTED',
      context: COMMON_DENIAL_REASONS.HOMEBOUND_NOT_DOCUMENTED.description,
      source: 'medicareCompliance.validateHomeboundStatus',
    });
    recommendations.push(
      'Document specific physical or cognitive conditions limiting mobility',
      'Describe the taxing effort required to leave home',
      'Note assistive devices used (wheelchair, walker, etc.)'
    );
  }

  // Check for taxing effort documentation in visit notes
  if (input.visitNotes && input.visitNotes.length > 0) {
    const taxingKeywords = [
      'considerable effort',
      'taxing effort',
      'assistance required',
      'unable to leave',
      'homebound',
      'confined to home',
      'medically contraindicated',
      'wheelchair bound',
      'bedbound',
      'requires assistance',
    ];

    const hasExplicitDocumentation = input.visitNotes.some((note) =>
      taxingKeywords.some((keyword) =>
        note.toLowerCase().includes(keyword.toLowerCase())
      )
    );

    if (hasExplicitDocumentation) {
      qualifyingCriteria.push('Explicit homebound status documented in visit notes');
    } else {
      missingDocumentation.push('Explicit homebound status statement in visit notes');
      recommendations.push(
        'Include explicit statement about homebound status in visit documentation'
      );
    }
  } else {
    missingDocumentation.push('Visit notes for homebound verification');
  }

  // Determine validity and confidence
  const isValid = qualifyingCriteria.length > 0 && missingDocumentation.length < 2;
  const confidence = Math.min(
    1,
    (qualifyingCriteria.length * 0.3 + (mobilityIssueFound ? 0.3 : 0) + (assistiveDeviceDocumented ? 0.2 : 0)) /
      (1 + missingDocumentation.length * 0.2)
  );

  // Add error if homebound status is not adequately documented
  if (!isValid) {
    issues.push({
      id: uuidv4(),
      field: 'homebound_status',
      code: 'HOMEBOUND_NOT_DOCUMENTED',
      severity: 'error',
      category: 'homebound_status',
      message: 'Homebound status not adequately documented for Medicare eligibility',
      suggestion: 'Document qualifying criteria: mobility limitations, assistive devices, or medical contraindication for leaving home',
      denialRisk: 'HOMEBOUND_NOT_DOCUMENTED',
      context: 'Medicare requires documentation that leaving home is a considerable and taxing effort',
      source: 'medicareCompliance.validateHomeboundStatus',
    });
  }

  return {
    isValid,
    confidence: Math.round(confidence * 100) / 100,
    qualifyingCriteria,
    missingDocumentation,
    issues,
    recommendations,
    policyReference: 'Medicare Benefit Policy Manual Chapter 7, Section 30.1.1',
  };
}

// ===========================================
// SKILLED CARE NECESSITY VALIDATION
// ===========================================

/**
 * Validate skilled care necessity for nursing, therapy services
 *
 * Per Medicare requirements, skilled care must be:
 * 1. Reasonable and necessary
 * 2. Require skills of a qualified professional
 * 3. Be at a level of complexity requiring professional assessment/planning
 */
export async function validateSkilledCareNecessity(
  episodeId: string,
  visitId?: string
): Promise<SkilledCareValidationResult> {
  const issues: ComplianceIssue[] = [];
  const services: SkilledCareRequirement[] = [];
  const recommendations: string[] = [];

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
  });

  if (!episode) {
    return {
      isValid: false,
      services: [],
      issues: [{
        id: uuidv4(),
        field: 'episodeId',
        code: 'EPISODE_NOT_FOUND',
        severity: 'error',
        category: 'skilled_care',
        message: 'Episode not found',
        suggestion: 'Verify episode ID',
        source: 'medicareCompliance.validateSkilledCareNecessity',
      }],
      recommendations: [],
    };
  }

  // Fetch latest assessment with responses
  const assessment = await prisma.oasisAssessment.findFirst({
    where: { episodeId },
    orderBy: { createdAt: 'desc' },
    include: { responses: true },
  });

  // Fetch visits
  const visits = visitId
    ? await prisma.visit.findMany({ where: { id: visitId } })
    : await prisma.visit.findMany({
        where: { episodeId },
        orderBy: { scheduledDate: 'desc' },
        take: 5,
      });

  const responses = assessment?.responses || [];
  const responseMap: Record<string, string | null> = {};
  for (const response of responses) {
    responseMap[response.itemCode] = response.responseCode || response.responseValue;
  }

  // Check for nursing skilled care indicators
  const nursingIndicators = checkNursingIndicators(responseMap);
  services.push(nursingIndicators.service);
  if (!nursingIndicators.service.required && visits.some((v) => v.visitType === 'SKILLED_NURSING')) {
    issues.push({
      id: uuidv4(),
      field: 'skilled_nursing',
      code: 'NURSING_NECESSITY_UNCLEAR',
      severity: 'warning',
      category: 'skilled_care',
      message: 'Skilled nursing necessity not clearly supported by OASIS findings',
      suggestion: 'Ensure OASIS assessment reflects nursing care needs (wound care, medication management, etc.)',
      denialRisk: 'SKILLED_CARE_NOT_JUSTIFIED',
      source: 'medicareCompliance.validateSkilledCareNecessity',
    });
    recommendations.push('Document specific skilled nursing interventions required');
  }

  // Check for therapy skilled care indicators
  const therapyIndicators = checkTherapyIndicators(responseMap);
  services.push(therapyIndicators.service);
  if (!therapyIndicators.service.required && visits.some((v) => ['PHYSICAL_THERAPY', 'OCCUPATIONAL_THERAPY', 'SPEECH_THERAPY'].includes(v.visitType))) {
    issues.push({
      id: uuidv4(),
      field: 'skilled_therapy',
      code: 'THERAPY_NECESSITY_UNCLEAR',
      severity: 'warning',
      category: 'skilled_care',
      message: 'Skilled therapy necessity not clearly supported by functional scores',
      suggestion: 'Ensure GG functional items reflect therapy rehabilitation potential',
      denialRisk: 'SKILLED_CARE_NOT_JUSTIFIED',
      source: 'medicareCompliance.validateSkilledCareNecessity',
    });
    recommendations.push('Document functional deficits requiring therapy intervention');
  }

  // Check for wound care indicators
  const woundIndicators = checkWoundCareIndicators(responseMap);
  if (woundIndicators.hasWounds) {
    services.push({
      serviceType: 'nursing',
      required: true,
      justification: 'Wound care management required',
      supportingDiagnoses: [],
      relevantFindings: woundIndicators.findings,
    });
  }

  // Overall validation
  const hasJustifiedServices = services.some((s) => s.required);
  if (!hasJustifiedServices && visits.length > 0) {
    issues.push({
      id: uuidv4(),
      field: 'skilled_care',
      code: 'SKILLED_CARE_NOT_JUSTIFIED',
      severity: 'error',
      category: 'skilled_care',
      message: 'Skilled care services ordered but medical necessity not documented',
      suggestion: 'Document specific skilled care needs that justify the ordered services',
      denialRisk: 'SKILLED_CARE_NOT_JUSTIFIED',
      context: COMMON_DENIAL_REASONS.SKILLED_CARE_NOT_JUSTIFIED.description,
      source: 'medicareCompliance.validateSkilledCareNecessity',
    });
  }

  return {
    isValid: !issues.some((i) => i.severity === 'error'),
    services,
    issues,
    recommendations,
  };
}

/**
 * Check nursing care indicators from OASIS responses
 */
function checkNursingIndicators(
  responseMap: Record<string, string | null>
): { service: SkilledCareRequirement; findings: string[] } {
  const findings: string[] = [];
  let required = false;

  // Check medication management (M2001)
  const medManagement = responseMap['M2001'];
  if (medManagement && ['01', '02'].includes(medManagement)) {
    findings.push('Medication management complexity requiring skilled oversight');
    required = true;
  }

  // Check drug regimen review (M2003)
  const drugReview = responseMap['M2003'];
  if (drugReview && drugReview === '1') {
    findings.push('Drug regimen review identified potential issues');
    required = true;
  }

  // Check high-risk drug education (M2010)
  const highRiskDrugs = responseMap['M2010'];
  if (highRiskDrugs && highRiskDrugs === '1') {
    findings.push('High-risk drug education needed');
    required = true;
  }

  // Check risk for hospitalization (M1033)
  const hospRisk = responseMap['M1033'];
  if (hospRisk && hospRisk === '01') {
    findings.push('Risk factors for hospitalization present');
    required = true;
  }

  return {
    service: {
      serviceType: 'nursing',
      required,
      justification: required
        ? 'Skilled nursing assessment and intervention required'
        : 'No clear nursing necessity documented',
      supportingDiagnoses: [],
      relevantFindings: findings,
    },
    findings,
  };
}

/**
 * Check therapy care indicators from OASIS responses
 */
function checkTherapyIndicators(
  responseMap: Record<string, string | null>
): { service: SkilledCareRequirement; findings: string[] } {
  const findings: string[] = [];
  let required = false;
  let dependentCount = 0;

  // Check GG functional items
  const ggItems = ['GG0130A', 'GG0130B', 'GG0130C', 'GG0130E', 'GG0170A', 'GG0170B', 'GG0170C', 'GG0170D', 'GG0170E', 'GG0170I', 'GG0170J'];

  for (const item of ggItems) {
    const value = responseMap[item];
    if (value && ['01', '02', '03', '04'].includes(value)) {
      dependentCount++;
    }
  }

  if (dependentCount >= 3) {
    findings.push(`${dependentCount} functional areas showing significant limitation`);
    required = true;
  }

  // Check ADL items
  const adlItems = ['M1800', 'M1810', 'M1820', 'M1830', 'M1840', 'M1850', 'M1860'];
  let adlIssues = 0;

  for (const item of adlItems) {
    const value = responseMap[item];
    if (value && ['01', '02', '03'].includes(value)) {
      adlIssues++;
    }
  }

  if (adlIssues >= 2) {
    findings.push(`ADL limitations in ${adlIssues} areas`);
    required = true;
  }

  return {
    service: {
      serviceType: 'pt',
      required,
      justification: required
        ? 'Functional limitations support therapy intervention'
        : 'Functional status does not clearly support therapy necessity',
      supportingDiagnoses: [],
      relevantFindings: findings,
    },
    findings,
  };
}

/**
 * Check wound care indicators from OASIS responses
 */
function checkWoundCareIndicators(
  responseMap: Record<string, string | null>
): { hasWounds: boolean; findings: string[] } {
  const findings: string[] = [];
  let hasWounds = false;

  // Check pressure ulcer items
  const pressureUlcerItems = ['M1306', 'M1307', 'M1308', 'M1309'];
  for (const item of pressureUlcerItems) {
    const value = responseMap[item];
    if (value && value !== '0' && value !== '00') {
      hasWounds = true;
      findings.push(`Pressure ulcer documented (${item})`);
    }
  }

  // Check stasis ulcer (M1320)
  if (responseMap['M1320'] && responseMap['M1320'] !== '0') {
    hasWounds = true;
    findings.push('Stasis ulcer present');
  }

  // Check surgical wound (M1340)
  if (responseMap['M1340'] && responseMap['M1340'] !== '0') {
    hasWounds = true;
    findings.push('Surgical wound requiring care');
  }

  return { hasWounds, findings };
}

// ===========================================
// FACE-TO-FACE ENCOUNTER VALIDATION
// ===========================================

/**
 * Validate face-to-face encounter requirements
 *
 * Per CMS requirements:
 * - F2F must occur within 90 days before or 30 days after SOC
 * - Must document clinical findings, homebound status, skilled care need
 * - Must be signed by certifying physician
 *
 * Note: This function expects faceToFaceDate and certifyingPhysicianNpi
 * to be added to the Episode model. If not present, it will flag as missing.
 */
export async function validateFaceToFaceRequirements(
  episodeId: string
): Promise<FaceToFaceRequirement> {
  const issues: ComplianceIssue[] = [];

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      patient: true,
    },
  });

  if (!episode) {
    return {
      required: true,
      timingValid: false,
      contentRequirements: {
        clinicalFindings: false,
        homeboundStatus: false,
        skilledCareNeed: false,
        physicianSignature: false,
      },
      issues: [{
        id: uuidv4(),
        field: 'episodeId',
        code: 'EPISODE_NOT_FOUND',
        severity: 'error',
        category: 'face_to_face',
        message: 'Episode not found',
        suggestion: 'Verify episode ID',
        source: 'medicareCompliance.validateFaceToFaceRequirements',
      }],
    };
  }

  const socDate = episode.startDate;

  // Access F2F fields - these may need to be added to the Episode schema
  // Using type assertion to handle potential schema mismatch
  const episodeData = episode as unknown as {
    faceToFaceDate?: Date | null;
    certifyingPhysicianNpi?: string | null;
    [key: string]: unknown;
  };

  const f2fDate = episodeData.faceToFaceDate;
  const certifyingPhysicianNpi = episodeData.certifyingPhysicianNpi;

  // Check if F2F is documented
  if (!f2fDate) {
    issues.push({
      id: uuidv4(),
      field: 'face_to_face',
      code: 'F2F_NOT_DOCUMENTED',
      severity: 'error',
      category: 'face_to_face',
      message: 'Face-to-face encounter date not documented',
      suggestion: 'Document the face-to-face encounter date from the certifying physician',
      denialRisk: 'FACE_TO_FACE_MISSING',
      context: COMMON_DENIAL_REASONS.FACE_TO_FACE_MISSING.description,
      source: 'medicareCompliance.validateFaceToFaceRequirements',
    });

    return {
      required: true,
      timingValid: false,
      contentRequirements: {
        clinicalFindings: false,
        homeboundStatus: false,
        skilledCareNeed: false,
        physicianSignature: false,
      },
      issues,
    };
  }

  // Validate F2F timing
  const daysBefore = Math.floor((socDate.getTime() - f2fDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysAfter = Math.floor((f2fDate.getTime() - socDate.getTime()) / (1000 * 60 * 60 * 24));

  let timingValid = false;
  if (daysBefore >= 0 && daysBefore <= F2F_DAYS_BEFORE_SOC) {
    timingValid = true;
  } else if (daysAfter >= 0 && daysAfter <= F2F_DAYS_AFTER_SOC) {
    timingValid = true;
  }

  if (!timingValid) {
    issues.push({
      id: uuidv4(),
      field: 'face_to_face_date',
      code: 'F2F_TIMING_INVALID',
      severity: 'error',
      category: 'face_to_face',
      message: `Face-to-face encounter outside valid window (90 days before or 30 days after SOC)`,
      suggestion: 'Obtain a new face-to-face encounter within the valid timeframe',
      denialRisk: 'FACE_TO_FACE_TIMING',
      context: `F2F date: ${f2fDate.toISOString().split('T')[0]}, SOC date: ${socDate.toISOString().split('T')[0]}`,
      source: 'medicareCompliance.validateFaceToFaceRequirements',
    });
  }

  // Check for certifying physician
  if (!certifyingPhysicianNpi) {
    issues.push({
      id: uuidv4(),
      field: 'certifying_physician',
      code: 'CERTIFYING_PHYSICIAN_MISSING',
      severity: 'warning',
      category: 'face_to_face',
      message: 'Certifying physician NPI not documented',
      suggestion: 'Document the NPI of the physician who performed the face-to-face encounter',
      source: 'medicareCompliance.validateFaceToFaceRequirements',
    });
  }

  return {
    required: true,
    encounterDate: f2fDate.toISOString(),
    physicianNpi: certifyingPhysicianNpi ?? undefined,
    timingValid,
    contentRequirements: {
      clinicalFindings: true, // Would need document analysis to verify
      homeboundStatus: true,
      skilledCareNeed: true,
      physicianSignature: !!certifyingPhysicianNpi,
    },
    issues,
  };
}

// ===========================================
// CERTIFICATION PERIOD VALIDATION
// ===========================================

/**
 * Validate certification period dates and recertification requirements
 */
export async function validateCertificationPeriod(
  episodeId: string
): Promise<CertificationPeriodValidation> {
  const issues: ComplianceIssue[] = [];

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
  });

  if (!episode) {
    return {
      currentPeriod: {
        startDate: '',
        endDate: '',
        daysRemaining: 0,
      },
      recertificationNeeded: true,
      datesValid: false,
      issues: [{
        id: uuidv4(),
        field: 'episodeId',
        code: 'EPISODE_NOT_FOUND',
        severity: 'error',
        category: 'certification_period',
        message: 'Episode not found',
        suggestion: 'Verify episode ID',
        source: 'medicareCompliance.validateCertificationPeriod',
      }],
    };
  }

  // Use certPeriodStart/certPeriodEnd from schema, fallback to episode dates
  const certStartDate = episode.certPeriodStart || episode.startDate;
  const certEndDate = episode.certPeriodEnd || new Date(certStartDate.getTime() + CERTIFICATION_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  const now = new Date();
  const daysRemaining = Math.floor((certEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Check if certification is expired
  if (daysRemaining < 0) {
    issues.push({
      id: uuidv4(),
      field: 'certification_period',
      code: 'CERTIFICATION_EXPIRED',
      severity: 'error',
      category: 'certification_period',
      message: `Certification period expired ${Math.abs(daysRemaining)} days ago`,
      suggestion: 'Complete recertification immediately to continue billing',
      denialRisk: 'CERTIFICATION_EXPIRED',
      context: `Certification ended: ${certEndDate.toISOString().split('T')[0]}`,
      source: 'medicareCompliance.validateCertificationPeriod',
    });
  } else if (daysRemaining <= RECERT_WARNING_DAYS) {
    issues.push({
      id: uuidv4(),
      field: 'certification_period',
      code: 'RECERTIFICATION_DUE_SOON',
      severity: 'warning',
      category: 'certification_period',
      message: `Recertification due in ${daysRemaining} days`,
      suggestion: 'Begin recertification process to ensure continuity of care',
      context: `Certification ends: ${certEndDate.toISOString().split('T')[0]}`,
      source: 'medicareCompliance.validateCertificationPeriod',
    });
  }

  // Validate date logic
  const datesValid = certStartDate < certEndDate && certStartDate <= now;

  if (!datesValid) {
    issues.push({
      id: uuidv4(),
      field: 'certification_dates',
      code: 'INVALID_CERTIFICATION_DATES',
      severity: 'error',
      category: 'certification_period',
      message: 'Certification period dates are invalid',
      suggestion: 'Verify certification start and end dates',
      source: 'medicareCompliance.validateCertificationPeriod',
    });
  }

  const startDateStr = certStartDate.toISOString().split('T')[0] || certStartDate.toISOString();
  const endDateStr = certEndDate.toISOString().split('T')[0] || certEndDate.toISOString();

  return {
    currentPeriod: {
      startDate: startDateStr,
      endDate: endDateStr,
      daysRemaining: Math.max(0, daysRemaining),
    },
    recertificationNeeded: daysRemaining <= RECERT_WARNING_DAYS,
    recertificationDeadline: daysRemaining <= RECERT_WARNING_DAYS
      ? endDateStr
      : undefined,
    datesValid,
    issues,
  };
}

// ===========================================
// OASIS COMPLETENESS CHECK
// ===========================================

/**
 * Check OASIS assessment completeness for Medicare compliance
 */
export async function checkOasisCompleteness(
  assessmentId: string
): Promise<ComplianceIssue[]> {
  const issues: ComplianceIssue[] = [];

  const assessment = await prisma.oasisAssessment.findUnique({
    where: { id: assessmentId },
    include: {
      responses: true,
    },
  });

  if (!assessment) {
    return [{
      id: uuidv4(),
      field: 'assessmentId',
      code: 'ASSESSMENT_NOT_FOUND',
      severity: 'error',
      category: 'oasis_completeness',
      message: 'OASIS assessment not found',
      suggestion: 'Verify assessment ID',
      source: 'medicareCompliance.checkOasisCompleteness',
    }];
  }

  // Define required items by assessment type
  const requiredItemsByType: Record<string, string[]> = {
    START_OF_CARE: [
      'M0010', 'M0014', 'M0016', 'M0018', 'M0020', 'M0030', 'M0040', 'M0050',
      'M0060', 'M0063', 'M0064', 'M0065', 'M0066', 'M0069', 'M0080', 'M0090', 'M0100',
      'M1021', 'M1023', 'M1033', 'M1800', 'M1810', 'M1820', 'M1830', 'M1840', 'M1850', 'M1860',
      'GG0130A', 'GG0130B', 'GG0130C', 'GG0170A', 'GG0170B', 'GG0170C', 'GG0170I', 'GG0170J',
    ],
    RESUMPTION_OF_CARE: [
      'M0010', 'M0014', 'M0016', 'M0018', 'M0020', 'M0032', 'M0040', 'M0050',
      'M0060', 'M0063', 'M0064', 'M0065', 'M0066', 'M0069', 'M0080', 'M0090', 'M0100',
      'M1021', 'M1023', 'M1800', 'M1810', 'M1820', 'M1830', 'M1840', 'M1850', 'M1860',
      'GG0130A', 'GG0130B', 'GG0130C', 'GG0170A', 'GG0170B', 'GG0170C', 'GG0170I', 'GG0170J',
    ],
    RECERTIFICATION: [
      'M0010', 'M0014', 'M0016', 'M0018', 'M0020', 'M0040', 'M0050',
      'M0060', 'M0063', 'M0064', 'M0065', 'M0066', 'M0069', 'M0080', 'M0090', 'M0100',
      'M1021', 'M1023', 'M1800', 'M1810', 'M1820', 'M1830', 'M1840', 'M1850', 'M1860',
    ],
    DISCHARGE_FROM_AGENCY: [
      'M0010', 'M0014', 'M0016', 'M0018', 'M0020', 'M0040', 'M0050',
      'M0060', 'M0063', 'M0064', 'M0065', 'M0066', 'M0069', 'M0080', 'M0090', 'M0100',
      'M1800', 'M1810', 'M1820', 'M1830', 'M1840', 'M1850', 'M1860',
      'GG0130A', 'GG0130B', 'GG0130C', 'GG0170A', 'GG0170B', 'GG0170C', 'GG0170I', 'GG0170J',
    ],
  };

  const assessmentTypeKey = String(assessment.assessmentType);
  const requiredItems = requiredItemsByType[assessmentTypeKey] ?? requiredItemsByType['START_OF_CARE'] ?? [];
  const completedItems = new Set(assessment.responses.map((r) => r.itemCode));

  const missingItems: string[] = [];
  for (const item of requiredItems) {
    if (!completedItems.has(item)) {
      missingItems.push(item);
    }
  }

  if (missingItems.length > 0) {
    // Group missing items by section
    const mItemsMissing = missingItems.filter((i) => i.startsWith('M'));
    const ggItemsMissing = missingItems.filter((i) => i.startsWith('GG'));

    if (mItemsMissing.length > 0) {
      issues.push({
        id: uuidv4(),
        field: 'oasis_items',
        code: 'OASIS_M_ITEMS_INCOMPLETE',
        severity: mItemsMissing.length > 5 ? 'error' : 'warning',
        category: 'oasis_completeness',
        message: `${mItemsMissing.length} required M-items not completed`,
        suggestion: `Complete the following items: ${mItemsMissing.slice(0, 5).join(', ')}${mItemsMissing.length > 5 ? '...' : ''}`,
        denialRisk: 'OASIS_INCOMPLETE',
        context: `Missing items: ${mItemsMissing.join(', ')}`,
        source: 'medicareCompliance.checkOasisCompleteness',
      });
    }

    if (ggItemsMissing.length > 0) {
      issues.push({
        id: uuidv4(),
        field: 'oasis_functional',
        code: 'OASIS_GG_ITEMS_INCOMPLETE',
        severity: 'error',
        category: 'oasis_completeness',
        message: `${ggItemsMissing.length} required GG functional items not completed`,
        suggestion: 'Complete GG functional items - these directly impact reimbursement',
        denialRisk: 'OASIS_INCOMPLETE',
        context: `Missing items: ${ggItemsMissing.join(', ')}`,
        source: 'medicareCompliance.checkOasisCompleteness',
      });
    }
  }

  // Add info about completion percentage
  const completionPercentage = Math.round(
    ((requiredItems.length - missingItems.length) / requiredItems.length) * 100
  );

  if (completionPercentage < 100) {
    issues.push({
      id: uuidv4(),
      field: 'oasis_completion',
      code: 'OASIS_COMPLETION_STATUS',
      severity: 'info',
      category: 'oasis_completeness',
      message: `OASIS assessment is ${completionPercentage}% complete`,
      suggestion: `${missingItems.length} items remaining to complete`,
      source: 'medicareCompliance.checkOasisCompleteness',
    });
  }

  return issues;
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Calculate overall compliance score based on issues
 */
function calculateComplianceScore(issues: ComplianceIssue[]): number {
  const errorWeight = 20;
  const warningWeight = 5;
  const infoWeight = 1;

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const infos = issues.filter((i) => i.severity === 'info').length;

  const deductions = errors * errorWeight + warnings * warningWeight + infos * infoWeight;
  return Math.max(0, Math.min(100, 100 - deductions));
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  validateVisitCompliance,
  validateHomeboundStatus,
  validateSkilledCareNecessity,
  validateFaceToFaceRequirements,
  validateCertificationPeriod,
  checkOasisCompleteness,
};
