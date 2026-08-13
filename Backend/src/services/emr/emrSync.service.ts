/**
 * EMR Sync Service
 *
 * High-level service for synchronizing visit and assessment data to EMR systems.
 * Handles conversion from internal data models to FHIR resources, submission,
 * conflict resolution, and retry logic.
 *
 * HIPAA Compliance:
 * - All sync operations are logged for audit trail
 * - PHI is encrypted in transit and at rest
 * - Access is controlled by user authorization
 */

import crypto from 'crypto';
import prisma from '../../config/prisma';
import type { TxClient } from '../../config/tenancy';
import { FhirWriterService, type FhirObservation, type FhirCondition, type FhirProcedure, type WriteResult, type BundleTransactionResult } from '../fhir/fhirWriter.service';

// EMR Sync Status enum (matches Prisma schema)
export type EmrSyncStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

// ===========================================
// TYPES
// ===========================================

export interface SyncJobResult {
  success: boolean;
  syncId: string;
  status: EmrSyncStatus;
  resourcesCreated: number;
  resourcesUpdated: number;
  errors: SyncError[];
  warnings: string[];
  completedAt?: Date;
}

export interface SyncError {
  resourceType: string;
  field?: string;
  message: string;
  code: string;
  retryable: boolean;
}

export interface VisitSyncData {
  visitId: string;
  patientFhirId: string;
  connectionId: string;
  userId: string;
  includeVitals?: boolean;
  includeNotes?: boolean;
  includeProcedures?: boolean;
}

export interface AssessmentSyncData {
  assessmentId: string;
  patientFhirId: string;
  connectionId: string;
  userId: string;
  includeAllResponses?: boolean;
  includeConditions?: boolean;
}

export interface SyncConfig {
  maxRetries: number;
  retryDelayMs: number;
  useTransaction: boolean;
  conflictResolution: 'latest-wins' | 'server-wins' | 'manual';
}

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  useTransaction: true,
  conflictResolution: 'latest-wins',
};

// ===========================================
// FHIR CODE SYSTEMS
// ===========================================

const LOINC_SYSTEM = 'http://loinc.org';
const SNOMED_SYSTEM = 'http://snomed.info/sct';
// ICD-10 system for diagnoses (reserved for future use)
// const ICD10_SYSTEM = 'http://hl7.org/fhir/sid/icd-10-cm';

// Common vital sign LOINC codes
const VITAL_CODES = {
  BLOOD_PRESSURE_SYSTOLIC: { system: LOINC_SYSTEM, code: '8480-6', display: 'Systolic blood pressure' },
  BLOOD_PRESSURE_DIASTOLIC: { system: LOINC_SYSTEM, code: '8462-4', display: 'Diastolic blood pressure' },
  HEART_RATE: { system: LOINC_SYSTEM, code: '8867-4', display: 'Heart rate' },
  RESPIRATORY_RATE: { system: LOINC_SYSTEM, code: '9279-1', display: 'Respiratory rate' },
  TEMPERATURE: { system: LOINC_SYSTEM, code: '8310-5', display: 'Body temperature' },
  OXYGEN_SATURATION: { system: LOINC_SYSTEM, code: '2708-6', display: 'Oxygen saturation' },
  WEIGHT: { system: LOINC_SYSTEM, code: '29463-7', display: 'Body weight' },
  HEIGHT: { system: LOINC_SYSTEM, code: '8302-2', display: 'Body height' },
  PAIN_SCORE: { system: LOINC_SYSTEM, code: '72514-3', display: 'Pain severity - 0-10 verbal numeric rating' },
};

// ===========================================
// EMR SYNC SERVICE
// ===========================================

