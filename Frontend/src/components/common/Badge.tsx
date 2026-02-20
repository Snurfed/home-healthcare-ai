/**
 * Badge Component
 *
 * Status badges for assessments and other entities
 */

import type { AssessmentStatus } from '@typedefs/index';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'status';
  status?: AssessmentStatus;
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

const variantClasses = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  status: '', // Will be determined by status prop
};

const statusClasses: Record<AssessmentStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  PENDING_REVIEW: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  NEEDS_CORRECTION: 'bg-red-100 text-red-800',
  SUBMITTED: 'bg-purple-100 text-purple-800',
  LOCKED: 'bg-gray-200 text-gray-600',
};

export default function Badge({
  variant = 'default',
  status,
  size = 'md',
  children,
  className = '',
}: BadgeProps) {
  const colorClass =
    variant === 'status' && status
      ? statusClasses[status]
      : variantClasses[variant];

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      className={`
        inline-flex items-center rounded-full
        font-medium
        ${sizeClass}
        ${colorClass}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
