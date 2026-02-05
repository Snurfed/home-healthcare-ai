/**
 * Authentication Types
 *
 * Mirrors the backend auth types for type safety
 */

// User roles matching backend UserRole enum
export type UserRole =
  | 'ADMIN'
  | 'SUPERVISOR'
  | 'NURSE'
  | 'THERAPIST_PT'
  | 'THERAPIST_OT'
  | 'THERAPIST_ST'
  | 'HOME_HEALTH_AIDE'
  | 'MEDICAL_SOCIAL_WORKER'
  | 'BILLING'
  | 'READONLY';

// User status matching backend UserStatus enum
export type UserStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'PENDING_VERIFICATION';

// User profile returned from API
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  phone?: string | null;
  role: UserRole;
  status: UserStatus;
  licenseNumber?: string | null;
  licenseState?: string | null;
  licenseExpiration?: string | null;
  npiNumber?: string | null;
  profileImageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Login request body
export interface LoginCredentials {
  email: string;
  password: string;
}

// Login response from API
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: User;
}

// Token refresh request
export interface RefreshTokenRequest {
  refreshToken: string;
}

// Token refresh response
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

// JWT payload structure (for client-side token inspection)
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

// Auth state for Zustand store
export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Auth actions for Zustand store
export interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<boolean>;
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  checkPermission: (permission: string) => boolean;
  hasRole: (roles: UserRole[]) => boolean;
}

// Role-based permissions
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: ['*'],
  SUPERVISOR: [
    'assessments:read',
    'assessments:write',
    'assessments:review',
    'assessments:approve',
    'patients:read',
    'patients:write',
    'users:read',
  ],
  NURSE: [
    'assessments:read',
    'assessments:write',
    'assessments:submit',
    'patients:read',
    'patients:write',
  ],
  THERAPIST_PT: [
    'assessments:read',
    'assessments:write',
    'assessments:submit',
    'patients:read',
  ],
  THERAPIST_OT: [
    'assessments:read',
    'assessments:write',
    'assessments:submit',
    'patients:read',
  ],
  THERAPIST_ST: [
    'assessments:read',
    'assessments:write',
    'assessments:submit',
    'patients:read',
  ],
  HOME_HEALTH_AIDE: [
    'assessments:read',
    'patients:read',
  ],
  MEDICAL_SOCIAL_WORKER: [
    'assessments:read',
    'assessments:write',
    'patients:read',
    'patients:write',
  ],
  BILLING: [
    'assessments:read',
    'patients:read',
  ],
  READONLY: [
    'assessments:read',
    'patients:read',
  ],
};
