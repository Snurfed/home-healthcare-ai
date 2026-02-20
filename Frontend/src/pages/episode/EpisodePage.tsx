/**
 * Episode Page
 *
 * Main page for the 3-step episode workflow:
 * Prepare → Visit → Documentation
 */

import { useEffect, useCallback, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePatient, useAssessment } from '@hooks/index';
import { useEpisodeStore, VISIT_TYPE_LABELS, type VisitType } from '@context/stores/episodeStore';
import { Spinner, Modal } from '@components/common';
import EpisodeShell from '@components/episode/EpisodeShell';
import PrepareTab from './PrepareTab';
import VisitTab from './VisitTab';
import DocumentationTab from './DocumentationTab';

export default function EpisodePage() {
  const { patientId, episodeId } = useParams<{ patientId: string; episodeId?: string }>();
  const [searchParams] = useSearchParams();
  const [showUploadsModal, setShowUploadsModal] = useState(false);

  const visitTypeParam = searchParams.get('visitType') as VisitType | null;
  const { activeTab, currentVisitType, loadEpisode, clearEpisode } = useEpisodeStore();

  // Load patient data
  const { data: patient, isLoading: patientLoading } = usePatient(patientId);

  // Load latest assessment if we have an episode
  const { data: assessment } = useAssessment(episodeId);

  // Initialize episode store
  useEffect(() => {
    if (patientId) {
      loadEpisode(patientId, episodeId || '', visitTypeParam || undefined);
    }
    return () => {
      clearEpisode();
    };
  }, [patientId, episodeId, visitTypeParam, loadEpisode, clearEpisode]);

  // Handle recording complete
  const handleRecordingComplete = useCallback((audioBlob: Blob) => {
    console.log('Recording complete:', audioBlob.size, 'bytes');
    // Process the recording - send to backend for transcription
  }, []);

  // Handle view uploads
  const handleViewUploads = useCallback(() => {
    setShowUploadsModal(true);
  }, []);

  if (patientLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">Patient not found</h2>
          <p className="text-gray-500 mt-1">The requested patient could not be found.</p>
        </div>
      </div>
    );
  }

  const patientName = `${patient.lastName}, ${patient.firstName}`;
  const uploadCount = 2; // Mock count
  const visitTypeLabel = currentVisitType ? VISIT_TYPE_LABELS[currentVisitType] : undefined;

  return (
    <>
      <EpisodeShell
        patientName={patientName}
        mrn={patient.mrn}
        status={assessment?.status || 'In Progress'}
        visitType={visitTypeLabel}
        uploadCount={uploadCount}
        onViewUploads={handleViewUploads}
        onRecordingComplete={handleRecordingComplete}
      >
        {/* Tab Content */}
        {activeTab === 'prepare' && (
          <PrepareTab
            patientId={patientId || ''}
          />
        )}

        {activeTab === 'visit' && <VisitTab />}

        {activeTab === 'documentation' && (
          <DocumentationTab
            assessmentId={assessment?.id}
            patientId={patientId}
            patientName={`${patient.firstName} ${patient.lastName}`}
            physicianName={patient.primaryPhysicianName || 'Dr. Smith'}
          />
        )}
      </EpisodeShell>

      {/* Uploads Modal */}
      <Modal
        isOpen={showUploadsModal}
        onClose={() => setShowUploadsModal(false)}
        title="Uploaded Documents"
        size="lg"
      >
        <div className="p-4">
          <p className="text-gray-500">Document viewer would go here...</p>
        </div>
      </Modal>
    </>
  );
}
