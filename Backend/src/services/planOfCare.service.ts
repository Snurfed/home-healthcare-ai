/**
 * Plan of Care Service
 *
 * Business logic for CMS-485 Plan of Care operations including:
 * - CRUD operations
 * - Auto-population from OASIS assessments
 * - Physician signature management
 */

import type { Discipline } from '../constants/visitForm.constants';

import { TxClient } from '../config/tenancy';
// ===========================================
// TYPE DEFINITIONS
// ===========================================

export interface Diagnosis {
  code: string;
  description: string;
  isPrimary: boolean;
  onsetDate?: string;
  sequence?: number;
}

export interface ServiceFrequency {
  discipline: Discipline;
  frequency: string;
  duration?: string;
  startDate?: string;
  endDate?: string;
}

export interface CareGoal {
  id: string;
  discipline: Discipline;
  goalType: 'short_term' | 'long_term';
  description: string;
  targetDate: string;
  status: 'active' | 'met' | 'revised' | 'discontinued';
  measurableOutcome?: string;
}

export interface PlanOfCareData {
  id: string;
  episodeId: string;
  patientId: string;
  status: 'draft' | 'pending_signature' | 'active' | 'expired' | 'amended';
  certificationPeriod: {
    startDate: string;
    endDate: string;
  };
  diagnoses: Diagnosis[];
  functionalLimitations: string[];
  safetyMeasures: string[];
  dmeNeeds: string[];
  serviceFrequencies: ServiceFrequency[];
  goals: CareGoal[];
  allowedActivities?: string;
  nutritionalRequirements?: string;
  mentalStatus?: string;
  prognosis?: 'excellent' | 'good' | 'fair' | 'guarded' | 'poor';
  dischargeGoals?: string;
  physicianName: string;
  physicianNpi?: string;
  physicianSignedAt?: string;
  physicianSignedBy?: string;
  nurseSignedAt?: string;
  nurseSignedBy?: string;
  createdAt: string;
  updatedAt: string;
  effectiveDate: string;
  expirationDate?: string;
}

export interface CreatePlanOfCareInput {
  episodeId: string;
  patientId: string;
  certificationPeriod: {
    startDate: string;
    endDate: string;
  };
  physicianName: string;
  physicianNpi?: string;
}

export interface UpdatePlanOfCareInput {
  diagnoses?: Diagnosis[];
  functionalLimitations?: string[];
  safetyMeasures?: string[];
  dmeNeeds?: string[];
  serviceFrequencies?: ServiceFrequency[];
  goals?: CareGoal[];
  allowedActivities?: string;
  nutritionalRequirements?: string;
  mentalStatus?: string;
  prognosis?: 'excellent' | 'good' | 'fair' | 'guarded' | 'poor';
  dischargeGoals?: string;
}

export interface AutoPopulateResult {
  success: boolean;
  populated: {
    field: string;
    value: unknown;
    source: string;
    oasisItemCode: string;
  }[];
  warnings?: string[];
}

// ===========================================
// OASIS ITEM CODE MAPPINGS
// ===========================================

