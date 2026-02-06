/**
 * Episode Query Hooks
 *
 * React Query hooks for episode operations
 */

import { useQuery, useMutation, useQueryClient } from 'react-query';
import { queryKeys } from '@context/QueryProvider';
import { episodeService } from '@services/index';
import type { Episode, CreateEpisodeRequest, ListEpisodesResponse } from '@services/episode.service';

/**
 * Hook to get episodes for a patient
 */
export function usePatientEpisodes(patientId: string | undefined, includeEnded = false) {
  return useQuery<ListEpisodesResponse, Error>(
    queryKeys.episodes.byPatient(patientId || ''),
    () => episodeService.getPatientEpisodes(patientId!, includeEnded),
    {
      enabled: !!patientId,
    }
  );
}

/**
 * Hook to create a new episode
 */
export function useCreateEpisode(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ message: string; episode: Episode }, Error, CreateEpisodeRequest>(
    (data) => episodeService.createEpisode(patientId, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(queryKeys.episodes.byPatient(patientId));
      },
    }
  );
}

/**
 * Hook to get a single episode
 */
export function useEpisode(id: string | undefined) {
  return useQuery<Episode, Error>(
    queryKeys.episodes.detail(id || ''),
    () => episodeService.getEpisode(id!),
    {
      enabled: !!id,
    }
  );
}
