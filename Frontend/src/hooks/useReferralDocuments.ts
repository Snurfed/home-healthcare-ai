/**
 * useReferralDocuments Hook
 *
 * Manages referral document fetching, uploading, and extraction status
 */

import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useState, useCallback, useEffect } from 'react';
import referralService from '@services/referral.service';
import type {
  ReferralDocument,
  ReferralDocumentType,
  ExtractionStatus,
} from '@typedefs/index';

interface UseReferralDocumentsOptions {
  patientId: string;
  autoRefreshProcessing?: boolean;
  refreshInterval?: number;
}

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  currentFile: string | null;
}

export function useReferralDocuments({
  patientId,
  autoRefreshProcessing = true,
  refreshInterval = 3000,
}: UseReferralDocumentsOptions) {
  const queryClient = useQueryClient();
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    currentFile: null,
  });

  // Fetch referral documents for the patient
  const {
    data: documentsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['referralDocuments', patientId],
    queryFn: () => referralService.listReferrals(patientId),
    enabled: !!patientId,
    staleTime: 30000,
  });

  const documents = documentsData?.data ?? [];

  // Check if any documents are processing
  const hasProcessingDocuments = documents.some(
    (doc) => doc.extractionStatus === 'PROCESSING' || doc.extractionStatus === 'PENDING'
  );

  // Auto-refresh when documents are processing
  useEffect(() => {
    if (!autoRefreshProcessing || !hasProcessingDocuments) return;

    const interval = setInterval(() => {
      refetch();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefreshProcessing, hasProcessingDocuments, refreshInterval, refetch]);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      documentType,
    }: {
      file: File;
      documentType: ReferralDocumentType;
    }) => {
      setUploadState({
        isUploading: true,
        progress: 0,
        error: null,
        currentFile: file.name,
      });

      // Simulate progress since we can't track actual upload progress easily
      const progressInterval = setInterval(() => {
        setUploadState((prev) => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90),
        }));
      }, 200);

      try {
        const result = await referralService.uploadReferral(patientId, file, documentType);
        clearInterval(progressInterval);
        setUploadState((prev) => ({ ...prev, progress: 100 }));
        return result;
      } catch (err) {
        clearInterval(progressInterval);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referralDocuments', patientId] });
      setTimeout(() => {
        setUploadState({
          isUploading: false,
          progress: 0,
          error: null,
          currentFile: null,
        });
      }, 500);
    },
    onError: (err: Error) => {
      setUploadState({
        isUploading: false,
        progress: 0,
        error: err.message || 'Failed to upload document',
        currentFile: null,
      });
    },
  });

  // Get single document with extracted data
  const getDocument = useCallback(async (id: string): Promise<ReferralDocument | null> => {
    try {
      return await referralService.getReferral(id);
    } catch {
      return null;
    }
  }, []);

  // Trigger re-extraction
  const triggerExtraction = useMutation({
    mutationFn: (id: string) => referralService.triggerExtraction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referralDocuments', patientId] });
    },
  });

  // Delete document
  const deleteDocument = useMutation({
    mutationFn: (id: string) => referralService.deleteReferral(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referralDocuments', patientId] });
    },
  });

  // Upload file handler
  const uploadFile = useCallback(
    (file: File, documentType: ReferralDocumentType = 'REFERRAL') => {
      uploadMutation.mutate({ file, documentType });
    },
    [uploadMutation]
  );

  // Get extraction status label
  const getExtractionStatusInfo = useCallback(
    (status: ExtractionStatus): { label: string; color: string; icon: 'spinner' | 'check' | 'error' | 'clock' } => {
      switch (status) {
        case 'PROCESSING':
          return { label: 'Analyzing...', color: 'blue', icon: 'spinner' };
        case 'COMPLETED':
          return { label: 'Ready', color: 'green', icon: 'check' };
        case 'FAILED':
          return { label: 'Failed', color: 'red', icon: 'error' };
        case 'PENDING':
        default:
          return { label: 'Pending', color: 'yellow', icon: 'clock' };
      }
    },
    []
  );

  return {
    documents,
    isLoading,
    error,
    refetch,
    uploadState,
    uploadFile,
    getDocument,
    triggerExtraction: triggerExtraction.mutate,
    deleteDocument: deleteDocument.mutate,
    getExtractionStatusInfo,
    hasProcessingDocuments,
  };
}

export default useReferralDocuments;
