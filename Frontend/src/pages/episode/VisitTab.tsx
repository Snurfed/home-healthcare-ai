/**
 * Visit Tab
 *
 * Comprehensive visit documentation with:
 * - Episode Dashboard overview
 * - Dynamic visit note form based on discipline/visit type
 * - Canonical Form Engine integration (EMR-agnostic)
 * - EMR Export functionality
 * - OASIS integration for assessment visits
 * - Plan of Care (485) access
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useEpisodeStore } from '@context/stores/episodeStore';
import EpisodeDashboard from '@components/episode/EpisodeDashboard';
import { VisitFormContainer } from '@components/forms';
import EMRExportPanel from '@components/forms/EMRExportPanel';
import { Button, Badge, Modal } from '@components/common';
import { DISCIPLINE_LABELS, VISIT_PURPOSE_LABELS } from '@constants/visitFormConfig';
import type { Discipline, VisitType } from '@typedefs/index';

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

const ExportIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
    />
  </svg>
);

type ViewMode = 'dashboard' | 'visit-note' | 'export';

// Default discipline/visit for testing - in production this comes from episodeStore
const DEFAULT_DISCIPLINE: Discipline = 'RN';
const DEFAULT_VISIT_TYPE: VisitType = 'FOLLOWUP';

// Map VisitPurpose to VisitType (they're the same but different naming conventions)
const mapVisitPurposeToType = (purpose: string): VisitType => {
  const mapping: Record<string, VisitType> = {
    SOC: 'SOC',
    ROC: 'ROC',
    RECERT: 'RECERT',
    FOLLOWUP: 'FOLLOWUP',
    DISCHARGE: 'DISCHARGE',
    EVALUATION: 'EVAL',
    SUPERVISORY: 'SUPERVISORY',
  };
  return mapping[purpose] || 'FOLLOWUP';
};

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
    currentEpisodeId,
    currentVisitType,
    currentVisitId,
  } = useEpisodeStore();

  // Local state
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [showPocModal, setShowPocModal] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Generate stable visit ID (only once per component instance)
  const generatedVisitIdRef = useRef<string | null>(null);
  if (!generatedVisitIdRef.current) {
    generatedVisitIdRef.current = `visit_${currentEpisodeId || 'new'}_${Date.now()}`;
  }

  // Use props or store values - prioritize explicit values over generated
  const visitId = propVisitId || currentVisitId || generatedVisitIdRef.current;
  const episodeId = currentEpisodeId || 'episode_test';

  // Map visit type to discipline/purpose
  // In production, this would come from the selected visit or user's discipline
  const discipline: Discipline = DEFAULT_DISCIPLINE;
  const visitType: VisitType = mapVisitPurposeToType(currentVisitType || '') || DEFAULT_VISIT_TYPE;

  // Debug logging to trace visit type flow
  useEffect(() => {
    console.log('[VisitTab] Visit type debug:', {
      currentVisitType,
      mappedVisitType: visitType,
      visitId,
      episodeId,
    });
  }, [currentVisitType, visitType, visitId, episodeId]);

  // Get visit purpose label for display
  const visitPurposeLabel = useMemo(() => {
    return VISIT_PURPOSE_LABELS[visitType as keyof typeof VISIT_PURPOSE_LABELS] || visitType;
  }, [visitType]);

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

  // Handle visit save success
  const handleSaveSuccess = useCallback(() => {
    console.log('Visit note saved successfully');
  }, []);

  // Handle validation change
  const handleValidationChange = useCallback((isValid: boolean, errors: string[]) => {
    setIsFormValid(isValid);
    setFormErrors(errors);
  }, []);

  // Handle visit selection from dashboard
  const handleSelectVisit = useCallback((selectedVisitId: string) => {
    console.log('Selected visit:', selectedVisitId);
    // Update store with selected visit
    const { setCurrentVisit } = useEpisodeStore.getState();
    setCurrentVisit(selectedVisitId);
    setViewMode('visit-note');
  }, []);

  // Handle opening assessments from dashboard
  const handleOpenAssessment = useCallback((assessmentId?: string, type?: string) => {
    console.log('Open assessment:', assessmentId, type);
    if (onNavigateToOasis) {
      onNavigateToOasis();
    }
  }, [onNavigateToOasis]);

  // Handle export complete
  const handleExportComplete = useCallback(() => {
    console.log('Export completed');
  }, []);

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
          <button
            onClick={() => setViewMode('export')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${viewMode === 'export'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
              }
            `}
          >
            <ExportIcon className="w-4 h-4" />
            EMR Export
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Current discipline/visit badge */}
          <Badge variant="info">
            {DISCIPLINE_LABELS[discipline]} - {visitPurposeLabel}
          </Badge>

          {/* Validation status */}
          {viewMode === 'visit-note' && (
            <Badge variant={isFormValid ? 'success' : 'warning'}>
              {isFormValid ? 'Ready' : `${formErrors.length} issues`}
            </Badge>
          )}

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
      ) : viewMode === 'visit-note' ? (
        <VisitFormContainer
          visitId={visitId}
          discipline={discipline}
          visitType={visitType}
          onSaveSuccess={handleSaveSuccess}
          onValidationChange={handleValidationChange}
          autoSave={true}
          autoSaveDelay={2000}
        />
      ) : viewMode === 'export' ? (
        <EMRExportPanel
          visitId={visitId}
          discipline={discipline}
          visitType={visitType}
          onExportComplete={handleExportComplete}
        />
      ) : null}

      {/* OASIS Required Banner - shown when in visit-note mode and OASIS is needed */}
      {viewMode === 'visit-note' && (visitType === 'SOC' || visitType === 'ROC' || visitType === 'RECERT' || visitType === 'DISCHARGE') && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <ClipboardCheckIcon className="w-5 h-5" />
            <span className="text-sm font-medium">OASIS assessment required</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOasisRequired}
              className="bg-white text-blue-600 hover:bg-blue-50"
            >
              Open OASIS
            </Button>
          </div>
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
