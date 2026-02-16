/**
 * Settings Service
 *
 * API client for agency and system settings
 */

import apiClient from './api/client';
import type { AgencySettings, AgencySettingsInput, OasisDefaults } from '@typedefs/settings.types';

export const settingsService = {
  /**
   * Get agency settings
   */
  async getAgencySettings(): Promise<AgencySettings> {
    const response = await apiClient.get<AgencySettings>('/settings/agency');
    return response.data;
  },

  /**
   * Update agency settings (admin/supervisor only)
   */
  async updateAgencySettings(data: AgencySettingsInput): Promise<AgencySettings> {
    const response = await apiClient.put<AgencySettings>('/settings/agency', data);
    return response.data;
  },

  /**
   * Get OASIS field defaults from agency settings
   */
  async getOasisDefaults(): Promise<OasisDefaults> {
    const response = await apiClient.get<OasisDefaults>('/settings/agency/oasis-defaults');
    return response.data;
  },
};

export default settingsService;
