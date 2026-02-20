/**
 * Import Patient Modal
 *
 * Preview and import a patient from EMR with duplicate checking.
 */

import { useState, useEffect } from 'react';
import {
  useEmrPatient,
  useCheckDuplicates,
  useImportEmrPatient,
} from '@hooks/index';
import { Modal, Button, Spinner, Alert, Input } from '@components/common';
import type { EmrPatientSearchResult, EmrPatientImportData, DuplicateCheckResult, ImportPatientResponse } from '@typedefs/index';

// Type for a potential match from duplicate check
type PotentialMatch = NonNullable<DuplicateCheckResult['potentialMatches']>[number];

// Type for emergency contact
type EmergencyContact = NonNullable<EmrPatientImportData['emergencyContacts']>[number];

interface ImportPatientModalProps {
  connectionId: string;
  patient: EmrPatientSearchResult;
  onClose: () => void;
  onSuccess: (patientId: string) => void;
}

export function ImportPatientModal({
  connectionId,
  patient,
  onClose,
  onSuccess,
}: ImportPatientModalProps) {
  const [overrides, setOverrides] = useState<Partial<EmrPatientImportData>>({});
  const [forceImport, setForceImport] = useState(false);

  // Fetch full patient data for import preview
  const {
    data: patientDetail,
    isLoading: patientLoading,
    error: patientError,
  } = useEmrPatient(connectionId, patient.fhirId);

  // Check for duplicates
  const {
    data: duplicateCheck,
    isLoading: duplicateLoading,
  } = useCheckDuplicates(connectionId, patient.fhirId);

  // Import mutation
  const importMutation = useImportEmrPatient();

  // Pre-populate overrides from import preview when loaded
  useEffect(() => {
    if (patientDetail?.importPreview) {
      setOverrides({});
    }
  }, [patientDetail]);

  // Handle import
  const handleImport = async () => {
    try {
      const result = await importMutation.mutateAsync({
        connectionId,
        fhirId: patient.fhirId,
        options: {
          overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
          forceImport,
        },
      }) as ImportPatientResponse;
      onSuccess(result.patient.id);
    } catch (error) {
      console.error('Import failed:', error);
    }
  };

  // Handle override change
  const handleOverrideChange = (field: keyof EmrPatientImportData, value: string) => {
    setOverrides(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Get preview data with overrides applied
  const previewData = patientDetail?.importPreview
    ? { ...patientDetail.importPreview, ...overrides }
    : null;

  const isLoading = patientLoading || duplicateLoading;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Import Patient from EMR"
      size="lg"
    >
      <div className="space-y-4">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
            <span className="ml-2 text-gray-500">Loading patient data...</span>
          </div>
        )}

        {/* Error State */}
        {patientError && (
          <Alert variant="error">
            Failed to load patient data: {patientError instanceof Error ? patientError.message : 'Unknown error'}
          </Alert>
        )}

        {/* Duplicate Warning */}
        {duplicateCheck?.isDuplicate && (
          <Alert variant="warning">
            <div className="font-medium">
              {duplicateCheck.reason === 'already_imported'
                ? 'This patient has already been imported'
                : 'A similar patient may already exist'}
            </div>
            {duplicateCheck.existingPatient && (
              <p className="text-sm mt-1">
                Existing patient: {duplicateCheck.existingPatient.firstName}{' '}
                {duplicateCheck.existingPatient.lastName} (MRN: {duplicateCheck.existingPatient.mrn})
              </p>
            )}
            {duplicateCheck.potentialMatches && duplicateCheck.potentialMatches.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium">Potential matches:</p>
                <ul className="text-sm mt-1 space-y-1">
                  {duplicateCheck.potentialMatches.map((match: PotentialMatch) => (
                    <li key={match.id}>
                      {match.firstName} {match.lastName} - DOB: {match.dateOfBirth}, MRN: {match.mrn}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {duplicateCheck.reason !== 'already_imported' && (
              <label className="flex items-center mt-3 text-sm">
                <input
                  type="checkbox"
                  checked={forceImport}
                  onChange={(e) => setForceImport(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-2"
                />
                Import anyway (create new patient)
              </label>
            )}
          </Alert>
        )}

        {/* Preview Data */}
        {previewData && !isLoading && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900">Patient Information Preview</h4>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                value={previewData.firstName}
                onChange={(e) => handleOverrideChange('firstName', e.target.value)}
              />
              <Input
                label="Last Name"
                value={previewData.lastName}
                onChange={(e) => handleOverrideChange('lastName', e.target.value)}
              />
              <Input
                label="Date of Birth"
                type="date"
                value={previewData.dateOfBirth}
                onChange={(e) => handleOverrideChange('dateOfBirth', e.target.value)}
              />
              <Input
                label="Mobile Phone"
                value={previewData.phoneMobile}
                onChange={(e) => handleOverrideChange('phoneMobile', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <Input
                label="Street Address"
                value={previewData.addressStreet1}
                onChange={(e) => handleOverrideChange('addressStreet1', e.target.value)}
              />
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="City"
                  value={previewData.addressCity}
                  onChange={(e) => handleOverrideChange('addressCity', e.target.value)}
                />
                <Input
                  label="State"
                  value={previewData.addressState}
                  onChange={(e) => handleOverrideChange('addressState', e.target.value)}
                />
                <Input
                  label="ZIP Code"
                  value={previewData.addressZipCode}
                  onChange={(e) => handleOverrideChange('addressZipCode', e.target.value)}
                />
              </div>
            </div>

            {previewData.primaryPhysicianName && (
              <Input
                label="Primary Physician"
                value={previewData.primaryPhysicianName}
                onChange={(e) => handleOverrideChange('primaryPhysicianName', e.target.value)}
              />
            )}

            {previewData.emergencyContacts && previewData.emergencyContacts.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Emergency Contacts</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  {previewData.emergencyContacts.map((contact: EmergencyContact, index: number) => (
                    <li key={index}>
                      {contact.firstName} {contact.lastName} ({contact.relationship}) - {contact.phoneMobile}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Import Error */}
        {importMutation.error && (
          <Alert variant="error">
            Import failed: {importMutation.error instanceof Error ? importMutation.error.message : 'Unknown error'}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              isLoading ||
              !previewData ||
              (duplicateCheck?.reason === 'already_imported' && !forceImport) ||
              importMutation.isLoading
            }
          >
            {importMutation.isLoading ? (
              <>
                <Spinner size="sm" />
                <span className="ml-2">Importing...</span>
              </>
            ) : (
              'Import Patient'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ImportPatientModal;
