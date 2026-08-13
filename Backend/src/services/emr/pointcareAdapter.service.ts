/**
 * PointCare EMR Adapter Service
 *
 * Adapter specifically for PointCare EMR integration.
 * PointCare may use standard FHIR or have proprietary API extensions.
 * This adapter provides a unified interface for PointCare-specific operations.
 *
 * HIPAA Compliance:
 * - All operations are logged for audit trail
 * - PHI is encrypted in transit
 * - Access is controlled by user authorization
 *
 * TODO: Obtain PointCare API documentation to complete implementation:
 * - Confirm if PointCare uses standard FHIR R4 or has proprietary extensions
 * - Get PointCare-specific authentication requirements
 * - Determine field mapping requirements for OASIS data
 * - Identify any rate limiting or batch size constraints
 * - Get sandbox/test environment credentials
 */

import prisma from '../../config/prisma';
import { FhirWriterService, type FhirWriteResource, type WriteResult } from '../fhir/fhirWriter.service';
import { FhirClientService } from '../fhir/fhirClient.service';

// ===========================================
// POINTCARE-SPECIFIC TYPES
// ===========================================

/**
 * PointCare connection configuration
 * TODO: Update based on actual PointCare API documentation
 */
export interface PointCareConfig {
  /** Base URL for PointCare API */
  baseUrl: string;
  /** PointCare-specific API key (if not using standard OAuth) */
  apiKey?: string;
  /** Client ID for OAuth (if using standard FHIR) */
  clientId?: string;
  /** Facility/Practice identifier in PointCare */
  facilityId?: string;
  /** Whether PointCare uses standard FHIR endpoints */
  usesStandardFhir: boolean;
  /** PointCare API version */
  apiVersion?: string;
  /** Custom headers required by PointCare */
  customHeaders?: Record<string, string>;
}

/**
 * PointCare patient search parameters
 * TODO: Verify these map correctly to PointCare's search API
 */
export interface PointCarePatientSearchParams {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  mrn?: string;
  ssn?: string;
  phone?: string;
  facilityId?: string;
}

/**
 * PointCare visit data structure
 * TODO: Map to actual PointCare visit schema
 */
export interface PointCareVisitData {
  patientId: string;
  visitDate: string;
  visitType: string;
  clinicianId: string;
  notes?: string;
  vitalSigns?: Record<string, unknown>;
  diagnoses?: Array<{
    code: string;
    system: string;
    description?: string;
  }>;
  procedures?: Array<{
    code: string;
    system: string;
    description?: string;
  }>;
}

/**
 * PointCare OASIS assessment data
 * TODO: Map to actual PointCare OASIS schema
 */
export interface PointCareOasisData {
  patientId: string;
  assessmentDate: string;
  assessmentType: string;
  clinicianId: string;
  responses: Array<{
    itemCode: string;
    value: string;
    valueCode?: string;
  }>;
}

/**
 * PointCare API response wrapper
 */
export interface PointCareResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

// ===========================================
// POINTCARE ADAPTER SERVICE
// ===========================================

export class PointCareAdapterService {
  /**
   * Check if a connection is a PointCare connection
   */
  static async isPointCareConnection(connectionId: string): Promise<boolean> {
    const connection = await prisma.emrConnection.findUnique({
      where: { id: connectionId },
    });

    // Check if the connection is configured as PointCare
    // This could be based on vendor type, URL pattern, or custom configuration
    if (!connection) {
      return false;
    }

    // TODO: Update detection logic based on actual PointCare configuration
    return connection.vendor === 'CUSTOM' &&
           connection.fhirBaseUrl.toLowerCase().includes('pointcare');
  }

  /**
   * Get PointCare configuration for a connection
   * TODO: Load from database or environment once PointCare details are known
   */
  static async getConfig(connectionId: string): Promise<PointCareConfig | null> {
    const connection = await prisma.emrConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return null;
    }

