/**
 * New Patient Page
 *
 * Standalone page for creating a new patient
 */

import { useNavigate, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { usePatient } from '@hooks/index';
import { Button, Spinner, Alert } from '@components/common';
import CreatePatientForm from '@components/patients/CreatePatientForm';

export default function NewPatientPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  // Fetch patient data if editing
  const { data: patient, isLoading, error } = usePatient(id);

  const handleSuccess = () => {
    navigate('/patients');
  };

  const handleCancel = () => {
    navigate('/patients');
  };

  if (isEditMode && isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isEditMode && error) {
    return (
      <div className="max-w-3xl mx-auto">
        <Alert variant="error">
          Failed to load patient data. Please try again.
        </Alert>
        <div className="mt-4">
          <Link to="/patients">
            <Button variant="secondary">Back to Patients</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/patients"
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? 'Edit Patient' : 'Add New Patient'}
          </h1>
          <p className="text-gray-500">
            {isEditMode
              ? `Editing ${patient?.firstName} ${patient?.lastName}`
              : 'Enter patient information to create a new record'}
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-lg shadow-card p-6">
        <CreatePatientForm onSuccess={handleSuccess} onCancel={handleCancel} />
      </div>
    </div>
  );
}
