/**
 * Visit Tab
 *
 * Comprehensive visit documentation with:
 * - Episode Dashboard overview
 * - Dynamic visit note form based on discipline/visit type
 * - OASIS integration for assessment visits
 * - Plan of Care (485) access
 */

import { useState, useCallback, useMemo } from 'react';
import { useEpisodeStore } from '@context/stores/episodeStore';
import EpisodeDashboard from '@components/episode/EpisodeDashboard';
import VisitNoteForm from '@components/visit/VisitNoteForm';
import { Button, Badge, Modal } from '@components/common';
import { DISCIPLINE_LABELS, VISIT_PURPOSE_LABELS, getVisitFormConfig } from '@constants/visitFormConfig';
import type { Discipline, VisitPurpose } from '@typedefs/index';

// Icons
const DocumentIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const ClipboardCheckIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
);

const ListIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
    />
  </svg>
);

type ViewMode = 'dashboard' | 'visit-note' | 'plan-of-care';

// Default discipline/visit for testing - in production this comes from episodeStore
const DEFAULT_DISCIPLINE: Discipline = 'RN';
const DEFAULT_VISIT_PURPOSE: VisitPurpose = 'FOLLOWUP';

interface VisitTabProps {
  visitId?: string;
  onNavigateToOasis?: () => void;
  onNavigateToPlanOfCare?: () => void;
}

export default function VisitTab({
  visitId: propVisitId,
  onNavigateToOasis,
  onNavigateToPlanOfCare,
}: VisitTabProps = {}) {
  // Get episode context
  const {
    currentPatientId,
    currentEpisodeId,
    currentVisitType,
  } = useEpisodeStore();

  // Local state
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [showPocModal, setShowPocModal] = useState(false);

  // Use props or generate test values
  const visitId = propVisitId || `visit_${currentEpisodeId || 'test'}_${Date.now()}`;
  const patientId = currentPatientId || 'patient_test';
  const episodeId = currentEpisodeId || 'episode_test';

  // Map visit type to discipline/purpose
  // In production, this would come from the selected visit or user's discipline
  const discipline: Discipline = DEFAULT_DISCIPLINE;
  const visitPurpose: VisitPurpose = (currentVisitType as VisitPurpose) || DEFAULT_VISIT_PURPOSE;

  // Check if form config exists for this combination
  const formConfig = useMemo(
    () => getVisitFormConfig(discipline, visitPurpose),
    [discipline, visitPurpose]
  );

  // Handle navigation to OASIS
  const handleOasisRequired = useCallback(() => {
    if (onNavigateToOasis) {
      onNavigateToOasis();
    } else {
      // Default behavior - switch to Documentation tab
      const { setActiveTab } = useEpisodeStore.getState();
      setActiveTab('documentation');
    }
  }, [onNavigateToOasis]);

  // Handle visit completion
  const handleVisitComplete = useCallback(() => {
    // Show completion modal or navigate
    console.log('Visit note completed');
  }, []);

  // Handle visit selection from dashboard
  const handleSelectVisit = useCallback((selectedVisitId: string) => {
    console.log('Selected visit:', selectedVisitId);
    // Would typically update route or state to show that visit
  }, []);

  // Handle opening assessments from dashboard
  const handleOpenAssessment = useCallback((assessmentId?: string, type?: string) => {
    console.log('Open assessment:', assessmentId, type);
    if (onNavigateToOasis) {
      onNavigateToOasis();
    }
  }, [onNavigateToOasis]);

  return (
    <div className="space-y-4 pb-8">
      {/* View Mode Tabs */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-2">
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('dashboard')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${viewMode === 'dashboard'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
              }
            `}
          >
            <ListIcon className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setViewMode('visit-note')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${viewMode === 'visit-note'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
              }
            `}
          >
            <DocumentIcon className="w-4 h-4" />
            Visit Note
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Current discipline/visit badge */}
          <Badge variant="info">
            {DISCIPLINE_LABELS[discipline]} - {VISIT_PURPOSE_LABELS[visitPurpose]}
          </Badge>

          {/* Plan of Care button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigateToPlanOfCare?.() || setShowPocModal(true)}
          >
            <ClipboardCheckIcon className="w-4 h-4 mr-1" />
            485 Form
          </Button>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'dashboard' ? (
        <EpisodeDashboard
          episodeId={episodeId}
          onOpenAssessment={handleOpenAssessment}
          onSelectVisit={handleSelectVisit}
        />
      ) : viewMode === 'visit-note' && formConfig ? (
        <VisitNoteForm
          visitId={visitId}
          patientId={patientId}
          episodeId={episodeId}
          discipline={discipline}
          visitPurpose={visitPurpose}
          onComplete={handleVisitComplete}
          onOasisRequired={handleOasisRequired}
        />
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <DocumentIcon className="w-12 h-12 mx-auto text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Form Not Available</h3>
          <p className="mt-2 text-sm text-gray-500">
            No visit note form is configured for {DISCIPLINE_LABELS[discipline]} -{' '}
            {VISIT_PURPOSE_LABELS[visitPurpose]}.
          </p>
        </div>
      )}

      {/* Plan of Care Modal */}
      <Modal
        isOpen={showPocModal}
        onClose={() => setShowPocModal(false)}
        title="Plan of Care (CMS-485)"
        size="lg"
      >
        <div className="p-4">
          <p className="text-gray-600">
            The Plan of Care form would be displayed here. This modal provides quick access
            to view or edit the 485 form.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowPocModal(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onNavigateToPlanOfCare?.();
                setShowPocModal(false);
              }}
            >
              Open Full Form
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
