/**
 * API Response Types
 *
 * Common types for API responses, pagination, and errors
 */

// Standard paginated response
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// Pagination metadata
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Standard API error response
export interface ApiErrorResponse {
  status: number;
  error: string;
  message: string;
  code?: string;
  errors?: string[];
  stack?: string; // Only in development
}

// Validation error response
export interface ValidationErrorResponse {
  error: 'Bad Request';
  message: 'Validation failed';
  errors: string[];
}

// Success message response
export interface SuccessResponse {
  message: string;
}

// Generic API response wrapper
export type ApiResponse<T> = T | ApiErrorResponse;

// Request options for API calls
export interface RequestOptions {
  signal?: AbortSignal;
  timeout?: number;
}

// Sort direction
export type SortOrder = 'asc' | 'desc';

// Base list query params
export interface BaseListParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

// Search params
export interface SearchParams extends BaseListParams {
  search?: string;
}

// Date range filter
export interface DateRangeFilter {
  dateFrom?: string;
  dateTo?: string;
}

// API client configuration
export interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  headers?: Record<string, string>;
}

// Token storage keys
export const TOKEN_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
} as const;

// API endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  REFRESH_TOKEN: '/auth/refresh-token',
  ME: '/auth/me',
  REVOKE_ALL: '/auth/revoke-all',

  // Patients
  PATIENTS: '/patients',

  // OASIS
  ASSESSMENTS: '/oasis/assessments',
  QUESTIONS: '/oasis/questions',

  // Voice
  VOICE_TRANSCRIBE: '/voice/transcribe',
  VOICE_PROCESS_OASIS: '/voice/process-oasis',

  // Documents
  DOCUMENTS: '/documents',
} as const;

// HTTP methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Rate limit error
export interface RateLimitError extends ApiErrorResponse {
  status: 429;
  error: 'Too Many Requests';
  retryAfter?: number;
}

// Authentication error codes
export type AuthErrorCode =
  | 'TOKEN_EXPIRED'
  | 'INVALID_TOKEN'
  | 'TOKEN_REVOKED'
  | 'REFRESH_TOKEN_EXPIRED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_SUSPENDED'
  | 'INVALID_CREDENTIALS';

// Auth error response
export interface AuthErrorResponse extends ApiErrorResponse {
  code?: AuthErrorCode;
  lockedUntil?: string;
}
