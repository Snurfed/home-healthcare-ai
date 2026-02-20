/**
 * New Assessment Modal
 *
 * Modal for selecting a patient to start a new assessment.
 * Patients can only be imported from EMR - no manual creation.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Button, Input, Spinner, Alert } from '@components/common';
import { usePatients, useEmrConnections } from '@hooks/index';
import { EmrPatientSearch } from '@components/emr';

interface NewAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'local' | 'emr';

export function NewAssessmentModal({ isOpen, onClose }: NewAssessmentModalProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('local');
  const [localSearch, setLocalSearch] = useState('');

  // Fetch local patients
  const { data: patientsData, isLoading: patientsLoading } = usePatients({
    search: localSearch || undefined,
    limit: 20,
  });

  // Fetch EMR connections to check if any are available
  const { data: emrConnections } = useEmrConnections();
  const hasEmrConnections = emrConnections && emrConnections.length > 0;

  // Handle patient selection
  const handleSelectPatient = (patientId: string) => {
    onClose();
    navigate(`/episode/${patientId}`);
  };

  // Handle successful EMR import
  const handleEmrImportSuccess = (patientId: string) => {
    onClose();
    navigate(`/episode/${patientId}`);
  };

  const localPatients = patientsData?.data || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Start New Assessment"
      size="lg"
    >
      <div className="space-y-4">
        {/* Tab Buttons */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('local')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'local'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Existing Patients
          </button>
          <button
            onClick={() => setActiveTab('emr')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'emr'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Import from EMR
          </button>
        </div>

        {/* Local Patients Tab */}
        {activeTab === 'local' && (
          <div className="space-y-4">
            <Input
              placeholder="Search by name or MRN..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />

            {patientsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : localPatients.length === 0 ? (
              <div className="text-center py-8">
                <svg
                  className="mx-auto h-12 w-12 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p className="mt-2 text-sm text-gray-500">
                  {localSearch ? 'No patients found matching your search.' : 'No patients in the system yet.'}
                </p>
                {hasEmrConnections && (
                  <button
                    onClick={() => setActiveTab('emr')}
                    className="mt-3 text-sm text-green-600 font-medium hover:text-green-700"
                  >
                    Import a patient from EMR
                  </button>
                )}
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {localPatients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient.id)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {patient.lastName}, {patient.firstName}
                      </p>
                      <p className="text-xs text-gray-500">
                        <span className="font-mono">{patient.mrn}</span>
                        {patient.dateOfBirth && (
                          <>
                            <span className="mx-2">•</span>
                            DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}
                          </>
                        )}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EMR Import Tab */}
        {activeTab === 'emr' && (
          <div>
            {!hasEmrConnections ? (
              <Alert variant="info">
                No EMR connections configured. Contact your administrator to set up EMR integration.
              </Alert>
            ) : (
              <EmrPatientSearch onPatientImported={handleEmrImportSuccess} />
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default NewAssessmentModal;