// OASIS item code mappings for auto-population
// These are used when mapping OASIS assessment data to Plan of Care fields
/* eslint-disable @typescript-eslint/no-unused-vars */
const OASIS_ITEM_MAPPINGS = {
  primaryDiagnosis: 'M1021',
  secondaryDiagnoses: 'M1023',
  functionalLimitations: ['GG0130', 'GG0170'],
  cognitiveStatus: ['M1700', 'C0500'],
  fallRisk: 'J1800',
  medications: 'N0415',
} as const;
/* eslint-enable @typescript-eslint/no-unused-vars */

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function generateId(): string {
  return `poc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ===========================================
// MAIN SERVICE FUNCTIONS
// ===========================================

/**
 * Get Plan of Care by episode ID
 */
export async function getPlanOfCare(tx: TxClient, episodeId: string): Promise<PlanOfCareData | null> {
  const carePlan = await tx.carePlan.findFirst({
    where: {
      episodeId,
      deletedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!carePlan) {
    return null;
  }

  // Map database model to API type
  return {
    id: carePlan.id,
    episodeId: carePlan.episodeId,
    patientId: carePlan.patientId,
    status: mapCarePlanStatus(carePlan.status),
    certificationPeriod: {
      startDate: carePlan.startDate.toISOString(),
      endDate: carePlan.endDate?.toISOString() || '',
    },
    diagnoses: buildDiagnoses(carePlan),
    functionalLimitations: [],
    safetyMeasures: [],
    dmeNeeds: [],
    serviceFrequencies: buildServiceFrequencies(carePlan),
    goals: (carePlan['goals'] as unknown as CareGoal[]) || [],
    allowedActivities: undefined,
    nutritionalRequirements: undefined,
    mentalStatus: undefined,
    prognosis: undefined,
    dischargeGoals: undefined,
    physicianName: carePlan.physicianSignedBy || '',
    physicianNpi: undefined,
    physicianSignedAt: carePlan.physicianSignedAt?.toISOString(),
    physicianSignedBy: carePlan.physicianSignedBy || undefined,
    nurseSignedAt: undefined,
    nurseSignedBy: undefined,
    createdAt: carePlan.createdAt.toISOString(),
    updatedAt: carePlan.updatedAt.toISOString(),
    effectiveDate: carePlan.startDate.toISOString(),
    expirationDate: carePlan.endDate?.toISOString(),
  };
}

function mapCarePlanStatus(status: string): PlanOfCareData['status'] {
  switch (status) {
    case 'DRAFT':
      return 'draft';
    case 'PENDING_APPROVAL':
      return 'pending_signature';
    case 'ACTIVE':
      return 'active';
    case 'COMPLETED':
    case 'CANCELLED':
      return 'expired';
    default:
      return 'draft';
  }
}

function buildDiagnoses(carePlan: {
  primaryDiagnosisCode: string;
  primaryDiagnosisDesc: string;
  secondaryDiagnoses: unknown;
}): Diagnosis[] {
  const diagnoses: Diagnosis[] = [];

  if (carePlan.primaryDiagnosisCode) {
    diagnoses.push({
      code: carePlan.primaryDiagnosisCode,
      description: carePlan.primaryDiagnosisDesc || '',
      isPrimary: true,
      sequence: 1,
    });
  }

  if (carePlan.secondaryDiagnoses && Array.isArray(carePlan.secondaryDiagnoses)) {
    const secondary = carePlan.secondaryDiagnoses as Array<{ code: string; description: string }>;
    secondary.forEach((dx, index) => {
      diagnoses.push({
        code: dx.code,
        description: dx.description || '',
        isPrimary: false,
        sequence: index + 2,
      });
    });
  }

  return diagnoses;
}

function buildServiceFrequencies(carePlan: {
  snFrequency: string | null;
  ptFrequency: string | null;
  otFrequency: string | null;
  stFrequency: string | null;
  hhaFrequency: string | null;
  mswFrequency: string | null;
}): ServiceFrequency[] {
  const frequencies: ServiceFrequency[] = [];

  if (carePlan.snFrequency) {
    frequencies.push({ discipline: 'RN', frequency: carePlan.snFrequency });
  }
  if (carePlan.ptFrequency) {
    frequencies.push({ discipline: 'PT', frequency: carePlan.ptFrequency });
  }
  if (carePlan.otFrequency) {
    frequencies.push({ discipline: 'OT', frequency: carePlan.otFrequency });
  }
  if (carePlan.stFrequency) {
    frequencies.push({ discipline: 'SLP', frequency: carePlan.stFrequency });
  }
  if (carePlan.hhaFrequency) {
    frequencies.push({ discipline: 'HHA', frequency: carePlan.hhaFrequency });
  }
  if (carePlan.mswFrequency) {
    frequencies.push({ discipline: 'MSW', frequency: carePlan.mswFrequency });
  }

  return frequencies;
}

/**
 * Create a new Plan of Care
 */
export async function createPlanOfCare(tx: TxClient, input: CreatePlanOfCareInput): Promise<PlanOfCareData> {
  const id = generateId();
  const now = new Date();

  const carePlan = await tx.carePlan.create({
    data: {
      id,
      patientId: input.patientId,
      episodeId: input.episodeId,
      status: 'DRAFT',
      startDate: new Date(input.certificationPeriod.startDate),
      endDate: new Date(input.certificationPeriod.endDate),
      primaryDiagnosisCode: '',
      primaryDiagnosisDesc: '',
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    id: carePlan.id,
    episodeId: carePlan.episodeId,
    patientId: carePlan.patientId,
    status: 'draft',
    certificationPeriod: input.certificationPeriod,
    diagnoses: [],
    functionalLimitations: [],
    safetyMeasures: [],
    dmeNeeds: [],
    serviceFrequencies: [],
    goals: [],
    physicianName: input.physicianName,
    physicianNpi: input.physicianNpi,
    createdAt: carePlan.createdAt.toISOString(),
    updatedAt: carePlan.updatedAt.toISOString(),
    effectiveDate: input.certificationPeriod.startDate,
  };
}

/**
 * Update an existing Plan of Care
 */
export async function updatePlanOfCare(
  tx: TxClient,
  pocId: string,
  input: UpdatePlanOfCareInput
): Promise<PlanOfCareData> {
  const existing = await tx.carePlan.findUnique({ where: { id: pocId } });
  if (!existing) {
    throw new Error(`Plan of Care ${pocId} not found`);
  }

  // Build update data
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.diagnoses) {
    const primary = input.diagnoses.find((d) => d.isPrimary);
    if (primary) {
      updateData['primaryDiagnosisCode'] = primary.code;
      updateData['primaryDiagnosisDesc'] = primary.description;
    }
    updateData['secondaryDiagnoses'] = input.diagnoses
      .filter((d) => !d.isPrimary)
      .map((d) => ({ code: d.code, description: d.description }));
  }

  if (input.serviceFrequencies) {
    for (const sf of input.serviceFrequencies) {
      switch (sf.discipline) {
        case 'RN':
        case 'LVN':
          updateData['snFrequency'] = sf.frequency;
          break;
        case 'PT':
          updateData['ptFrequency'] = sf.frequency;
          break;
        case 'OT':
          updateData['otFrequency'] = sf.frequency;
          break;
        case 'SLP':
          updateData['stFrequency'] = sf.frequency;
          break;
        case 'HHA':
          updateData['hhaFrequency'] = sf.frequency;
          break;
        case 'MSW':
          updateData['mswFrequency'] = sf.frequency;
          break;
      }
    }
  }

  if (input.goals) {
    updateData['goals'] = input.goals;
  }

  const updated = await tx.carePlan.update({
    where: { id: pocId },
    data: updateData,
  });

  return getPlanOfCare(tx, updated.episodeId) as Promise<PlanOfCareData>;
}

/**
 * Auto-populate Plan of Care from OASIS assessment
 */
export async function autoPopulateFromOasis(
  tx: TxClient,
  pocId: string,
  oasisAssessmentId: string,
  fieldsToPopulate?: string[]
): Promise<AutoPopulateResult> {
  const populated: AutoPopulateResult['populated'] = [];
  const warnings: string[] = [];

  // Get OASIS responses
  const responses = await tx.oasisResponse.findMany({
    where: { assessmentId: oasisAssessmentId },
  });

  const responseMap = new Map(responses.map((r) => [r.itemCode, r]));

  // Populate primary diagnosis (M1021)
  const m1021 = responseMap.get('M1021');
  if (m1021 && (!fieldsToPopulate || fieldsToPopulate.includes('diagnoses'))) {
    const code = m1021.responseCode || m1021.responseValue;
    const description = m1021.responseText || '';

    if (code) {
      const diagnoses: Diagnosis[] = [
        {
          code: code as string,
          description,
          isPrimary: true,
          sequence: 1,
        },
      ];

      // Get secondary diagnoses (M1023)
      const m1023 = responseMap.get('M1023');
      if (m1023?.responseText) {
        try {
          const secondary = JSON.parse(m1023.responseText) as Array<{ code: string; description: string }>;
          secondary.forEach((dx, index) => {
            diagnoses.push({
              code: dx.code,
              description: dx.description || '',
              isPrimary: false,
              sequence: index + 2,
            });
          });
        } catch {
          // Try CSV format
          const codes = m1023.responseText.split(',').map((s) => s.trim());
          codes.forEach((code, index) => {
            if (code) {
              diagnoses.push({
                code,
                description: '',
                isPrimary: false,
                sequence: index + 2,
              });
            }
          });
        }
      }

      populated.push({
        field: 'diagnoses',
        value: diagnoses,
        source: 'OASIS',
        oasisItemCode: 'M1021/M1023',
      });
    }
  }

  // Populate functional limitations (GG0130, GG0170)
  if (!fieldsToPopulate || fieldsToPopulate.includes('functionalLimitations')) {
    const limitations: string[] = [];

    const gg0130 = responseMap.get('GG0130');
    if (gg0130?.responseText) {
      limitations.push(`Self-Care: ${gg0130.responseText}`);
    }

    const gg0170 = responseMap.get('GG0170');
    if (gg0170?.responseText) {
      limitations.push(`Mobility: ${gg0170.responseText}`);
    }

    if (limitations.length > 0) {
      populated.push({
        field: 'functionalLimitations',
        value: limitations,
        source: 'OASIS',
        oasisItemCode: 'GG0130/GG0170',
      });
    }
  }

  // Populate mental status (M1700, C0500)
  if (!fieldsToPopulate || fieldsToPopulate.includes('mentalStatus')) {
    let mentalStatus = '';

    const m1700 = responseMap.get('M1700');
    if (m1700?.responseText) {
      mentalStatus += `Cognitive Function: ${m1700.responseText}. `;
    }

    const c0500 = responseMap.get('C0500');
    if (c0500?.responseNumeric !== null) {
      mentalStatus += `BIMS Score: ${c0500.responseNumeric}. `;
    }

    if (mentalStatus) {
      populated.push({
        field: 'mentalStatus',
        value: mentalStatus.trim(),
        source: 'OASIS',
        oasisItemCode: 'M1700/C0500',
      });
    }
  }

  // Populate safety measures (J1800 - Fall Risk)
  if (!fieldsToPopulate || fieldsToPopulate.includes('safetyMeasures')) {
    const j1800 = responseMap.get('J1800');
    if (j1800?.responseCode === '1' || j1800?.responseText?.toLowerCase().includes('yes')) {
      populated.push({
        field: 'safetyMeasures',
        value: ['Fall precautions', 'Assistive device for ambulation'],
        source: 'OASIS',
        oasisItemCode: 'J1800',
      });
    }
  }

  return {
    success: populated.length > 0,
    populated,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Sign Plan of Care
 */
export async function signPlanOfCare(
  tx: TxClient,
  pocId: string,
  signatureType: 'physician' | 'nurse',
  signedBy: string,
  signedAt: string
): Promise<PlanOfCareData> {
  const existing = await tx.carePlan.findUnique({ where: { id: pocId } });
  if (!existing) {
    throw new Error(`Plan of Care ${pocId} not found`);
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (signatureType === 'physician') {
    updateData.physicianSignedAt = new Date(signedAt);
    updateData.physicianSignedBy = signedBy;
    // Activate if physician signs
    updateData.status = 'ACTIVE';
  }
  // Nurse signature would be stored in a separate field if needed

  const updated = await tx.carePlan.update({
    where: { id: pocId },
    data: updateData,
  });

  return getPlanOfCare(tx, updated.episodeId) as Promise<PlanOfCareData>;
}

export default {
  getPlanOfCare,
  createPlanOfCare,
  updatePlanOfCare,
  autoPopulateFromOasis,
  signPlanOfCare,
};
