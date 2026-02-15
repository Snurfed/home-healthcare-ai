/**
 * Visit Tab (NestMed Style)
 *
 * Visit Guide with accordion sections:
 * - Eye icon toggles for show/hide reference data
 * - Green accent colors
 * - Close all/Expand all per section
 * - Completion tracking
 */

import { useState, useCallback } from 'react';

interface VisitItem {
  id: string;
  label: string;
  completed?: boolean;
  referenceData?: string;
}

interface VisitSection {
  id: string;
  title: string;
  items: VisitItem[];
}

const VISIT_SECTIONS: VisitSection[] = [
  {
    id: 'administrative',
    title: 'Administrative & Safety',
    items: [
      { id: 'two-id', label: 'Two Patient Identifiers', completed: true, referenceData: 'Name + DOB verified' },
      { id: 'infection', label: 'Infection Control', completed: true, referenceData: 'Hand hygiene completed' },
      { id: 'safety', label: 'Home Safety Assessment', referenceData: 'Review prior visit findings' },
      { id: 'emergency', label: 'Emergency Plan Review', referenceData: '911, emergency contacts' },
      { id: 'consent', label: 'Consent Verification', completed: true, referenceData: 'Verbal consent obtained' },
    ],
  },
  {
    id: 'clinical',
    title: 'Clinical Assessment',
    items: [
      { id: 'vitals', label: 'Vital Signs', completed: true, referenceData: 'BP, HR, RR, Temp, SpO2, Weight' },
      { id: 'pain', label: 'Pain Assessment', referenceData: 'Location, intensity 0-10, character' },
      { id: 'neuro', label: 'Neurological', referenceData: 'Orientation, speech, sensation' },
      { id: 'cardiac', label: 'Cardiac', referenceData: 'Heart sounds, edema, JVD' },
      { id: 'respiratory', label: 'Respiratory', completed: true, referenceData: 'Breath sounds, cough, dyspnea' },
      { id: 'integumentary', label: 'Integumentary', referenceData: 'Skin condition, wounds' },
      { id: 'gi', label: 'GI/GU', referenceData: 'Bowel sounds, bladder function' },
      { id: 'musculo', label: 'Musculoskeletal', referenceData: 'ROM, strength, gait' },
    ],
  },
  {
    id: 'medications',
    title: 'Medications',
    items: [
      { id: 'med-reconciliation', label: 'Medication Reconciliation', referenceData: 'Compare to MAR' },
      { id: 'med-teaching', label: 'Medication Teaching', referenceData: 'Purpose, side effects, schedule' },
      { id: 'med-compliance', label: 'Compliance Assessment', referenceData: 'Barriers, missed doses' },
      { id: 'med-admin', label: 'Medication Administration', referenceData: 'As ordered' },
    ],
  },
  {
    id: 'tests',
    title: 'Standardized Tests & Measures',
    items: [
      { id: 'phq9', label: 'PHQ-9 Depression Screening', referenceData: 'Score 0-27, if >10 refer' },
      { id: 'falls', label: 'Fall Risk Assessment', referenceData: 'Morse Fall Scale or TUG' },
      { id: 'gg-mobility', label: 'GG - Mobility', referenceData: 'OASIS functional mobility' },
      { id: 'gg-self-care', label: 'GG - Self-Care', referenceData: 'OASIS self-care items' },
      { id: 'braden', label: 'Braden Scale', referenceData: 'Pressure ulcer risk' },
    ],
  },
];

interface VisitItemRowProps {
  item: VisitItem;
  showReference: boolean;
  onToggle: () => void;
  onToggleReference: () => void;
}

