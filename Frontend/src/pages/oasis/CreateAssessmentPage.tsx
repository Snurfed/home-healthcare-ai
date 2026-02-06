/**
 * Create Assessment Page
 *
 * Multi-step workflow for creating a new OASIS assessment:
 * 1. Patient selection (search existing)
 * 2. Episode selection (existing or create new)
 * 3. Assessment type and details
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePatientSearch, usePatientEpisodes, useCreateEpisode, useCreateAssessment, useAssessments } from '@hooks/index';
import { Button, Input, Select, Spinner, Alert } from '@components/common';
import { CreatePatientForm } from '@components/patients';
import { ASSESSMENT_TYPE_LABELS } from '@typedefs/oasis.types';
import type { PatientListItem } from '@services/patient.service';
import type { Episode } from '@services/episode.service';
import type { AssessmentType } from '@typedefs/oasis.types';

// Step indicator component
function StepIndicator({ currentStep, steps }: { currentStep: number; steps: string[] }) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center">
        {steps.map((step, index) => (
          <li key={step} className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}>
            <div className="flex items-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  index < currentStep
                    ? 'bg-primary-600 text-white'
                    : index === currentStep
                    ? 'border-2 border-primary-600 text-primary-600'
                    : 'border-2 border-gray-300 text-gray-500'
                }`}
              >
                {index < currentStep ? (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <span className={`ml-2 text-sm font-medium ${
                index <= currentStep ? 'text-gray-900' : 'text-gray-500'
              }`}>
                {step}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`ml-4 h-0.5 flex-1 ${
                index < currentStep ? 'bg-primary-600' : 'bg-gray-300'
              }`} />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Patient search and selection step
function PatientSearchStep({
  onSelect,
  selectedPatient,
}: {
  onSelect: (patient: PatientListItem) => void;
  selectedPatient: PatientListItem | null;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading } = usePatientSearch({
    search: debouncedQuery,
    limit: 10,
    status: 'ACTIVE',
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handlePatientCreated = (patient: PatientListItem) => {
    setShowCreateForm(false);
    onSelect(patient);
  };

  if (selectedPatient) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Selected Patient</h3>
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">
                {selectedPatient.lastName}, {selectedPatient.firstName}
                {selectedPatient.middleName && ` ${selectedPatient.middleName.charAt(0)}.`}
              </p>
              <p className="text-sm text-gray-600">
                MRN: {selectedPatient.mrn} | DOB: {formatDate(selectedPatient.dateOfBirth)} ({calculateAge(selectedPatient.dateOfBirth)} y/o)
              </p>
              <p className="text-sm text-gray-500">
                {selectedPatient.addressCity}, {selectedPatient.addressState}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onSelect(null as unknown as PatientListItem)}
            >
              Change
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show create patient form
  if (showCreateForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Create New Patient</h3>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowCreateForm(false)}
          >
            Back to Search
          </Button>
        </div>
        <CreatePatientForm
          onSuccess={handlePatientCreated}
          onCancel={() => setShowCreateForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Search for Patient</h3>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowCreateForm(true)}
        >
          Create New Patient
        </Button>
      </div>
      <Input
        type="search"
        placeholder="Search by name, MRN, or phone number..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        autoFocus
      />

      {isLoading && (
        <div className="flex justify-center py-4">
          <Spinner size="md" label="Searching patients..." />
        </div>
      )}

      {!isLoading && data?.data && data.data.length > 0 && (
        <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
          {data.data.map((patient) => (
            <button
              key={patient.id}
              onClick={() => onSelect(patient)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors focus:outline-none focus:bg-primary-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {patient.lastName}, {patient.firstName}
                    {patient.middleName && ` ${patient.middleName.charAt(0)}.`}
                  </p>
                  <p className="text-sm text-gray-500">
                    MRN: {patient.mrn} | DOB: {formatDate(patient.dateOfBirth)} ({calculateAge(patient.dateOfBirth)} y/o)
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  patient.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                  patient.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {patient.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {!isLoading && debouncedQuery && data?.data?.length === 0 && (
        <div className="text-center py-6">
          <p className="text-gray-500 mb-4">
            No patients found matching "{debouncedQuery}"
          </p>
          <Button onClick={() => setShowCreateForm(true)}>
            Create New Patient
          </Button>
        </div>
      )}

      {!debouncedQuery && (
        <p className="text-center text-gray-500 py-4">
          Enter a name, MRN, or phone number to search
        </p>
      )}
    </div>
  );
}

// Episode selection step
function EpisodeSelectionStep({
  patientId,
  patientName,
  onSelect,
  selectedEpisode,
}: {
  patientId: string;
  patientName: string;
  onSelect: (episode: Episode) => void;
  selectedEpisode: Episode | null;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0] || '');
  const [referralDate, setReferralDate] = useState<string>('');
  const [referralSource, setReferralSource] = useState('');

  const { data: episodesData, isLoading } = usePatientEpisodes(patientId);
  const createEpisode = useCreateEpisode(patientId);

  const handleCreateEpisode = async () => {
    try {
      const result = await createEpisode.mutateAsync({
        startDate,
        referralDate: referralDate || undefined,
        referralSource: referralSource || undefined,
      });
      onSelect(result.episode);
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create episode:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  if (selectedEpisode) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Selected Episode</h3>
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">
                Episode #{selectedEpisode.episodeNumber}
              </p>
              <p className="text-sm text-gray-600">
                Started: {formatDate(selectedEpisode.startDate)}
                {selectedEpisode.endDate && ` | Ended: ${formatDate(selectedEpisode.endDate)}`}
              </p>
              <p className="text-sm text-gray-500">
                Status: {selectedEpisode.status}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onSelect(null as unknown as Episode)}
            >
              Change
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          Select Episode for {patientName}
        </h3>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Cancel' : 'New Episode'}
        </Button>
      </div>

      {showCreateForm && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <h4 className="font-medium text-gray-900">Create New Episode</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              label="Referral Date"
              type="date"
              value={referralDate}
              onChange={(e) => setReferralDate(e.target.value)}
            />
            <Input
              label="Referral Source"
              placeholder="e.g., Hospital, Physician"
              value={referralSource}
              onChange={(e) => setReferralSource(e.target.value)}
              className="md:col-span-2"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowCreateForm(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateEpisode}
              disabled={!startDate || createEpisode.isLoading}
            >
              {createEpisode.isLoading ? 'Creating...' : 'Create Episode'}
            </Button>
          </div>
          {createEpisode.isError && (
            <Alert variant="error">
              Failed to create episode. Please try again.
            </Alert>
          )}
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-4">
          <Spinner size="md" label="Loading episodes..." />
        </div>
      )}

      {!isLoading && episodesData?.data && episodesData.data.length > 0 && (
        <div className="border rounded-lg divide-y">
          {episodesData.data.map((episode) => (
            <button
              key={episode.id}
              onClick={() => onSelect(episode)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors focus:outline-none focus:bg-primary-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    Episode #{episode.episodeNumber}
                  </p>
                  <p className="text-sm text-gray-500">
                    Started: {formatDate(episode.startDate)}
                    {episode._count && ` | ${episode._count.assessments} assessment(s)`}
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  episode.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                  episode.status === 'COMPLETED' ? 'bg-gray-100 text-gray-800' :
                  episode.status === 'ON_HOLD' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {episode.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {!isLoading && (!episodesData?.data || episodesData.data.length === 0) && !showCreateForm && (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">No active episodes found for this patient.</p>
          <Button onClick={() => setShowCreateForm(true)}>
            Create First Episode
          </Button>
        </div>
      )}
    </div>
  );
}

// Assessment type selection step
function AssessmentTypeStep({
  patientId,
  onSelect,
  selectedType,
  onCopyFromChange,
  copyFromId,
}: {
  patientId: string;
  onSelect: (type: AssessmentType) => void;
  selectedType: AssessmentType | null;
  onCopyFromChange: (id: string | null) => void;
  copyFromId: string | null;
}) {
  // Get previous assessments for copy-from option
  const { data: previousAssessments } = useAssessments({ patientId, limit: 5 });

  const assessmentTypes: { value: AssessmentType; description: string }[] = [
    { value: 'START_OF_CARE', description: 'Initial assessment when patient begins service' },
    { value: 'RESUMPTION_OF_CARE', description: 'Assessment when patient returns after inpatient stay' },
    { value: 'RECERTIFICATION', description: 'Assessment at the end of certification period' },
    { value: 'FOLLOW_UP', description: 'Follow-up assessment during care' },
    { value: 'TRANSFER_TO_INPATIENT', description: 'Assessment when patient transfers to facility' },
    { value: 'DISCHARGE_FROM_AGENCY', description: 'Final assessment when patient is discharged' },
    { value: 'DEATH_AT_HOME', description: 'Assessment completed when patient dies at home' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Assessment Type</h3>
        <div className="grid grid-cols-1 gap-3">
          {assessmentTypes.map(({ value, description }) => (
            <button
              key={value}
              onClick={() => onSelect(value)}
              className={`text-left p-4 rounded-lg border-2 transition-colors ${
                selectedType === value
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="font-medium text-gray-900">{ASSESSMENT_TYPE_LABELS[value]}</p>
              <p className="text-sm text-gray-500">{description}</p>
            </button>
          ))}
        </div>
      </div>

      {previousAssessments?.data && previousAssessments.data.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Copy From Previous Assessment (Optional)</h3>
          <Select
            value={copyFromId || ''}
            onChange={(e) => onCopyFromChange(e.target.value || null)}
            options={[
              { value: '', label: 'Start fresh - no copy' },
              ...previousAssessments.data.map((a) => ({
                value: a.id,
                label: `${ASSESSMENT_TYPE_LABELS[a.assessmentType]} - ${new Date(a.createdAt).toLocaleDateString()} (${a.completionPercentage}% complete)`,
              })),
            ]}
          />
          <p className="mt-2 text-sm text-gray-500">
            Copying will pre-fill responses from the selected assessment.
          </p>
        </div>
      )}
    </div>
  );
}

export default function CreateAssessmentPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState<PatientListItem | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [selectedType, setSelectedType] = useState<AssessmentType | null>(null);
  const [copyFromId, setCopyFromId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createAssessment = useCreateAssessment();

  const steps = ['Select Patient', 'Select Episode', 'Assessment Type'];

  // Reset subsequent steps when going back
  const handlePatientSelect = useCallback((patient: PatientListItem | null) => {
    setSelectedPatient(patient);
    if (!patient) {
      setSelectedEpisode(null);
      setSelectedType(null);
      setCopyFromId(null);
    }
  }, []);

  const handleEpisodeSelect = useCallback((episode: Episode | null) => {
    setSelectedEpisode(episode);
    if (!episode) {
      setSelectedType(null);
      setCopyFromId(null);
    }
  }, []);

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return !!selectedPatient;
      case 1:
        return !!selectedEpisode;
      case 2:
        return !!selectedType;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPatient || !selectedEpisode || !selectedType) {
      setError('Please complete all required fields');
      return;
    }

    setError(null);

    try {
      const assessment = await createAssessment.mutateAsync({
        patientId: selectedPatient.id,
        episodeId: selectedEpisode.id,
        assessmentType: selectedType,
        copyFromAssessmentId: copyFromId || undefined,
      });

      // Navigate to the assessment wizard
      navigate(`/assessments/${assessment.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create assessment');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New OASIS Assessment</h1>
        <p className="text-gray-500">Create a new patient assessment</p>
      </div>

      <div className="bg-white rounded-lg shadow-card p-6">
        <StepIndicator currentStep={currentStep} steps={steps} />

        {error && (
          <Alert variant="error" className="mb-6">
            {error}
          </Alert>
        )}

        {/* Step Content */}
        <div className="min-h-[300px]">
          {currentStep === 0 && (
            <PatientSearchStep
              onSelect={handlePatientSelect}
              selectedPatient={selectedPatient}
            />
          )}

          {currentStep === 1 && selectedPatient && (
            <EpisodeSelectionStep
              patientId={selectedPatient.id}
              patientName={`${selectedPatient.firstName} ${selectedPatient.lastName}`}
              onSelect={handleEpisodeSelect}
              selectedEpisode={selectedEpisode}
            />
          )}

          {currentStep === 2 && selectedPatient && selectedEpisode && (
            <AssessmentTypeStep
              patientId={selectedPatient.id}
              onSelect={setSelectedType}
              selectedType={selectedType}
              onCopyFromChange={setCopyFromId}
              copyFromId={copyFromId}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between border-t pt-6">
          <div>
            {currentStep > 0 ? (
              <Button variant="secondary" onClick={handleBack}>
                Back
              </Button>
            ) : (
              <Link to="/assessments">
                <Button variant="secondary">Cancel</Button>
              </Link>
            )}
          </div>

          <div>
            {currentStep < steps.length - 1 ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Continue
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed() || createAssessment.isLoading}
              >
                {createAssessment.isLoading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create Assessment'
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
