/**
 * FHIR Writer Service
 *
 * Handles writing FHIR R4 resources to EMR systems.
 * Supports creating, updating resources, bundle transactions, and vendor-specific quirks.
 * Implements HIPAA-compliant audit logging for all write operations.
 */

import crypto from 'crypto';
import prisma from '../../config/prisma';
import { FhirClientService } from './fhirClient.service';
import { MockFhirService } from './mockFhir.service';
import type {
  FhirBundle,
  FhirBundleEntry,
  FhirOperationOutcome,
  FhirCodeableConcept,
  FhirReference,
  FhirIdentifier,
  FhirMeta,
} from './fhirTypes';
import type { EmrVendor } from '../../generated/prisma';

// ===========================================
// FHIR RESOURCE TYPES FOR WRITING
// ===========================================

export interface FhirObservation {
  resourceType: 'Observation';
  id?: string;
  meta?: FhirMeta;
  identifier?: FhirIdentifier[];
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime?: string;
  effectivePeriod?: { start?: string; end?: string };
  issued?: string;
  performer?: FhirReference[];
  valueQuantity?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  valueCodeableConcept?: FhirCodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueDateTime?: string;
  interpretation?: FhirCodeableConcept[];
  note?: Array<{ text: string }>;
  component?: Array<{
    code: FhirCodeableConcept;
    valueQuantity?: { value?: number; unit?: string; system?: string; code?: string };
    valueCodeableConcept?: FhirCodeableConcept;
    valueString?: string;
  }>;
}

export interface FhirCondition {
  resourceType: 'Condition';
  id?: string;
  meta?: FhirMeta;
  identifier?: FhirIdentifier[];
  clinicalStatus?: FhirCodeableConcept;
  verificationStatus?: FhirCodeableConcept;
  category?: FhirCodeableConcept[];
  severity?: FhirCodeableConcept;
  code?: FhirCodeableConcept;
  bodySite?: FhirCodeableConcept[];
  subject: FhirReference;
  encounter?: FhirReference;
  onsetDateTime?: string;
  onsetPeriod?: { start?: string; end?: string };
  onsetString?: string;
  abatementDateTime?: string;
  recordedDate?: string;
  recorder?: FhirReference;
  asserter?: FhirReference;
  note?: Array<{ text: string }>;
}

export interface FhirProcedure {
  resourceType: 'Procedure';
  id?: string;
  meta?: FhirMeta;
  identifier?: FhirIdentifier[];
  status: 'preparation' | 'in-progress' | 'not-done' | 'on-hold' | 'stopped' | 'completed' | 'entered-in-error' | 'unknown';
  statusReason?: FhirCodeableConcept;
  category?: FhirCodeableConcept;
  code?: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  performedDateTime?: string;
  performedPeriod?: { start?: string; end?: string };
  performedString?: string;
  recorder?: FhirReference;
  asserter?: FhirReference;
  performer?: Array<{
    function?: FhirCodeableConcept;
    actor: FhirReference;
    onBehalfOf?: FhirReference;
  }>;
  location?: FhirReference;
  reasonCode?: FhirCodeableConcept[];
  reasonReference?: FhirReference[];
  bodySite?: FhirCodeableConcept[];
  outcome?: FhirCodeableConcept;
  report?: FhirReference[];
  complication?: FhirCodeableConcept[];
  followUp?: FhirCodeableConcept[];
  note?: Array<{ text: string }>;
}

