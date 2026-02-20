/**
 * PermissionGuard Component
 *
 * Granular permission check component that shows/hides children
 * based on the current user's permissions.
 *
 * Usage:
 * <PermissionGuard permission="patient:create">
 *   <Button>Add Patient</Button>
 * </PermissionGuard>
 */

import { type ReactNode } from 'react';
import { useAuthStore } from '@context/stores/authStore';

interface PermissionGuardProps {
  /** The permission string to check (e.g., 'patient:create', 'assessments:write') */
  permission: string;
  /** Content to render if the user has the permission */
  children: ReactNode;
  /** Optional fallback content to render if the user lacks the permission */
  fallback?: ReactNode;
}

/**
 * Guards content based on user permissions.
 * Unlike RoleGuard (which checks roles and redirects), PermissionGuard
 * simply shows/hides content without navigation.
 */
export function PermissionGuard({
  permission,
  children,
  fallback = null
}: PermissionGuardProps) {
  const { checkPermission } = useAuthStore();

  if (!checkPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default PermissionGuard;
