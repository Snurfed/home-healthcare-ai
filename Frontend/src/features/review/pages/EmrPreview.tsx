/**
 * EMR Preview Page
 *
 * Test page to visualize how EMR fields would be auto-filled
 * without needing an actual EMR integration.
 *
 * Shows:
 * - All EMR fields grouped by section
 * - AI-proposed values with confidence scores
 * - Source text showing where data came from
 * - Mock EMR form layout for validation
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaptureStore } from '../../capture/stores/captureStore';

// =============================================================================
// ICONS
// =============================================================================

const ArrowLeftIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const CheckIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const ExclamationIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

// =============================================================================
// CONFIDENCE BADGE
// =============================================================================

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);

  let colorClass = 'bg-red-100 text-red-700';
  if (confidence >= 0.9) colorClass = 'bg-green-100 text-green-700';
  else if (confidence >= 0.7) colorClass = 'bg-yellow-100 text-yellow-700';

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
      {percentage}%
    </span>
  );
}

// =============================================================================
// SOURCE INDICATOR
// =============================================================================

function SourceIndicator({ sources }: { sources: Array<{ type: string; audioTimestamp?: number; documentId?: string }> }) {
  if (!sources || sources.length === 0) {
    return <span className="text-xs text-gray-400">No source</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {sources.map((source, idx) => (
        <span
          key={idx}
          className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
        >
          {source.type === 'audio' && source.audioTimestamp !== undefined
            ? `🎙️ ${Math.floor(source.audioTimestamp / 60)}:${String(source.audioTimestamp % 60).padStart(2, '0')}`
            : source.type === 'document'
            ? `📄 Doc`
            : '✏️ Manual'}
        </span>
      ))}
    </div>
  );
}

// =============================================================================
// EMR FIELD ROW
// =============================================================================

function EmrFieldRow({
  field
}: {
  field: {
    fieldId: string;
    fieldLabel: string;
    type: string;
    required: boolean;
    proposedAnswer?: string | number | boolean | string[];
    confidence: number;
    sources: Array<{ type: string; audioTimestamp?: number; documentId?: string }>;
    status: string;
  }
}) {
  const hasValue = field.proposedAnswer !== undefined && field.proposedAnswer !== '';
  const isLowConfidence = field.confidence > 0 && field.confidence < 0.7;

  const displayValue = () => {
    if (!hasValue) return <span className="text-gray-400 italic">Not captured</span>;

    if (Array.isArray(field.proposedAnswer)) {
      return field.proposedAnswer.join(', ');
    }
    if (typeof field.proposedAnswer === 'boolean') {
      return field.proposedAnswer ? 'Yes' : 'No';
    }
    return String(field.proposedAnswer);
  };

  return (
    <tr className={`border-b border-gray-100 ${isLowConfidence ? 'bg-yellow-50' : ''}`}>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{field.fieldLabel}</span>
          {field.required && <span className="text-red-500 text-xs">*</span>}
        </div>
        <span className="text-xs text-gray-500">{field.fieldId}</span>
      </td>
      <td className="py-3 px-4">
        <span className="text-xs text-gray-500 uppercase">{field.type}</span>
      </td>
      <td className="py-3 px-4">
        <div className={`${hasValue ? 'text-gray-900' : 'text-gray-400'}`}>
          {displayValue()}
        </div>
      </td>
      <td className="py-3 px-4">
        {hasValue ? (
          <ConfidenceBadge confidence={field.confidence} />
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="py-3 px-4">
        <SourceIndicator sources={field.sources} />
      </td>
      <td className="py-3 px-4">
        {hasValue ? (
          isLowConfidence ? (
            <span className="flex items-center gap-1 text-yellow-600">
              <ExclamationIcon className="w-4 h-4" />
              <span className="text-xs">Review</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-green-600">
              <CheckIcon className="w-4 h-4" />
              <span className="text-xs">Ready</span>
            </span>
          )
        ) : (
          <span className="text-xs text-gray-400">Empty</span>
        )}
      </td>
    </tr>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function EmrPreview() {
  const navigate = useNavigate();
  const { currentCapture } = useCaptureStore();

  const answerMap = currentCapture?.emrAnswerMap;
  const soapNote = answerMap?.soapNote;

  // Group answers by section
  const sectionedAnswers = useMemo(() => {
    if (!answerMap?.answers) return {};

    return answerMap.answers.reduce<Record<string, typeof answerMap.answers>>((acc, answer) => {
      const section = answer.section || 'Other';
      if (!acc[section]) acc[section] = [];
      acc[section].push(answer);
      return acc;
    }, {});
  }, [answerMap]);

  // Stats
  const stats = useMemo(() => {
    if (!answerMap?.answers) return { total: 0, filled: 0, required: 0, requiredFilled: 0, lowConfidence: 0 };

    const answers = answerMap.answers;
    return {
      total: answers.length,
      filled: answers.filter(a => a.proposedAnswer !== undefined && a.proposedAnswer !== '').length,
      required: answers.filter(a => a.required).length,
      requiredFilled: answers.filter(a => a.required && a.proposedAnswer !== undefined).length,
      lowConfidence: answers.filter(a => a.confidence > 0 && a.confidence < 0.7).length,
    };
  }, [answerMap]);

  if (!currentCapture || !answerMap) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No capture data available</p>
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
                onClick={() => navigate(-1)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">EMR Preview</h1>
                <p className="text-sm text-gray-500">
                  Test view - See how fields would be auto-filled in your EMR
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-gray-900">{stats.filled}/{stats.total}</p>
            <p className="text-sm text-gray-500">Fields Filled</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-blue-600">{stats.requiredFilled}/{stats.required}</p>
            <p className="text-sm text-gray-500">Required Complete</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-yellow-600">{stats.lowConfidence}</p>
            <p className="text-sm text-gray-500">Need Review</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-green-600">
              {stats.total > 0 ? Math.round((stats.filled / stats.total) * 100) : 0}%
            </p>
            <p className="text-sm text-gray-500">Auto-Fill Rate</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-purple-600">{Object.keys(sectionedAnswers).length}</p>
            <p className="text-sm text-gray-500">Sections</p>
          </div>
        </div>

        {/* SOAP Note Preview */}
        {soapNote && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">SOAP Note (Auto-Generated)</h2>
            </div>
            <div className="p-4 space-y-4">
              {['subjective', 'objective', 'assessment', 'plan'].map(section => (
                <div key={section}>
                  <h3 className="font-medium text-gray-900 uppercase text-sm mb-1">{section}</h3>
                  <p className="text-gray-700 text-sm whitespace-pre-wrap">
                    {soapNote[section as keyof typeof soapNote] || <span className="text-gray-400 italic">Not generated</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EMR Fields by Section */}
        {Object.entries(sectionedAnswers).map(([section, answers]) => (
          <div key={section} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{section}</h2>
              <span className="text-sm text-gray-500">
                {answers.filter(a => a.proposedAnswer !== undefined).length}/{answers.length} filled
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="py-2 px-4 font-medium">Field</th>
                    <th className="py-2 px-4 font-medium">Type</th>
                    <th className="py-2 px-4 font-medium">Value</th>
                    <th className="py-2 px-4 font-medium">Confidence</th>
                    <th className="py-2 px-4 font-medium">Source</th>
                    <th className="py-2 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {answers.map(answer => (
                    <EmrFieldRow key={answer.fieldId} field={answer} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Raw Transcript */}
        {answerMap.visitNarrative && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Visit Narrative</h2>
            </div>
            <div className="p-4">
              <p className="text-gray-700">{answerMap.visitNarrative}</p>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-3">Legend</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">90%+</span>
              <span className="text-gray-600">High confidence - ready for export</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">70-89%</span>
              <span className="text-gray-600">Medium confidence - review recommended</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">&lt;70%</span>
              <span className="text-gray-600">Low confidence - manual review required</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">🎙️ 1:30</span>
              <span className="text-gray-600">Audio source at timestamp</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">📄 Doc</span>
              <span className="text-gray-600">From uploaded document</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
