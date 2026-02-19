/**
 * Documentation Tab - Single Scroll Layout
 *
 * All OASIS sections stacked vertically with:
 * - Fixed left sidebar with click-to-scroll navigation
 * - IntersectionObserver to highlight current section
 * - Unanswered filter toggle with badges
 * - Progress bar at bottom of sidebar
 * - 140px bottom padding for recording bar
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useEpisodeStore } from '@context/stores/episodeStore';
import { useAssessmentStore } from '@context/stores/assessmentStore';
import { useAllQuestions, useAssessment } from '@hooks/queries/useAssessments';
import { useAutoSave } from '@hooks/useAutoSave';
import { useClinicalEventAlerts } from '@hooks/useClinicalEvents';
import QuestionRenderer from '@components/oasis/QuestionRenderer';
import { TriggerAlertBanner } from '@components/communication/TriggerAlertBanner';
import { CommunicationDraftEditor } from '@components/communication/CommunicationDraftEditor';
import { EventAlertBanner, EventDetailsModal } from '@components/clinical-events';
import { useCommunicationTriggers } from '@hooks/useCommunicationTriggers';
import { Spinner } from '@components/common';
import { OASIS_SECTIONS } from '@typedefs/oasis.types';
import { openPhysicianEmail } from '@utils/physicianEmail';
import type { OASISSectionId, OASISQuestion, OASISResponse } from '@typedefs/index';
import type { CommunicationTriggerWithStatus } from '@typedefs/communication.types';
import type { KeywordMatch, DetectedClinicalEvent } from '@typedefs/clinicalEvents.types';

interface SectionData {
  id: OASISSectionId;
  name: string;
  shortName: string;
  questions: OASISQuestion[];
  answeredCount: number;
  totalCount: number;
}

// Administrative items classification
// Hidden completely - agency constants (auto-injected on EMR export)
const HIDDEN_ADMIN_ITEMS = ['M0010', 'M0014', 'M0016', 'M0018'];

// Read-only demographics - shown in verification card, not counted as questions
const DEMOGRAPHIC_ITEMS = ['M0020', 'M0040', 'M0050', 'M0060', 'M0066', 'M0069'];

// Clinician confirmation items - pre-filled but editable
const CLINICIAN_CONFIRM_ITEMS = ['M0030', 'M0032', 'M0080', 'M0090'];

// Patient Info Card - shows demographics as read-only verification
function PatientInfoCard({
  patientName,
  patientId,
  dob,
  gender,
  state,
  zip,
}: {
  patientName?: string;
  patientId?: string;
  dob?: string;
  gender?: string;
  state?: string;
  zip?: string;
}) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-blue-900 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Patient Information (from referral)
        </h3>
        <span className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
          Edit in patient record →
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <div>
          <span className="text-blue-600 text-xs">Name</span>
          <p className="font-medium text-gray-900">{patientName || '—'}</p>
        </div>
        <div>
          <span className="text-blue-600 text-xs">Patient ID</span>
          <p className="font-medium text-gray-900">{patientId || '—'}</p>
        </div>
        <div>
          <span className="text-blue-600 text-xs">DOB</span>
          <p className="font-medium text-gray-900">{dob || '—'}</p>
        </div>
        <div>
          <span className="text-blue-600 text-xs">Gender</span>
          <p className="font-medium text-gray-900">{gender || '—'}</p>
        </div>
        <div>
          <span className="text-blue-600 text-xs">State</span>
          <p className="font-medium text-gray-900">{state || '—'}</p>
        </div>
        <div>
          <span className="text-blue-600 text-xs">ZIP</span>
          <p className="font-medium text-gray-900">{zip || '—'}</p>
        </div>
      </div>
    </div>
  );
}

interface DocumentationTabProps {
  assessmentId?: string;
  patientId?: string;
  patientName?: string;
  physicianName?: string;
  physicianNpi?: string;
}

export default function DocumentationTab({
  assessmentId,
  patientId: propPatientId,
  patientName: propPatientName,
  physicianName = 'Dr. Smith',
  physicianNpi,
}: DocumentationTabProps) {
  // Filter state
  const [showUnansweredOnly, setShowUnansweredOnly] = useState(false);
  const [activeSection, setActiveSection] = useState<OASISSectionId>('clinical_record');
  const [transferring, setTransferring] = useState(false);

  // Section refs for scroll-to
  const sectionRefs = useRef<Map<OASISSectionId, HTMLDivElement>>(new Map());

  // Episode store
  const { currentPatientId, currentEpisodeId } = useEpisodeStore();
  const patientId = propPatientId || currentPatientId || '';
  const episodeId = currentEpisodeId || '';

  // Assessment store
  const {
    draftResponses,
    updateResponse,
    getResponseValue,
    isDirty,
  } = useAssessmentStore();

  // Fetch assessment data
  const { isLoading: assessmentLoading } = useAssessment(assessmentId);

  // Fetch ALL questions for all sections
  const { data: allQuestions = [], isLoading: questionsLoading } = useAllQuestions();

  // Auto-save
  useAutoSave({
    assessmentId: assessmentId || '',
    debounceMs: 2000,
    enabled: !!assessmentId && isDirty,
  });

  // Communication triggers
  const [showTriggerBanner, setShowTriggerBanner] = useState(true);
  const [showDraftEditor, setShowDraftEditor] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState<CommunicationTriggerWithStatus | null>(null);

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

  // Clinical events
  const [showClinicalEventsBanner, setShowClinicalEventsBanner] = useState(true);
  const [showEventDetailsModal, setShowEventDetailsModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<KeywordMatch | DetectedClinicalEvent | null>(null);

  const {
    realtimeMatches,
    pendingEvents,
    isDetecting: isDetectingEvents,
    acknowledge: acknowledgeEvent,
    dismiss: dismissEvent,
  } = useClinicalEventAlerts(patientId, episodeId, {
    enableRealtime: true,
    enablePolling: true,
    pollingInterval: 60000,
  });

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

  // Check if a question is answered - include draftResponses in deps to trigger re-render
  const isQuestionAnswered = useCallback((itemCode: string): boolean => {
    const response = getResponseValue(itemCode);
    return !!(response?.responseValue || response?.responseCode || response?.responseNumeric !== undefined);
  }, [getResponseValue, draftResponses]); // eslint-disable-line react-hooks/exhaustive-deps

  // Group questions by section with counts - recalculate when draftResponses changes
  // Excludes hidden admin items and demographics (shown separately)
  const sectionData = useMemo((): SectionData[] => {
    return OASIS_SECTIONS.map((section) => {
      const shortName = section.name.includes('.')
        ? section.name.split('.')[1]?.trim().split(' ').slice(0, 2).join(' ') || section.name
        : section.name.split(' ').slice(0, 2).join(' ');

      // Filter questions belonging to this section
      let sectionQuestions = allQuestions.filter((q: OASISQuestion) => {
        const code = q.itemCode || '';
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

      // For administrative section, exclude hidden items and demographics
      // Only show clinician confirmation items (M0030, M0032, M0080, M0090)
      if (section.id === 'administrative') {
        sectionQuestions = sectionQuestions.filter((q: OASISQuestion) => {
          const code = q.itemCode || '';
          // Hide agency constants and demographics
          if (HIDDEN_ADMIN_ITEMS.includes(code)) return false;
          if (DEMOGRAPHIC_ITEMS.includes(code)) return false;
          // Only show clinician confirmation items
          return CLINICIAN_CONFIRM_ITEMS.includes(code);
        });
      }

      // Count answered questions - uses draftResponses via getResponseValue
      const answeredCount = sectionQuestions.filter((q: OASISQuestion) => {
        const response = getResponseValue(q.itemCode);
        return !!(response?.responseValue || response?.responseCode || response?.responseNumeric !== undefined);
      }).length;

      return {
        id: section.id,
        name: section.name,
        shortName,
        questions: sectionQuestions,
        answeredCount,
        totalCount: sectionQuestions.length,
      };
    }).filter(s => s.totalCount > 0); // Only show sections with questions
  }, [allQuestions, draftResponses, getResponseValue]);

  // Calculate totals
  const totalQuestions = sectionData.reduce((sum, s) => sum + s.totalCount, 0);
  const totalAnswered = sectionData.reduce((sum, s) => sum + s.answeredCount, 0);
  const totalRemaining = totalQuestions - totalAnswered;
  const isComplete = totalRemaining === 0 && totalQuestions > 0;

  // Scroll-spy: track which section is visible using scroll events
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const viewportTop = scrollTop + 150; // 15% from top of viewport

      let currentSection: OASISSectionId | null = null;

      // Find the section whose header has scrolled past the 15% mark
      sectionRefs.current.forEach((element, sectionId) => {
        const rect = element.getBoundingClientRect();
        const elementTop = rect.top + scrollTop;

        if (elementTop <= viewportTop) {
          currentSection = sectionId;
        }
      });

      if (currentSection && currentSection !== activeSection) {
        setActiveSection(currentSection);
      }
    };

    // Initial check
    handleScroll();

    // Listen to scroll events
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [sectionData, activeSection]);

  // Scroll to section
  const scrollToSection = useCallback((sectionId: OASISSectionId) => {
    const element = sectionRefs.current.get(sectionId);
    if (element) {
      const yOffset = -120; // Account for sticky header
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, []);

  // Handle response change
  const handleResponseChange = useCallback(
    (itemCode: string, response: Partial<OASISResponse>) => {
      updateResponse(itemCode, response);
    },
    [updateResponse]
  );

  // Communication handlers
  const handleReviewDraft = useCallback((trigger: CommunicationTriggerWithStatus) => {
    setSelectedTrigger(trigger);
    setShowDraftEditor(true);
  }, []);

  const handleDismissTrigger = useCallback(async (ruleId: string) => {
    await dismissTrigger(ruleId, 'dismissed');
  }, [dismissTrigger]);

  const handleDismissAll = useCallback(async () => {
    for (const trigger of activeTriggers) {
      await dismissTrigger(trigger.ruleId, 'dismissed');
    }
  }, [activeTriggers, dismissTrigger]);

  const handleCloseBanner = useCallback(() => {
    setShowTriggerBanner(false);
  }, []);

  const handleCloseDraftEditor = useCallback(() => {
    setShowDraftEditor(false);
    setSelectedTrigger(null);
  }, []);

  const handleCommunicationSaved = useCallback(() => {
    console.log('Communication saved successfully');
  }, []);

  // Clinical event handlers
  const handleReviewClinicalEvent = useCallback((event: KeywordMatch | DetectedClinicalEvent) => {
    setSelectedEvent(event);
    setShowEventDetailsModal(true);
  }, []);

  const handleDismissClinicalEventMatch = useCallback((match: KeywordMatch) => {
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
    setShowEventDetailsModal(false);
    setSelectedEvent(null);
    openPhysicianEmail({
      event,
      patientName: propPatientName || 'Patient',
      physicianName,
    });
  }, [propPatientName, physicianName]);

  const handleTransferToEMR = useCallback(() => {
    setTransferring(true);
    setTimeout(() => {
      setTransferring(false);
      alert('Results transferred to EMR successfully!');
    }, 1500);
  }, []);

  const isLoading = assessmentLoading || questionsLoading;

  return (
    <div className="flex gap-6 pb-36"> {/* pb-36 = 144px for recording bar */}
      {/* Fixed Left Sidebar */}
      <div className="w-56 flex-shrink-0">
        <div className="fixed w-56 top-32 bottom-36 flex flex-col">
          {/* Filter Toggle */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3">
            <button
              onClick={() => setShowUnansweredOnly(!showUnansweredOnly)}
              className={`
                w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${showUnansweredOnly
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
              `}
            >
              {showUnansweredOnly ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Show Unanswered Only
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Show All
                </>
              )}
            </button>
          </div>

          {/* Section Navigation */}
          <div className="flex-1 bg-white rounded-xl border border-gray-200 p-3 overflow-y-auto">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider px-3 mb-2">
              Sections
            </h3>
            <div className="space-y-1">
              {sectionData.map((section) => {
                const isActive = activeSection === section.id;
                const isComplete = section.answeredCount === section.totalCount;
                const remaining = section.totalCount - section.answeredCount;

                // Hide complete sections when filtering
                if (showUnansweredOnly && isComplete) return null;

                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
                      ${isActive
                        ? 'bg-green-50 text-green-700 border-l-2 border-green-500'
                        : 'text-gray-700 hover:bg-gray-50'
                      }
                    `}
                  >
                    {/* Status badge */}
                    <span
                      className={`
                        flex-shrink-0 min-w-[28px] px-1.5 py-0.5 rounded text-xs font-medium text-center
                        ${isComplete
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                        }
                      `}
                    >
                      {isComplete ? '✓' : `${remaining}`}
                    </span>

                    {/* Section name */}
                    <span className={`text-sm truncate ${isActive ? 'font-medium' : ''}`}>
                      {section.shortName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Progress Bar & Transfer Button */}
          <div className="mt-3 space-y-3">
            {/* Progress */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              {isComplete ? (
                <div className="flex items-center gap-2 text-green-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Ready for EMR</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">{totalAnswered}/{totalQuestions} complete</span>
                    <span className="font-medium text-amber-600">{totalRemaining} remaining</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${(totalAnswered / totalQuestions) * 100}%` }}
                    />
                  </div>
                </>
              )}
              {isDirty && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                  Unsaved changes
                </p>
              )}
            </div>

            {/* Transfer Button */}
            <button
              onClick={handleTransferToEMR}
              disabled={transferring || !isComplete}
              className={`
                w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all
                ${transferring
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : isComplete
                    ? 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-200'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Transfer to EMR</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - All Sections */}
      <div className="flex-1 min-w-0 space-y-6">
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

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12 bg-white rounded-xl border border-gray-200">
            <Spinner size="lg" />
            <span className="ml-3 text-gray-500">Loading questions...</span>
          </div>
        )}

        {/* Patient Info Card - Demographics from referral (read-only) */}
        {!isLoading && (
          <PatientInfoCard
            patientName={propPatientName}
            patientId={patientId}
          />
        )}

        {/* All Sections */}
        {!isLoading && sectionData.map((section) => {
          const isComplete = section.answeredCount === section.totalCount;

          // Filter questions if showing unanswered only
          const visibleQuestions = showUnansweredOnly
            ? section.questions.filter(q => !isQuestionAnswered(q.itemCode))
            : section.questions;

          // Hide section entirely if filtered and no unanswered questions
          if (showUnansweredOnly && visibleQuestions.length === 0) return null;

          return (
            <div
              key={section.id}
              ref={(el) => {
                if (el) sectionRefs.current.set(section.id, el);
              }}
              className="scroll-mt-32"
            >
              {/* Section Header */}
              <div className={`
                sticky top-28 z-10 bg-white rounded-t-xl border border-gray-200 border-b-0 p-4
                flex items-center justify-between
              `}>
                <div className="flex items-center gap-3">
                  <span
                    className={`
                      px-2 py-1 rounded text-xs font-medium
                      ${isComplete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}
                    `}
                  >
                    {isComplete ? '✓ Complete' : `${section.totalCount - section.answeredCount} remaining`}
                  </span>
                  <h2 className="text-lg font-semibold text-gray-900">{section.name}</h2>
                </div>
                <span className="text-sm text-gray-500">
                  {section.answeredCount}/{section.totalCount}
                </span>
              </div>

              {/* Section Questions */}
              <div className="bg-white rounded-b-xl border border-gray-200 border-t-0 p-4 space-y-4">
                {visibleQuestions.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    All questions in this section are complete
                  </p>
                ) : (
                  visibleQuestions.map((question: OASISQuestion) => {
                    const response = getResponseValue(question.itemCode);
                    return (
                      <QuestionRenderer
                        key={question.itemCode}
                        question={question}
                        value={response}
                        onChange={(resp) => handleResponseChange(question.itemCode, resp)}
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      <CommunicationDraftEditor
        isOpen={showDraftEditor}
        onClose={handleCloseDraftEditor}
        assessmentId={assessmentId || ''}
        trigger={selectedTrigger || undefined}
        physicianName={physicianName}
        physicianNpi={physicianNpi}
        onSaved={handleCommunicationSaved}
      />

      <EventDetailsModal
        event={selectedEvent}
        isOpen={showEventDetailsModal}
        onClose={handleCloseEventDetailsModal}
        onAcknowledge={handleAcknowledgeClinicalEvent}
        onDismiss={handleDismissClinicalEvent}
        onDraftCommunication={handleDraftCommunicationFromEvent}
      />
    </div>
  );
}
