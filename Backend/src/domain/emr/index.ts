/**
 * EMR Domain Module
 *
 * EMR-specific templates, adapters, and export functionality.
 */

// Types
export * from './types';

// EMR Adapter
export {
  exportToEMR,
  getAvailableTemplates,
  copyToClipboard,
} from './emrAdapter.service';

// Sample Templates
export { HCHB_RN_SOC_TEMPLATE } from './templates/hchb-rn-soc.template';