    // TODO: Implement actual configuration loading
    // This would typically come from:
    // 1. Environment variables for sensitive data
    // 2. Database configuration for agency-specific settings
    // 3. PointCare-provided configuration files

    return {
      baseUrl: connection.fhirBaseUrl,
      clientId: connection.clientId,
      usesStandardFhir: true, // TODO: Determine from PointCare documentation
      apiVersion: '1.0', // TODO: Get actual version
      customHeaders: {
        // TODO: Add PointCare-required headers
      },
    };
  }

  /**
   * Search for patients in PointCare
   *
   * If PointCare uses standard FHIR, this delegates to FhirClientService.
   * If PointCare has a proprietary API, this implements the custom search.
   */
  static async searchPatients(
    connectionId: string,
    userId: string,
    params: PointCarePatientSearchParams
  ): Promise<{
    patients: Array<{
      id: string;
      mrn?: string;
      firstName: string;
      lastName: string;
      dateOfBirth: string;
    }>;
    total: number;
  }> {
    const config = await this.getConfig(connectionId);

    if (!config) {
      throw new Error('PointCare connection not found');
    }

    if (config.usesStandardFhir) {
      // Use standard FHIR patient search
      const fhirParams: Record<string, string> = {};
      if (params.firstName) fhirParams['given'] = params.firstName;
      if (params.lastName) fhirParams['family'] = params.lastName;
      if (params.dateOfBirth) fhirParams['birthdate'] = params.dateOfBirth;
      if (params.mrn) fhirParams['identifier'] = params.mrn;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = await FhirClientService.searchPatients(
        connectionId,
        userId,
        fhirParams as any
      );

      return {
        patients: results.map(r => ({
          id: r.fhirId,
          mrn: r.mrn,
          firstName: r.firstName,
          lastName: r.lastName,
          dateOfBirth: r.dateOfBirth,
        })),
        total: results.length,
      };
    }

    // TODO: Implement PointCare proprietary patient search
    // This would involve:
    // 1. Building PointCare-specific request format
    // 2. Making API call with PointCare authentication
    // 3. Parsing PointCare-specific response format
    throw new Error('PointCare proprietary API not yet implemented');
  }

  /**
   * Create or update a visit in PointCare
   *
   * If PointCare uses standard FHIR, this creates appropriate FHIR resources.
   * If PointCare has a proprietary API, this implements the custom submission.
   */
  static async syncVisit(
    connectionId: string,
    userId: string,
    visitData: PointCareVisitData
  ): Promise<WriteResult> {
    const config = await this.getConfig(connectionId);

    if (!config) {
      return {
        success: false,
        resourceType: 'Visit',
        error: 'PointCare connection not found',
      };
    }

    const startTime = Date.now();

    try {
      if (config.usesStandardFhir) {
        // Convert to FHIR resources and submit via FhirWriterService
        const resources = this.convertVisitToFhirResources(visitData);

        if (resources.length === 0) {
          return {
            success: false,
            resourceType: 'Visit',
            error: 'No resources to sync',
          };
        }

        // Execute as transaction
        const result = await FhirWriterService.executeTransaction(
          connectionId,
          userId,
          resources.map(r => ({ resource: r, method: 'POST' as const }))
        );

        await this.logOperation(
          connectionId,
          userId,
          'SYNC_VISIT',
          visitData.patientId,
          result.success,
          Date.now() - startTime
        );

        if (result.success) {
          return {
            success: true,
            resourceType: 'Visit',
            resourceId: result.transactionId,
          };
        }

        return {
          success: false,
          resourceType: 'Visit',
          error: result.error || 'Transaction failed',
        };
      }

      // TODO: Implement PointCare proprietary visit submission
      // This would involve:
      // 1. Converting visit data to PointCare format
      // 2. Making API call with PointCare authentication
      // 3. Handling PointCare-specific response/errors
      throw new Error('PointCare proprietary API not yet implemented');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.logOperation(
        connectionId,
        userId,
        'SYNC_VISIT',
        visitData.patientId,
        false,
        Date.now() - startTime,
        errorMessage
      );

      return {
        success: false,
        resourceType: 'Visit',
        error: errorMessage,
      };
    }
  }

  /**
   * Submit OASIS assessment to PointCare
   *
   * If PointCare uses standard FHIR, this creates Observation resources.
   * If PointCare has a proprietary OASIS API, this implements the custom submission.
   */
  static async syncOasisAssessment(
    connectionId: string,
    userId: string,
    oasisData: PointCareOasisData
  ): Promise<WriteResult> {
    const config = await this.getConfig(connectionId);

    if (!config) {
      return {
        success: false,
        resourceType: 'Assessment',
        error: 'PointCare connection not found',
      };
    }

    const startTime = Date.now();

    try {
      if (config.usesStandardFhir) {
        // Convert to FHIR Observations and submit
        const observations = this.convertOasisToFhirObservations(oasisData);

        if (observations.length === 0) {
          return {
            success: false,
            resourceType: 'Assessment',
            error: 'No OASIS responses to sync',
          };
        }

        const result = await FhirWriterService.executeTransaction(
          connectionId,
          userId,
          observations.map(obs => ({ resource: obs, method: 'POST' as const }))
        );

        await this.logOperation(
          connectionId,
          userId,
          'SYNC_OASIS',
          oasisData.patientId,
          result.success,
          Date.now() - startTime
        );

        if (result.success) {
          return {
            success: true,
            resourceType: 'Assessment',
            resourceId: result.transactionId,
          };
        }

        return {
          success: false,
          resourceType: 'Assessment',
          error: result.error || 'Transaction failed',
        };
      }

      // TODO: Implement PointCare proprietary OASIS submission
      // Many EMRs have dedicated OASIS submission endpoints
      // This would involve:
      // 1. Formatting data per PointCare's OASIS API spec
      // 2. Submitting to PointCare's OASIS endpoint
      // 3. Handling validation errors and responses
      throw new Error('PointCare proprietary OASIS API not yet implemented');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.logOperation(
        connectionId,
        userId,
        'SYNC_OASIS',
        oasisData.patientId,
        false,
        Date.now() - startTime,
        errorMessage
      );

      return {
        success: false,
        resourceType: 'Assessment',
        error: errorMessage,
      };
    }
  }

  /**
   * Check PointCare connection health
   */
  static async checkConnection(connectionId: string): Promise<{
    healthy: boolean;
    message: string;
    apiVersion?: string;
    latencyMs?: number;
  }> {
    const config = await this.getConfig(connectionId);

    if (!config) {
      return {
        healthy: false,
        message: 'PointCare connection not found',
      };
    }

    const startTime = Date.now();

    try {
      if (config.usesStandardFhir) {
        // Use standard FHIR metadata endpoint
        const result = await FhirClientService.testConnection(connectionId);
        return {
          healthy: result.success,
          message: result.message,
          latencyMs: Date.now() - startTime,
        };
      }

      // TODO: Implement PointCare proprietary health check
      // This would typically call a /health or /status endpoint
      throw new Error('PointCare proprietary health check not yet implemented');
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Get PointCare-specific field mappings
   *
   * Returns mapping of internal field names to PointCare field names.
   * This is used for agencies that have custom field mappings configured.
   */
  static async getFieldMappings(agencyId: string): Promise<Map<string, string>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = prisma as any;

    // Check if emrFieldMapping model is available (requires prisma generate)
    if (!prismaAny.emrFieldMapping) {
      return new Map<string, string>();
    }

    const mappings = await prismaAny.emrFieldMapping.findMany({
      where: {
        agencyId,
        active: true,
        // TODO: Filter by PointCare EMR type once EMR type field is added
      },
    });

    const map = new Map<string, string>();
    for (const mapping of mappings) {
      map.set(mapping.internalField, mapping.emrField);
    }

    return map;
  }

  // ===========================================
  // CONVERSION HELPERS
  // ===========================================

  /**
   * Convert internal visit data to FHIR resources
   */
  private static convertVisitToFhirResources(
    visitData: PointCareVisitData
  ): FhirWriteResource[] {
    const resources: FhirWriteResource[] = [];
    const dateStr = new Date(visitData.visitDate).toISOString();

    // Convert vital signs to Observations
    if (visitData.vitalSigns) {
      const vitals = visitData.vitalSigns as Record<string, unknown>;
      // Blood pressure
      if (vitals['systolicBp'] && vitals['diastolicBp']) {
        resources.push({
          resourceType: 'Observation',
          status: 'final',
          category: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
            }],
          }],
          code: {
            coding: [{
              system: 'http://loinc.org',
              code: '85354-9',
              display: 'Blood pressure panel',
            }],
          },
          subject: { reference: `Patient/${visitData.patientId}` },
          effectiveDateTime: dateStr,
          component: [
            {
              code: {
                coding: [{
                  system: 'http://loinc.org',
                  code: '8480-6',
                  display: 'Systolic blood pressure',
                }],
              },
              valueQuantity: {
                value: Number(vitals['systolicBp']),
                unit: 'mmHg',
                system: 'http://unitsofmeasure.org',
                code: 'mm[Hg]',
              },
            },
            {
              code: {
                coding: [{
                  system: 'http://loinc.org',
                  code: '8462-4',
                  display: 'Diastolic blood pressure',
                }],
              },
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

      // TODO: Add other vital sign observations
    }

    // Convert notes to clinical note Observation
    if (visitData.notes) {
      resources.push({
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'exam',
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '34109-9',
            display: 'Note',
          }],
        },
        subject: { reference: `Patient/${visitData.patientId}` },
        effectiveDateTime: dateStr,
        valueString: visitData.notes,
      });
    }

    // Convert procedures
    if (visitData.procedures) {
      for (const proc of visitData.procedures) {
        resources.push({
          resourceType: 'Procedure',
          status: 'completed',
          code: {
            coding: [{
              system: proc.system,
              code: proc.code,
              display: proc.description,
            }],
          },
          subject: { reference: `Patient/${visitData.patientId}` },
          performedDateTime: dateStr,
        });
      }
    }

    return resources;
  }

  /**
   * Convert OASIS data to FHIR Observations
   */
  private static convertOasisToFhirObservations(
    oasisData: PointCareOasisData
  ): FhirWriteResource[] {
    const observations: FhirWriteResource[] = [];
    const dateStr = new Date(oasisData.assessmentDate).toISOString();

    for (const response of oasisData.responses) {
      observations.push({
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'survey',
          }],
        }],
        code: {
          coding: [{
            system: 'http://cms.gov/oasis',
            code: response.itemCode,
          }],
          text: `OASIS ${response.itemCode}`,
        },
        subject: { reference: `Patient/${oasisData.patientId}` },
        effectiveDateTime: dateStr,
        valueCodeableConcept: response.valueCode ? {
          coding: [{
            system: 'http://cms.gov/oasis',
            code: response.valueCode,
          }],
          text: response.value,
        } : undefined,
        valueString: !response.valueCode ? response.value : undefined,
      });
    }

    return observations;
  }

  // ===========================================
  // LOGGING HELPERS
  // ===========================================

  /**
   * Log PointCare operation for audit trail
   */
  private static async logOperation(
    connectionId: string,
    userId: string,
    action: string,
    patientId: string,
    success: boolean,
    durationMs: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      await prisma.emrAuditLog.create({
        data: {
          connectionId,
          userId,
          action: `POINTCARE_${action}`,
          resourceType: 'PointCareSync',
          patientFhirId: patientId,
          requestUrl: `[POINTCARE] ${action}`,
          responseStatus: success ? 200 : 500,
          durationMs,
          errorMessage,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('[PointCareAdapter] Failed to create audit log:', error);
    }
  }
}

export default PointCareAdapterService;
