/**
 * Dashboard
 *
 * Minimal dashboard with quick access to start a new visit capture.
 * Shows recent captures and quick patient search.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@context/stores/authStore';

// =============================================================================
// ICONS
// =============================================================================

const MicrophoneIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const SearchIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ClockIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ChevronRightIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const LogoutIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const UserIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

// =============================================================================
// MOCK DATA
// =============================================================================

const recentCaptures = [
  {
    id: '1',
    patientName: 'Doe, John',
    visitType: 'Follow-up',
    date: '2024-01-20',
    status: 'exported',
  },
  {
    id: '2',
    patientName: 'Smith, Jane',
    visitType: 'SOC',
    date: '2024-01-19',
    status: 'review',
  },
  {
    id: '3',
    patientName: 'Johnson, Robert',
    visitType: 'Recert',
    date: '2024-01-18',
    status: 'exported',
  },
];

const todaysSchedule = [
  {
    id: 'p1',
    patientName: 'Doe, John',
    patientId: 'p1',
    episodeId: 'e1',
    visitType: 'FOLLOWUP',
    time: '9:00 AM',
    address: '123 Main St',
    status: 'complete' as VisitStatus,
  },
  {
    id: 'p2',
    patientName: 'Smith, Jane',
    patientId: 'p2',
    episodeId: 'e2',
    visitType: 'FOLLOWUP',
    time: '11:00 AM',
    address: '456 Oak Ave',
    status: 'in_progress' as VisitStatus,
  },
  {
    id: 'p3',
    patientName: 'Williams, Mary',
    patientId: 'p3',
    episodeId: 'e3',
    visitType: 'SOC',
    time: '2:00 PM',
    address: '789 Pine Rd',
    status: 'scheduled' as VisitStatus,
  },
];

type VisitStatus = 'scheduled' | 'in_progress' | 'complete';

/**
 * A Start of Care is not a longer follow-up. It carries the full OASIS, sets
 * the episode's payment and case-mix, and cannot be amended as freely later.
 * Rendering it identically to a routine visit hides the one appointment on the
 * list that most deserves the clinician's remaining time and attention.
 */
const VISIT_TYPE_LABELS: Record<string, { label: string; className: string }> = {
  SOC: { label: 'Start of Care', className: 'bg-purple-100 text-purple-800 ring-1 ring-purple-200' },
  RECERT: { label: 'Recertification', className: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200' },
  DISCHARGE: { label: 'Discharge', className: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200' },
  FOLLOWUP: { label: 'Follow-up', className: 'bg-gray-100 text-gray-600' },
};

const STATUS_META: Record<VisitStatus, { label: string; dot: string; action: string }> = {
  scheduled: { label: 'Not started', dot: 'bg-gray-300', action: 'Start' },
  in_progress: { label: 'In progress', dot: 'bg-blue-500', action: 'Resume' },
  complete: { label: 'Documented', dot: 'bg-green-500', action: 'View' },
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function Dashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { user, logout } = useAuthStore();

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  const handleStartCapture = useCallback((patient?: typeof todaysSchedule[0]) => {
    if (patient) {
      navigate(`/capture?patientId=${patient.patientId}&episodeId=${patient.episodeId}&visitType=${patient.visitType}&discipline=RN`);
    } else {
      navigate('/capture');
    }
  }, [navigate]);

  const filteredSchedule = todaysSchedule.filter(p =>
    p.patientName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">HomeHealth AI</h1>
              <p className="text-gray-500">Voice-powered visit documentation</p>
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-blue-600" />
                </div>
                <div className="hidden sm:block">
                  <p className="font-medium text-gray-900">{user ? `${user.firstName} ${user.lastName}` : 'User'}</p>
                  <p className="text-xs text-gray-500">{user?.role || 'Clinician'}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogoutIcon className="w-5 h-5" />
                <span className="hidden sm:inline text-sm">Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Quick Start Card */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">Start New Visit</h2>
              <p className="text-blue-100 text-sm">
                Record your visit and let AI generate documentation
              </p>
            </div>
            <button
              onClick={() => handleStartCapture()}
              className="flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
            >
              <MicrophoneIcon className="w-5 h-5" />
              Start Recording
            </button>
          </div>
        </div>

        {/* Today's Schedule */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Today's Schedule</h2>
              {/* A bare count answers a question nobody has. What is left to do
                  is the reason this screen gets opened between visits. */}
              <span className="text-sm text-gray-500">
                {todaysSchedule.filter((v) => v.status === 'complete').length} of{' '}
                {todaysSchedule.length} documented
              </span>
            </div>

            {/* Search */}
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {filteredSchedule.map((visit) => {
              const type = VISIT_TYPE_LABELS[visit.visitType] ?? {
                label: visit.visitType,
                className: 'bg-gray-100 text-gray-600',
              };
              const status = STATUS_META[visit.status];
              const done = visit.status === 'complete';
              return (
                <button
                  key={visit.id}
                  onClick={() => handleStartCapture(visit)}
                  className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center gap-4"
                >
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-semibold ${
                      done ? 'bg-green-50 text-green-700' : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    {visit.patientName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900">{visit.patientName}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${type.className}`}>
                        {type.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.dot}`} aria-hidden />
                      {status.label} • {visit.address}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-medium text-gray-900">{visit.time}</p>
                    <p className="text-xs text-blue-600 font-medium">{status.action} →</p>
                  </div>
                </button>
              );
            })}

            {filteredSchedule.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No visits match your search
              </div>
            )}
          </div>
        </div>

        {/* Recent Captures */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Captures</h2>
            <ClockIcon className="w-5 h-5 text-gray-400" />
          </div>

          <div className="divide-y divide-gray-100">
            {recentCaptures.map((capture) => (
              <div
                key={capture.id}
                className="p-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <div>
                    <p className="font-medium text-gray-900">{capture.patientName}</p>
                    <p className="text-sm text-gray-500">
                      {capture.visitType} • {capture.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    capture.status === 'exported'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {capture.status === 'exported' ? 'Exported' : 'Review'}
                  </span>
                  <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">12</p>
            <p className="text-sm text-gray-500">This Week</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-3xl font-bold text-green-600">98%</p>
            <p className="text-sm text-gray-500">Auto-filled</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-3xl font-bold text-purple-600">45min</p>
            <p className="text-sm text-gray-500">Saved/Day</p>
          </div>
        </div>
      </main>
    </div>
  );
}
