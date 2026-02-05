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
