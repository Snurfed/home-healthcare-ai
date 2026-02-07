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
} from './queries/useAssessments';

// Patient hooks
export {
  usePatientSearch,
  usePatient,
  useCreatePatient,
} from './queries/usePatients';

// Episode hooks
export {
  usePatientEpisodes,
  useCreateEpisode,
  useEpisode,
} from './queries/useEpisodes';

// Utility hooks
export { useAutoSave } from './useAutoSave';
export { useSkipLogic } from './useSkipLogic';
export { useSectionValidation } from './useSectionValidation';
export { useAssessmentValidation } from './useAssessmentValidation';
