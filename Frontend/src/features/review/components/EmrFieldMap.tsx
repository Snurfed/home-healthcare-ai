/**
 * EMR Field Map
 *
 * List of EMR fields with AI-proposed answers, confidence indicators,
 * and source references. Allows quick editing and approval.
 */

import { useState } from 'react';
import type { EmrAnswer } from '@/types/capture.types';

interface EmrFieldMapProps {
  answers: EmrAnswer[];
  onAnswerChange: (fieldId: string, newAnswer: string | number | boolean | string[]) => void;
  onApprove: (fieldId: string) => void;
}

const CheckIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const EditIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'bg-green-100 text-green-700';
  if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

function getStatusBadge(answer: EmrAnswer): { label: string; color: string } | null {
  if (answer.userApproved) return { label: 'Approved', color: 'bg-green-100 text-green-700' };
  if (answer.userModified) return { label: 'Modified', color: 'bg-blue-100 text-blue-700' };
  if (answer.status === 'low_confidence') return { label: 'Review', color: 'bg-yellow-100 text-yellow-700' };
  if (answer.status === 'empty') return { label: 'Empty', color: 'bg-gray-100 text-gray-600' };
  return null;
}

function formatSource(source: EmrAnswer['sources'][0]): string {
  if (source.type === 'audio') {
    const mins = Math.floor((source.audioTimestamp || 0) / 60);
    const secs = (source.audioTimestamp || 0) % 60;
    return `🎙️ ${mins}:${String(secs).padStart(2, '0')}`;
  }
  if (source.type === 'document') {
    return `📄 Page ${source.pageNumber || '?'}`;
  }
  return '✏️ Manual';
}

export function EmrFieldMap({
  answers,
  onAnswerChange,
  onApprove,
}: EmrFieldMapProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Group answers by section
  const sections = answers.reduce<Record<string, EmrAnswer[]>>((acc, answer) => {
    if (!acc[answer.section]) {
      acc[answer.section] = [];
    }
    acc[answer.section]!.push(answer);
    return acc;
  }, {});

  const handleStartEdit = (answer: EmrAnswer) => {
    setEditingField(answer.fieldId);
    setEditValue(
      answer.userAnswer !== undefined
        ? String(answer.userAnswer)
        : answer.proposedAnswer !== undefined
          ? String(answer.proposedAnswer)
          : ''
    );
  };

  const handleSaveEdit = (fieldId: string) => {
    onAnswerChange(fieldId, editValue);
    setEditingField(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  return (
    <div className="bg-white rounded-b-xl border border-gray-200 overflow-hidden">
      <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
        {Object.entries(sections).map(([section, sectionAnswers]) => (
          <div key={section}>
            {/* Section Header */}
            <div className="sticky top-0 px-4 py-2 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700">{section}</h3>
            </div>

            {/* Fields */}
            <div className="divide-y divide-gray-100">
              {sectionAnswers.map((answer) => {
                const isEditing = editingField === answer.fieldId;
                const displayValue = answer.userAnswer ?? answer.proposedAnswer;
                const displayLabel = answer.proposedAnswerLabel || String(displayValue || '—');
                const statusBadge = getStatusBadge(answer);

                return (
                  <div
                    key={answer.fieldId}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      answer.status === 'low_confidence' ? 'bg-yellow-50/50' : ''
                    }`}
                  >
                    {/* Field Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {answer.fieldLabel}
                          </span>
                          {answer.required && (
                            <span className="text-red-500 text-xs">*</span>
                          )}
                          {statusBadge && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${statusBadge.color}`}>
                              {statusBadge.label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Confidence */}
                      {answer.proposedAnswer !== undefined && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getConfidenceColor(answer.confidence)}`}>
                          {Math.round(answer.confidence * 100)}%
                        </span>
                      )}
                    </div>

                    {/* Value Display/Edit */}
                    {isEditing ? (
                      <div className="space-y-2">
                        {answer.type === 'textarea' ? (
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                        ) : answer.type === 'number' || answer.type === 'scale' ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                        ) : (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEdit(answer.fieldId)}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          {answer.type === 'textarea' && displayValue ? (
                            <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">
                              {displayLabel}
                            </p>
                          ) : (
                            <p className={`text-sm ${displayValue ? 'text-gray-900' : 'text-gray-400'}`}>
                              {displayLabel}
                            </p>
                          )}

                          {/* Sources */}
                          {answer.sources.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {answer.sources.slice(0, 2).map((source, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded"
                                >
                                  {formatSource(source)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(answer)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <EditIcon className="w-4 h-4" />
                          </button>
                          {!answer.userApproved && displayValue && (
                            <button
                              onClick={() => onApprove(answer.fieldId)}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                              title="Approve"
                            >
                              <CheckIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {answers.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No fields match the current filter
          </div>
        )}
      </div>
    </div>
  );
}

export default EmrFieldMap;
