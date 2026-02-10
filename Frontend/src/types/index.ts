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