function VisitItemRow({ item, showReference, onToggle, onToggleReference }: VisitItemRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Completion checkbox */}
        <button
          onClick={onToggle}
          className={`
            flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center
            transition-colors
            ${item.completed
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 hover:border-green-400'
            }
          `}
        >
          {item.completed && (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>

        {/* Label and reference */}
        <div className="flex-1 min-w-0">
          <span className={`text-sm ${item.completed ? 'text-gray-500' : 'text-gray-900'}`}>
            {item.label}
          </span>
          {showReference && item.referenceData && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{item.referenceData}</p>
          )}
        </div>
      </div>

      {/* Eye toggle */}
      {item.referenceData && (
        <button
          onClick={onToggleReference}
          className={`
            p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center
            ${showReference
              ? 'text-green-600 bg-green-50'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            }
          `}
          title={showReference ? 'Hide reference' : 'Show reference'}
        >
          {showReference ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

interface AccordionSectionProps {
  section: VisitSection;
  isOpen: boolean;
  onToggle: () => void;
  itemStates: Record<string, { completed: boolean; showReference: boolean }>;
  onItemToggle: (itemId: string, field: 'completed' | 'showReference') => void;
  onShowAllReferences: () => void;
  onHideAllReferences: () => void;
}

function AccordionSection({
  section,
  isOpen,
  onToggle,
  itemStates,
  onItemToggle,
  onShowAllReferences,
  onHideAllReferences,
}: AccordionSectionProps) {
  const completedCount = section.items.filter((i) => itemStates[i.id]?.completed ?? i.completed).length;
  const totalCount = section.items.length;
  const isComplete = completedCount === totalCount;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <span
            className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
              isComplete
                ? 'bg-green-100 text-green-600'
                : completedCount > 0
                  ? 'bg-green-50 text-green-600'
                  : 'bg-gray-100 text-gray-400'
            }`}
          >
            {isComplete ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <span>{completedCount}</span>
            )}
          </span>

          {/* Title */}
          <span className="text-base font-medium text-gray-900">{section.title}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress text */}
          <span className="text-sm text-gray-500">
            {completedCount}/{totalCount}
          </span>

          {/* Chevron */}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Content */}
      {isOpen && (
        <div className="px-4 pb-4">
          {/* Reference toggle controls */}
          <div className="flex items-center justify-end gap-3 py-2 border-b border-gray-100 mb-2">
            <button
              onClick={onShowAllReferences}
              className="text-xs text-green-600 hover:text-green-700 font-medium"
            >
              Show all
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={onHideAllReferences}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Hide all
            </button>
          </div>

          {/* Items */}
          <div>
            {section.items.map((item) => {
              const state = itemStates[item.id] ?? {
                completed: item.completed ?? false,
                showReference: false,
              };
              return (
                <VisitItemRow
                  key={item.id}
                  item={{ ...item, completed: state.completed }}
                  showReference={state.showReference}
                  onToggle={() => onItemToggle(item.id, 'completed')}
                  onToggleReference={() => onItemToggle(item.id, 'showReference')}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VisitTab() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['administrative']));
  const [itemStates, setItemStates] = useState<Record<string, { completed: boolean; showReference: boolean }>>(() => {
    // Initialize with default values
    const initial: Record<string, { completed: boolean; showReference: boolean }> = {};
    VISIT_SECTIONS.forEach((section) => {
      section.items.forEach((item) => {
        initial[item.id] = {
          completed: item.completed ?? false,
          showReference: false,
        };
      });
    });
    return initial;
  });

  const handleToggleSection = useCallback((sectionId: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    setOpenSections(new Set(VISIT_SECTIONS.map((s) => s.id)));
  }, []);

  const handleCloseAll = useCallback(() => {
    setOpenSections(new Set());
  }, []);

  const handleItemToggle = useCallback((itemId: string, field: 'completed' | 'showReference') => {
    setItemStates((prev) => {
      const current = prev[itemId] ?? { completed: false, showReference: false };
      return {
        ...prev,
        [itemId]: {
          ...current,
          [field]: !current[field],
        },
      };
    });
  }, []);

  const handleShowAllReferences = useCallback((sectionId: string) => {
    const section = VISIT_SECTIONS.find((s) => s.id === sectionId);
    if (!section) return;

    setItemStates((prev) => {
      const next: Record<string, { completed: boolean; showReference: boolean }> = { ...prev };
      section.items.forEach((item) => {
        if (item.referenceData) {
          const current = prev[item.id] ?? { completed: false, showReference: false };
          next[item.id] = { ...current, showReference: true };
        }
      });
      return next;
    });
  }, []);

  const handleHideAllReferences = useCallback((sectionId: string) => {
    const section = VISIT_SECTIONS.find((s) => s.id === sectionId);
    if (!section) return;

    setItemStates((prev) => {
      const next: Record<string, { completed: boolean; showReference: boolean }> = { ...prev };
      section.items.forEach((item) => {
        const current = prev[item.id] ?? { completed: false, showReference: false };
        next[item.id] = { ...current, showReference: false };
      });
      return next;
    });
  }, []);

  // Calculate overall progress
  const totalItems = VISIT_SECTIONS.reduce((sum, s) => sum + s.items.length, 0);
  const completedItems = Object.values(itemStates).filter((s) => s.completed).length;
  const progressPercent = Math.round((completedItems / totalItems) * 100);

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Visit Guide</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-gray-500">
              {completedItems} of {totalItems} items
            </span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-medium text-green-600">{progressPercent}%</span>
            </div>
          </div>
        </div>

        {/* Expand/Close all */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleExpandAll}
            className="px-3 py-2 text-sm text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors min-h-[44px]"
          >
            Expand all
          </button>
          <button
            onClick={handleCloseAll}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px]"
          >
            Close all
          </button>
        </div>
      </div>

      {/* Not showing reference notice */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
        <span className="text-sm text-gray-500">
          Not showing reference data. Click the eye icon to show.
        </span>
      </div>

      {/* Accordion Sections */}
      <div className="space-y-3">
        {VISIT_SECTIONS.map((section) => (
          <AccordionSection
            key={section.id}
            section={section}
            isOpen={openSections.has(section.id)}
            onToggle={() => handleToggleSection(section.id)}
            itemStates={itemStates}
            onItemToggle={handleItemToggle}
            onShowAllReferences={() => handleShowAllReferences(section.id)}
            onHideAllReferences={() => handleHideAllReferences(section.id)}
          />
        ))}
      </div>
    </div>
  );
}
