/**
 * Domain Module
 *
 * Central domain layer containing EMR-agnostic canonical models
 * and EMR-specific adapters.
 */

// Canonical Domain (EMR-agnostic)
export * from './canonical';

// EMR Domain (vendor-specific)
export * from './emr';
