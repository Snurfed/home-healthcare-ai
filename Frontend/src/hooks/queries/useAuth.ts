/**
 * Auth Query Hooks
 *
 * React Query hooks for authentication
 */

import { useQuery, useMutation, useQueryClient } from 'react-query';
import { queryKeys } from '@context/QueryProvider';
import { authService } from '@services/index';
import { useAuthStore } from '@context/stores/authStore';
import type { LoginCredentials, User } from '@typedefs/index';

/**
 * Hook to get current user profile
 */
export function useCurrentUser() {
  const { isAuthenticated, setUser } = useAuthStore();

  return useQuery<User, Error>(
    queryKeys.auth.me,
    () => authService.getCurrentUser(),
    {
      enabled: isAuthenticated,
      onSuccess: (user) => {
        setUser(user);
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    }
  );
}

/**
 * Hook for login mutation
 */
export function useLogin() {
  const queryClient = useQueryClient();
  const { login } = useAuthStore();

  return useMutation<void, Error, LoginCredentials>(
    async (credentials) => {
      await login(credentials);
    },
    {
      onSuccess: () => {
        // Invalidate and refetch user data
        queryClient.invalidateQueries(queryKeys.auth.me);
      },
    }
  );
}

/**
 * Hook for logout mutation
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();

  return useMutation<void, Error>(
    async () => {
      await logout();
    },
    {
      onSuccess: () => {
        // Clear all queries on logout
        queryClient.clear();
      },
    }
  );
}

/**
 * Hook for refreshing session
 */
export function useRefreshSession() {
  const { refreshSession } = useAuthStore();

  return useMutation<boolean, Error>(
    async () => {
      return refreshSession();
    }
  );
}

/**
 * Hook to check if user has specific permission
 */
export function usePermission(permission: string): boolean {
  const { checkPermission } = useAuthStore();
  return checkPermission(permission);
}

/**
 * Hook to check if user has specific role(s)
 */
export function useHasRole(roles: string[]): boolean {
  const { hasRole } = useAuthStore();
  return hasRole(roles as never);
}
