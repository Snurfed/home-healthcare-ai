/**
 * Compliance Services Index
 *
 * Exports all compliance-related services for Medicare validation,
 * OASIS edit checks, and billing code suggestions.
 */

// Medicare Compliance Service
export {
  validateVisitCompliance,
  validateHomeboundStatus,
  validateSkilledCareNecessity,
  validateFaceToFaceRequirements,
  validateCertificationPeriod,
  checkOasisCompleteness,
} from './medicareCompliance.service';

// OASIS Validation Service
export {
  validateOasisAssessment,
  default as oasisValidation,
} from './oasisValidation.service';

// Billing Code Suggestion Service
export {
  generateBillingSuggestions,
  generateAssessmentBillingSuggestions,
  default as billingCodeSuggestion,
} from './billingCodeSuggestion.service';

// Re-export types
export type {
  ComplianceIssue,
  ComplianceSeverity,
  ComplianceCategory,
  DenialReason,
  ValidationResult,
  BillingCodeSuggestion,
  BillingSuggestionResult,
  CodingWarning,
  OasisEditCheck,
  OasisEditCheckResult,
  OasisValidationResult,
  SkipPatternViolation,
  DateRangeIssue,
  HomeboundCheckInput,
  HomeboundCheckResult,
  SkilledCareValidationResult,
  SkilledCareRequirement,
  FaceToFaceRequirement,
  CertificationPeriodValidation,
} from '../../types/compliance.types';