export interface FhirPatientWrite {
  resourceType: 'Patient';
  id?: string;
  meta?: FhirMeta;
  identifier?: FhirIdentifier[];
  active?: boolean;
  name?: Array<{
    use?: string;
    family?: string;
    given?: string[];
    prefix?: string[];
    suffix?: string[];
  }>;
  telecom?: Array<{
    system?: string;
    value?: string;
    use?: string;
  }>;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  address?: Array<{
    use?: string;
    type?: string;
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
  maritalStatus?: FhirCodeableConcept;
  communication?: Array<{
    language: FhirCodeableConcept;
    preferred?: boolean;
  }>;
}

export type FhirWriteResource = FhirObservation | FhirCondition | FhirProcedure | FhirPatientWrite;

// ===========================================
// VALIDATION TYPES
// ===========================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

// ===========================================
// WRITE RESULT TYPES
// ===========================================

export interface WriteResult {
  success: boolean;
  resourceId?: string;
  resourceType: string;
  location?: string;
  etag?: string;
  operationOutcome?: FhirOperationOutcome;
  error?: string;
}

export interface BundleTransactionResult {
  success: boolean;
  transactionId: string;
  results: WriteResult[];
  operationOutcome?: FhirOperationOutcome;
  error?: string;
}

// ===========================================
// VENDOR-SPECIFIC CONFIGURATION
// ===========================================

interface VendorConfig {
  // Epic-specific
  epicRequiresAppOrchardId?: boolean;
  epicCategoryCode?: string;
  // Cerner-specific
  cernerRequiresContained?: boolean;
  cernerNamespaceUri?: string;
  // PointCare-specific
  pointcareUsesCustomEndpoint?: boolean;
  pointcareAuthHeader?: string;
  // Generic
  supportsTransactions?: boolean;
  supportsBatch?: boolean;
  requiresIfMatch?: boolean;
  maxBundleSize?: number;
}

const VENDOR_CONFIGS: Record<EmrVendor, VendorConfig> = {
  EPIC: {
    epicRequiresAppOrchardId: true,
    supportsTransactions: true,
    supportsBatch: true,
    requiresIfMatch: false,
    maxBundleSize: 100,
  },
  CERNER: {
    cernerRequiresContained: false,
    supportsTransactions: true,
    supportsBatch: true,
    requiresIfMatch: true,
    maxBundleSize: 50,
  },
  ALLSCRIPTS: {
    supportsTransactions: false,
    supportsBatch: true,
    requiresIfMatch: false,
    maxBundleSize: 25,
  },
  MEDITECH: {
    supportsTransactions: false,
    supportsBatch: false,
    requiresIfMatch: false,
    maxBundleSize: 10,
  },
  ATHENAHEALTH: {
    supportsTransactions: true,
    supportsBatch: true,
    requiresIfMatch: false,
    maxBundleSize: 50,
  },
  NEXTGEN: {
    supportsTransactions: true,
    supportsBatch: true,
    requiresIfMatch: false,
    maxBundleSize: 30,
  },
  CUSTOM: {
    supportsTransactions: true,
    supportsBatch: true,
    requiresIfMatch: false,
    maxBundleSize: 50,
  },
};

// ===========================================
// FHIR WRITER SERVICE
// ===========================================

export class FhirWriterService {
  /**
   * Generate a unique identifier for new resources
   */
  private static generateResourceIdentifier(): string {
    return `urn:uuid:${crypto.randomUUID()}`;
  }

  /**
   * Get vendor configuration
   */
  private static getVendorConfig(vendor: EmrVendor): VendorConfig {
    return VENDOR_CONFIGS[vendor] || VENDOR_CONFIGS.CUSTOM;
  }

  /**
   * Validate a FHIR resource before submission
   */
  static validateResource(resource: FhirWriteResource): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Common validation
    if (!resource.resourceType) {
      errors.push({
        field: 'resourceType',
        message: 'Resource type is required',
        code: 'REQUIRED_FIELD',
      });
    }

    // Resource-specific validation
    switch (resource.resourceType) {
      case 'Observation':
        this.validateObservation(resource, errors, warnings);
        break;
      case 'Condition':
        this.validateCondition(resource, errors, warnings);
        break;
      case 'Procedure':
        this.validateProcedure(resource, errors, warnings);
        break;
      case 'Patient':
        this.validatePatient(resource, errors, warnings);
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private static validateObservation(
    obs: FhirObservation,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!obs.status) {
      errors.push({
        field: 'status',
        message: 'Observation status is required',
        code: 'REQUIRED_FIELD',
      });
    }
    if (!obs.code || !obs.code.coding || obs.code.coding.length === 0) {
      errors.push({
        field: 'code',
        message: 'Observation code with at least one coding is required',
        code: 'REQUIRED_FIELD',
      });
    }
    if (!obs.subject) {
      warnings.push({
        field: 'subject',
        message: 'Subject reference is recommended for Observation',
        code: 'RECOMMENDED_FIELD',
      });
    }
    // Validate value[x] - at least one value should be present
    const hasValue = obs.valueQuantity || obs.valueCodeableConcept ||
                     obs.valueString || obs.valueBoolean !== undefined ||
                     obs.valueInteger !== undefined || obs.valueDateTime ||
                     (obs.component && obs.component.length > 0);
    if (!hasValue) {
      warnings.push({
        field: 'value[x]',
        message: 'Observation should have a value or components',
        code: 'RECOMMENDED_FIELD',
      });
    }
  }