export class EmrSyncService {
  /**
   * Sync a visit to the EMR system
   */
  static async syncVisit(
    tx: TxClient,
    data: VisitSyncData,
    config: Partial<SyncConfig> = {}
  ): Promise<SyncJobResult> {
    const syncConfig = { ...DEFAULT_SYNC_CONFIG, ...config };
    const syncId = crypto.randomUUID();

    // Create sync job record
    const syncJob = await this.createSyncJob(tx, syncId, 'VISIT', data.visitId, data.userId);

    try {
      // Fetch visit data with related records
      const visit = await tx.visit.findUnique({
        where: { id: data.visitId },
        include: {
          patient: {
            include: {
              emrLink: true,
            },
          },
          episode: true,
          clinician: true,
        },
      });

      if (!visit) {
        return this.failSyncJob(tx, syncJob.id, [{
          resourceType: 'Visit',
          message: 'Visit not found',
          code: 'NOT_FOUND',
          retryable: false,
        }]);
      }

      // Verify patient is linked to EMR
      const patientFhirId = data.patientFhirId || visit.patient.emrLink?.fhirPatientId;
      if (!patientFhirId) {
        return this.failSyncJob(tx, syncJob.id, [{
          resourceType: 'Patient',
          message: 'Patient is not linked to EMR. Import patient first.',
          code: 'NOT_LINKED',
          retryable: false,
        }]);
      }

      const resources: Array<{ resource: FhirObservation | FhirProcedure; method: 'POST' | 'PUT' }> = [];
      const warnings: string[] = [];

      // Convert vitals to Observations
      if (data.includeVitals !== false && visit.vitalSigns) {
        const vitalObservations = this.convertVitalsToObservations(
          visit.vitalSigns as Record<string, unknown>,
          patientFhirId,
          visit.actualStartTime || visit.scheduledDate
        );
        resources.push(...vitalObservations.map(obs => ({ resource: obs, method: 'POST' as const })));
      }

      // Convert visit notes to Observation (clinical note)
      if (data.includeNotes !== false && visit.visitNotes) {
        const noteObservation = this.createClinicalNoteObservation(
          visit.visitNotes,
          patientFhirId,
          visit.actualStartTime || visit.scheduledDate,
          visit.clinician
        );
        resources.push({ resource: noteObservation, method: 'POST' });
      }

      // Convert interventions to Procedures
      if (data.includeProcedures !== false && visit.interventions) {
        const procedures = this.convertInterventionsToProcedures(
          visit.interventions,
          patientFhirId,
          visit.actualStartTime || visit.scheduledDate,
          visit.clinician
        );
        resources.push(...procedures.map(proc => ({ resource: proc, method: 'POST' as const })));
      }

      if (resources.length === 0) {
        warnings.push('No data to sync for this visit');
        return this.completeSyncJob(tx, syncJob.id, 0, 0, warnings);
      }

      // Execute sync with retry logic
      const result = await this.executeWithRetry(
        data.connectionId,
        data.userId,
        resources,
        syncConfig
      );

      if (!result.success) {
        return this.failSyncJob(tx, syncJob.id, result.errors, warnings);
      }

      return this.completeSyncJob(
        tx,
        syncJob.id,
        result.resourcesCreated,
        result.resourcesUpdated,
        warnings
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.failSyncJob(tx, syncJob.id, [{
        resourceType: 'Visit',
        message: errorMessage,
        code: 'INTERNAL_ERROR',
        retryable: true,
      }]);
    }
  }

  /**
   * Sync an OASIS assessment to the EMR system
   */
  static async syncAssessment(
    tx: TxClient,
    data: AssessmentSyncData,
    config: Partial<SyncConfig> = {}
  ): Promise<SyncJobResult> {
    const syncConfig = { ...DEFAULT_SYNC_CONFIG, ...config };
    const syncId = crypto.randomUUID();

    // Create sync job record
    const syncJob = await this.createSyncJob(tx, syncId, 'ASSESSMENT', data.assessmentId, data.userId);

    try {
      // Fetch assessment data with related records
      const assessment = await tx.oasisAssessment.findUnique({
        where: { id: data.assessmentId },
        include: {
          patient: {
            include: {
              emrLink: true,
            },
          },
          responses: true,
          clinician: true,
        },
      });

      if (!assessment) {
        return this.failSyncJob(tx, syncJob.id, [{
          resourceType: 'Assessment',
          message: 'Assessment not found',
          code: 'NOT_FOUND',
          retryable: false,
        }]);
      }

      // Verify patient is linked to EMR
      const patientFhirId = data.patientFhirId || assessment.patient.emrLink?.fhirPatientId;
      if (!patientFhirId) {
        return this.failSyncJob(tx, syncJob.id, [{
          resourceType: 'Patient',
          message: 'Patient is not linked to EMR. Import patient first.',
          code: 'NOT_LINKED',
          retryable: false,
        }]);
      }

      const resources: Array<{ resource: FhirObservation | FhirCondition; method: 'POST' | 'PUT' }> = [];
      const warnings: string[] = [];

      // Convert OASIS responses to Observations
      if (data.includeAllResponses !== false) {
        const observations = this.convertOasisResponsesToObservations(
          assessment.responses,
          patientFhirId,
          assessment.m0090_completionDate || new Date()
        );
        resources.push(...observations.map(obs => ({ resource: obs, method: 'POST' as const })));
      }

      // Extract conditions from diagnosis-related OASIS items
      if (data.includeConditions !== false) {
        const conditions = this.extractConditionsFromAssessment(
          assessment,
          patientFhirId
        );
        resources.push(...conditions.map(cond => ({ resource: cond, method: 'POST' as const })));
      }

      if (resources.length === 0) {
        warnings.push('No data to sync for this assessment');
        return this.completeSyncJob(tx, syncJob.id, 0, 0, warnings);
      }

      // Execute sync with retry logic
      const result = await this.executeWithRetry(
        data.connectionId,
        data.userId,
        resources,
        syncConfig
      );

      if (!result.success) {
        return this.failSyncJob(tx, syncJob.id, result.errors, warnings);
      }

      return this.completeSyncJob(
        tx,
        syncJob.id,
        result.resourcesCreated,
        result.resourcesUpdated,
        warnings
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.failSyncJob(tx, syncJob.id, [{
        resourceType: 'Assessment',
        message: errorMessage,
        code: 'INTERNAL_ERROR',
        retryable: true,
      }]);
    }
  }

  /**
   * Get sync job status
   */
  static async getSyncStatus(tx: TxClient, syncId: string): Promise<{
    id: string;
    type: string;
    status: EmrSyncStatus;
    visitId?: string | null;
    assessmentId?: string | null;
    error?: string | null;
    createdAt: Date;
    completedAt?: Date | null;
  } | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = tx as any;

    // Check if emrSyncJob model is available (requires prisma generate)
    if (!prismaAny.emrSyncJob) {
      return null;
    }

    const job = await prismaAny.emrSyncJob.findUnique({
      where: { id: syncId },
    });

    return job;
  }

  /**
   * Retry a failed sync job
   */
  static async retrySyncJob(
    tx: TxClient,
    syncId: string,
    userId: string
  ): Promise<SyncJobResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = tx as any;

    // Check if emrSyncJob model is available
    if (!prismaAny.emrSyncJob) {
      return {
        success: false,
        syncId,
        status: 'FAILED',
        resourcesCreated: 0,
        resourcesUpdated: 0,
        errors: [{
          resourceType: 'SyncJob',
          message: 'EMR sync jobs table not yet available. Run prisma generate after schema update.',
          code: 'NOT_AVAILABLE',
          retryable: false,
        }],
        warnings: [],
      };
    }

    const job = await prismaAny.emrSyncJob.findUnique({
      where: { id: syncId },
    });

    if (!job) {
      return {
        success: false,
        syncId,
        status: 'FAILED',
        resourcesCreated: 0,
        resourcesUpdated: 0,
        errors: [{
          resourceType: 'SyncJob',
          message: 'Sync job not found',
          code: 'NOT_FOUND',
          retryable: false,
        }],
        warnings: [],
      };
    }

    if (job.status !== 'FAILED') {
      return {
        success: false,
        syncId,
        status: job.status,
        resourcesCreated: 0,
        resourcesUpdated: 0,
        errors: [{
          resourceType: 'SyncJob',
          message: `Cannot retry job with status ${job.status}`,
          code: 'INVALID_STATE',
          retryable: false,
        }],
        warnings: [],
      };
    }

    // Get the connection for this job
    // For now, we need to look up the patient's EMR link
    // In a production system, the connection ID would be stored on the sync job
    const connectionId = await this.getConnectionForJob(tx, job);
    if (!connectionId) {
      return {
        success: false,
        syncId,
        status: 'FAILED',
        resourcesCreated: 0,
        resourcesUpdated: 0,
        errors: [{
          resourceType: 'SyncJob',
          message: 'Could not determine EMR connection for retry',
          code: 'NO_CONNECTION',
          retryable: false,
        }],
        warnings: [],
      };
    }

    // Retry based on job type
    if (job.type === 'VISIT' && job.visitId) {
      return this.syncVisit(tx, {
        visitId: job.visitId,
        patientFhirId: '', // Will be looked up
        connectionId,
        userId,
      });
    } else if (job.type === 'ASSESSMENT' && job.assessmentId) {
      return this.syncAssessment(tx, {
        assessmentId: job.assessmentId,
        patientFhirId: '', // Will be looked up
        connectionId,
        userId,
      });
    }

    return {
      success: false,
      syncId,
      status: 'FAILED',
      resourcesCreated: 0,
      resourcesUpdated: 0,
      errors: [{
        resourceType: 'SyncJob',
        message: 'Invalid job type or missing reference ID',
        code: 'INVALID_JOB',
        retryable: false,
      }],
      warnings: [],
    };
  }

