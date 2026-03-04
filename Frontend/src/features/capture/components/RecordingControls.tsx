/**
 * Recording Controls
 *
 * Big record button with start/pause/stop controls.
 * Shows recording duration and visual feedback.
 */

import type { RecordingStatus } from '@/types/capture.types';

interface RecordingControlsProps {
  status: RecordingStatus;
  duration: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  disabled?: boolean;
}

const MicrophoneIcon = ({ className = 'w-8 h-8' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const PauseIcon = ({ className = 'w-8 h-8' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
  </svg>
);

const PlayIcon = ({ className = 'w-8 h-8' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const StopIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function RecordingControls({
  status,
  duration,
  onStart,
  onPause,
  onResume,
  onStop,
  disabled,
}: RecordingControlsProps) {
  const isIdle = status === 'idle';
  const isRecording = status === 'recording';
  const isPaused = status === 'paused';
  const isComplete = status === 'complete';

  return (
    <div className="flex flex-col items-center">
      {/* Duration Display */}
      <div className="mb-6">
        <span className={`text-5xl font-mono font-light ${isRecording ? 'text-red-600' : 'text-gray-700'}`}>
          {formatDuration(duration)}
        </span>
      </div>

      {/* Main Controls */}
      <div className="flex items-center gap-4">
        {/* Main Record/Pause Button */}
        {isIdle && (
          <button
            onClick={onStart}
            disabled={disabled}
            className="relative w-24 h-24 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <MicrophoneIcon className="w-10 h-10" />
            <span className="absolute -bottom-8 text-sm font-medium text-gray-600 group-hover:text-gray-900">
              Start Recording
            </span>
          </button>
        )}

        {isRecording && (
          <div className="flex items-center gap-6">
            <button
              onClick={onPause}
              className="w-16 h-16 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white flex items-center justify-center shadow-lg transition-all"
            >
              <PauseIcon className="w-8 h-8" />
            </button>

            <div className="relative">
              <button
                onClick={onStop}
                className="w-24 h-24 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg animate-pulse"
              >
                <div className="w-6 h-6 bg-white rounded-sm" />
              </button>
              {/* Recording indicator */}
              <span className="absolute -top-2 -right-2 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
              </span>
            </div>
          </div>
        )}

        {isPaused && (
          <div className="flex items-center gap-6">
            <button
              onClick={onResume}
              className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-lg transition-all"
            >
              <PlayIcon className="w-8 h-8" />
            </button>

            <button
              onClick={onStop}
              className="w-24 h-24 rounded-full bg-gray-400 hover:bg-gray-500 text-white flex items-center justify-center shadow-lg transition-all"
            >
              <StopIcon className="w-10 h-10" />
            </button>
          </div>
        )}

        {isComplete && (
          <div className="text-center">
            <div className="w-24 h-24 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-2">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">Recording complete</p>
          </div>
        )}
      </div>

      {/* Status Text */}
      <div className="mt-6 text-center">
        {isIdle && (
          <p className="text-sm text-gray-500">
            Tap to start recording your visit
          </p>
        )}
        {isRecording && (
          <p className="text-sm text-red-600 font-medium">
            Recording in progress...
          </p>
        )}
        {isPaused && (
          <p className="text-sm text-yellow-600 font-medium">
            Recording paused
          </p>
        )}
      </div>

      {/* Tips */}
      {isIdle && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg max-w-md">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Speak naturally during the visit. The AI will extract vitals, diagnoses, medications, and generate your documentation.
          </p>
        </div>
      )}
    </div>
  );
}

export default RecordingControls;
