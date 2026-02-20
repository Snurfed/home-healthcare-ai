/**
 * Module Toggles Component
 *
 * Renders toggle switches for optional form modules
 * (e.g., Wound Care, IV Therapy, Catheter Care)
 */

import { useCallback } from 'react';
import type { ModuleToggle } from '@typedefs/index';

// =============================================================================
// ICONS
// =============================================================================

const moduleIcons: Record<string, React.ReactNode> = {
  wound: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  ),
  iv: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
      />
    </svg>
  ),
  catheter: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  ),
  ostomy: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
      />
    </svg>
  ),
  default: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
  ),
};

// =============================================================================
// TYPES
// =============================================================================

interface ModuleTogglesProps {
  modules: ModuleToggle[];
  activeModules: string[];
  onToggle: (moduleId: string, active: boolean) => void;
  disabled?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function ModuleToggles({
  modules,
  activeModules,
  onToggle,
  disabled = false,
}: ModuleTogglesProps) {
  const handleToggle = useCallback(
    (moduleId: string, currentActive: boolean) => {
      if (!disabled) {
        onToggle(moduleId, !currentActive);
      }
    },
    [onToggle, disabled]
  );

  if (modules.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Optional Modules</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {modules.map((module) => {
          const isActive = activeModules.includes(module.id);
          const iconKey = module.icon || module.id.toLowerCase().replace('_module', '');
          const icon = moduleIcons[iconKey] || moduleIcons.default;

          return (
            <button
              key={module.id}
              type="button"
              onClick={() => handleToggle(module.id, isActive)}
              disabled={disabled}
              className={`
                flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all
                ${
                  isActive
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={module.description}
            >
              <div
                className={`
                  p-2 rounded-full
                  ${isActive ? 'bg-blue-100' : 'bg-gray-100'}
                `}
              >
                {icon}
              </div>
              <span className="text-xs font-medium text-center">{module.name}</span>

              {/* Toggle indicator */}
              <div
                className={`
                  w-8 h-4 rounded-full relative transition-colors
                  ${isActive ? 'bg-blue-500' : 'bg-gray-300'}
                `}
              >
                <div
                  className={`
                    absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform
                    ${isActive ? 'translate-x-4' : 'translate-x-0.5'}
                  `}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
