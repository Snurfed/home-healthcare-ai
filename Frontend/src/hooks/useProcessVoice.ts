/**
 * Process Voice Hook
 *
 * React Query mutation hook for voice processing API
 */

import { useMutation, useQueryClient } from 'react-query';
import { voiceService, VoiceProcessingResult } from '@services/voice.service';
import { queryKeys } from '@context/QueryProvider';
import type { AssessmentType } from '@typedefs/index';

export interface ProcessVoiceParams {
  audioBlob: Blob;
  assessmentType: AssessmentType;
  patientId: string;
}

export function useProcessVoice(assessmentId: string) {
  const queryClient = useQueryClient();

  return useMutation<VoiceProcessingResult, Error, ProcessVoiceParams>({
    mutationFn: async ({ audioBlob, assessmentType, patientId }) => {
      return voiceService.processOasisVoice(
        audioBlob,
        assessmentId,
        assessmentType,
        patientId
      );
    },
    onSuccess: () => {
      // Invalidate assessment query to refresh with any auto-saved fields
      queryClient.invalidateQueries(queryKeys.assessments.detail(assessmentId));
    },
  });
}

export default useProcessVoice;
