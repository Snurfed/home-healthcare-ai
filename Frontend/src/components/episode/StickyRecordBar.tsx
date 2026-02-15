/**
 * Sticky Record Bar (NestMed Style)
 *
 * Persistent bottom bar with:
 * - View Uploads link with indicator
 * - "Press button to start recording" text
 * - Large green Start Recording button
 * - Timer
 */

import { useCallback, useEffect, useRef } from 'react';
import { useEpisodeStore } from '@context/stores/episodeStore';

interface StickyRecordBarProps {
  uploadCount?: number;
  onViewUploads?: () => void;
  onRecordingComplete?: (audioBlob: Blob) => void;
}

export default function StickyRecordBar({
  uploadCount = 0,
  onViewUploads,
  onRecordingComplete,
}: StickyRecordBarProps) {
  const {
    isRecording,
    recordingDuration,
    setIsRecording,
    setRecordingDuration,
  } = useEpisodeStore();

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecordingComplete?.(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, [onRecordingComplete, setIsRecording, setRecordingDuration]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording, setIsRecording]);

  // Update timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration(recordingDuration + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, recordingDuration, setRecordingDuration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg safe-area-pb">
      <div className="px-4 py-3">
        {/* Top Row: Uploads + Instructions + Timer */}
        <div className="flex items-center justify-between mb-3">
          {/* View Uploads */}
          <button
            onClick={onViewUploads}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <span className="relative">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {uploadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full" />
              )}
            </span>
            <span>View Uploads ({uploadCount})</span>
          </button>

          {/* Timer */}
          <div className="flex items-center gap-2">
            {isRecording && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
            )}
            <span
              className={`font-mono text-lg ${
                isRecording ? 'text-red-600 font-semibold' : 'text-gray-400'
              }`}
            >
              {formatDuration(recordingDuration)}
            </span>
          </div>
        </div>

        {/* Instructions */}
        {!isRecording && (
          <p className="text-center text-sm text-gray-500 mb-3">
            Press button to start recording
          </p>
        )}

        {/* Record Button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`
            w-full flex items-center justify-center gap-3 py-4 rounded-xl font-semibold text-white
            transition-all min-h-[56px]
            ${isRecording
              ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200'
              : 'bg-green-500 hover:bg-green-600 shadow-lg shadow-green-200'
            }
          `}
        >
          {isRecording ? (
            <>
              {/* Stop icon */}
              <span className="w-5 h-5 bg-white rounded-sm" />
              <span>Stop Recording</span>
            </>
          ) : (
            <>
              {/* Mic icon */}
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              <span>Start Recording</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
