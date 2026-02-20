/**
 * Type Exports
 *
 * Central export file for all TypeScript types
 */

// Auth types
export type {
  UserRole,
  UserStatus,
  User,
  LoginCredentials,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  JWTPayload,
  AuthState,
  AuthActions,
} from './auth.types';

export { ROLE_PERMISSIONS } from './auth.types';

// OASIS types
export type {
  AssessmentStatus,
  AssessmentType,
  ResponseType,
  SourceType,
  OASISSectionId,
  OASISSection,
  QuestionOption,
  ValidationRule,
  SkipLogicCondition,
  OASISQuestion,
  OASISResponse,
  SectionProgress,
  ValidationError,
  ScoringResult,
  HIPPSCodePosition,
  HIPPSCodeBreakdown,
  ClinicalGroupingDetails,
  ComorbidityDetails,
  ReimbursementEstimate,
  OptimizationSuggestion,
  EnhancedScoringResult,
  HIPPSDetailsResponse,
  HIPPSDetailsOptions,
  PatientSummary,
  EpisodeSummary,
  UserSummary,
  OASISAssessment,
  AssessmentListItem,
  CreateAssessmentRequest,
  UpdateAssessmentRequest,
  SubmitForReviewRequest,
  ReviewAssessmentRequest,
  ListAssessmentsParams,
  QuestionLibraryParams,
  ValidationResponse,
} from './oasis.types';

export {
  OASIS_SECTIONS,
  ASSESSMENT_TYPE_LABELS,
  STATUS_CONFIG,
} from './oasis.types';

// API types
export type {
  PaginatedResponse,
  PaginationMeta,
  ApiErrorResponse,
  ValidationErrorResponse,
  SuccessResponse,
  ApiResponse,
  RequestOptions,
  SortOrder,
  BaseListParams,
  SearchParams,
  DateRangeFilter,
  ApiClientConfig,
  HttpMethod,
  RateLimitError,
  AuthErrorCode,
  AuthErrorResponse,
} from './api.types';

export {
  TOKEN_KEYS,
  API_ENDPOINTS,
} from './api.types';

// Suggestion types
export type {
  SuggestionType,
  SuggestionPriority,
  FinancialDirection,
  RelatedQuestion,
  FinancialImpact,
  QuestionSuggestion,
  DismissalReason,
  SuggestionDismissal,
  GetSuggestionsRequest,
  GetSuggestionsResponse,
  DismissSuggestionRequest,
  SuggestionsSummary,
} from './suggestion.types';

export {
  SUGGESTION_TYPE_CONFIG,
  SUGGESTION_PRIORITY_CONFIG,
} from './suggestion.types';

// Referral types
export type {
  ReferralDocumentType,
  ExtractionStatus,
  FieldAcceptanceState,
  ExtractedOASISField,
  ExtractedDemographics,
  ExtractedDiagnosis,
  ExtractedMedication,
  ExtractedOrder,
  ExtractionResult,
  ReferralDocument,
  ReferralListItem,
  UploadReferralRequest,
  UploadReferralResponse,
  ExtractionStatusResponse,
  ApplyExtractionRequest,
  ApplyExtractionResponse,
  ReviewFieldState,
  ExtractionReviewState,
} from './referral.types';

export {
  DOCUMENT_TYPE_LABELS,
  EXTRACTION_STATUS_CONFIG,
} from './referral.types';

// SOAP Note types
export type {
  SoapNoteStatus,
  SoapSection,
  SoapNotePatient,
  SoapNoteUser,
  SoapNoteAssessment,
  SoapNote,
  SoapNoteListItem,
  GenerateSoapNoteRequest,
  GenerateSoapNoteResponse,
  UpdateSoapNoteRequest,
  UpdateSoapNoteStatusRequest,
  RegenerateSectionRequest,
  RegenerateSectionResponse,
  SoapNotesListParams,
  SoapNotesListResponse,
  SoapNoteValidation,
} from './soapNote.types';

export {
  SOAP_STATUS_CONFIG,
  SOAP_SECTION_CONFIG,
} from './soapNote.types';

// Settings types
export type {
  AgencySettings,
  AgencySettingsInput,
  OasisDefaultField,
  OasisDefaults,
  SystemAutoFillCode,
} from './settings.types';

export {
  SYSTEM_AUTOFILL_CODES,
  isSystemAutoFillField,
} from './settings.types';

// Communication types
export type {
  CommunicationType,
  CommunicationUrgency,
  CommunicationStatus,
  CommunicationTrigger,
  CommunicationTriggerWithStatus,
  TriggerSummary,
  PhysicianCommunication,
  GetTriggersResponse,
  DetectTriggersRequest,
  DetectTriggersResponse,
  DismissTriggerRequest,
  GenerateCommunicationRequest,
  GenerateCommunicationResponse,
  UpdateCommunicationRequest,
  RegenerateCommunicationRequest,
  ListCommunicationsResponse,
} from './communication.types';

export {
  COMMUNICATION_TYPE_CONFIG,
  COMMUNICATION_URGENCY_CONFIG,
  COMMUNICATION_STATUS_CONFIG,
} from './communication.types';

// Clinical Events types
export type {
  ClinicalEventType,
  TriggerPriority,
  DetectionMethod,
  KeywordMatch,
  AIDetection,
  CombinedDetection,
  DetectedClinicalEvent,
  KeywordDetectionRequest,
  KeywordDetectionResponse,
  FullDetectionRequest,
  FullDetectionResponse,
  PendingEventsResponse,
  TriggerConfig,
  ClinicalEventAlert,
} from './clinicalEvents.types';

export {
  PRIORITY_CONFIG,
  EVENT_TYPE_CONFIG,
} from './clinicalEvents.types';

// Integration types
export type {
  IntegrationProvider,
  NotificationChannel,
  SendMethod,
  IntegrationStatus,
  SMTPConfigRequest,
  SendNotificationRequest,
  SendNotificationResponse,
  SendLogEntry,
} from './integration.types';

export { PROVIDER_CONFIG } from './integration.types';

// EMR Integration types
export type {
  EmrVendor,
  EmrConnection,
  CreateEmrConnectionRequest,
  UpdateEmrConnectionRequest,
  ConnectionTestResult,
  ConnectionStatus,
  EmrPatientSearchParams,
  EmrPatientSearchResult,
  EmrPatientImportData,
  EmrPatientDetail,
  DuplicateCheckResult,
  ImportPatientRequest,
  ImportPatientResponse,
} from './emr.types';

export { EMR_VENDOR_CONFIG } from './emr.types';
