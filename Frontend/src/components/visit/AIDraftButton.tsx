/**
 * AIDraftButton Component
 *
 * Button to trigger AI draft generation for a section or question.
 * Shows loading state and success/error feedback.
 */

import { useState, useCallback } from 'react';
import { Spinner } from '@components/common';

interface AIDraftButtonProps {
  onGenerate: () => Promise<void>;
  disabled?: boolean;
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

// Sparkles icon for AI
const SparklesIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
    />
  </svg>
);

export default function AIDraftButton({
  onGenerate,
  disabled = false,
  size = 'sm',
  label,
  className = '',
}: AIDraftButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    if (isGenerating || disabled) return;

    setIsGenerating(true);
    setError(null);
    setShowSuccess(false);

    try {
      await onGenerate();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsGenerating(false);
    }
  }, [onGenerate, isGenerating, disabled]);

  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isGenerating}
      className={`
        inline-flex items-center gap-1.5 rounded-md font-medium
        transition-all duration-200
        ${sizeClasses}
        ${
          showSuccess
            ? 'bg-green-100 text-green-700 border border-green-300'
            : error
              ? 'bg-red-100 text-red-700 border border-red-300'
              : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 shadow-sm'
        }
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      title={error || (showSuccess ? 'Draft generated!' : 'Generate AI draft')}
    >
      {isGenerating ? (
        <>
          <Spinner size="sm" />
          <span>Generating...</span>
        </>
      ) : showSuccess ? (
        <>
          <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Done!</span>
        </>
      ) : error ? (
        <>
          <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Retry</span>
        </>
      ) : (
        <>
          <SparklesIcon className={iconSize} />
          <span>{label || 'AI Draft'}</span>
        </>
      )}
    </button>
  );
}
