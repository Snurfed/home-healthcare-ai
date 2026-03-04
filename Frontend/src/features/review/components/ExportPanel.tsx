/**
 * Export Panel
 *
 * Export SOAP note and EMR answers in various formats:
 * - Copy-to-clipboard blocks
 * - JSON export for EMR integration
 * - CSV export
 */

import { useState, useCallback } from 'react';
import type { SoapNote, EmrAnswer } from '@/types/capture.types';
import { exportEmrAnswers, copySoapToClipboard, copyAllToClipboard } from '../utils/exportUtils';

interface ExportPanelProps {
  soapNote?: SoapNote;
  answers: EmrAnswer[];
  visitNarrative?: string;
  onClose: () => void;
}

const XIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CopyIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const DownloadIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const CheckIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

export function ExportPanel({
  soapNote,
  answers,
  visitNarrative,
  onClose,
}: ExportPanelProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'copy' | 'json' | 'csv'>('copy');

  const showCopied = (section: string) => {
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleCopySoap = useCallback(async () => {
    if (soapNote) {
      await copySoapToClipboard(soapNote);
      showCopied('soap');
    }
  }, [soapNote]);

  const handleCopyNarrative = useCallback(async () => {
    if (visitNarrative) {
      await navigator.clipboard.writeText(visitNarrative);
      showCopied('narrative');
    }
  }, [visitNarrative]);

  const handleCopyAll = useCallback(async () => {
    await copyAllToClipboard(soapNote, answers, visitNarrative);
    showCopied('all');
  }, [soapNote, answers, visitNarrative]);

  const handleDownloadJson = useCallback(() => {
    const data = exportEmrAnswers(answers, 'json');
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emr-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [answers]);

  const handleDownloadCsv = useCallback(() => {
    const data = exportEmrAnswers(answers, 'csv');
    const blob = new Blob([data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emr-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [answers]);

  const handleCopyJson = useCallback(async () => {
    const data = exportEmrAnswers(answers, 'json');
    await navigator.clipboard.writeText(data);
    showCopied('json');
  }, [answers]);

  const filledCount = answers.filter(a => a.proposedAnswer !== undefined || a.userAnswer !== undefined).length;
  const requiredMissing = answers.filter(a => a.required && a.status === 'empty').length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Export to EMR</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Fields ready to export:</span>
            <span className="font-medium text-gray-900">{filledCount}/{answers.length}</span>
          </div>
          {requiredMissing > 0 && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ {requiredMissing} required field{requiredMissing > 1 ? 's' : ''} still empty
              </p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('copy')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'copy'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500'
            }`}
          >
            📋 Copy Blocks
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'json'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500'
            }`}
          >
            {'{}'} JSON
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'csv'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500'
            }`}
          >
            📊 CSV
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
          {activeTab === 'copy' && (
            <>
              {/* SOAP Note */}
              {soapNote && (
                <ExportBlock
                  title="SOAP Note"
                  description="Complete SOAP note ready to paste"
                  onCopy={handleCopySoap}
                  copied={copiedSection === 'soap'}
                />
              )}

              {/* Visit Narrative */}
              {visitNarrative && (
                <ExportBlock
                  title="Visit Narrative"
                  description="Brief visit summary"
                  onCopy={handleCopyNarrative}
                  copied={copiedSection === 'narrative'}
                />
              )}

              {/* Copy All */}
              <ExportBlock
                title="Copy All"
                description="SOAP + all EMR field values"
                onCopy={handleCopyAll}
                copied={copiedSection === 'all'}
                primary
              />

              {/* Individual Sections */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-3">Individual Sections</p>
                <div className="space-y-2">
                  {['Subjective', 'Objective', 'Assessment', 'Plan'].map((section) => (
                    <button
                      key={section}
                      onClick={async () => {
                        const key = section.toLowerCase() as keyof SoapNote;
                        if (soapNote?.[key]) {
                          await navigator.clipboard.writeText(soapNote[key] || '');
                          showCopied(section);
                        }
                      }}
                      disabled={!soapNote?.[section.toLowerCase() as keyof SoapNote]}
                      className="w-full flex items-center justify-between p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="text-sm text-gray-700">{section}</span>
                      {copiedSection === section ? (
                        <CheckIcon className="w-4 h-4 text-green-600" />
                      ) : (
                        <CopyIcon className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'json' && (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Export field values as JSON for EMR integration or API import.
              </p>

              <div className="space-y-3">
                <button
                  onClick={handleCopyJson}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {copiedSection === 'json' ? (
                    <>
                      <CheckIcon className="w-5 h-5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <CopyIcon className="w-5 h-5" />
                      Copy JSON
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadJson}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  <DownloadIcon className="w-5 h-5" />
                  Download JSON File
                </button>
              </div>

              {/* Preview */}
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Preview:</p>
                <pre className="p-3 bg-gray-900 text-green-400 rounded-lg text-xs overflow-x-auto max-h-48">
                  {exportEmrAnswers(answers.slice(0, 3), 'json')}
                  {answers.length > 3 && '\n  // ... and more fields'}
                </pre>
              </div>
            </>
          )}

          {activeTab === 'csv' && (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Export as CSV for spreadsheet import or data analysis.
              </p>

              <button
                onClick={handleDownloadCsv}
                className="w-full flex items-center justify-center gap-2 p-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <DownloadIcon className="w-5 h-5" />
                Download CSV
              </button>

              {/* Preview */}
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Preview:</p>
                <pre className="p-3 bg-gray-100 rounded-lg text-xs overflow-x-auto max-h-48">
                  {exportEmrAnswers(answers.slice(0, 5), 'csv')}
                </pre>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            💡 Tip: Use JSON export for automated EMR integration
          </p>
        </div>
      </div>
    </div>
  );
}

function ExportBlock({
  title,
  description,
  onCopy,
  copied,
  primary,
}: {
  title: string;
  description: string;
  onCopy: () => void;
  copied: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onCopy}
      className={`w-full flex items-center justify-between p-4 rounded-lg text-left transition-colors ${
        primary
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'bg-gray-50 hover:bg-gray-100'
      }`}
    >
      <div>
        <p className={`font-medium ${primary ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </p>
        <p className={`text-sm ${primary ? 'text-blue-100' : 'text-gray-500'}`}>
          {description}
        </p>
      </div>
      {copied ? (
        <span className={`flex items-center gap-1 text-sm ${primary ? 'text-white' : 'text-green-600'}`}>
          <CheckIcon className="w-4 h-4" />
          Copied!
        </span>
      ) : (
        <CopyIcon className={`w-5 h-5 ${primary ? 'text-white' : 'text-gray-400'}`} />
      )}
    </button>
  );
}

export default ExportPanel;
