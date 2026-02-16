/**
 * Agency Settings Controller
 *
 * Handles CRUD operations for agency-level settings
 * used to auto-populate OASIS fields.
 */

import { Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { UserRole } from '../generated/prisma';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

// ===========================================
// TYPES
// ===========================================

interface AgencySettingsInput {
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

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Check if user has admin/supervisor access
 */
function hasAdminAccess(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPERVISOR;
}

// ===========================================
// CONTROLLER FUNCTIONS
// ===========================================

/**
 * Get agency settings
 * GET /api/settings/agency
 */
export async function getAgencySettings(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // All authenticated users can read agency settings
    const settings = await prisma.agencySettings.findFirst({
      where: { isPrimary: true, isActive: true },
    });

    if (!settings) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Agency settings not configured',
      });
    }

    return res.json(settings);
  } catch (error) {
    next(error);
  }
}

/**
 * Update agency settings
 * PUT /api/settings/agency
 */
export async function updateAgencySettings(
  req: AuthenticatedRequest & { body: AgencySettingsInput },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // Only admin/supervisor can update
    if (!hasAdminAccess(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only administrators and supervisors can update agency settings',
      });
    }

    const {
      agencyName,
      cmsNumber,
      branchState,
      branchId,
      facilityNpi,
      providerType,
      agencyAddress,
      agencyCity,
      agencyState,
      agencyZip,
      agencyPhone,
      agencyFax,
    } = req.body;

    // Validation
    const errors: string[] = [];
    if (!agencyName) errors.push('Agency name is required');
    if (!cmsNumber || !/^\d{6}$/.test(cmsNumber)) {
      errors.push('CMS number must be exactly 6 digits');
    }
    if (!branchState || !/^[A-Z]{2}$/.test(branchState)) {
      errors.push('Branch state must be a 2-character state code');
    }
    if (branchId && !/^\d{10}$/.test(branchId)) {
      errors.push('Branch ID must be exactly 10 digits if provided');
    }
    if (!facilityNpi || !/^\d{10}$/.test(facilityNpi)) {
      errors.push('Facility NPI must be exactly 10 digits');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid agency settings',
        errors,
      });
    }

    // Find existing or create
    const existing = await prisma.agencySettings.findFirst({
      where: { isPrimary: true },
    });

    let settings;
    if (existing) {
      settings = await prisma.agencySettings.update({
        where: { id: existing.id },
        data: {
          agencyName,
          cmsNumber,
          branchState,
          branchId: branchId || null,
          facilityNpi,
          providerType: providerType || '01',
          agencyAddress: agencyAddress || null,
          agencyCity: agencyCity || null,
          agencyState: agencyState || null,
          agencyZip: agencyZip || null,
          agencyPhone: agencyPhone || null,
          agencyFax: agencyFax || null,
          updatedBy: req.user.id,
        },
      });
    } else {
      settings = await prisma.agencySettings.create({
        data: {
          agencyName,
          cmsNumber,
          branchState,
          branchId: branchId || null,
          facilityNpi,
          providerType: providerType || '01',
          agencyAddress: agencyAddress || null,
          agencyCity: agencyCity || null,
          agencyState: agencyState || null,
          agencyZip: agencyZip || null,
          agencyPhone: agencyPhone || null,
          agencyFax: agencyFax || null,
          isPrimary: true,
          isActive: true,
          createdBy: req.user.id,
          updatedBy: req.user.id,
        },
      });
    }

    return res.json(settings);
  } catch (error) {
    next(error);
  }
}

/**
 * Get the OASIS field mappings from agency settings
 * GET /api/settings/agency/oasis-defaults
 * Returns a map of OASIS item codes to their default values
 */
export async function getOasisDefaults(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const settings = await prisma.agencySettings.findFirst({
      where: { isPrimary: true, isActive: true },
    });

    if (!settings) {
      return res.json({ defaults: {} });
    }

    // Map agency settings to OASIS fields
    const defaults: Record<string, { value: string; label: string }> = {
      M0010: {
        value: settings.cmsNumber,
        label: 'CMS Certification Number',
      },
      M0014: {
        value: settings.branchState,
        label: 'Branch State',
      },
      A0200: {
        value: settings.providerType,
        label: 'Provider Type (Home Health Agency)',
      },
    };

    // Optional fields
    if (settings.branchId) {
      defaults['M0016'] = {
        value: settings.branchId,
        label: 'Branch ID',
      };
    }

    if (settings.facilityNpi) {
      defaults['A0100'] = {
        value: settings.facilityNpi,
        label: 'Facility NPI',
      };
    }

    return res.json({ defaults, agencyName: settings.agencyName });
  } catch (error) {
    next(error);
  }
}

export default {
  getAgencySettings,
  updateAgencySettings,
  getOasisDefaults,
};
