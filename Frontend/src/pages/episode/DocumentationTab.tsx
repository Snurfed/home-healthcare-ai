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

import { useState, useCallback } from 'react';
import { useEpisodeStore } from '@context/stores/episodeStore';
import QuestionCard from '@components/episode/QuestionCard';
import { TriggerAlertBanner } from '@components/communication/TriggerAlertBanner';
import { CommunicationDraftEditor } from '@components/communication/CommunicationDraftEditor';
import { useCommunicationTriggers } from '@hooks/useCommunicationTriggers';
import type { CommunicationTriggerWithStatus } from '@typedefs/communication.types';

type FilterOption = 'all' | 'required' | 'incomplete';

interface OasisSection {
  id: string;
  title: string;
  shortTitle: string;
  completedCount: number;
  totalCount: number;
}

const MOCK_SECTIONS: OasisSection[] = [
  { id: 'admin', title: 'Administrative Information', shortTitle: 'Admin', completedCount: 5, totalCount: 5 },
  { id: 'clinical', title: 'Clinical Record Items', shortTitle: 'Clinical', completedCount: 3, totalCount: 8 },
  { id: 'living', title: 'Living Situation', shortTitle: 'Living', completedCount: 2, totalCount: 4 },
  { id: 'sensory', title: 'Sensory Status', shortTitle: 'Sensory', completedCount: 0, totalCount: 6 },
  { id: 'neuro', title: 'Neurological Status', shortTitle: 'Neuro', completedCount: 0, totalCount: 5 },
  { id: 'functional', title: 'Functional Status', shortTitle: 'Functional', completedCount: 1, totalCount: 12 },
  { id: 'medication', title: 'Medications', shortTitle: 'Meds', completedCount: 0, totalCount: 4 },
  { id: 'skin', title: 'Skin Conditions', shortTitle: 'Skin', completedCount: 0, totalCount: 8 },
];

interface SidebarSectionProps {
  section: OasisSection;
  isActive: boolean;
  onClick: () => void;
}

