/**
 * Schedule Page (NestMed Style)
 *
 * Mobile-first patient schedule with:
 * - Filter pills for status filtering
 * - Date picker navigation
 * - Search bar (searches all patients)
 * - Patient cards with status badges
 * - New Assessment button
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { usePatients } from '@hooks/index';
import { Spinner } from '@components/common';

type VisitStatus = 'all' | 'not_started' | 'in_progress' | 'completed' | 'pending_review';

interface SchedulePatient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  visitType: string;
  address: string;
  status: Exclude<VisitStatus, 'all'>;
  episodeId?: string;
  assessmentCount: number;
}

const STATUS_CONFIG: Record<Exclude<VisitStatus, 'all'>, { label: string; className: string }> = {
  not_started: {
    label: 'Not Started',
    className: 'bg-gray-100 text-gray-600',
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-blue-100 text-blue-700',
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-100 text-green-700',
  },
  pending_review: {
    label: 'Pending Review',
    className: 'bg-orange-100 text-orange-700',
  },
};

const FILTER_OPTIONS: { value: VisitStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending_review', label: 'Pending Review' },
];

function StatusBadge({ status }: { status: Exclude<VisitStatus, 'all'> }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

export default function SchedulePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const filterParam = (searchParams.get('filter') as VisitStatus) || 'all';

  const [searchInput, setSearchInput] = useState(searchQuery);
  const [activeFilter, setActiveFilter] = useState<VisitStatus>(filterParam);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { data: patientsData, isLoading } = usePatients({
    search: searchQuery || undefined,
    limit: 100,
  });

  // Debounced search - automatically search as user types
  useEffect(() => {
    const trimmedInput = searchInput.trim();
    const trimmedQuery = searchQuery.trim();

    // Don't update if the values are the same
    if (trimmedInput === trimmedQuery) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (trimmedInput) {
        params.set('search', trimmedInput);
      } else {
        params.delete('search');
      }
      setSearchParams(params);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchInput, searchQuery, searchParams, setSearchParams]);

  // Handle search submission (for Enter key)
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      params.set('search', searchInput.trim());
    } else {
      params.delete('search');
    }
    setSearchParams(params);
  }, [searchInput, searchParams, setSearchParams]);

  // Handle filter change
  const handleFilterChange = useCallback((filter: VisitStatus) => {
    setActiveFilter(filter);
    const params = new URLSearchParams(searchParams);
    if (filter !== 'all') {
      params.set('filter', filter);
    } else {
      params.delete('filter');
    }
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Navigate date
  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  // Transform patients to schedule format
  const schedulePatients: SchedulePatient[] = useMemo(() => {
    if (!patientsData?.data) return [];

    return patientsData.data.map((patient) => {
      let status: Exclude<VisitStatus, 'all'> = 'not_started';
      const assessmentCount = patient._count?.assessments || 0;

      if (patient.status === 'DISCHARGED') {
        status = 'completed';
      } else if (assessmentCount > 0) {
        // Check if any assessments are pending review
        if (patient.status === 'PENDING') {
          status = 'pending_review';
        } else {
          status = 'in_progress';
        }
      }

      return {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        mrn: patient.mrn,
        visitType: 'SOC',
        address: [patient.addressCity, patient.addressState].filter(Boolean).join(', '),
        status,
        episodeId: undefined,
        assessmentCount,
      };
    });
  }, [patientsData]);

  // Filter patients by status
  const filteredPatients = useMemo(() => {
    if (activeFilter === 'all') return schedulePatients;
    return schedulePatients.filter((p) => p.status === activeFilter);
  }, [schedulePatients, activeFilter]);

  // Count by status for filter badges
  const statusCounts = useMemo(() => {
    const counts: Record<VisitStatus, number> = {
      all: schedulePatients.length,
      not_started: 0,
      in_progress: 0,
      completed: 0,
      pending_review: 0,
    };
    schedulePatients.forEach((p) => {
      counts[p.status]++;
    });
    return counts;
  }, [schedulePatients]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-14 z-20">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Your Schedule</h1>

          {/* New Assessment Button */}
          <button
            onClick={() => navigate('/episode/new')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Assessment
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-3">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search all patients by name or MRN..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    const params = new URLSearchParams(searchParams);
                    params.delete('search');
                    setSearchParams(params);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Filter Pills */}
        <div className="px-4 pb-3 overflow-x-auto">
          <div className="flex gap-2">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleFilterChange(option.value)}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
                  ${activeFilter === option.value
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                `}
              >
                {option.label}
                <span className={`
                  text-xs px-1.5 py-0.5 rounded-full
                  ${activeFilter === option.value
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                  }
                `}>
                  {statusCounts[option.value]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Date Picker */}
        <div className="px-4 pb-3 flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Previous day"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setSelectedDate(new Date())}
              className="text-sm font-medium text-gray-900 min-w-[120px] text-center hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              {formatDate(selectedDate)}
            </button>
            <button
              onClick={() => changeDate(1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Next day"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <button
            onClick={() => setSelectedDate(new Date())}
            className="text-sm text-green-600 font-medium hover:text-green-700"
          >
            Today
          </button>
        </div>
      </header>

      {/* Patient List */}
      <main className="p-4 space-y-3 pb-24">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-4 text-sm font-medium text-gray-900">
              {activeFilter === 'all' ? 'No patients found' : `No ${STATUS_CONFIG[activeFilter as Exclude<VisitStatus, 'all'>]?.label.toLowerCase()} patients`}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery
                ? 'Try adjusting your search or filters.'
                : activeFilter === 'all'
                  ? 'No patients scheduled for this date.'
                  : 'Try selecting a different filter.'}
            </p>
            {activeFilter !== 'all' && (
              <button
                onClick={() => handleFilterChange('all')}
                className="mt-4 text-sm text-green-600 font-medium hover:text-green-700"
              >
                Show all patients
              </button>
            )}
          </div>
        ) : (
          filteredPatients.map((patient) => (
            <div
              key={patient.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {patient.lastName}, {patient.firstName}
                  </h3>
                  <p className="text-sm text-gray-500">
                    <span className="font-mono">{patient.mrn}</span>
                    <span className="mx-2">•</span>
                    <span className="text-blue-600 font-medium">{patient.visitType}</span>
                    {patient.assessmentCount > 0 && (
                      <>
                        <span className="mx-2">•</span>
                        <span className="text-gray-400">{patient.assessmentCount} assessment{patient.assessmentCount !== 1 ? 's' : ''}</span>
                      </>
                    )}
                  </p>
                </div>
                <StatusBadge status={patient.status} />
              </div>

              {patient.address && (
                <p className="text-sm text-gray-500 mb-3 flex items-center gap-1">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {patient.address}
                </p>
              )}

              <Link
                to={`/episode/${patient.id}${patient.episodeId ? `/${patient.episodeId}` : ''}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-700"
              >
                {patient.status === 'not_started' ? 'Start Assessment' : 'View Episode'}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
