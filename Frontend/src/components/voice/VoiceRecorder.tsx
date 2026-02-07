/**
 * Voice Recorder Component
 *
 * Audio recording UI with visualization, playback preview,
 * and OASIS extraction processing
 */

import { useState, useRef, useEffect } from 'react';
import { useVoiceRecording } from '@hooks/useVoiceRecording';
import { useProcessVoice } from '@hooks/useProcessVoice';
import { Button, Spinner, Alert } from '@components/common';
import type { AssessmentType } from '@typedefs/index';
import type { VoiceProcessingResult } from '@services/voice.service';

// ===========================================
// TYPES
// ===========================================

interface VoiceRecorderProps {
  assessmentId: string;
  assessmentType: AssessmentType;
  patientId: string;
  onExtractionComplete: (results: VoiceProcessingResult['result']) => void;
  onClose: () => void;
}

type RecorderState = 'idle' | 'recording' | 'preview' | 'processing';

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ===========================================
// COMPONENT
// ===========================================

export default function VoiceRecorder({
  assessmentId,
  assessmentType,
  patientId,
  onExtractionComplete,
  onClose,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [processingStage, setProcessingStage] = useState<'transcribing' | 'extracting'>('transcribing');
  const audioRef = useRef<HTMLAudioElement>(null);

  const {
    isPaused,
    duration,
    audioLevel,
    error: recordingError,
    isSupported,
    permissionStatus,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    audioBlob,
    audioUrl,
  } = useVoiceRecording({
    maxDuration: 300, // 5 minutes max
    onRecordingComplete: () => setState('preview'),
  });

  const processVoice = useProcessVoice(assessmentId);

  // Handle processing completion
  useEffect(() => {
    if (processVoice.isSuccess && processVoice.data) {
      onExtractionComplete(processVoice.data.result);
    }
  }, [processVoice.isSuccess, processVoice.data, onExtractionComplete]);

  // Handle start recording
  const handleStartRecording = async () => {
    await startRecording();
    setState('recording');
  };

  // Handle stop recording
  const handleStopRecording = async () => {
    await stopRecording();
    // State will be set to 'preview' by onRecordingComplete callback
  };

  // Handle analyze
  const handleAnalyze = () => {
    if (!audioBlob) return;

    setState('processing');
    setProcessingStage('transcribing');

    processVoice.mutate(
      {
        audioBlob,
        assessmentType,
        patientId,
      },
      {
        onError: () => {
          setState('preview');
        },
      }
    );

    // Simulate stage transition (actual progress comes from API)
    setTimeout(() => setProcessingStage('extracting'), 5000);
  };

  // Handle re-record
  const handleReRecord = () => {
    cancelRecording();
    setState('idle');
    processVoice.reset();
  };

  // Handle cancel
  const handleCancel = () => {
    cancelRecording();
    processVoice.reset();
    onClose();
  };

  // Not supported
  if (!isSupported) {
    return (
      <div className="p-6">
        <Alert variant="error" title="Not Supported">
          Voice recording is not supported in your browser. Please use Chrome, Firefox, or Edge.
        </Alert>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  // Permission denied
  if (permissionStatus === 'denied') {
    return (
      <div className="p-6">
        <Alert variant="error" title="Microphone Access Denied">
          Please allow microphone access in your browser settings to use voice recording.
        </Alert>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Voice Input</h2>
        <button
          onClick={handleCancel}
          className="text-gray-400 hover:text-gray-500"
          disabled={state === 'processing'}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Error display */}
      {(recordingError || processVoice.isError) && (
        <Alert variant="error">
          {recordingError?.message || (processVoice.error as Error)?.message || 'An error occurred'}
        </Alert>
      )}

      {/* Idle State - Start Recording */}
      {state === 'idle' && (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-6">
            Click the microphone to start recording your assessment notes.
            The AI will extract relevant OASIS fields from your speech.
          </p>

          <button
            onClick={handleStartRecording}
            className="w-24 h-24 mx-auto rounded-full bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-200 transition-all"
          >
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </button>

          <p className="text-sm text-gray-500 mt-4">
            Max recording time: 5 minutes
          </p>
        </div>
      )}

      {/* Recording State */}
      {state === 'recording' && (
        <div className="text-center py-8">
          {/* Recording animation */}
          <div className="relative w-32 h-32 mx-auto mb-6">
            {/* Pulsing rings */}
            <div
              className="absolute inset-0 rounded-full bg-red-500 opacity-20 animate-ping"
              style={{ animationDuration: '1.5s' }}
            />
            <div
              className="absolute inset-2 rounded-full bg-red-500 opacity-30 animate-ping"
              style={{ animationDuration: '1.5s', animationDelay: '0.5s' }}
            />

            {/* Center circle with audio level */}
            <div
              className="absolute inset-4 rounded-full bg-red-600 flex items-center justify-center transition-transform"
              style={{ transform: `scale(${1 + audioLevel * 0.3})` }}
            >
              <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
          </div>

          {/* Duration */}
          <div className="text-3xl font-mono font-bold text-gray-900 mb-2">
            {formatDuration(duration)}
          </div>

          <div className="flex items-center justify-center gap-2 text-red-600 mb-6">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="font-medium">{isPaused ? 'Paused' : 'Recording'}</span>
          </div>

          {/* Audio level bar */}
          <div className="w-64 mx-auto h-2 bg-gray-200 rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-red-500 transition-all duration-100"
              style={{ width: `${audioLevel * 100}%` }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            {isPaused ? (
              <Button variant="secondary" onClick={resumeRecording}>
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Resume
              </Button>
            ) : (
              <Button variant="secondary" onClick={pauseRecording}>
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Pause
              </Button>
            )}

            <Button variant="primary" onClick={handleStopRecording}>
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Stop Recording
            </Button>

            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Preview State */}
      {state === 'preview' && audioUrl && (
        <div className="py-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Recording Complete
            </div>
            <p className="text-gray-600">Duration: {formatDuration(duration)}</p>
          </div>

          {/* Audio player */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <audio ref={audioRef} src={audioUrl} controls className="w-full" />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-4">
            <Button variant="secondary" onClick={handleReRecord}>
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Re-record
            </Button>

            <Button variant="primary" onClick={handleAnalyze}>
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Analyze Recording
            </Button>
          </div>
        </div>
      )}

      {/* Processing State */}
      {state === 'processing' && (
        <div className="text-center py-12">
          <div className="mb-6">
            <Spinner size="lg" />
          </div>

          <div className="space-y-2">
            <p className="text-lg font-medium text-gray-900">
              {processingStage === 'transcribing'
                ? 'Transcribing audio...'
                : 'Extracting OASIS fields...'}
            </p>
            <p className="text-sm text-gray-500">
              {processingStage === 'transcribing'
                ? 'Converting speech to text'
                : 'AI is analyzing the transcription'}
            </p>
          </div>

          {/* Progress indicator */}
          <div className="mt-8 max-w-xs mx-auto">
            <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
              <span className={processingStage === 'transcribing' ? 'text-primary-600 font-medium' : 'text-green-600'}>
                {processingStage === 'transcribing' ? '1. Transcribing' : '1. Transcribed'}
              </span>
              <span className={processingStage === 'extracting' ? 'text-primary-600 font-medium' : ''}>
                2. Extracting
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-600 transition-all duration-500"
                style={{ width: processingStage === 'transcribing' ? '40%' : '80%' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      {state === 'idle' && (
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Tips for best results:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>Speak clearly and at a moderate pace</li>
            <li>Include specific details like pain levels, mobility status, and diagnoses</li>
            <li>Mention relevant OASIS items by name when possible</li>
            <li>Use a quiet environment to reduce background noise</li>
          </ul>
        </div>
      )}
    </div>
  );
}
