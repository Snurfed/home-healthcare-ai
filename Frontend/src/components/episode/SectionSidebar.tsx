/**
 * Section Sidebar
 *
 * Left navigation for episode sections:
 * - Filter (All / Remaining / Required Only)
 * - Section list with completion status
 * - Responsive: drawer on mobile, fixed on tablet+
 */

import { useMemo } from 'react';
import { useEpisodeStore, type SectionFilter, type EpisodeSection } from '@context/stores/episodeStore';

// Default sections for documentation workflow
const DEFAULT_SECTIONS: EpisodeSection[] = [
  { id: 'patient-identifier', name: 'Patient Identifier', questionCount: 3, completedCount: 0, requiredCount: 3, requiredCompletedCount: 0 },
  { id: 'infection-control', name: 'Infection Control', questionCount: 4, completedCount: 0, requiredCount: 2, requiredCompletedCount: 0 },
  { id: 'pain', name: 'Pain', questionCount: 6, completedCount: 0, requiredCount: 4, requiredCompletedCount: 0 },
  { id: 'physical', name: 'Physical', questionCount: 12, completedCount: 0, requiredCount: 8, requiredCompletedCount: 0 },
  { id: 'integumentary', name: 'Integumentary', questionCount: 8, completedCount: 0, requiredCount: 6, requiredCompletedCount: 0 },
  { id: 'medications', name: 'Medications', questionCount: 5, completedCount: 0, requiredCount: 4, requiredCompletedCount: 0 },
  { id: 'tests', name: 'Tests', questionCount: 4, completedCount: 0, requiredCount: 2, requiredCompletedCount: 0 },
  { id: 'gait', name: 'Gait', questionCount: 6, completedCount: 0, requiredCount: 4, requiredCompletedCount: 0 },
  { id: 'homebound', name: 'Homebound Status', questionCount: 3, completedCount: 0, requiredCount: 3, requiredCompletedCount: 0 },
  { id: 'provider', name: 'Provider', questionCount: 2, completedCount: 0, requiredCount: 2, requiredCompletedCount: 0 },
  { id: 'narrative', name: 'Narrative', questionCount: 1, completedCount: 0, requiredCount: 1, requiredCompletedCount: 0 },
];

interface SectionSidebarProps {
  sections?: EpisodeSection[];
  className?: string;
}

const FILTER_OPTIONS: { value: SectionFilter; label: string }[] = [
  { value: 'all', label: 'Show all' },
  { value: 'remaining', label: 'Remaining' },
  { value: 'required', label: 'Required only' },
];

export default function SectionSidebar({ sections = DEFAULT_SECTIONS, className = '' }: SectionSidebarProps) {
  const {
    activeSectionId,
    setActiveSectionId,
    sectionFilter,
    setSectionFilter,
    sectionCompletion,
    sidebarOpen,
    setSidebarOpen,
  } = useEpisodeStore();

  // Merge default sections with completion data
  const mergedSections = useMemo(() => {
    return sections.map((section) => ({
      ...section,
      ...sectionCompletion[section.id],
    }));
  }, [sections, sectionCompletion]);

  // Filter sections
  const filteredSections = useMemo(() => {
    switch (sectionFilter) {
      case 'remaining':
        return mergedSections.filter((s) => s.completedCount < s.questionCount);
      case 'required':
        return mergedSections.filter((s) => s.requiredCount > 0);
      default:
        return mergedSections;
    }
  }, [mergedSections, sectionFilter]);

  // Calculate totals
  const totalRequired = mergedSections.reduce((sum, s) => sum + s.requiredCount, 0);
  const totalRequiredCompleted = mergedSections.reduce((sum, s) => sum + s.requiredCompletedCount, 0);

  const handleSectionClick = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setSidebarOpen(false);
  };

  const sidebarContent = (
    <>
      {/* Header with filter */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Sections</h2>
          <span className="text-xs text-gray-500">
            {totalRequiredCompleted}/{totalRequired} required
          </span>
        </div>

        {/* Filter Dropdown */}
        <select
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value as SectionFilter)}
          className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Section List */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {filteredSections.map((section) => {
            const isComplete = section.completedCount === section.questionCount;
            const isActive = activeSectionId === section.id;
            const requiredComplete = section.requiredCompletedCount === section.requiredCount;

            return (
              <li key={section.id}>
                <button
                  onClick={() => handleSectionClick(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {/* Completion indicator */}
                  <span
                    className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                      isComplete
                        ? 'bg-green-100 text-green-600'
                        : requiredComplete
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-400'
                    }`}
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
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    )}
                  </span>

                  {/* Section name and count */}
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium truncate ${isComplete ? 'text-gray-500' : ''}`}>
                      {section.name}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">
                        {section.completedCount}/{section.questionCount}
                      </span>
                      {section.requiredCount > 0 && !requiredComplete && (
                        <span className="text-xs text-red-500">
                          {section.requiredCount - section.requiredCompletedCount} required
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${className}
          fixed lg:sticky top-14 left-0 z-40
          w-72 h-[calc(100vh-3.5rem-4rem)] bg-white border-r border-gray-200
          flex flex-col
          transform transition-transform duration-200 ease-out
          lg:transform-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
