/**
 * Capture Service
 *
 * Frontend service for the voice capture workflow API
 */

import { apiClient } from './index';

// =============================================================================
// TYPES (API Response types - match backend capture.service.ts)
// =============================================================================

export interface CaptureProcessRequest {
  audioBlob?: Blob;
  documentTexts?: string[];
  patientName?: string;
  patientDob?: string;
  diagnoses?: string[];
  visitType?: string;
  discipline?: string;
}

export interface TranscriptionResult {
  text: string;
  segments: Array<{
    id: string;
    startTime: number;
    endTime: number;
    text: string;
    confidence: number;
  }>;
  language: string;
  duration: number;
  confidence: number;
  processingTimeMs: number;
}

// Backend extracted entity types
export interface BackendDiagnosis {
  code?: string;
  description: string;
  confidence: number;
}

export interface BackendMedication {
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  confidence: number;
}

export interface BackendVital {
  type: string;
  value: string | number;
  unit?: string;
  confidence: number;
}

export interface BackendSymptom {
  description: string;
  severity?: string;
  duration?: string;
  confidence: number;
}

export interface BackendFunctionalStatus {
  activity: string;
  level: string;
  confidence: number;
}

export interface BackendWound {
  location: string;
  type?: string;
  stage?: string;
  measurements?: string;
  confidence: number;
}

export interface BackendPainAssessment {
  location?: string;
  level: number;
  description?: string;
  confidence: number;
}

export interface BackendExtractedEntities {
  diagnoses: BackendDiagnosis[];
  medications: BackendMedication[];
  vitals: BackendVital[];
  symptoms: BackendSymptom[];
  functionalStatus: BackendFunctionalStatus[];
  wounds: BackendWound[];
  painAssessments: BackendPainAssessment[];
}

export interface BackendSoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  interventions?: string;
  patientEducation?: string;
  coordinationOfCare?: string;
  homeboundStatus?: string;
  skilledNeed?: string;
}

export interface BackendEmrFieldAnswer {
  fieldId: string;
  fieldLabel: string;
  section: string;
  type: string;
  required: boolean;
  proposedAnswer: string | number | boolean | string[];
  proposedAnswerLabel?: string;
  confidence: number;
  sources: Array<{
    type: 'audio' | 'document' | 'manual';
    text: string;
    audioTimestamp?: number;
    documentId?: string;
  }>;
}

export interface CaptureProcessResponse {
  success: boolean;
  transcription?: TranscriptionResult;
  transcript?: string;
  extractedEntities?: BackendExtractedEntities;
  soapNote?: BackendSoapNote;
  emrAnswers?: BackendEmrFieldAnswer[];
  visitNarrative?: string;
  processingTimeMs: number;
  error?: string;
}

export interface CaptureHealthResponse {
  status: 'healthy' | 'degraded';
  services: {
    whisper: string;
    claude: string;
  };
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Process a voice capture through the AI pipeline
 */
export async function processCapture(request: CaptureProcessRequest): Promise<CaptureProcessResponse> {
  const formData = new FormData();

  // Add audio file if provided
  if (request.audioBlob) {
    formData.append('audio', request.audioBlob, 'recording.webm');
  }

  // Add document texts if provided
  if (request.documentTexts && request.documentTexts.length > 0) {
    formData.append('documentTexts', JSON.stringify(request.documentTexts));
  }

  // Add patient context
  if (request.patientName) {
    formData.append('patientName', request.patientName);
  }
  if (request.patientDob) {
    formData.append('patientDob', request.patientDob);
  }
  if (request.diagnoses && request.diagnoses.length > 0) {
    formData.append('diagnoses', JSON.stringify(request.diagnoses));
  }

  // Add visit info
  if (request.visitType) {
    formData.append('visitType', request.visitType);
  }
  if (request.discipline) {
    formData.append('discipline', request.discipline);
  }

  const response = await apiClient.post<CaptureProcessResponse>('/capture/process', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 120000, // 2 minute timeout for AI processing
  });

  return response.data;
}

/**
 * Check capture service health
 */
export async function checkCaptureHealth(): Promise<CaptureHealthResponse> {
  const response = await apiClient.get<CaptureHealthResponse>('/capture/health');
  return response.data;
}

// =============================================================================
// DOCUMENT EXTRACTION
// =============================================================================

