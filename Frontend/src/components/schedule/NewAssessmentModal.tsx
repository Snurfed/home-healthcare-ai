/**
 * New Assessment Modal
 *
 * Multi-step modal for starting a new assessment:
 * 1. Select patient (existing or import from EMR)
 * 2. Select visit type (SOC, Recert, Follow-up, ROC, Discharge)
 * 3. Navigate to assessment
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Button, Input, Spinner, Alert } from '@components/common';
import { usePatients, useEmrConnections, usePatientEpisodes } from '@hooks/index';
import { EmrPatientSearch } from '@components/emr';

interface NewAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'patient' | 'visit-type';
type PatientTab = 'local' | 'emr';

// Visit types for OASIS assessments
const VISIT_TYPES = {
  SOC: {
    code: 'SOC',
    label: 'Start of Care',
    description: 'Initial assessment for new episode of care',
    icon: '🏠',
    requiresNewEpisode: true,
  },
  ROC: {
    code: 'ROC',
    label: 'Resumption of Care',
    description: 'Patient returning after inpatient facility stay',
    icon: '🔄',
    requiresNewEpisode: false,
  },
  RECERT: {
    code: 'RECERT',
    label: 'Recertification',
    description: '60-day recertification assessment',
    icon: '📋',
    requiresNewEpisode: false,
  },
  FOLLOWUP: {
    code: 'FOLLOWUP',
    label: 'Follow-up Visit',
    description: 'Routine skilled visit documentation',
    icon: '📝',
    requiresNewEpisode: false,
  },
  DISCHARGE: {
    code: 'DISCHARGE',
    label: 'Discharge',
    description: 'Final assessment, close episode of care',
    icon: '✅',
    requiresNewEpisode: false,
  },
} as const;

type VisitType = keyof typeof VISIT_TYPES;

interface SelectedPatient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
}

export function NewAssessmentModal({ isOpen, onClose }: NewAssessmentModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('patient');
  const [patientTab, setPatientTab] = useState<PatientTab>('local');
  const [localSearch, setLocalSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<SelectedPatient | null>(null);
  const [selectedVisitType, setSelectedVisitType] = useState<VisitType | null>(null);

  // Fetch local patients
  const { data: patientsData, isLoading: patientsLoading } = usePatients({
    search: localSearch || undefined,
    limit: 20,
  });

  // Fetch EMR connections
  const { data: emrConnections } = useEmrConnections();
  const hasEmrConnections = emrConnections && emrConnections.length > 0;

  // Fetch patient's episodes when selected
  const { data: episodes, isLoading: episodesLoading } = usePatientEpisodes(
    selectedPatient?.id || ''
  );

  // Check if patient has an active episode
  const activeEpisode = episodes?.data?.find(
    (ep: { status: string }) => ep.status === 'ACTIVE' || ep.status === 'PENDING'
  );

  // Determine available visit types based on episode status
  const getAvailableVisitTypes = (): VisitType[] => {
    if (!activeEpisode) {
      // No active episode - must start with SOC
      return ['SOC'];
    }
    // Has active episode - can do follow-up, recert, ROC, or discharge
    return ['FOLLOWUP', 'RECERT', 'ROC', 'DISCHARGE'];
  };

  // Handle patient selection
  const handleSelectPatient = (patient: SelectedPatient) => {
    setSelectedPatient(patient);
    setSelectedVisitType(null);
    setStep('visit-type');
  };

  // Handle EMR import success
  const handleEmrImportSuccess = (patientId: string) => {
    // Find the patient in the updated list or create a placeholder
    const imported = patientsData?.data?.find((p) => p.id === patientId);
    if (imported) {
      handleSelectPatient({
        id: imported.id,
        firstName: imported.firstName,
        lastName: imported.lastName,
        mrn: imported.mrn,
      });
    } else {
      // Navigate directly if we can't find the patient data
      navigate(`/episode/${patientId}`);
      handleClose();
    }
  };

  // Handle visit type selection and navigation
  const handleStartAssessment = () => {
    if (!selectedPatient || !selectedVisitType) return;

    const visitType = VISIT_TYPES[selectedVisitType];

    // Navigate to episode page with visit type parameter
    if (visitType.requiresNewEpisode || !activeEpisode) {
      // New episode - go to episode creation
      navigate(`/episode/${selectedPatient.id}?visitType=${selectedVisitType}`);
    } else {
      // Existing episode - go to that episode
      navigate(`/episode/${selectedPatient.id}/${activeEpisode.id}?visitType=${selectedVisitType}`);
    }

    handleClose();
  };

  // Reset and close
  const handleClose = () => {
    setStep('patient');
    setPatientTab('local');
    setLocalSearch('');
    setSelectedPatient(null);
    setSelectedVisitType(null);
    onClose();
  };

  // Go back to patient selection
  const handleBack = () => {
    setStep('patient');
    setSelectedPatient(null);
    setSelectedVisitType(null);
  };

  const localPatients = patientsData?.data || [];
  const availableVisitTypes = getAvailableVisitTypes();

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'patient' ? 'Select Patient' : 'Select Visit Type'}
      size="lg"
    >
      <div className="space-y-4">
        {/* Step Indicator */}
        <div className="flex items-center gap-2 text-sm">
          <span className={`flex items-center gap-1 ${step === 'patient' ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'patient' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>1</span>
            Patient
          </span>
          <span className="text-gray-300">→</span>
          <span className={`flex items-center gap-1 ${step === 'visit-type' ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'visit-type' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>2</span>
            Visit Type
          </span>
        </div>

        {/* Step 1: Patient Selection */}
        {step === 'patient' && (
          <>
            {/* Tab Buttons */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setPatientTab('local')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  patientTab === 'local'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Existing Patients
              </button>
              <button
                onClick={() => setPatientTab('emr')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  patientTab === 'emr'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Import from EMR
              </button>
            </div>

            {/* Local Patients Tab */}
            {patientTab === 'local' && (
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
                      {localSearch ? 'No patients found.' : 'No patients in the system yet.'}
                    </p>
                    {hasEmrConnections && (
                      <button
                        onClick={() => setPatientTab('emr')}
                        className="mt-3 text-sm text-green-600 font-medium hover:text-green-700"
                      >
                        Import a patient from EMR
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
                    {localPatients.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => handleSelectPatient({
                          id: patient.id,
                          firstName: patient.firstName,
                          lastName: patient.lastName,
                          mrn: patient.mrn,
                        })}
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
            {patientTab === 'emr' && (
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
          </>
        )}

        {/* Step 2: Visit Type Selection */}
        {step === 'visit-type' && selectedPatient && (
          <div className="space-y-4">
            {/* Selected Patient Info */}
            <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {selectedPatient.lastName}, {selectedPatient.firstName}
                </p>
                <p className="text-xs text-gray-500 font-mono">{selectedPatient.mrn}</p>
              </div>
              <button
                onClick={handleBack}
                className="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                Change
              </button>
            </div>

            {/* Episode Status */}
            {episodesLoading ? (
              <div className="flex items-center justify-center py-4">
                <Spinner size="sm" />
                <span className="ml-2 text-sm text-gray-500">Checking episode status...</span>
              </div>
            ) : (
              <div className={`text-sm p-3 rounded-lg ${activeEpisode ? 'bg-blue-50 text-blue-700' : 'bg-yellow-50 text-yellow-700'}`}>
                {activeEpisode ? (
                  <>
                    <span className="font-medium">Active Episode:</span> Started {new Date(activeEpisode.startDate).toLocaleDateString()}
                  </>
                ) : (
                  <>
                    <span className="font-medium">No active episode.</span> A Start of Care assessment will begin a new episode.
                  </>
                )}
              </div>
            )}

            {/* Visit Type Options */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Select visit type:</p>
              <div className="grid gap-2">
                {availableVisitTypes.map((type) => {
                  const visit = VISIT_TYPES[type];
                  const isSelected = selectedVisitType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedVisitType(type)}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                        isSelected
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{visit.icon}</span>
                        <div className="flex-1">
                          <p className={`font-medium ${isSelected ? 'text-green-700' : 'text-gray-900'}`}>
                            {visit.label}
                          </p>
                          <p className="text-sm text-gray-500">{visit.description}</p>
                        </div>
                        {isSelected && (
                          <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t">
          <div>
            {step === 'visit-type' && (
              <Button variant="secondary" onClick={handleBack}>
                ← Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            {step === 'visit-type' && (
              <Button
                onClick={handleStartAssessment}
                disabled={!selectedVisitType}
              >
                Start Assessment
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default NewAssessmentModal;
