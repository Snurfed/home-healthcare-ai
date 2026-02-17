/**
 * Episode Shell (NestMed Style)
 *
 * Mobile-first episode layout with:
 * - Top header: back, patient name, MRN, status
 * - 3-tab bar: Prepare | Visit | Documentation
 * - Sticky bottom recording bar
 */

import { ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEpisodeStore, type EpisodeTab } from '@context/stores/episodeStore';
import StickyRecordBar from './StickyRecordBar';

interface EpisodeShellProps {
  patientName: string;
  mrn: string;
  status?: string;
  visitDate?: string;
  visitType?: string;
  children: ReactNode;
  uploadCount?: number;
  onViewUploads?: () => void;
  onRecordingComplete?: (audioBlob: Blob) => void;
}

const TABS: { id: EpisodeTab; label: string }[] = [
  { id: 'prepare', label: 'Prepare' },
  { id: 'visit', label: 'Visit' },
  { id: 'documentation', label: 'Documentation' },
];

const STATUS_STYLES: Record<string, string> = {
  'In Progress': 'bg-blue-100 text-blue-700',
  'Transferred': 'bg-orange-100 text-orange-700',
  'Completed': 'bg-green-100 text-green-700',
  'Not Started': 'bg-gray-100 text-gray-600',
  'DRAFT': 'bg-gray-100 text-gray-600',
  'PENDING_REVIEW': 'bg-orange-100 text-orange-700',
  'APPROVED': 'bg-green-100 text-green-700',
};

export default function EpisodeShell({
  patientName,
  mrn,
  status = 'In Progress',
  visitDate,
  visitType = 'SOC',
  children,
  uploadCount = 0,
  onViewUploads,
  onRecordingComplete,
}: EpisodeShellProps) {
  const navigate = useNavigate();
  const { activeTab, setActiveTab } = useEpisodeStore();

  const handleTabChange = useCallback(
    (tab: EpisodeTab) => {
      setActiveTab(tab);
    },
    [setActiveTab]
  );

  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES['In Progress'];

  return (
    <div className="min-h-screen bg-gray-50 pb-36">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        {/* Top Row: Back, Patient Info, Status */}
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Back + Patient Info */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/schedule')}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Back to schedule"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div>
              <h1 className="text-lg font-semibold text-gray-900">{patientName}</h1>
              <p className="text-sm text-gray-500">{mrn}</p>
            </div>
          </div>

          {/* Right: Status + Visit Info */}
          <div className="text-right">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle}`}>
              {status}
            </span>
            {(visitType || visitDate) && (
              <p className="text-xs text-gray-500 mt-1">
                {visitType}
                {visitDate && ` • ${visitDate}`}
              </p>
            )}
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex border-t border-gray-100">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  flex-1 py-3 text-sm font-medium text-center transition-colors relative
                  ${isActive
                    ? 'text-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                  }
                `}
              >
                {tab.label}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500" />
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4">
        {children}
      </main>

      {/* Sticky Record Bar */}
      <StickyRecordBar
        uploadCount={uploadCount}
        onViewUploads={onViewUploads}
        onRecordingComplete={onRecordingComplete}
      />
    </div>
  );
}