  private static validateCondition(
    condition: FhirCondition,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!condition.subject) {
      errors.push({
        field: 'subject',
        message: 'Condition subject is required',
        code: 'REQUIRED_FIELD',
      });
    }
    if (!condition.code) {
      warnings.push({
        field: 'code',
        message: 'Condition code is strongly recommended',
        code: 'RECOMMENDED_FIELD',
      });
    }
    if (!condition.clinicalStatus) {
      warnings.push({
        field: 'clinicalStatus',
        message: 'Clinical status is recommended for Condition',
        code: 'RECOMMENDED_FIELD',
      });
    }
  }

  private static validateProcedure(
    procedure: FhirProcedure,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!procedure.status) {
      errors.push({
        field: 'status',
        message: 'Procedure status is required',
        code: 'REQUIRED_FIELD',
      });
    }
    if (!procedure.subject) {
      errors.push({
        field: 'subject',
        message: 'Procedure subject is required',
        code: 'REQUIRED_FIELD',
      });
    }
    if (!procedure.code) {
      warnings.push({
        field: 'code',
        message: 'Procedure code is strongly recommended',
        code: 'RECOMMENDED_FIELD',
      });
    }
  }

  private static validatePatient(
    patient: FhirPatientWrite,
    errors: ValidationError[],
    _warnings: ValidationWarning[]
  ): void {
    if (!patient.name || patient.name.length === 0) {
      errors.push({
        field: 'name',
        message: 'Patient must have at least one name',
        code: 'REQUIRED_FIELD',
      });
    }
  }

  /**
   * Apply vendor-specific transformations to a resource
   */
  private static applyVendorTransformations(
    resource: FhirWriteResource,
    vendor: EmrVendor
  ): FhirWriteResource {
    const config = this.getVendorConfig(vendor);
    const transformed = { ...resource };

    switch (vendor) {
      case 'EPIC':
        // Epic requires specific category coding for observations
        if (transformed.resourceType === 'Observation' && config.epicCategoryCode) {
          const obs = transformed as FhirObservation;
          if (!obs.category) {
            obs.category = [];
          }
          // Add Epic-specific category if not present
          const hasEpicCategory = obs.category.some(
            cat => cat.coding?.some(c => c.system === 'http://epic.com/fhir/category')
          );
          if (!hasEpicCategory) {
            obs.category.push({
              coding: [{
                system: 'http://epic.com/fhir/category',
                code: config.epicCategoryCode,
              }],
            });
          }
        }
        break;

      case 'CERNER':
        // Cerner may require If-Match header for updates
        // This is handled at the request level
        // Cerner also has specific namespace requirements for identifiers
        if (config.cernerNamespaceUri && transformed.identifier) {
          for (const id of transformed.identifier) {
            if (!id.system) {
              id.system = config.cernerNamespaceUri;
            }
          }
        }
        break;

      // TODO: Add PointCare-specific transformations when API details are available
      case 'CUSTOM':
        // No transformations for generic/custom vendors
        break;
    }

    return transformed;
  }

  /**
   * Create a new FHIR resource
   */
  static async createResource(
    connectionId: string,
    userId: string,
    resource: FhirWriteResource
  ): Promise<WriteResult> {
    const connection = await prisma.emrConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return {
        success: false,
        resourceType: resource.resourceType,
        error: 'EMR connection not found',
      };
    }

    // Validate before submission
    const validation = this.validateResource(resource);
    if (!validation.isValid) {
      return {
        success: false,
        resourceType: resource.resourceType,
        error: `Validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
        operationOutcome: {
          resourceType: 'OperationOutcome',
          issue: validation.errors.map(e => ({
            severity: 'error' as const,
            code: e.code,
            diagnostics: e.message,
            location: [e.field],
          })),
        },
      };
    }

    // Apply vendor-specific transformations
    const transformedResource = this.applyVendorTransformations(resource, connection.vendor);

    const startTime = Date.now();

    try {
      // Mock mode
      if (MockFhirService.isEnabled()) {
        const mockId = this.generateResourceIdentifier().replace('urn:uuid:', '');

        await this.logWriteOperation(
          connectionId,
          userId,
          'CREATE',
          resource.resourceType,
          mockId,
          200,
          Date.now() - startTime
        );

        return {
          success: true,
          resourceId: mockId,
          resourceType: resource.resourceType,
          location: `${resource.resourceType}/${mockId}`,
        };
      }

      // Real API call
      const accessToken = await FhirClientService.getValidToken(connectionId, userId);
      const url = `${connection.fhirBaseUrl}/${resource.resourceType}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/fhir+json',
          Accept: 'application/fhir+json',
        },
        body: JSON.stringify(transformedResource),
      });

      const durationMs = Date.now() - startTime;

      // Parse response
      const responseData = await response.json() as FhirWriteResource | FhirOperationOutcome;

      // Extract resource ID from Location header or response
      let resourceId: string | undefined;
      const locationHeader = response.headers.get('Location');
      if (locationHeader) {
        const match = locationHeader.match(/\/([^/]+)$/);
        resourceId = match?.[1];
      } else if ('id' in responseData && responseData.id) {
        resourceId = responseData.id;
      }

      await this.logWriteOperation(
        connectionId,
        userId,
        'CREATE',
        resource.resourceType,
        resourceId,
        response.status,
        durationMs,
        !response.ok ? JSON.stringify(responseData) : undefined
      );

      if (!response.ok) {
        return {
          success: false,
          resourceType: resource.resourceType,
          operationOutcome: responseData as FhirOperationOutcome,
          error: `Create failed with status ${response.status}`,
        };
      }

      return {
        success: true,
        resourceId,
        resourceType: resource.resourceType,
        location: locationHeader || undefined,
        etag: response.headers.get('ETag') || undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.logWriteOperation(
        connectionId,
        userId,
        'CREATE',
        resource.resourceType,
        undefined,
        0,
        Date.now() - startTime,
        errorMessage
      );

      return {
        success: false,
        resourceType: resource.resourceType,
        error: errorMessage,
      };
    }
  }

  /**
   * Update an existing FHIR resource
   */
  static async updateResource(
    connectionId: string,
    userId: string,
    resourceId: string,
    resource: FhirWriteResource,
    etag?: string
  ): Promise<WriteResult> {
    const connection = await prisma.emrConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return {
        success: false,
        resourceType: resource.resourceType,
        error: 'EMR connection not found',
      };
    }

    const config = this.getVendorConfig(connection.vendor);

    // Validate before submission
    const validation = this.validateResource(resource);
    if (!validation.isValid) {
      return {
        success: false,
        resourceType: resource.resourceType,
        error: `Validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
      };
    }

    // Apply vendor-specific transformations
    const transformedResource = this.applyVendorTransformations(resource, connection.vendor);

    // Ensure ID is set for update
    transformedResource.id = resourceId;

    const startTime = Date.now();

    try {
      // Mock mode
      if (MockFhirService.isEnabled()) {
        await this.logWriteOperation(
          connectionId,
          userId,
          'UPDATE',
          resource.resourceType,
          resourceId,
          200,
          Date.now() - startTime
        );

        return {
          success: true,
          resourceId,
          resourceType: resource.resourceType,
          location: `${resource.resourceType}/${resourceId}`,
        };
      }

      // Real API call
      const accessToken = await FhirClientService.getValidToken(connectionId, userId);
      const url = `${connection.fhirBaseUrl}/${resource.resourceType}/${resourceId}`;

      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/fhir+json',
        Accept: 'application/fhir+json',
      };

      // Add If-Match header if required by vendor or provided
      if (config.requiresIfMatch && etag) {
        headers['If-Match'] = etag;
      } else if (etag) {
        headers['If-Match'] = etag;
      }

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(transformedResource),
      });

      const durationMs = Date.now() - startTime;
      const responseData = await response.json() as FhirWriteResource | FhirOperationOutcome;

      await this.logWriteOperation(
        connectionId,
        userId,
        'UPDATE',
        resource.resourceType,
        resourceId,
        response.status,
        durationMs,
        !response.ok ? JSON.stringify(responseData) : undefined
      );

      if (!response.ok) {
        return {
          success: false,
          resourceId,
          resourceType: resource.resourceType,
          operationOutcome: responseData as FhirOperationOutcome,
          error: `Update failed with status ${response.status}`,
        };
      }

      return {
        success: true,
        resourceId,
        resourceType: resource.resourceType,
        location: response.headers.get('Location') || undefined,
        etag: response.headers.get('ETag') || undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.logWriteOperation(
        connectionId,
        userId,
        'UPDATE',
        resource.resourceType,
        resourceId,
        0,
        Date.now() - startTime,
        errorMessage
      );

      return {
        success: false,
        resourceId,
        resourceType: resource.resourceType,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute a bundle transaction for atomic updates
   */
  static async executeTransaction(
    connectionId: string,
    userId: string,
    entries: Array<{
      resource: FhirWriteResource;
      method: 'POST' | 'PUT' | 'DELETE';
      url?: string;
    }>
  ): Promise<BundleTransactionResult> {
    const connection = await prisma.emrConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return {
        success: false,
        transactionId: '',
        results: [],
        error: 'EMR connection not found',
      };
    }

    const config = this.getVendorConfig(connection.vendor);
    const transactionId = crypto.randomUUID();

    // Check if vendor supports transactions
    if (!config.supportsTransactions) {
      // Fall back to batch or individual requests
      if (config.supportsBatch) {
        return this.executeBatch(connectionId, userId, entries);
      } else {
        return this.executeIndividually(connectionId, userId, entries);
      }
    }

    // Check bundle size limits
    if (entries.length > (config.maxBundleSize || 50)) {
      return {
        success: false,
        transactionId,
        results: [],
        error: `Bundle size ${entries.length} exceeds vendor limit of ${config.maxBundleSize}`,
      };
    }

    // Validate all resources
    for (const entry of entries) {
      if (entry.method !== 'DELETE') {
        const validation = this.validateResource(entry.resource);
        if (!validation.isValid) {
          return {
            success: false,
            transactionId,
            results: [],
            error: `Validation failed for ${entry.resource.resourceType}: ${validation.errors.map(e => e.message).join(', ')}`,
          };
        }
      }
    }

    // Build transaction bundle
    const bundle: FhirBundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: entries.map((entry) => {
        const transformedResource = this.applyVendorTransformations(
          entry.resource,
          connection.vendor
        );

        const bundleEntry: FhirBundleEntry = {
          fullUrl: entry.resource.id
            ? `${entry.resource.resourceType}/${entry.resource.id}`
            : this.generateResourceIdentifier(),
          resource: transformedResource as any,
          request: {
            method: entry.method,
            url: entry.url || (entry.resource.id
              ? `${entry.resource.resourceType}/${entry.resource.id}`
              : entry.resource.resourceType),
          },
        };

        return bundleEntry;
      }),
    };

    const startTime = Date.now();

    try {
      // Mock mode
      if (MockFhirService.isEnabled()) {
        const results: WriteResult[] = entries.map((entry, index) => ({
          success: true,
          resourceId: entry.resource.id || `mock-${index}`,
          resourceType: entry.resource.resourceType,
        }));

        await this.logWriteOperation(
          connectionId,
          userId,
          'TRANSACTION',
          'Bundle',
          transactionId,
          200,
          Date.now() - startTime
        );

        return {
          success: true,
          transactionId,
          results,
        };
      }

      // Real API call
      const accessToken = await FhirClientService.getValidToken(connectionId, userId);
      const url = connection.fhirBaseUrl;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/fhir+json',
          Accept: 'application/fhir+json',
        },
        body: JSON.stringify(bundle),
      });

      const durationMs = Date.now() - startTime;
      const responseData = await response.json() as FhirBundle | FhirOperationOutcome;

      await this.logWriteOperation(
        connectionId,
        userId,
        'TRANSACTION',
        'Bundle',
        transactionId,
        response.status,
        durationMs,
        !response.ok ? JSON.stringify(responseData) : undefined
      );

      if (!response.ok) {
        return {
          success: false,
          transactionId,
          results: [],
          operationOutcome: responseData as FhirOperationOutcome,
          error: `Transaction failed with status ${response.status}`,
        };
      }

      // Parse response bundle
      const responseBundle = responseData as FhirBundle;
      const results: WriteResult[] = (responseBundle.entry || []).map((entry, index) => {
        const originalEntry = entries[index];
        return {
          success: entry.response?.status?.startsWith('2') ?? false,
          resourceId: entry.resource?.id || entry.response?.location?.split('/').pop(),
          resourceType: originalEntry?.resource.resourceType || 'Unknown',
          location: entry.response?.location,
          etag: entry.response?.etag,
        };
      });

      return {
        success: true,
        transactionId,
        results,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.logWriteOperation(
        connectionId,
        userId,
        'TRANSACTION',
        'Bundle',
        transactionId,
        0,
        Date.now() - startTime,
        errorMessage
      );

      return {
        success: false,
        transactionId,
        results: [],
        error: errorMessage,
      };
    }
  }

  /**
   * Execute as batch (non-transactional)
   */
  private static async executeBatch(
    connectionId: string,
    userId: string,
    entries: Array<{
      resource: FhirWriteResource;
      method: 'POST' | 'PUT' | 'DELETE';
      url?: string;
    }>
  ): Promise<BundleTransactionResult> {
    const transactionId = crypto.randomUUID();

    // Similar to transaction but with type: 'batch'
    // Batch allows partial success
    const connection = await prisma.emrConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return {
        success: false,
        transactionId,
        results: [],
        error: 'EMR connection not found',
      };
    }

    const bundle: FhirBundle = {
      resourceType: 'Bundle',
      type: 'batch',
      entry: entries.map((entry) => ({
        fullUrl: entry.resource.id
          ? `${entry.resource.resourceType}/${entry.resource.id}`
          : this.generateResourceIdentifier(),
        resource: entry.resource as any,
        request: {
          method: entry.method,
          url: entry.url || (entry.resource.id
            ? `${entry.resource.resourceType}/${entry.resource.id}`
            : entry.resource.resourceType),
        },
      })),
    };

    const startTime = Date.now();

    try {
      if (MockFhirService.isEnabled()) {
        const results: WriteResult[] = entries.map((entry, index) => ({
          success: true,
          resourceId: entry.resource.id || `mock-${index}`,
          resourceType: entry.resource.resourceType,
        }));

        return { success: true, transactionId, results };
      }

      const accessToken = await FhirClientService.getValidToken(connectionId, userId);
      const response = await fetch(connection.fhirBaseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/fhir+json',
          Accept: 'application/fhir+json',
        },
        body: JSON.stringify(bundle),
      });

      const responseData = await response.json() as FhirBundle;

      await this.logWriteOperation(
        connectionId,
        userId,
        'BATCH',
        'Bundle',
        transactionId,
        response.status,
        Date.now() - startTime
      );

      const results: WriteResult[] = (responseData.entry || []).map((entry, index) => ({
        success: entry.response?.status?.startsWith('2') ?? false,
        resourceId: entry.resource?.id,
        resourceType: entries[index]?.resource.resourceType || 'Unknown',
      }));

      // Batch is successful even with partial failures
      const allSucceeded = results.every(r => r.success);

      return {
        success: allSucceeded,
        transactionId,
        results,
      };
    } catch (error) {
      return {
        success: false,
        transactionId,
        results: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute requests individually (fallback for vendors without bundle support)
   */
  private static async executeIndividually(
    connectionId: string,
    userId: string,
    entries: Array<{
      resource: FhirWriteResource;
      method: 'POST' | 'PUT' | 'DELETE';
      url?: string;
    }>
  ): Promise<BundleTransactionResult> {
    const transactionId = crypto.randomUUID();
    const results: WriteResult[] = [];

    for (const entry of entries) {
      let result: WriteResult;

      if (entry.method === 'POST') {
        result = await this.createResource(connectionId, userId, entry.resource);
      } else if (entry.method === 'PUT' && entry.resource.id) {
        result = await this.updateResource(connectionId, userId, entry.resource.id, entry.resource);
      } else {
        result = {
          success: false,
          resourceType: entry.resource.resourceType,
          error: 'Unsupported operation for individual execution',
        };
      }

      results.push(result);

      // Stop on first failure for consistency with transaction semantics
      if (!result.success) {
        return {
          success: false,
          transactionId,
          results,
          error: `Operation failed at index ${results.length - 1}: ${result.error}`,
        };
      }
    }

    return {
      success: true,
      transactionId,
      results,
    };
  }

  /**
   * Log write operation for HIPAA audit trail
   */
  private static async logWriteOperation(
    connectionId: string,
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string | undefined,
    responseStatus: number,
    durationMs: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      await prisma.emrAuditLog.create({
        data: {
          connectionId,
          userId,
          action,
          resourceType,
          resourceId,
          requestUrl: `[${action}] ${resourceType}${resourceId ? `/${resourceId}` : ''}`,
          responseStatus,
          durationMs,
          errorMessage,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      // Don't fail the operation if audit logging fails, but log the error
      console.error('[FhirWriter] Failed to create audit log:', error);
    }
  }
}

export default FhirWriterService;
