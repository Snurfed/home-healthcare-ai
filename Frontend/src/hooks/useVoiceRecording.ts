/**
 * Voice Recording Hook
 *
 * Uses MediaRecorder API for browser-based audio recording
 * with audio level monitoring and microphone permission handling
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ===========================================
// TYPES
// ===========================================

export interface UseVoiceRecordingOptions {
  maxDuration?: number; // Max recording duration in seconds (default: 300 = 5 min)
  onRecordingComplete?: (blob: Blob) => void;
  onError?: (error: Error) => void;
}

export interface UseVoiceRecordingReturn {
  // State
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
  error: Error | null;
  isSupported: boolean;
  permissionStatus: 'prompt' | 'granted' | 'denied' | 'unknown';

  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;

  // Audio data
  audioBlob: Blob | null;
  audioUrl: string | null;
}

// ===========================================
// HOOK IMPLEMENTATION
// ===========================================

export function useVoiceRecording(
  options: UseVoiceRecordingOptions = {}
): UseVoiceRecordingReturn {
  const { maxDuration = 300, onRecordingComplete, onError } = options;

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<
    'prompt' | 'granted' | 'denied' | 'unknown'
  >('unknown');

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const levelIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check browser support
  const isSupported =
    typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    !!window.MediaRecorder;

  // Check permission status
  useEffect(() => {
    if (!isSupported) return;

    navigator.permissions
      ?.query({ name: 'microphone' as PermissionName })
      .then((result) => {
        setPermissionStatus(result.state as 'prompt' | 'granted' | 'denied');
        result.onchange = () => {
          setPermissionStatus(result.state as 'prompt' | 'granted' | 'denied');
        };
      })
      .catch(() => {
        setPermissionStatus('unknown');
      });
  }, [isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (levelIntervalRef.current) {
      clearInterval(levelIntervalRef.current);
      levelIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!isSupported) {
      const err = new Error('Voice recording is not supported in this browser');
      setError(err);
      onError?.(err);
      return;
    }

    try {
      // Reset state
      setError(null);
      setAudioBlob(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      chunksRef.current = [];
      setDuration(0);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Optimal for Whisper
        },
      });
      streamRef.current = stream;
      setPermissionStatus('granted');

      // Set up audio analysis for level meter
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onerror = (e) => {
        const err = new Error(`Recording error: ${(e as ErrorEvent).message || 'Unknown error'}`);
        setError(err);
        onError?.(err);
        cleanup();
      };

      // Start recording
      mediaRecorderRef.current.start(1000); // Collect data every second
      setIsRecording(true);
      setIsPaused(false);

      // Start duration timer
      const startTime = Date.now();
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setDuration(elapsed);

        // Auto-stop at max duration
        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 1000);

      // Start audio level monitoring
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      levelIntervalRef.current = setInterval(() => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setAudioLevel(average / 255);
        }
      }, 100);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to start recording');

      if (error.name === 'NotAllowedError') {
        setPermissionStatus('denied');
        error.message = 'Microphone permission denied. Please allow microphone access.';
      }

      setError(error);
      onError?.(error);
      cleanup();
    }
  }, [isSupported, maxDuration, audioUrl, onError, cleanup]);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });

        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        setIsRecording(false);
        setIsPaused(false);
        setAudioLevel(0);

        cleanup();

        onRecordingComplete?.(blob);
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
    });
  }, [isRecording, cleanup, onRecordingComplete]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
  }, [isRecording, isPaused]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      // Restart duration timer from current duration
      const startTime = Date.now() - duration * 1000;
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setDuration(elapsed);

        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 1000);
    }
  }, [isRecording, isPaused, duration, maxDuration, stopRecording]);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    setAudioLevel(0);
    setAudioBlob(null);
    setAudioUrl(null);

    cleanup();
  }, [audioUrl, cleanup]);

  return {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    error,
    isSupported,
    permissionStatus,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    audioBlob,
    audioUrl,
  };
}

export default useVoiceRecording;
