/**
 * EMR Template Panel
 *
 * Shows which EMR template is loaded, field completion status,
 * and provides action to go to review.
 */

import type { EmrTemplate, EmrAnswerMap } from '@/types/capture.types';

interface EmrTemplatePanelProps {
  template: EmrTemplate | null;
  answerMap: EmrAnswerMap | undefined;
  onGoToReview: () => void;
  isReady: boolean;
}

const ChevronRightIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const SettingsIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export function EmrTemplatePanel({
  template,
  answerMap,
  onGoToReview,
  isReady,
}: EmrTemplatePanelProps) {
  if (!template) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span>🗂️</span>
          EMR Template
        </h3>
        <div className="text-center py-6">
          <SettingsIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No template loaded</p>
          <button className="mt-2 text-sm text-blue-600 hover:text-blue-700">
            Import Template
          </button>
        </div>
      </div>
    );
  }

  const completionPercent = answerMap
    ? Math.round((answerMap.filledFields / answerMap.totalFields) * 100)
    : 0;

  const requiredPercent = answerMap
    ? Math.round((answerMap.requiredFilledFields / answerMap.requiredFields) * 100)
    : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-20">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <span>🗂️</span>
        EMR Template
      </h3>

      {/* Template Info */}
      <div className="p-3 bg-gray-50 rounded-lg mb-4">
        <p className="font-medium text-gray-900 text-sm">{template.name}</p>
        <p className="text-xs text-gray-500">{template.vendor} • v{template.version}</p>
      </div>

      {/* Field Stats */}
      {answerMap && (
        <div className="space-y-4 mb-4">
          {/* Overall Progress */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">All Fields</span>
              <span className="font-medium">{answerMap.filledFields}/{answerMap.totalFields}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>

          {/* Required Fields */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">Required Fields</span>
              <span className={`font-medium ${requiredPercent === 100 ? 'text-green-600' : 'text-orange-600'}`}>
                {answerMap.requiredFilledFields}/{answerMap.requiredFields}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  requiredPercent === 100 ? 'bg-green-500' : 'bg-orange-500'
                }`}
                style={{ width: `${requiredPercent}%` }}
              />
            </div>
          </div>

          {/* Confidence Issues */}
          {answerMap.lowConfidenceCount > 0 && (
            <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg">
              <span className="text-yellow-600">⚠️</span>
              <span className="text-xs text-yellow-700">
                {answerMap.lowConfidenceCount} field{answerMap.lowConfidenceCount > 1 ? 's' : ''} need{answerMap.lowConfidenceCount === 1 ? 's' : ''} review
              </span>
            </div>
          )}
        </div>
      )}

      {/* Sections List */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 mb-2">Sections</p>
        <div className="space-y-1">
          {template.sections.map((section) => {
            const sectionFields = template.fields.filter(f => f.section === section);
            const sectionFilled = answerMap?.answers.filter(
              a => sectionFields.some(f => f.fieldId === a.fieldId) && a.status === 'filled'
            ).length || 0;

            return (
              <div
                key={section}
                className="flex items-center justify-between py-1 px-2 text-xs rounded hover:bg-gray-50"
              >
                <span className="text-gray-700">{section}</span>
                <span className="text-gray-400">
                  {sectionFilled}/{sectionFields.length}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Go to Review Button */}
      <button
        onClick={onGoToReview}
        disabled={!isReady}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
          isReady
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isReady ? (
          <>
            Review & Approve
            <ChevronRightIcon className="w-5 h-5" />
          </>
        ) : (
          'Complete recording to review'
        )}
      </button>

      {/* Quick Actions */}
      <div className="mt-3 flex justify-center">
        <button className="text-xs text-gray-500 hover:text-gray-700">
          Change Template
        </button>
      </div>
    </div>
  );
}

export default EmrTemplatePanel;
