/**
 * FHIR Services Index
 *
 * Exports all FHIR-related services for EMR integration
 */

// Types
export * from './fhirTypes';

// Services
export { FhirClientService, encryptToken, decryptToken } from './fhirClient.service';
export { FhirWriterService } from './fhirWriter.service';
export type {
  FhirObservation,
  FhirCondition,
  FhirProcedure,
  FhirPatientWrite,
  FhirWriteResource,
  ValidationResult,
  WriteResult,
  BundleTransactionResult,
} from './fhirWriter.service';
export { MockFhirService } from './mockFhir.service';
export * from './emrMapping.service';
