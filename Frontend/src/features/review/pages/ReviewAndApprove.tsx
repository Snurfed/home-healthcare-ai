/**
 * Review and Approve Page
 *
 * Review AI-generated SOAP note and EMR field mappings.
 * Approve, edit, and export to EMR.
 *
 * Layout:
 * - Left: SOAP Note Editor (editable sections)
 * - Right: EMR Field Map (filterable list with confidence indicators)
 */

import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCaptureStore } from '../../capture/stores/captureStore';
import { SoapNoteEditor } from '../components/SoapNoteEditor';
import { EmrFieldMap } from '../components/EmrFieldMap';
import { ExportPanel } from '../components/ExportPanel';
import type { EmrAnswer, SoapNote } from '@/types/capture.types';

// =============================================================================
// ICONS
// =============================================================================

const ArrowLeftIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const CheckIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const ExportIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

// =============================================================================
// FILTER TYPES
// =============================================================================

type FieldFilter = 'all' | 'required' | 'low_confidence' | 'empty' | 'modified';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ReviewAndApprove() {
  const { visitId: _visitId } = useParams<{ visitId: string }>();
  void _visitId; // Used for routing, data comes from store
  const navigate = useNavigate();

  // Store
  const { currentCapture, setStatus } = useCaptureStore();

  // Local state
  const [activeTab, setActiveTab] = useState<'soap' | 'fields'>('soap');
  const [fieldFilter, setFieldFilter] = useState<FieldFilter>('all');
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [soapNote, setSoapNote] = useState<SoapNote | undefined>(
    currentCapture?.emrAnswerMap?.soapNote
  );
  const [answers, setAnswers] = useState<EmrAnswer[]>(
    currentCapture?.emrAnswerMap?.answers || []
  );
  const [isApproved, setIsApproved] = useState(false);

  // Filter answers
  const filteredAnswers = useMemo(() => {
    switch (fieldFilter) {
      case 'required':
        return answers.filter(a => a.required);
      case 'low_confidence':
        return answers.filter(a => a.confidence < 0.8 && a.proposedAnswer !== undefined);
      case 'empty':
        return answers.filter(a => a.status === 'empty');
      case 'modified':
        return answers.filter(a => a.userModified);
      default:
        return answers;
    }
  }, [answers, fieldFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = answers.length;
    const filled = answers.filter(a => a.status === 'filled' || a.userModified).length;
    const required = answers.filter(a => a.required).length;
    const requiredFilled = answers.filter(a => a.required && (a.status === 'filled' || a.userModified)).length;
    const lowConfidence = answers.filter(a => a.confidence < 0.8 && a.proposedAnswer !== undefined).length;
    const empty = answers.filter(a => a.status === 'empty').length;

    return { total, filled, required, requiredFilled, lowConfidence, empty };
  }, [answers]);

  // Handle SOAP note change
  const handleSoapChange = useCallback((section: keyof SoapNote, value: string) => {
    setSoapNote(prev => prev ? { ...prev, [section]: value } : undefined);
  }, []);

  // Handle answer change
  const handleAnswerChange = useCallback((fieldId: string, newAnswer: string | number | boolean | string[]) => {
    setAnswers(prev =>
      prev.map(a =>
        a.fieldId === fieldId
          ? { ...a, userAnswer: newAnswer, userModified: true, status: 'filled' as const }
          : a
      )
    );
  }, []);

  // Handle approve answer
  const handleApproveAnswer = useCallback((fieldId: string) => {
    setAnswers(prev =>
      prev.map(a =>
        a.fieldId === fieldId
          ? { ...a, userApproved: true }
          : a
      )
    );
  }, []);

  // Handle approve all
  const handleApproveAll = useCallback(() => {
    setAnswers(prev => prev.map(a => ({ ...a, userApproved: true })));
    setIsApproved(true);
    setStatus('approved');
  }, [setStatus]);

  // Handle export
  const handleExport = useCallback(() => {
    setShowExportPanel(true);
  }, []);

  // Handle back
  const handleBack = useCallback(() => {
    navigate(`/capture?patientId=${currentCapture?.patientId}&episodeId=${currentCapture?.episodeId}`);
  }, [navigate, currentCapture]);

  // No data check
  if (!currentCapture?.emrAnswerMap) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No capture data found</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Review & Approve</h1>
                <p className="text-sm text-gray-500">
                  {stats.filled}/{stats.total} fields filled • {stats.requiredFilled}/{stats.required} required
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Approval Status */}
              {isApproved ? (
                <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  <CheckIcon className="w-4 h-4" />
                  Approved
                </span>
              ) : (
                <button
                  onClick={handleApproveAll}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  <CheckIcon className="w-5 h-5" />
                  Approve All
                </button>
              )}

              {/* EMR Preview Button */}
              <button
                onClick={() => navigate('/emr-preview')}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Preview EMR
              </button>

              {/* Export Button */}
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                <ExportIcon className="w-5 h-5" />
                Export to EMR
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Bar (Mobile) */}
      <div className="lg:hidden bg-white border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('soap')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'soap'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500'
            }`}
          >
            SOAP Note
          </button>
          <button
            onClick={() => setActiveTab('fields')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'fields'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500'
            }`}
          >
            EMR Fields
            {stats.lowConfidence > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                {stats.lowConfidence}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SOAP Note Editor */}
          <div className={`${activeTab === 'fields' ? 'hidden lg:block' : ''}`}>
            <SoapNoteEditor
              soapNote={soapNote}
              onChange={handleSoapChange}
              visitNarrative={currentCapture.emrAnswerMap.visitNarrative}
            />
          </div>

          {/* EMR Field Map */}
          <div className={`${activeTab === 'soap' ? 'hidden lg:block' : ''}`}>
            {/* Filter Bar */}
            <div className="bg-white rounded-t-xl border border-b-0 border-gray-200 p-3">
              <div className="flex flex-wrap gap-2">
                <FilterButton
                  active={fieldFilter === 'all'}
                  onClick={() => setFieldFilter('all')}
                  label="All"
                  count={stats.total}
                />
                <FilterButton
                  active={fieldFilter === 'required'}
                  onClick={() => setFieldFilter('required')}
                  label="Required"
                  count={stats.required}
                  variant="blue"
                />
                <FilterButton
                  active={fieldFilter === 'low_confidence'}
                  onClick={() => setFieldFilter('low_confidence')}
                  label="Low Confidence"
                  count={stats.lowConfidence}
                  variant="yellow"
                />
                <FilterButton
                  active={fieldFilter === 'empty'}
                  onClick={() => setFieldFilter('empty')}
                  label="Empty"
                  count={stats.empty}
                  variant="red"
                />
              </div>
            </div>

            <EmrFieldMap
              answers={filteredAnswers}
              onAnswerChange={handleAnswerChange}
              onApprove={handleApproveAnswer}
            />
          </div>
        </div>
      </main>

      {/* Export Panel (Modal/Slide-over) */}
      {showExportPanel && (
        <ExportPanel
          soapNote={soapNote}
          answers={answers}
          visitNarrative={currentCapture.emrAnswerMap.visitNarrative}
          onClose={() => setShowExportPanel(false)}
        />
      )}
    </div>
  );
}

// =============================================================================
// FILTER BUTTON
// =============================================================================

function FilterButton({
  active,
  onClick,
  label,
  count,
  variant = 'gray',
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  variant?: 'gray' | 'blue' | 'yellow' | 'red';
}) {
  const variants = {
    gray: active ? 'bg-gray-200 text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
    blue: active ? 'bg-blue-100 text-blue-800' : 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    yellow: active ? 'bg-yellow-100 text-yellow-800' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100',
    red: active ? 'bg-red-100 text-red-800' : 'bg-red-50 text-red-600 hover:bg-red-100',
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${variants[variant]}`}
    >
      {label}
      <span className="ml-1.5 opacity-70">{count}</span>
    </button>
  );
}
