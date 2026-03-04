/**
 * SOAP Note Editor
 *
 * Editable SOAP note sections with auto-generated content.
 */

import { useState } from 'react';
import type { SoapNote } from '@/types/capture.types';

interface SoapNoteEditorProps {
  soapNote?: SoapNote;
  onChange: (section: keyof SoapNote, value: string) => void;
  visitNarrative?: string;
}

const sectionConfig: Array<{
  key: keyof SoapNote;
  label: string;
  icon: string;
  placeholder: string;
}> = [
  {
    key: 'subjective',
    label: 'Subjective',
    icon: '💬',
    placeholder: 'Patient reports, symptoms, history...',
  },
  {
    key: 'objective',
    label: 'Objective',
    icon: '🔍',
    placeholder: 'Vital signs, physical exam findings, observations...',
  },
  {
    key: 'assessment',
    label: 'Assessment',
    icon: '📋',
    placeholder: 'Clinical assessment, diagnosis evaluation...',
  },
  {
    key: 'plan',
    label: 'Plan',
    icon: '📝',
    placeholder: 'Treatment plan, follow-up, orders...',
  },
];

export function SoapNoteEditor({
  soapNote,
  onChange,
  visitNarrative,
}: SoapNoteEditorProps) {
  const [expandedSection, setExpandedSection] = useState<keyof SoapNote>('subjective');
  const [showNarrative, setShowNarrative] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">SOAP Note</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              ✨ AI Generated
            </span>
            <button
              onClick={() => setShowNarrative(!showNarrative)}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {showNarrative ? 'Hide' : 'Show'} Narrative
            </button>
          </div>
        </div>
      </div>

      {/* Visit Narrative (collapsible) */}
      {showNarrative && visitNarrative && (
        <div className="p-4 bg-blue-50 border-b border-blue-100">
          <p className="text-sm font-medium text-blue-800 mb-2">Visit Narrative</p>
          <p className="text-sm text-blue-900">{visitNarrative}</p>
        </div>
      )}

      {/* SOAP Sections */}
      <div className="divide-y divide-gray-100">
        {sectionConfig.map(({ key, label, icon, placeholder }) => {
          const isExpanded = expandedSection === key;
          const content = soapNote?.[key] || '';
          const wordCount = content.split(/\s+/).filter(Boolean).length;

          return (
            <div key={key} className="group">
              {/* Section Header */}
              <button
                onClick={() => setExpandedSection(isExpanded ? ('' as keyof SoapNote) : key)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span>{icon}</span>
                  <span className="font-medium text-gray-900">{label}</span>
                  {content && (
                    <span className="text-xs text-gray-400">{wordCount} words</span>
                  )}
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Section Content */}
              {isExpanded && (
                <div className="px-4 pb-4">
                  <textarea
                    value={content}
                    onChange={(e) => onChange(key, e.target.value)}
                    placeholder={placeholder}
                    rows={6}
                    className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">
                      {wordCount} words
                    </span>
                    <div className="flex gap-2">
                      <button className="text-xs text-blue-600 hover:text-blue-700">
                        🔄 Regenerate
                      </button>
                      <button className="text-xs text-gray-500 hover:text-gray-700">
                        📋 Copy
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Collapsed Preview */}
              {!isExpanded && content && (
                <div className="px-4 pb-3">
                  <p className="text-sm text-gray-600 line-clamp-2">{content}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Additional Sections */}
      {(soapNote?.interventions || soapNote?.patientEducation || soapNote?.homeboundStatus) && (
        <div className="border-t border-gray-200">
          <div className="p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Additional Sections</p>
            <div className="space-y-3">
              {soapNote?.interventions && (
                <AdditionalSection
                  label="Interventions"
                  content={soapNote.interventions}
                />
              )}
              {soapNote?.patientEducation && (
                <AdditionalSection
                  label="Patient Education"
                  content={soapNote.patientEducation}
                />
              )}
              {soapNote?.homeboundStatus && (
                <AdditionalSection
                  label="Homebound Status"
                  content={soapNote.homeboundStatus}
                />
              )}
              {soapNote?.skilledNeed && (
                <AdditionalSection
                  label="Skilled Need"
                  content={soapNote.skilledNeed}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <button className="text-sm text-gray-600 hover:text-gray-800">
            Reset to Original
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            Copy Entire SOAP
          </button>
        </div>
      </div>
    </div>
  );
}

function AdditionalSection({ label, content }: { label: string; content: string }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-sm text-gray-900">{content}</p>
    </div>
  );
}

export default SoapNoteEditor;