export interface DocumentExtractionResponse {
  success: boolean;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'jpg' | 'png';
  extractedText: string;
  textLength?: number;
  pageCount?: number;
  warning?: string;
  error?: string;
}

/**
 * Extract text from an uploaded document (PDF, DOCX, image)
 */
export async function extractDocumentText(file: File): Promise<DocumentExtractionResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<DocumentExtractionResponse>('/capture/extract-document', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 180000, // 3 minute timeout for Claude Vision on scanned PDFs
  });

  return response.data;
}

// =============================================================================
// AUDIO RECORDING HELPERS
// =============================================================================

export interface AudioRecorder {
  start: () => Promise<void>;
  stop: () => Promise<Blob>;
  pause: () => void;
  resume: () => void;
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  /**
   * Current input level, 0..1.
   *
   * A muted microphone, a headset that grabbed the input, or a browser that
   * handed back a silent track all record perfectly happily and produce an
   * hour of nothing. There is no way to tell from the timer, which counts up
   * regardless. This is what lets the UI show that sound is arriving.
   */
  getLevel: () => number;
}

/**
 * Create an audio recorder using MediaRecorder API
 */
export function createAudioRecorder(): Promise<AudioRecorder> {
  return new Promise((resolve, reject) => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        let mediaRecorder: MediaRecorder | null = null;
        let audioChunks: Blob[] = [];
        let startTime = 0;
        let pausedDuration = 0;
        let pauseStartTime = 0;
        let isRecording = false;
        let isPaused = false;

        // Tapped off the same stream MediaRecorder uses, so the level reflects
        // what is actually being captured rather than a second device.
        let audioContext: AudioContext | null = null;
        let analyser: AnalyserNode | null = null;
        // Explicitly backed by an ArrayBuffer: getByteTimeDomainData will not
        // accept the SharedArrayBuffer-compatible default.
        let levelBuffer: Uint8Array<ArrayBuffer> | null = null;
        try {
          audioContext = new AudioContext();
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 512;
          levelBuffer = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
          audioContext.createMediaStreamSource(stream).connect(analyser);
        } catch {
          // Level metering is a nicety; never let it stop a visit recording.
          analyser = null;
        }

        const recorder: AudioRecorder = {
          get isRecording() { return isRecording; },
          get isPaused() { return isPaused; },

          getLevel: () => {
            if (!analyser || !levelBuffer || !isRecording || isPaused) return 0;
            analyser.getByteTimeDomainData(levelBuffer);
            // Root mean square around the 128 midpoint, scaled so ordinary
            // speech lands near the middle of the meter rather than pinned low.
            let sum = 0;
            for (let i = 0; i < levelBuffer.length; i++) {
              const v = (levelBuffer[i]! - 128) / 128;
              sum += v * v;
            }
            return Math.min(1, Math.sqrt(sum / levelBuffer.length) * 4);
          },
          get duration() {
            if (!isRecording) return 0;
            const elapsed = Date.now() - startTime - pausedDuration;
            if (isPaused) {
              return Math.floor((pauseStartTime - startTime - pausedDuration) / 1000);
            }
            return Math.floor(elapsed / 1000);
          },

          start: async () => {
            audioChunks = [];
            mediaRecorder = new MediaRecorder(stream, {
              mimeType: 'audio/webm;codecs=opus',
            });

            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                audioChunks.push(event.data);
              }
            };

            mediaRecorder.start(1000); // Collect data every second
            startTime = Date.now();
            pausedDuration = 0;
            isRecording = true;
            isPaused = false;
          },

          stop: () => {
            return new Promise((resolveStop) => {
              if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.onstop = () => {
                  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                  isRecording = false;
                  isPaused = false;
                  resolveStop(audioBlob);
                };
                mediaRecorder.stop();
              } else {
                resolveStop(new Blob([], { type: 'audio/webm' }));
              }
            });
          },

          pause: () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
              mediaRecorder.pause();
              pauseStartTime = Date.now();
              isPaused = true;
            }
          },

          resume: () => {
            if (mediaRecorder && mediaRecorder.state === 'paused') {
              mediaRecorder.resume();
              pausedDuration += Date.now() - pauseStartTime;
              isPaused = false;
            }
          },
        };

        resolve(recorder);
      })
      .catch(reject);
  });
}

// =============================================================================
// EXPORT
// =============================================================================

export default {
  processCapture,
  checkCaptureHealth,
  createAudioRecorder,
  extractDocumentText,
};