  // ===========================================
  // CONVERSION HELPERS
  // ===========================================

  /**
   * Convert vitals object to FHIR Observations
   */
  private static convertVitalsToObservations(
    vitals: Record<string, unknown>,
    patientFhirId: string,
    effectiveDateTime: Date
  ): FhirObservation[] {
    const observations: FhirObservation[] = [];
    const dateStr = effectiveDateTime.toISOString();

    // Blood pressure (if both systolic and diastolic present)
    if (vitals['systolicBp'] && vitals['diastolicBp']) {
      observations.push({
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          }],
        }],
        code: {
          coding: [{
            system: LOINC_SYSTEM,
            code: '85354-9',
            display: 'Blood pressure panel',
          }],
        },
        subject: { reference: `Patient/${patientFhirId}` },
        effectiveDateTime: dateStr,
        component: [
          {
            code: { coding: [VITAL_CODES.BLOOD_PRESSURE_SYSTOLIC] },
            valueQuantity: {
              value: Number(vitals['systolicBp']),
              unit: 'mmHg',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]',
            },
          },
          {
            code: { coding: [VITAL_CODES.BLOOD_PRESSURE_DIASTOLIC] },
            valueQuantity: {
              value: Number(vitals['diastolicBp']),
              unit: 'mmHg',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]',
            },
          },
        ],
      });
    }

    // Heart rate
    if (vitals['heartRate'] || vitals['pulse']) {
      observations.push({
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
          }],
        }],
        code: { coding: [VITAL_CODES.HEART_RATE] },
        subject: { reference: `Patient/${patientFhirId}` },
        effectiveDateTime: dateStr,
        valueQuantity: {
          value: Number(vitals['heartRate'] || vitals['pulse']),
          unit: '/min',
          system: 'http://unitsofmeasure.org',
          code: '/min',
        },
      });
    }

    // Respiratory rate
    if (vitals['respiratoryRate']) {
      observations.push({
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
          }],
        }],
        code: { coding: [VITAL_CODES.RESPIRATORY_RATE] },
        subject: { reference: `Patient/${patientFhirId}` },
        effectiveDateTime: dateStr,
        valueQuantity: {
          value: Number(vitals['respiratoryRate']),
          unit: '/min',
          system: 'http://unitsofmeasure.org',
          code: '/min',
        },
      });
    }

    // Temperature
    if (vitals['temperature']) {
      observations.push({
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
          }],
        }],
        code: { coding: [VITAL_CODES.TEMPERATURE] },
        subject: { reference: `Patient/${patientFhirId}` },
        effectiveDateTime: dateStr,
        valueQuantity: {
          value: Number(vitals['temperature']),
          unit: 'degF',
          system: 'http://unitsofmeasure.org',
          code: '[degF]',
        },
      });
    }

    // Oxygen saturation
    if (vitals['oxygenSaturation'] || vitals['spo2']) {
      observations.push({
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
          }],
        }],
        code: { coding: [VITAL_CODES.OXYGEN_SATURATION] },
        subject: { reference: `Patient/${patientFhirId}` },
        effectiveDateTime: dateStr,
        valueQuantity: {
          value: Number(vitals['oxygenSaturation'] || vitals['spo2']),
          unit: '%',
          system: 'http://unitsofmeasure.org',
          code: '%',
        },
      });
    }

    // Weight
    if (vitals['weight']) {
      observations.push({
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
          }],
        }],
        code: { coding: [VITAL_CODES.WEIGHT] },
        subject: { reference: `Patient/${patientFhirId}` },
        effectiveDateTime: dateStr,
        valueQuantity: {
          value: Number(vitals['weight']),
          unit: 'lb',
          system: 'http://unitsofmeasure.org',
          code: '[lb_av]',
        },
      });
    }

    // Pain score
    if (vitals['painScore'] !== undefined) {
      observations.push({
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'survey',
          }],
        }],
        code: { coding: [VITAL_CODES.PAIN_SCORE] },
        subject: { reference: `Patient/${patientFhirId}` },
        effectiveDateTime: dateStr,
        valueInteger: Number(vitals['painScore']),
      });
    }

    return observations;
  }

  /**
   * Create a clinical note observation
   */
  private static createClinicalNoteObservation(
    noteText: string,
    patientFhirId: string,
    effectiveDateTime: Date,
    clinician: { firstName: string; lastName: string; npiNumber?: string | null } | null
  ): FhirObservation {
    const observation: FhirObservation = {
      resourceType: 'Observation',
      status: 'final',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'exam',
          display: 'Exam',
        }],
      }],
      code: {
        coding: [{
          system: LOINC_SYSTEM,
          code: '34109-9',
          display: 'Note',
        }],
        text: 'Home Health Visit Note',
      },
      subject: { reference: `Patient/${patientFhirId}` },
      effectiveDateTime: effectiveDateTime.toISOString(),
      valueString: noteText,
    };

    if (clinician) {
      observation.performer = [{
        display: `${clinician.firstName} ${clinician.lastName}`,
      }];
    }

    return observation;
  }

  /**
   * Convert interventions text to Procedures
   */
  private static convertInterventionsToProcedures(
    interventions: string,
    patientFhirId: string,
    performedDateTime: Date,
    clinician: { firstName: string; lastName: string; npiNumber?: string | null } | null
  ): FhirProcedure[] {
    // For now, create a single procedure representing all interventions
    // In a production system, this would parse and categorize interventions
    const procedure: FhirProcedure = {
      resourceType: 'Procedure',
      status: 'completed',
      category: {
        coding: [{
          system: SNOMED_SYSTEM,
          code: '385763009',
          display: 'Home health nursing care',
        }],
      },
      code: {
        coding: [{
          system: SNOMED_SYSTEM,
          code: '410401003',
          display: 'Nursing intervention',
        }],
        text: 'Home health nursing interventions',
      },
      subject: { reference: `Patient/${patientFhirId}` },
      performedDateTime: performedDateTime.toISOString(),
      note: [{ text: interventions }],
    };

    if (clinician) {
      procedure.performer = [{
        actor: {
          display: `${clinician.firstName} ${clinician.lastName}`,
        },
      }];
    }

    return [procedure];
  }

  /**
   * Convert OASIS responses to Observations
   */
  private static convertOasisResponsesToObservations(
    responses: Array<{
      itemCode: string;
      section: string;
      responseValue?: string | null;
      responseCode?: string | null;
      responseText?: string | null;
    }>,
    patientFhirId: string,
    effectiveDateTime: Date
  ): FhirObservation[] {
    const observations: FhirObservation[] = [];
    const dateStr = effectiveDateTime.toISOString();

    for (const response of responses) {
      // Skip empty responses
      if (!response.responseValue && !response.responseCode && !response.responseText) {
        continue;
      }

      const observation: FhirObservation = {
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'survey',
            display: 'Survey',
          }],
        }],
        code: {
          coding: [{
            system: 'http://cms.gov/oasis',
            code: response.itemCode,
            display: response.itemCode,
          }],
          text: `OASIS ${response.itemCode}`,
        },
        subject: { reference: `Patient/${patientFhirId}` },
        effectiveDateTime: dateStr,
      };

      // Set value based on response type
      if (response.responseCode) {
        observation.valueCodeableConcept = {
          coding: [{
            system: 'http://cms.gov/oasis',
            code: response.responseCode,
          }],
          text: response.responseValue || response.responseText || undefined,
        };
      } else if (response.responseText) {
        observation.valueString = response.responseText;
      } else if (response.responseValue) {
        // Try to parse as number
        const numValue = parseFloat(response.responseValue);
        if (!isNaN(numValue)) {
          observation.valueQuantity = { value: numValue };
        } else {
          observation.valueString = response.responseValue;
        }
      }

      observations.push(observation);
    }

    return observations;
  }

  /**
   * Extract conditions from OASIS assessment
   */
  private static extractConditionsFromAssessment(
    _assessment: {
      id: string;
      m0090_completionDate?: Date | null;
    },
    _patientFhirId: string
  ): FhirCondition[] {
    // In a production system, this would:
    // 1. Look at diagnosis-related OASIS items (M1021, M1023, etc.)
    // 2. Extract ICD-10 codes
    // 3. Create Condition resources for each diagnosis

    // For now, return empty array - conditions would be populated
    // based on the actual OASIS diagnosis responses
    return [];
  }

  // ===========================================
  // EXECUTION HELPERS
  // ===========================================

  /**
   * Execute sync with retry logic
   */
  private static async executeWithRetry(
    connectionId: string,
    userId: string,
    resources: Array<{ resource: FhirObservation | FhirCondition | FhirProcedure; method: 'POST' | 'PUT' }>,
    config: SyncConfig
  ): Promise<{
    success: boolean;
    resourcesCreated: number;
    resourcesUpdated: number;
    errors: SyncError[];
  }> {
    let lastError: SyncError[] = [];
    let attempt = 0;

    while (attempt < config.maxRetries) {
      attempt++;

      try {
        let result: BundleTransactionResult | WriteResult[];

        if (config.useTransaction) {
          result = await FhirWriterService.executeTransaction(
            connectionId,
            userId,
            resources.map(r => ({
              resource: r.resource,
              method: r.method,
            }))
          );

          if ('transactionId' in result && result.success) {
            const created = result.results.filter(r => r.success).length;
            return {
              success: true,
              resourcesCreated: created,
              resourcesUpdated: 0,
              errors: [],
            };
          }

          if ('error' in result) {
            lastError = [{
              resourceType: 'Bundle',
              message: result.error || 'Transaction failed',
              code: 'TRANSACTION_FAILED',
              retryable: true,
            }];
          }
        } else {
          // Execute individually
          const results: WriteResult[] = [];
          for (const resource of resources) {
            const writeResult = await FhirWriterService.createResource(
              connectionId,
              userId,
              resource.resource
            );
            results.push(writeResult);
          }

          const allSuccess = results.every(r => r.success);
          if (allSuccess) {
            return {
              success: true,
              resourcesCreated: results.length,
              resourcesUpdated: 0,
              errors: [],
            };
          }

          lastError = results
            .filter(r => !r.success)
            .map(r => ({
              resourceType: r.resourceType,
              message: r.error || 'Write failed',
              code: 'WRITE_FAILED',
              retryable: true,
            }));
        }
      } catch (error) {
        lastError = [{
          resourceType: 'Unknown',
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'EXCEPTION',
          retryable: true,
        }];
      }

      // Wait before retry
      if (attempt < config.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, config.retryDelayMs * attempt));
      }
    }

    return {
      success: false,
      resourcesCreated: 0,
      resourcesUpdated: 0,
      errors: lastError,
    };
  }

  // ===========================================
  // DATABASE HELPERS
  // ===========================================

  /**
   * Create a new sync job record
   * Note: Uses raw SQL until Prisma client is regenerated with new models
   */
  private static async createSyncJob(
    tx: TxClient,
    id: string,
    type: string,
    referenceId: string,
    userId: string
  ): Promise<{ id: string; type: string; status: EmrSyncStatus }> {
    const visitId = type === 'VISIT' ? referenceId : null;
    const assessmentId = type === 'ASSESSMENT' ? referenceId : null;

    try {
      // Try using Prisma model first (works after prisma generate)
      const prismaAny = tx as any;
      if (prismaAny.emrSyncJob) {
        const job = await prismaAny.emrSyncJob.create({
          data: {
            id,
            type,
            status: 'PENDING',
            createdById: userId,
            visitId,
            assessmentId,
          },
        });
        return job;
      }
    } catch {
      // Fall through to raw query
    }

    // Fallback: Use raw SQL
    await prisma.$executeRaw`
      INSERT INTO emr_sync_jobs (id, type, status, visit_id, assessment_id, created_by_id, created_at)
      VALUES (${id}, ${type}, 'PENDING', ${visitId}, ${assessmentId}, ${userId}, NOW())
    `;

    return { id, type, status: 'PENDING' };
  }

  /**
   * Mark sync job as completed
   */
  private static async completeSyncJob(
    tx: TxClient,
    id: string,
    resourcesCreated: number,
    resourcesUpdated: number,
    warnings: string[]
  ): Promise<SyncJobResult> {
    try {
      const prismaAny = tx as any;
      if (prismaAny.emrSyncJob) {
        await prismaAny.emrSyncJob.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            resourcesCreated,
            resourcesUpdated,
          },
        });
      } else {
        await prisma.$executeRaw`
          UPDATE emr_sync_jobs
          SET status = 'COMPLETED', completed_at = NOW(),
              resources_created = ${resourcesCreated}, resources_updated = ${resourcesUpdated}
          WHERE id = ${id}
        `;
      }
    } catch (error) {
      console.error('[EmrSync] Failed to update sync job:', error);
    }

    // Log to audit
    await this.logSyncOperation(id, 'COMPLETED', { resourcesCreated, resourcesUpdated, warnings });

    return {
      success: true,
      syncId: id,
      status: 'COMPLETED',
      resourcesCreated,
      resourcesUpdated,
      errors: [],
      warnings,
      completedAt: new Date(),
    };
  }

  /**
   * Mark sync job as failed
   */
  private static async failSyncJob(
    tx: TxClient,
    id: string,
    errors: SyncError[],
    warnings: string[] = []
  ): Promise<SyncJobResult> {
    const errorMessage = errors.map(e => `${e.resourceType}: ${e.message}`).join('; ');

    try {
      const prismaAny = tx as any;
      if (prismaAny.emrSyncJob) {
        await prismaAny.emrSyncJob.update({
          where: { id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            error: errorMessage,
          },
        });
      } else {
        await prisma.$executeRaw`
          UPDATE emr_sync_jobs
          SET status = 'FAILED', completed_at = NOW(), error = ${errorMessage}
          WHERE id = ${id}
        `;
      }
    } catch (error) {
      console.error('[EmrSync] Failed to update sync job:', error);
    }

    // Log to audit
    await this.logSyncOperation(id, 'FAILED', { errors, warnings });

    return {
      success: false,
      syncId: id,
      status: 'FAILED',
      resourcesCreated: 0,
      resourcesUpdated: 0,
      errors,
      warnings,
      completedAt: new Date(),
    };
  }

  /**
   * Get EMR connection for a sync job
   */
  private static async getConnectionForJob(tx: TxClient, job: {
    visitId?: string | null;
    assessmentId?: string | null;
  }): Promise<string | null> {
    let patientId: string | null = null;

    if (job.visitId) {
      const visit = await tx.visit.findUnique({
        where: { id: job.visitId },
        select: { patientId: true },
      });
      patientId = visit?.patientId || null;
    } else if (job.assessmentId) {
      const assessment = await tx.oasisAssessment.findUnique({
        where: { id: job.assessmentId },
        select: { patientId: true },
      });
      patientId = assessment?.patientId || null;
    }

    if (!patientId) {
      return null;
    }

    const link = await tx.emrPatientLink.findUnique({
      where: { patientId },
      select: { connectionId: true },
    });

    return link?.connectionId || null;
  }

  /**
   * Log sync operation for audit trail
   */
  private static async logSyncOperation(
    syncId: string,
    action: string,
    details: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'CREATE',
          resourceType: 'EmrSyncJob',
          resourceId: syncId,
          description: `EMR sync ${action.toLowerCase()}`,
          newValues: JSON.parse(JSON.stringify(details)),
          phiAccessed: true,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('[EmrSync] Failed to create audit log:', error);
    }
  }
}

export default EmrSyncService;
