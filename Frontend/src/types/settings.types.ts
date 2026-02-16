/**
 * Settings Types
 *
 * Type definitions for agency and system settings
 */

export interface AgencySettings {
  id: string;
  agencyName: string;
  cmsNumber: string;
  branchState: string;
  branchId: string | null;
  facilityNpi: string;
  providerType: string;
  agencyAddress: string | null;
  agencyCity: string | null;
  agencyState: string | null;
  agencyZip: string | null;
  agencyPhone: string | null;
  agencyFax: string | null;
  isActive: boolean;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgencySettingsInput {
  agencyName: string;
  cmsNumber: string;
  branchState: string;
  branchId?: string;
  facilityNpi: string;
  providerType?: string;
  agencyAddress?: string;
  agencyCity?: string;
  agencyState?: string;
  agencyZip?: string;
  agencyPhone?: string;
  agencyFax?: string;
}

export interface OasisDefaultField {
  value: string;
  label: string;
}

export interface OasisDefaults {
  defaults: Record<string, OasisDefaultField>;
  agencyName: string;
}

// Item codes that are auto-filled by the system
export const SYSTEM_AUTOFILL_CODES = [
  'M0010', // CMS Certification Number
  'M0014', // Branch State
  'M0016', // Branch ID
  'M0018', // Attending Physician NPI
  'M0020', // Patient ID (MRN)
  'A0100', // Facility NPI
  'A0200', // Provider Type
] as const;

export type SystemAutoFillCode = typeof SYSTEM_AUTOFILL_CODES[number];

/**
 * Check if an item code is a system auto-fill field
 */
export function isSystemAutoFillField(itemCode: string): boolean {
  return SYSTEM_AUTOFILL_CODES.includes(itemCode as SystemAutoFillCode);
}
