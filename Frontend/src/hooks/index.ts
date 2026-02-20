/**
 * Hook Exports
 */

// Auth hooks
export {
  useCurrentUser,
  useLogin,
  useLogout,
  useRefreshSession,
  usePermission,
  useHasRole,
} from './queries/useAuth';

// Assessment hooks
export {
  useAssessments,
  useAssessment,
  useCreateAssessment,
  useUpdateAssessment,
  useSubmitForReview,
  useReviewAssessment,
  useLockAssessment,
  useDeleteAssessment,
  useQuestions,
  useCalculateScore,
  useValidateAssessment,
} from './queries/useAssessments';

// Patient hooks
export {
  usePatientSearch,
  usePatients,
  usePatient,
  useCreatePatient,
  usePatientAssessmentTimeline,
} from './queries/usePatients';

// Episode hooks
export {
  usePatientEpisodes,
  useCreateEpisode,
  useEpisode,
} from './queries/useEpisodes';

// Supervisor hooks
export {
  useSupervisorStats,
  usePendingReviews,
  useRecentActivity,
} from './queries/useSupervisor';

// Utility hooks
export { useAutoSave } from './useAutoSave';
export { useSkipLogic } from './useSkipLogic';
export { useSectionValidation } from './useSectionValidation';
export { useAssessmentValidation } from './useAssessmentValidation';
export { useSuggestions } from './useSuggestions';

// Voice hooks
export { useVoiceRecording } from './useVoiceRecording';
export { useProcessVoice } from './useProcessVoice';

// Communication hooks
export { useCommunicationTriggers } from './useCommunicationTriggers';

// Referral document hooks
export { useReferralDocuments } from './useReferralDocuments';

// Clinical events hooks
export {
  useRealtimeDetection,
  useFullDetection,
  usePendingEvents,
  useAcknowledgeEvent,
  useDismissEvent,
  useClinicalEventAlerts,
  useTriggerConfigs,
  useUpdateTriggerConfig,
  clinicalEventsKeys,
} from './useClinicalEvents';

// EMR integration hooks
export {
  useEmrConnections,
  useEmrConnectionStatus,
  useCreateEmrConnection,
  useUpdateEmrConnection,
  useDeleteEmrConnection,
  useTestEmrConnection,
  useEmrAuthorize,
  useEmrPatientSearch,
  useEmrPatient,
  useCheckDuplicates,
  useImportEmrPatient,
  emrQueryKeys,
} from './queries/useEmr';

// Visit note hooks
export {
  useVisitNoteQuery,
  useEpisodeDashboard,
  useEpisodeVisitNotes,
  useCreateVisitNote,
  useUpdateVisitNote,
  useGenerateAIDraft,
  useFinalizeVisitNote,
  useVisitNoteAutoSave,
  useVisitNote,
  visitNoteKeys,
} from './useVisitNote';

// Plan of Care hooks
export {
  usePlanOfCareQuery,
  useCreatePlanOfCare,
  useUpdatePlanOfCare,
  useAutoPopulateFromOasis,
  useSignPlanOfCare,
  usePlanOfCare,
  planOfCareKeys,
} from './usePlanOfCare';

// Form Engine hooks
export {
  useForm,
  useVisitForm,
  useFormDefinitions,
  useFormDefinition,
  useSections,
  useSaveResponses,
  useToggleModule,
  useValidateVisitNote,
  useValidateOnDemand,
  useSearchQuestions,
  useQuestion,
  formEngineQueryKeys,
} from './queries/useFormEngine';

// EMR Export hooks
export {
  useTemplates,
  useAllTemplates,
  useTemplate,
  useExportPreview,
  useGenerateExport,
  useCopyToClipboard,
  useExportAndCopy,
  useAuditEvents,
  emrExportQueryKeys,
} from './queries/useEmrExport';
