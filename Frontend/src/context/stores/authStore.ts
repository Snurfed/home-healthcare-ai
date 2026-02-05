/**
 * Auth Store
 *
 * Zustand store for authentication state management
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, UserRole, LoginCredentials } from '@typedefs/index';
import { authService, tokenStorage } from '@services/index';
import { ROLE_PERMISSIONS } from '@typedefs/auth.types';

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  setUser: (user: User) => void;
  clearError: () => void;
  checkPermission: (permission: string) => boolean;
  hasRole: (roles: UserRole[]) => boolean;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Login
      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authService.login(credentials);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed';
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: message,
          });
          throw error;
        }
      },

      // Logout
      logout: async () => {
        set({ isLoading: true });
        try {
          await authService.logout();
        } finally {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      // Refresh session
      refreshSession: async () => {
        try {
          await authService.refreshToken();
          const user = await authService.getCurrentUser();
          set({ user, isAuthenticated: true });
          return true;
        } catch {
          set({ user: null, isAuthenticated: false });
          return false;
        }
      },

      // Set user
      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Check permission
      checkPermission: (permission: string) => {
        const { user } = get();
        if (!user) return false;

        const permissions = ROLE_PERMISSIONS[user.role];
        if (!permissions) return false;

        // Admin has all permissions
        if (permissions.includes('*')) return true;

        return permissions.includes(permission);
      },

      // Has role
      hasRole: (roles: UserRole[]) => {
        const { user } = get();
        if (!user) return false;
        return roles.includes(user.role);
      },

      // Initialize auth on app load
      initializeAuth: async () => {
        const hasToken = authService.isAuthenticated();
        if (!hasToken) {
          set({ isAuthenticated: false, user: null });
          return;
        }

        set({ isLoading: true });
        try {
          const user = await authService.getCurrentUser();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch {
          tokenStorage.clearTokens();
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
