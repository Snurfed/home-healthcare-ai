/**
 * Capture Store
 *
 * Zustand store for visit capture workflow state
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  VisitCapture,
  CaptureStatus,
  RecordingStatus,
  ReferralDocument,
  ExtractedEntities,
  EmrTemplate,
  EmrAnswerMap,
  TimelineItem,
} from '@/types/capture.types';

interface CaptureState {
  // Current capture session
  currentCapture: VisitCapture | null;

  // Recording state
  recordingStatus: RecordingStatus;
  recordingDuration: number;
  isRecording: boolean;
  isPaused: boolean;

  // Processing state
  isProcessing: boolean;
  processingProgress: number;
  processingMessage: string;

  // Timeline
  timeline: TimelineItem[];

  // EMR Template
  emrTemplate: EmrTemplate | null;

  // Actions
  initCapture: (patientId: string, episodeId: string, visitType: string, discipline: string) => void;
  setEmrTemplate: (template: EmrTemplate) => void;

  // Recording actions
  startRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  setRecordingDuration: (duration: number) => void;

  // Document actions
  addDocument: (document: ReferralDocument) => void;
  removeDocument: (documentId: string) => void;
  updateDocument: (documentId: string, updates: Partial<ReferralDocument>) => void;
  updateDocumentStatus: (documentId: string, status: ReferralDocument['extractionStatus']) => void;

  // Processing actions
  startProcessing: () => void;
  updateProcessingProgress: (progress: number, message: string) => void;
  setExtractedEntities: (entities: ExtractedEntities) => void;
  setEmrAnswerMap: (answerMap: EmrAnswerMap) => void;

  // Timeline actions
  addTimelineItem: (item: Omit<TimelineItem, 'id' | 'timestamp'>) => void;

  // Status actions
  setStatus: (status: CaptureStatus) => void;

  // Visit info actions
  setVisitInfo: (info: { timeIn?: string; timeOut?: string; location?: string }) => void;

  // Reset
  resetCapture: () => void;
}

const initialState = {
  currentCapture: null,
  recordingStatus: 'idle' as RecordingStatus,
  recordingDuration: 0,
  isRecording: false,
  isPaused: false,
  isProcessing: false,
  processingProgress: 0,
  processingMessage: '',
  timeline: [] as TimelineItem[],
  emrTemplate: null,
};

export const useCaptureStore = create<CaptureState>()(
  persist(
    (set, get) => ({
  ...initialState,

  initCapture: (patientId, episodeId, visitType, discipline) => {
    // Check if there's an existing capture for this patient/episode
    const existing = get().currentCapture;
    if (existing && existing.patientId === patientId && existing.episodeId === episodeId) {
      // Resume existing capture
      return;
    }

    const captureId = `capture_${Date.now()}`;
    const visitId = `visit_${Date.now()}`;

    const capture: VisitCapture = {
      id: captureId,
      visitId,
      patientId,
      episodeId,
      visitType,
      discipline,
      visitDate: new Date().toISOString().split('T')[0] ?? new Date().toISOString().substring(0, 10),
      status: 'ready',
      referralDocuments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set({
      currentCapture: capture,
      recordingStatus: 'idle',
      recordingDuration: 0,
      isRecording: false,
      isPaused: false,
      timeline: [],
    });
  },

  setEmrTemplate: (template) => {
    set({ emrTemplate: template });
  },

  startRecording: () => {
    const { addTimelineItem, currentCapture } = get();

    set({
      recordingStatus: 'recording',
      isRecording: true,
      isPaused: false,
      currentCapture: currentCapture ? { ...currentCapture, status: 'capturing' } : null,
    });

    addTimelineItem({
      type: 'recording_started',
      title: 'Recording started',
      description: 'Voice capture in progress',
    });
  },

  pauseRecording: () => {
    const { addTimelineItem } = get();

    set({
      recordingStatus: 'paused',
      isPaused: true,
    });

    addTimelineItem({
      type: 'recording_paused',
      title: 'Recording paused',
    });
  },

  resumeRecording: () => {
    const { addTimelineItem } = get();

    set({
      recordingStatus: 'recording',
      isPaused: false,
    });

    addTimelineItem({
      type: 'recording_resumed',
      title: 'Recording resumed',
    });
  },

  stopRecording: () => {
    const { addTimelineItem, recordingDuration } = get();

    set({
      recordingStatus: 'complete',
      isRecording: false,
      isPaused: false,
    });

    addTimelineItem({
      type: 'recording_stopped',
      title: 'Recording complete',
      description: `Duration: ${Math.floor(recordingDuration / 60)}:${String(recordingDuration % 60).padStart(2, '0')}`,
    });
  },

  setRecordingDuration: (duration) => {
    set({ recordingDuration: duration });
  },

  addDocument: (document) => {
    const { currentCapture, addTimelineItem } = get();
    if (!currentCapture) return;

    set({
      currentCapture: {
        ...currentCapture,
        referralDocuments: [...currentCapture.referralDocuments, document],
      },
    });

    addTimelineItem({
      type: 'document_uploaded',
      title: 'Document uploaded',
      description: document.fileName,
    });
  },

  removeDocument: (documentId) => {
    const { currentCapture } = get();
    if (!currentCapture) return;

    set({
      currentCapture: {
        ...currentCapture,
        referralDocuments: currentCapture.referralDocuments.filter(d => d.id !== documentId),
      },
    });
  },

  updateDocument: (documentId, updates) => {
    const { currentCapture } = get();
    if (!currentCapture) return;

    set({
      currentCapture: {
        ...currentCapture,
        referralDocuments: currentCapture.referralDocuments.map(d =>
          d.id === documentId ? { ...d, ...updates } : d
        ),
      },
    });
  },

  updateDocumentStatus: (documentId, status) => {
    const { currentCapture } = get();
    if (!currentCapture) return;

    set({
      currentCapture: {
        ...currentCapture,
        referralDocuments: currentCapture.referralDocuments.map(d =>
          d.id === documentId ? { ...d, extractionStatus: status } : d
        ),
      },
    });
  },

  startProcessing: () => {
    const { currentCapture, addTimelineItem } = get();

    set({
      isProcessing: true,
      processingProgress: 0,
      processingMessage: 'Starting analysis...',
      currentCapture: currentCapture ? { ...currentCapture, status: 'processing' } : null,
    });

    addTimelineItem({
      type: 'extraction_started',
      title: 'AI analysis started',
      description: 'Processing audio and documents',
    });
  },

  updateProcessingProgress: (progress, message) => {
    set({
      processingProgress: progress,
      processingMessage: message,
    });
  },

  setExtractedEntities: (entities) => {
    const { currentCapture, addTimelineItem } = get();
    if (!currentCapture) return;

    // Count entities
    const entityCounts = {
      diagnoses: entities.diagnoses?.length || 0,
      medications: entities.medications?.length || 0,
      vitals: entities.vitals?.length || 0,
      wounds: entities.wounds?.length || 0,
    };

    const totalEntities = Object.values(entityCounts).reduce((a, b) => a + b, 0);

    set({
      currentCapture: {
        ...currentCapture,
        extractedEntities: entities,
      },
    });

    addTimelineItem({
      type: 'entity_extracted',
      title: 'Entities extracted',
      description: `Found ${totalEntities} clinical items`,
      entityCount: totalEntities,
    });
  },

  setEmrAnswerMap: (answerMap) => {
    const { currentCapture, addTimelineItem } = get();
    if (!currentCapture) return;

    set({
      isProcessing: false,
      processingProgress: 100,
      processingMessage: 'Complete',
      currentCapture: {
        ...currentCapture,
        status: 'review',
        emrAnswerMap: answerMap,
      },
    });

    addTimelineItem({
      type: 'emr_mapped',
      title: 'EMR fields mapped',
      description: `${answerMap.filledFields}/${answerMap.totalFields} fields populated`,
    });

    if (answerMap.soapNote) {
      addTimelineItem({
        type: 'soap_generated',
        title: 'SOAP note generated',
        description: 'Ready for review',
      });
    }
  },

  addTimelineItem: (item) => {
    const newItem: TimelineItem = {
      id: `timeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...item,
    };

    set((state) => ({
      timeline: [...state.timeline, newItem],
    }));
  },

  setStatus: (status) => {
    const { currentCapture } = get();
    if (!currentCapture) return;

    set({
      currentCapture: {
        ...currentCapture,
        status,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  setVisitInfo: (info) => {
    const { currentCapture } = get();
    if (!currentCapture) return;

    set({
      currentCapture: {
        ...currentCapture,
        ...info,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  resetCapture: () => {
    set(initialState);
  },
    }),
    {
      name: 'capture-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist the capture data, not transient recording state
      partialize: (state) => ({
        currentCapture: state.currentCapture,
        timeline: state.timeline,
        emrTemplate: state.emrTemplate,
      }),
    }
  )
);

export default useCaptureStore;
