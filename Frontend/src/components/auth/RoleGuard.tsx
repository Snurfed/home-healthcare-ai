/**
 * RoleGuard Component
 *
 * Guards routes based on user roles
 */

import { Navigate } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useAuthStore } from '@context/stores/authStore';
import type { UserRole } from '@typedefs/index';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  fallbackPath?: string;
}

export default function RoleGuard({
  children,
  allowedRoles,
  fallbackPath = '/schedule',
}: RoleGuardProps) {
  const { hasRole } = useAuthStore();

  if (!hasRole(allowedRoles)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
