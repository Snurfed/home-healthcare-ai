/**
 * Documentation Tab (NestMed Style)
 *
 * OASIS assessment with:
 * - Left sidebar with section navigation
 * - Progress bar with percentage
 * - "Transfer Results to EMR" green button
 * - Green checkmarks for completed items
 * - AI Explanation sparkle buttons
 * - Filter dropdown (Show all / Required only / Incomplete)
 * - AI-powered physician communication triggers
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useEpisodeStore } from '@context/stores/episodeStore';
import { useAssessmentStore } from '@context/stores/assessmentStore';
import { useQuestions, useAssessment } from '@hooks/queries/useAssessments';
import { useAutoSave } from '@hooks/useAutoSave';
import { useClinicalEventAlerts } from '@hooks/useClinicalEvents';
import QuestionRenderer from '@components/oasis/QuestionRenderer';
import { TriggerAlertBanner } from '@components/communication/TriggerAlertBanner';
import { CommunicationDraftEditor } from '@components/communication/CommunicationDraftEditor';
import { EventAlertBanner, EventDetailsModal, QuickEmailDraftModal } from '@components/clinical-events';
import { useCommunicationTriggers } from '@hooks/useCommunicationTriggers';
import { Spinner } from '@components/common';
import { OASIS_SECTIONS } from '@typedefs/oasis.types';
import type { OASISSectionId, OASISQuestion, OASISResponse } from '@typedefs/index';
import type { CommunicationTriggerWithStatus } from '@typedefs/communication.types';
import type { KeywordMatch, DetectedClinicalEvent } from '@typedefs/clinicalEvents.types';

type FilterOption = 'all' | 'required' | 'incomplete';

interface SectionInfo {
  id: OASISSectionId;
  name: string;
  shortName: string;
  completedCount: number;
  totalCount: number;
}

interface SidebarSectionProps {
  section: SectionInfo;
  isActive: boolean;
  onClick: () => void;
}

function SidebarSection({ section, isActive, onClick }: SidebarSectionProps) {
  const isComplete = section.completedCount === section.totalCount && section.totalCount > 0;
  const hasProgress = section.completedCount > 0;

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
        ${isActive
          ? 'bg-green-50 text-green-700'
          : 'text-gray-700 hover:bg-gray-50'
        }
      `}
    >
      {/* Status indicator */}
      <span
        className={`
          flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs
          ${isComplete
            ? 'bg-green-500 text-white'
            : hasProgress
              ? 'bg-green-100 text-green-600'
              : 'bg-gray-200 text-gray-500'
          }
        `}
      >
        {isComplete ? (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          section.completedCount
        )}
      </span>

      {/* Title and count */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? 'text-green-700' : 'text-gray-900'}`}>
          {section.shortName}
        </p>
        <p className="text-xs text-gray-500">
          {section.completedCount}/{section.totalCount}
        </p>
      </div>
    </button>
  );
}

interface DocumentationTabProps {
  assessmentId?: string;
  patientId?: string;
  physicianName?: string;
  physicianNpi?: string;
}

export default function DocumentationTab({
  assessmentId,
  patientId: propPatientId,
  physicianName = 'Dr. Smith',
  physicianNpi,
}: DocumentationTabProps) {
  const [activeSection, setActiveSection] = useState<OASISSectionId>('clinical_record');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [transferring, setTransferring] = useState(false);
  const {
    hideCompletedCards,
    setHideCompletedCards,
    currentPatientId,
    currentEpisodeId,
  } = useEpisodeStore();

  // Use prop or store for patient/episode IDs
  const patientId = propPatientId || currentPatientId || '';
  const episodeId = currentEpisodeId || '';

  // Assessment store for managing responses
  const {
    currentAssessment,
    draftResponses,
    updateResponse,
    getResponseValue,
    isDirty,
  } = useAssessmentStore();

  // Fetch assessment data
  const { isLoading: assessmentLoading } = useAssessment(assessmentId);

  // Fetch questions for the active section
  const { data: questions = [], isLoading: questionsLoading } = useQuestions({
    section: activeSection,
  });

  // Auto-save draft responses
  useAutoSave({
    assessmentId: assessmentId || '',
    debounceMs: 2000,
    enabled: !!assessmentId && isDirty,
  });

  // Communication triggers state
  const [showTriggerBanner, setShowTriggerBanner] = useState(true);
  const [showDraftEditor, setShowDraftEditor] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState<CommunicationTriggerWithStatus | null>(null);

  // Communication triggers hook
  const {
    activeTriggers,
    dismissTrigger,
    hasActiveTriggers,
    detectTriggers,
  } = useCommunicationTriggers({
    assessmentId: assessmentId || '',
    enabled: !!assessmentId,
    debounceMs: 500,
  });

  // Clinical events detection state
  const [showClinicalEventsBanner, setShowClinicalEventsBanner] = useState(true);
  const [showEventDetailsModal, setShowEventDetailsModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<KeywordMatch | DetectedClinicalEvent | null>(null);
  const [showQuickEmailDraft, setShowQuickEmailDraft] = useState(false);
  const [draftCommunicationEvent, setDraftCommunicationEvent] = useState<KeywordMatch | DetectedClinicalEvent | null>(null);

  // Clinical events detection hook
  const {
    realtimeMatches,
    pendingEvents,
    isDetecting: isDetectingEvents,
    acknowledge: acknowledgeEvent,
    dismiss: dismissEvent,
  } = useClinicalEventAlerts(patientId, episodeId, {
    enableRealtime: true,
    enablePolling: true,
    pollingInterval: 60000, // Check every minute
  });

  // Combined events for display
  const hasClinicalEvents = realtimeMatches.length > 0 || pendingEvents.length > 0;

  // Detect triggers when responses change
  useEffect(() => {
    if (assessmentId && Object.keys(draftResponses).length > 0) {
      const lastChange = Object.entries(draftResponses).pop();
      if (lastChange) {
        const [itemCode, response] = lastChange;
        detectTriggers(itemCode, { [itemCode]: response.responseValue || '' });
      }
    }
  }, [assessmentId, draftResponses, detectTriggers]);

  // Calculate section completion counts
  const sectionInfo = useMemo((): SectionInfo[] => {
    const responses = currentAssessment?.responses || {};
    const allResponses = { ...responses, ...draftResponses };

    return OASIS_SECTIONS.map((section) => {
      // Get short name from section name
      const shortName = section.name.includes('.')
        ? section.name.split('.')[1]?.trim().split(' ').slice(0, 2).join(' ') || section.name
        : section.name.split(' ').slice(0, 2).join(' ');

      // Count completed questions for this section
      // We need to know which item codes belong to which section
      // For now, we'll estimate based on the section's requiredItems
      const sectionResponses = Object.values(allResponses).filter((r) => {
        // Match responses to sections based on item code patterns
        const code = (r as OASISResponse).itemCode || '';
        if (section.id === 'administrative' && code.match(/^M00/)) return true;
        if (section.id === 'clinical_record' && code.match(/^M10/)) return true;
        if (section.id === 'functional_abilities' && code.match(/^GG/)) return true;
        if (section.id === 'functional_status' && code.match(/^M18/)) return true;
        if (section.id === 'medications' && code.match(/^M20/)) return true;
        if (section.id === 'skin_conditions' && code.match(/^M13/)) return true;
        if (section.id === 'cognitive' && code.match(/^C\d|^M17/)) return true;
        if (section.id === 'mood' && code.match(/^D\d/)) return true;
        return false;
      });

      const completedCount = sectionResponses.filter((r) => {
        const resp = r as OASISResponse;
        return !!(resp.responseValue || resp.responseCode || resp.responseNumeric !== undefined);
      }).length;

      return {
        id: section.id,
        name: section.name,
        shortName,
        completedCount: Math.min(completedCount, section.requiredItems),
        totalCount: section.requiredItems,
      };
    });
  }, [currentAssessment?.responses, draftResponses]);

  // Filter questions based on filter option
  const filteredQuestions = useMemo(() => {
    if (!questions) return [];

    return questions.filter((q: OASISQuestion) => {
      const response = getResponseValue(q.itemCode);
      const hasValue = !!(response?.responseValue || response?.responseCode || response?.responseNumeric !== undefined);
      const isRequired = q.validationRules?.some((r) => r.ruleType === 'required') ?? false;

      // Apply hide completed filter
      if (hideCompletedCards && hasValue) return false;

      switch (filter) {
        case 'required':
          return isRequired;
        case 'incomplete':
          return !hasValue;
        default:
          return true;
      }
    });
  }, [questions, filter, hideCompletedCards, getResponseValue]);

  // Handle response change
  const handleResponseChange = useCallback(
    (itemCode: string, response: Partial<OASISResponse>) => {
      updateResponse(itemCode, response);
    },
    [updateResponse]
  );

  // Handle opening draft editor for a trigger
  const handleReviewDraft = useCallback((trigger: CommunicationTriggerWithStatus) => {
    setSelectedTrigger(trigger);
    setShowDraftEditor(true);
  }, []);

  // Handle dismissing a trigger
  const handleDismissTrigger = useCallback(async (ruleId: string) => {
    await dismissTrigger(ruleId, 'dismissed');
  }, [dismissTrigger]);

  // Handle dismissing all triggers
  const handleDismissAll = useCallback(async () => {
    for (const trigger of activeTriggers) {
      await dismissTrigger(trigger.ruleId, 'dismissed');
    }
  }, [activeTriggers, dismissTrigger]);

  // Close the banner
  const handleCloseBanner = useCallback(() => {
    setShowTriggerBanner(false);
  }, []);

  // Close draft editor
  const handleCloseDraftEditor = useCallback(() => {
    setShowDraftEditor(false);
    setSelectedTrigger(null);
  }, []);

  // Handle saved communication
  const handleCommunicationSaved = useCallback(() => {
    console.log('Communication saved successfully');
  }, []);

  // Clinical event handlers
  const handleReviewClinicalEvent = useCallback((event: KeywordMatch | DetectedClinicalEvent) => {
    setSelectedEvent(event);
    setShowEventDetailsModal(true);
  }, []);

  const handleDismissClinicalEventMatch = useCallback((match: KeywordMatch) => {
    // For real-time matches, we just hide them locally
    // They'll be properly handled when saved
    console.log('Dismissed real-time match:', match.eventType);
  }, []);

  const handleCloseClinicalEventsBanner = useCallback(() => {
    setShowClinicalEventsBanner(false);
  }, []);

  const handleCloseEventDetailsModal = useCallback(() => {
    setShowEventDetailsModal(false);
    setSelectedEvent(null);
  }, []);

  const handleAcknowledgeClinicalEvent = useCallback((eventId: string) => {
    acknowledgeEvent(eventId);
    setShowEventDetailsModal(false);
    setSelectedEvent(null);
  }, [acknowledgeEvent]);

  const handleDismissClinicalEvent = useCallback((eventId: string, reason: string) => {
    dismissEvent({ eventId, reason });
    setShowEventDetailsModal(false);
    setSelectedEvent(null);
  }, [dismissEvent]);

  const handleDraftCommunicationFromEvent = useCallback((event: KeywordMatch | DetectedClinicalEvent) => {
    // Close the event modal and open the quick email draft modal
    setShowEventDetailsModal(false);
    setSelectedEvent(null);
    setDraftCommunicationEvent(event);
    setShowQuickEmailDraft(true);
  }, []);

  const handleCloseQuickEmailDraft = useCallback(() => {
    setShowQuickEmailDraft(false);
    setDraftCommunicationEvent(null);
  }, []);

  const handleTransferToEMR = useCallback(() => {
    setTransferring(true);
    setTimeout(() => {
      setTransferring(false);
      alert('Results transferred to EMR successfully!');
    }, 1500);
  }, []);

  // Navigate to previous/next section
  const navigateSection = useCallback((direction: 'prev' | 'next') => {
    const currentIndex = OASIS_SECTIONS.findIndex((s) => s.id === activeSection);
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    const newSection = OASIS_SECTIONS[newIndex];
    if (newIndex >= 0 && newIndex < OASIS_SECTIONS.length && newSection) {
      setActiveSection(newSection.id);
    }
  }, [activeSection]);

  // Calculate overall progress
  const totalItems = sectionInfo.reduce((sum, s) => sum + s.totalCount, 0);
  const completedItems = sectionInfo.reduce((sum, s) => sum + s.completedCount, 0);
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Get current section info
  const currentSectionInfo = sectionInfo.find((s) => s.id === activeSection);
  const currentIndex = OASIS_SECTIONS.findIndex((s) => s.id === activeSection);
  const hasPrevSection = currentIndex > 0;
  const hasNextSection = currentIndex < OASIS_SECTIONS.length - 1;

  const isLoading = assessmentLoading || questionsLoading;

  return (
    <div className="flex gap-6 min-h-[calc(100vh-200px)]">
      {/* Left Sidebar */}
      <div className="w-56 flex-shrink-0">
        <div className="sticky top-24 space-y-4">
          {/* Progress Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">Progress</span>
              <span className="text-lg font-bold text-green-600">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {completedItems} of {totalItems} items
            </p>
            {isDirty && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                Unsaved changes
              </p>
            )}
          </div>

          {/* Sections List */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 max-h-[50vh] overflow-y-auto">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider px-3 mb-2">
              Sections
            </h3>
            <div className="space-y-1">
              {sectionInfo.map((section) => (
                <SidebarSection
                  key={section.id}
                  section={section}
                  isActive={activeSection === section.id}
                  onClick={() => setActiveSection(section.id)}
                />
              ))}
            </div>
          </div>

          {/* Transfer to EMR Button */}
          <button
            onClick={handleTransferToEMR}
            disabled={transferring}
            className={`
              w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium
              transition-all min-h-[48px]
              ${transferring
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-200'
              }
            `}
          >
            {transferring ? (
              <>
                <Spinner size="sm" />
                <span>Transferring...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                <span>Transfer to EMR</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Clinical Events Alert Banner */}
        {showClinicalEventsBanner && hasClinicalEvents && (
          <EventAlertBanner
            realtimeMatches={realtimeMatches}
            pendingEvents={pendingEvents}
            onReviewEvent={handleReviewClinicalEvent}
            onDismissMatch={handleDismissClinicalEventMatch}
            onDismissBanner={handleCloseClinicalEventsBanner}
            isDetecting={isDetectingEvents}
          />
        )}

        {/* Communication Trigger Alert Banner */}
        {showTriggerBanner && hasActiveTriggers && (
          <TriggerAlertBanner
            triggers={activeTriggers}
            onReviewDraft={handleReviewDraft}
            onDismiss={handleDismissTrigger}
            onDismissAll={handleDismissAll}
            onClose={handleCloseBanner}
          />
        )}

        {/* Header with filters */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {currentSectionInfo?.name || 'Documentation'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {filteredQuestions.length} items
              {filter !== 'all' && ` (${filter})`}
            </p>
          </div>

          {/* Filter and hide toggle */}
          <div className="flex items-center gap-4">
            {/* Filter dropdown */}
            <div className="relative">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterOption)}
                className="appearance-none bg-gray-100 border-0 rounded-lg px-4 py-2 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[44px]"
              >
                <option value="all">Show all items</option>
                <option value="required">Required only</option>
                <option value="incomplete">Incomplete only</option>
              </select>
              <svg
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Hide completed toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={hideCompletedCards}
                  onChange={(e) => setHideCompletedCards(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500" />
              </div>
              <span className="text-sm text-gray-600">Hide completed</span>
            </label>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12 bg-white rounded-xl border border-gray-200">
            <Spinner size="lg" />
            <span className="ml-3 text-gray-500">Loading questions...</span>
          </div>
        )}

        {/* No Questions Message */}
        {!isLoading && filteredQuestions.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No questions found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filter !== 'all'
                ? 'Try changing the filter to see more questions.'
                : 'No questions available for this section.'}
            </p>
          </div>
        )}

        {/* Question Cards */}
        {!isLoading && filteredQuestions.length > 0 && (
          <div className="space-y-4">
            {filteredQuestions.map((question: OASISQuestion) => {
              const response = getResponseValue(question.itemCode);
              return (
                <QuestionRenderer
                  key={question.itemCode}
                  question={question}
                  value={response}
                  onChange={(resp) => handleResponseChange(question.itemCode, resp)}
                />
              );
            })}
          </div>
        )}

        {/* Bottom navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <button
            onClick={() => navigateSection('prev')}
            disabled={!hasPrevSection}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors min-h-[44px] ${
              hasPrevSection
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                : 'text-gray-300 cursor-not-allowed'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous Section
          </button>

          <button
            onClick={() => navigateSection('next')}
            disabled={!hasNextSection}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors min-h-[44px] ${
              hasNextSection
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Next Section
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Communication Draft Editor Modal */}
      <CommunicationDraftEditor
        isOpen={showDraftEditor}
        onClose={handleCloseDraftEditor}
        assessmentId={assessmentId || ''}
        trigger={selectedTrigger || undefined}
        physicianName={physicianName}
        physicianNpi={physicianNpi}
        onSaved={handleCommunicationSaved}
      />

      {/* Clinical Event Details Modal */}
      <EventDetailsModal
        event={selectedEvent}
        isOpen={showEventDetailsModal}
        onClose={handleCloseEventDetailsModal}
        onAcknowledge={handleAcknowledgeClinicalEvent}
        onDismiss={handleDismissClinicalEvent}
        onDraftCommunication={handleDraftCommunicationFromEvent}
      />

      {/* Quick Email Draft Modal (for clinical events) */}
      <QuickEmailDraftModal
        event={draftCommunicationEvent}
        isOpen={showQuickEmailDraft}
        onClose={handleCloseQuickEmailDraft}
        patientName={currentAssessment?.patient?.lastName ? `${currentAssessment.patient.firstName} ${currentAssessment.patient.lastName}` : 'Patient'}
        physicianName={physicianName}
      />
    </div>
  );
}
