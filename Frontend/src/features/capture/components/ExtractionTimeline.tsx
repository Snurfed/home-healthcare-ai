/**
 * Extraction Timeline
 *
 * Live timeline showing AI extraction progress and extracted entities.
 * Updates in real-time as entities are extracted from audio/documents.
 */

import type { TimelineItem, ExtractedEntities } from '@/types/capture.types';

interface ExtractionTimelineProps {
  items: TimelineItem[];
  entities?: ExtractedEntities;
  isProcessing: boolean;
}

const timelineIcons: Record<string, string> = {
  recording_started: '🎙️',
  recording_paused: '⏸️',
  recording_resumed: '▶️',
  recording_stopped: '⏹️',
  document_uploaded: '📄',
  extraction_started: '🔍',
  entity_extracted: '✨',
  soap_generated: '📝',
  emr_mapped: '🗂️',
  user_edit: '✏️',
  export_completed: '✅',
};

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ExtractionTimeline({
  items,
  entities,
  isProcessing,
}: ExtractionTimelineProps) {
  const hasEntities = entities && (
    entities.diagnoses?.length ||
    entities.medications?.length ||
    entities.vitals?.length ||
    entities.wounds?.length
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span>🔬</span>
        AI Extraction
        {isProcessing && (
          <span className="ml-auto flex items-center gap-1 text-xs text-blue-600">
            <span className="animate-pulse">●</span> Processing
          </span>
        )}
      </h3>

      {/* Extracted Entities Summary */}
      {hasEntities && (
        <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
          <p className="text-xs font-medium text-gray-600 mb-2">Extracted Items</p>
          <div className="grid grid-cols-2 gap-2">
            {entities.diagnoses && entities.diagnoses.length > 0 && (
              <EntityBadge
                icon="🏥"
                label="Diagnoses"
                count={entities.diagnoses.length}
                items={entities.diagnoses.map(d => d.description)}
              />
            )}
            {entities.medications && entities.medications.length > 0 && (
              <EntityBadge
                icon="💊"
                label="Medications"
                count={entities.medications.length}
                items={entities.medications.map(m => m.name)}
              />
            )}
            {entities.vitals && entities.vitals.length > 0 && (
              <EntityBadge
                icon="❤️"
                label="Vitals"
                count={entities.vitals.length}
                items={entities.vitals.map(v => `${v.type}: ${v.value}`)}
              />
            )}
            {entities.wounds && entities.wounds.length > 0 && (
              <EntityBadge
                icon="🩹"
                label="Wounds"
                count={entities.wounds.length}
                items={entities.wounds.map(w => w.location)}
              />
            )}
            {entities.chiefComplaint && (
              <div className="col-span-2 p-2 bg-white rounded border border-gray-200">
                <p className="text-xs text-gray-500">Chief Complaint</p>
                <p className="text-sm text-gray-900 line-clamp-2">
                  {String(entities.chiefComplaint.value)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />

        {/* Timeline items */}
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="pl-8 text-sm text-gray-400">
              Start recording to see extraction progress...
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="relative flex gap-3">
                {/* Icon */}
                <div className="relative z-10 flex-shrink-0 w-6 h-6 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-sm">
                  {timelineIcons[item.type] || '●'}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <span className="text-xs text-gray-400">
                      {formatTime(item.timestamp)}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                  )}
                  {item.entityCount !== undefined && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {item.entityCount} items
                    </span>
                  )}
                  {item.confidence !== undefined && (
                    <span className={`inline-block mt-1 ml-1 px-2 py-0.5 text-xs rounded-full ${
                      item.confidence >= 0.9 ? 'bg-green-100 text-green-700' :
                      item.confidence >= 0.7 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {Math.round(item.confidence * 100)}% confidence
                    </span>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <div className="relative flex gap-3">
              <div className="relative z-10 flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center">
                <span className="animate-spin text-blue-600">⚙️</span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-blue-600 animate-pulse">Processing...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Entity Badge Component
function EntityBadge({
  icon,
  label,
  count,
  items,
}: {
  icon: string;
  label: string;
  count: number;
  items: string[];
}) {
  return (
    <div className="p-2 bg-white rounded border border-gray-200">
      <div className="flex items-center gap-1 mb-1">
        <span>{icon}</span>
        <span className="text-xs font-medium text-gray-700">{label}</span>
        <span className="ml-auto text-xs bg-gray-100 px-1.5 rounded">{count}</span>
      </div>
      <div className="text-xs text-gray-500 line-clamp-2">
        {items.slice(0, 3).join(', ')}
        {items.length > 3 && ` +${items.length - 3} more`}
      </div>
    </div>
  );
}

export default ExtractionTimeline;
