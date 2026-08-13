/**
 * EMR Services Index
 *
 * Exports all EMR-related services for EMR sync and integration
 */

// EMR Sync Service
export { EmrSyncService } from './emrSync.service';
export type {
  SyncJobResult,
  SyncError,
  VisitSyncData,
  AssessmentSyncData,
  SyncConfig,
} from './emrSync.service';

// PointCare Adapter
export { PointCareAdapterService } from './pointcareAdapter.service';
export type {
  PointCareConfig,
  PointCarePatientSearchParams,
  PointCareVisitData,
  PointCareOasisData,
  PointCareResponse,
} from './pointcareAdapter.service';
