/**
 * Agency Settings Page
 *
 * Admin page for managing agency-level settings that auto-populate
 * OASIS assessment fields.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Button, Input, Alert, Spinner } from '@components/common';
import { settingsService } from '@services/settings.service';
import type { AgencySettings, AgencySettingsInput } from '@typedefs/index';

// US State options for dropdown
const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

// Field info for OASIS mapping display
const OASIS_FIELD_INFO = [
  { code: 'M0010', label: 'CMS Certification Number', field: 'cmsNumber' },
  { code: 'M0014', label: 'Branch State', field: 'branchState' },
  { code: 'M0016', label: 'Branch ID', field: 'branchId' },
  { code: 'A0100', label: 'Facility NPI', field: 'facilityNpi' },
  { code: 'A0200', label: 'Provider Type', field: 'providerType' },
];

export default function AgencySettingsPage() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<AgencySettingsInput>({
    agencyName: '',
    cmsNumber: '',
    branchState: '',
    branchId: '',
    facilityNpi: '',
    providerType: '01',
    agencyAddress: '',
    agencyCity: '',
    agencyState: '',
    agencyZip: '',
    agencyPhone: '',
    agencyFax: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch current settings
  const {
    data: settings,
    isLoading,
    error: fetchError,
  } = useQuery<AgencySettings, Error>('agencySettings', settingsService.getAgencySettings, {
    retry: false,
    onError: () => {
      // Settings don't exist yet - that's okay
    },
  });

  // Update mutation
  const updateMutation = useMutation(settingsService.updateAgencySettings, {
    onSuccess: () => {
      queryClient.invalidateQueries('agencySettings');
      setSuccessMessage('Agency settings saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (error: Error) => {
      setErrors({ submit: error.message });
    },
  });

  // Populate form when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        agencyName: settings.agencyName || '',
        cmsNumber: settings.cmsNumber || '',
        branchState: settings.branchState || '',
        branchId: settings.branchId || '',
        facilityNpi: settings.facilityNpi || '',
        providerType: settings.providerType || '01',
        agencyAddress: settings.agencyAddress || '',
        agencyCity: settings.agencyCity || '',
        agencyState: settings.agencyState || '',
        agencyZip: settings.agencyZip || '',
        agencyPhone: settings.agencyPhone || '',
        agencyFax: settings.agencyFax || '',
      });
    }
  }, [settings]);

  // Handle input changes
  const handleChange = (field: keyof AgencySettingsInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.agencyName.trim()) {
      newErrors.agencyName = 'Agency name is required';
    }

    if (!formData.cmsNumber.trim()) {
      newErrors.cmsNumber = 'CMS number is required';
    } else if (!/^\d{6}$/.test(formData.cmsNumber)) {
      newErrors.cmsNumber = 'CMS number must be exactly 6 digits';
    }

    if (!formData.branchState.trim()) {
      newErrors.branchState = 'Branch state is required';
    } else if (!/^[A-Z]{2}$/.test(formData.branchState)) {
      newErrors.branchState = 'Must be a 2-letter state code';
    }

    if (formData.branchId && !/^\d{10}$/.test(formData.branchId)) {
      newErrors.branchId = 'Branch ID must be exactly 10 digits';
    }

    if (!formData.facilityNpi.trim()) {
      newErrors.facilityNpi = 'Facility NPI is required';
    } else if (!/^\d{10}$/.test(formData.facilityNpi)) {
      newErrors.facilityNpi = 'Facility NPI must be exactly 10 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);

    if (validateForm()) {
      updateMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" label="Loading settings..." />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-card p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agency Settings</h1>
            <p className="text-gray-500">
              Configure agency-level information that auto-populates OASIS assessments
            </p>
          </div>
        </div>
      </div>

      {/* Settings Navigation */}
      <div className="bg-white rounded-lg shadow-card p-4">
        <div className="flex items-center gap-4">
          <Link
            to="/settings"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-100 text-primary-700 font-medium"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Agency Settings
          </Link>
          <Link
            to="/settings/emr-connections"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            EMR Connections
          </Link>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <Alert variant="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {fetchError && !settings && (
        <Alert variant="info">
          No agency settings configured yet. Fill out the form below to set up your agency.
        </Alert>
      )}

      {errors.submit && (
        <Alert variant="error" onClose={() => setErrors((prev) => ({ ...prev, submit: '' }))}>
          {errors.submit}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Agency Information */}
        <div className="bg-white rounded-lg shadow-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Agency Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="agencyName" className="block text-sm font-medium text-gray-700 mb-1">
                Agency Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="agencyName"
                type="text"
                value={formData.agencyName}
                onChange={(e) => handleChange('agencyName', e.target.value)}
                placeholder="Enter agency name"
                className={errors.agencyName ? 'border-red-500' : ''}
              />
              {errors.agencyName && (
                <p className="mt-1 text-sm text-red-600">{errors.agencyName}</p>
              )}
            </div>

            <div>
              <label htmlFor="cmsNumber" className="block text-sm font-medium text-gray-700 mb-1">
                CMS Certification Number <span className="text-red-500">*</span>
                <span className="text-gray-400 text-xs ml-1">(M0010)</span>
              </label>
              <Input
                id="cmsNumber"
                type="text"
                value={formData.cmsNumber}
                onChange={(e) => handleChange('cmsNumber', e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className={errors.cmsNumber ? 'border-red-500' : ''}
              />
              {errors.cmsNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.cmsNumber}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">6-digit Medicare certification number</p>
            </div>

            <div>
              <label htmlFor="branchState" className="block text-sm font-medium text-gray-700 mb-1">
                Branch State <span className="text-red-500">*</span>
                <span className="text-gray-400 text-xs ml-1">(M0014)</span>
              </label>
              <select
                id="branchState"
                value={formData.branchState}
                onChange={(e) => handleChange('branchState', e.target.value)}
                className={`form-input w-full ${errors.branchState ? 'border-red-500' : ''}`}
              >
                <option value="">Select state...</option>
                {US_STATES.map((state) => (
                  <option key={state.value} value={state.value}>
                    {state.value} - {state.label}
                  </option>
                ))}
              </select>
              {errors.branchState && (
                <p className="mt-1 text-sm text-red-600">{errors.branchState}</p>
              )}
            </div>

            <div>
              <label htmlFor="branchId" className="block text-sm font-medium text-gray-700 mb-1">
                Branch ID Number
                <span className="text-gray-400 text-xs ml-1">(M0016)</span>
              </label>
              <Input
                id="branchId"
                type="text"
                value={formData.branchId || ''}
                onChange={(e) => handleChange('branchId', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="1234567890"
                maxLength={10}
                className={errors.branchId ? 'border-red-500' : ''}
              />
              {errors.branchId && (
                <p className="mt-1 text-sm text-red-600">{errors.branchId}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">10-digit branch identification number (optional)</p>
            </div>

            <div>
              <label htmlFor="facilityNpi" className="block text-sm font-medium text-gray-700 mb-1">
                Facility NPI <span className="text-red-500">*</span>
                <span className="text-gray-400 text-xs ml-1">(A0100)</span>
              </label>
              <Input
                id="facilityNpi"
                type="text"
                value={formData.facilityNpi}
                onChange={(e) => handleChange('facilityNpi', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="1234567890"
                maxLength={10}
                className={errors.facilityNpi ? 'border-red-500' : ''}
              />
              {errors.facilityNpi && (
                <p className="mt-1 text-sm text-red-600">{errors.facilityNpi}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">10-digit National Provider Identifier</p>
            </div>

            <div>
              <label htmlFor="providerType" className="block text-sm font-medium text-gray-700 mb-1">
                Provider Type
                <span className="text-gray-400 text-xs ml-1">(A0200)</span>
              </label>
              <select
                id="providerType"
                value={formData.providerType}
                onChange={(e) => handleChange('providerType', e.target.value)}
                className="form-input w-full"
              >
                <option value="01">01 - Home Health Agency</option>
                <option value="02">02 - Skilled Nursing Facility</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">Type of Medicare-certified provider</p>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-lg shadow-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="agencyAddress" className="block text-sm font-medium text-gray-700 mb-1">
                Street Address
              </label>
              <Input
                id="agencyAddress"
                type="text"
                value={formData.agencyAddress || ''}
                onChange={(e) => handleChange('agencyAddress', e.target.value)}
                placeholder="123 Main Street"
              />
            </div>

            <div>
              <label htmlFor="agencyCity" className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <Input
                id="agencyCity"
                type="text"
                value={formData.agencyCity || ''}
                onChange={(e) => handleChange('agencyCity', e.target.value)}
                placeholder="City"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="agencyState" className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <select
                  id="agencyState"
                  value={formData.agencyState || ''}
                  onChange={(e) => handleChange('agencyState', e.target.value)}
                  className="form-input w-full"
                >
                  <option value="">Select...</option>
                  {US_STATES.map((state) => (
                    <option key={state.value} value={state.value}>
                      {state.value}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="agencyZip" className="block text-sm font-medium text-gray-700 mb-1">
                  ZIP Code
                </label>
                <Input
                  id="agencyZip"
                  type="text"
                  value={formData.agencyZip || ''}
                  onChange={(e) => handleChange('agencyZip', e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="12345"
                  maxLength={9}
                />
              </div>
            </div>

            <div>
              <label htmlFor="agencyPhone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <Input
                id="agencyPhone"
                type="tel"
                value={formData.agencyPhone || ''}
                onChange={(e) => handleChange('agencyPhone', e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <label htmlFor="agencyFax" className="block text-sm font-medium text-gray-700 mb-1">
                Fax Number
              </label>
              <Input
                id="agencyFax"
                type="tel"
                value={formData.agencyFax || ''}
                onChange={(e) => handleChange('agencyFax', e.target.value)}
                placeholder="(555) 123-4568"
              />
            </div>
          </div>
        </div>

        {/* OASIS Field Mapping Preview */}
        <div className="bg-white rounded-lg shadow-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">OASIS Field Auto-Population</h2>
          <p className="text-sm text-gray-500 mb-4">
            These values will automatically populate the following fields when creating new assessments:
          </p>

          <div className="bg-gray-50 rounded-lg p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="pb-2 font-medium">OASIS Field</th>
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium">Current Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {OASIS_FIELD_INFO.map((item) => (
                  <tr key={item.code}>
                    <td className="py-2 font-mono text-primary-600">{item.code}</td>
                    <td className="py-2 text-gray-700">{item.label}</td>
                    <td className="py-2">
                      {formData[item.field as keyof AgencySettingsInput] ? (
                        <span className="font-medium text-gray-900">
                          {formData[item.field as keyof AgencySettingsInput]}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Not set</span>
                      )}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 font-mono text-primary-600">M0020</td>
                  <td className="py-2 text-gray-700">Patient ID (MRN)</td>
                  <td className="py-2">
                    <span className="text-blue-600 italic">Auto-filled from patient record</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            variant="primary"
            isLoading={updateMutation.isLoading}
            disabled={updateMutation.isLoading}
          >
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