function SidebarSection({ section, isActive, onClick }: SidebarSectionProps) {
  const isComplete = section.completedCount === section.totalCount;
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
          {section.shortTitle}
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
  assessmentId = 'mock-assessment-id',
  // patientId reserved for future use
  physicianName = 'Dr. Smith',
  physicianNpi,
}: DocumentationTabProps) {
  const [activeSection, setActiveSection] = useState('clinical');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [transferring, setTransferring] = useState(false);
  const { hideCompletedCards, setHideCompletedCards } = useEpisodeStore();

  // Communication triggers state
  const [showTriggerBanner, setShowTriggerBanner] = useState(true);
  const [showDraftEditor, setShowDraftEditor] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState<CommunicationTriggerWithStatus | null>(null);

  // Communication triggers hook
  // Note: detectTriggers is available for calling when OASIS responses change
  const {
    activeTriggers,
    dismissTrigger,
    hasActiveTriggers,
  } = useCommunicationTriggers({
    assessmentId,
    enabled: !!assessmentId && assessmentId !== 'mock-assessment-id',
    debounceMs: 500,
  });

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
    // Optionally refresh triggers or show success message
    console.log('Communication saved successfully');
  }, []);

  const handleTransferToEMR = useCallback(() => {
    setTransferring(true);
    // Simulate transfer
    setTimeout(() => {
      setTransferring(false);
      alert('Results transferred to EMR successfully!');
    }, 1500);
  }, []);

  // Calculate overall progress
  const totalItems = MOCK_SECTIONS.reduce((sum, s) => sum + s.totalCount, 0);
  const completedItems = MOCK_SECTIONS.reduce((sum, s) => sum + s.completedCount, 0);
  const progressPercent = Math.round((completedItems / totalItems) * 100);

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
          </div>

          {/* Sections List */}
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider px-3 mb-2">
              Sections
            </h3>
            <div className="space-y-1">
              {MOCK_SECTIONS.map((section) => (
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
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
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
              {MOCK_SECTIONS.find((s) => s.id === activeSection)?.title || 'Documentation'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Complete all required fields for this section
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

        {/* Question Cards */}
        <div className="space-y-4">
          <QuestionCard
            id="m1021"
            title="M1021 - Primary Diagnosis"
            helperText="Enter the ICD-10 code for the primary diagnosis"
            required
            isCompleted={true}
          >
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 bg-gray-100 rounded-lg font-mono text-sm text-gray-900">
                I50.9
              </span>
              <span className="text-sm text-gray-700">Heart failure, unspecified</span>
            </div>
          </QuestionCard>

          <QuestionCard
            id="m1023"
            title="M1023 - Other Diagnoses"
            helperText="List other diagnoses requiring or affecting patient care"
            isCompleted={true}
          >
            <div className="space-y-2">
              {[
                { code: 'E11.9', desc: 'Type 2 diabetes mellitus' },
                { code: 'I10', desc: 'Essential hypertension' },
                { code: 'N18.3', desc: 'CKD Stage 3' },
              ].map((dx) => (
                <div key={dx.code} className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-gray-100 rounded font-mono text-xs text-gray-700">
                    {dx.code}
                  </span>
                  <span className="text-sm text-gray-600">{dx.desc}</span>
                </div>
              ))}
            </div>
          </QuestionCard>

          <QuestionCard
            id="m1033"
            title="M1033 - Risk for Hospitalization"
            helperText="Identify risk factors that indicate patient may be at risk for hospitalization"
            required
            isCompleted={false}
            aiExplanation="Based on the patient's history of CHF exacerbation requiring hospitalization and multiple comorbidities, consider checking 'History of falls', 'Multiple hospitalizations', and 'Polypharmacy'."
          >
            <div className="space-y-2">
              {[
                'History of falls (2+ in past 12 months)',
                'Unintentional weight loss',
                'Multiple hospitalizations (2+ in past 6 months)',
                'History of emergency department use',
                'Decline in mental/emotional/behavioral status',
                'Difficulty with compliance with medical instructions',
                'Taking 5 or more medications',
                'Currently seeing 2 or more physicians',
                'Frailty indicators',
                'None of the above',
              ].map((option) => (
                <label key={option} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </QuestionCard>

          <QuestionCard
            id="m1800"
            title="M1800 - Grooming"
            helperText="Current ability to dress upper body"
            isCompleted={false}
          >
            <div className="space-y-2">
              {[
                { value: '0', label: 'Able to groom self unaided' },
                { value: '1', label: 'Grooming utensils must be placed within reach' },
                { value: '2', label: 'Needs someone to assist with some grooming activities' },
                { value: '3', label: 'Needs total assistance with grooming' },
              ].map((option) => (
                <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="m1800"
                    value={option.value}
                    className="w-4 h-4 border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">
                    <span className="font-medium">{option.value}.</span> {option.label}
                  </span>
                </label>
              ))}
            </div>
          </QuestionCard>

          <QuestionCard
            id="m1810"
            title="M1810 - Dress Upper Body"
            helperText="Current ability to dress upper body safely"
            required
            isCompleted={true}
          >
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg font-medium text-sm">
                1 - Able to dress upper body but needs minor assistance
              </span>
            </div>
          </QuestionCard>

          <QuestionCard
            id="m1820"
            title="M1820 - Dress Lower Body"
            helperText="Current ability to dress lower body safely"
            required
            isCompleted={false}
            aiExplanation="The patient mentioned difficulty bending to put on shoes and socks. This typically correlates with response option 2 or 3."
          >
            <div className="space-y-2">
              {[
                { value: '0', label: 'Able to obtain, put on, and remove clothing and shoes' },
                { value: '1', label: 'Able to dress lower body but needs minor assistance' },
                { value: '2', label: 'Needs someone to help with putting on undergarments, slacks, socks/shoes' },
                { value: '3', label: 'Patient depends entirely upon another person' },
              ].map((option) => (
                <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="m1820"
                    value={option.value}
                    className="w-4 h-4 border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">
                    <span className="font-medium">{option.value}.</span> {option.label}
                  </span>
                </label>
              ))}
            </div>
          </QuestionCard>
        </div>

        {/* Bottom navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous Section
          </button>

          <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-500 text-white hover:bg-green-600 rounded-lg transition-colors min-h-[44px]">
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
        assessmentId={assessmentId}
        trigger={selectedTrigger || undefined}
        physicianName={physicianName}
        physicianNpi={physicianNpi}
        onSaved={handleCommunicationSaved}
      />
    </div>
  );
}
