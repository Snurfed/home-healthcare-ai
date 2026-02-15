/**
 * Schedule Page (NestMed Style)
 *
 * Mobile-first patient schedule with:
 * - Date picker navigation
 * - Search bar
 * - Patient cards with status badges
 */

import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePatients } from '@hooks/index';
import { Spinner } from '@components/common';

type VisitStatus = 'not_started' | 'in_progress' | 'transferred' | 'completed';

interface SchedulePatient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  visitType: string;
  address: string;
  status: VisitStatus;
  episodeId?: string;
}

const STATUS_CONFIG: Record<VisitStatus, { label: string; className: string }> = {
  not_started: {
    label: 'Not Started',
    className: 'bg-gray-100 text-gray-600',
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-blue-100 text-blue-700',
  },
  transferred: {
    label: 'Transferred',
    className: 'bg-orange-100 text-orange-700',
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-100 text-green-700',
  },
};

function StatusBadge({ status }: { status: VisitStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

export default function SchedulePage() {
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { data: patientsData, isLoading } = usePatients({
    search: searchQuery || undefined,
    limit: 50,
  });

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
      let status: VisitStatus = 'not_started';

      if (patient.status === 'DISCHARGED') {
        status = 'completed';
      } else if (patient._count?.assessments && patient._count.assessments > 0) {
        status = 'in_progress';
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
      };
    });
  }, [patientsData]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="px-4 py-3">
          <h1 className="text-xl font-semibold text-gray-900">Your Schedule</h1>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-3">
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
              placeholder="Search all patients by name or MRN"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 border-0 rounded-xl text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Date Picker & Toggle */}
        <div className="px-4 pb-3 flex items-center justify-between">
          {/* Date Navigator */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-medium text-gray-900 min-w-[120px] text-center">
              {formatDate(selectedDate)}
            </span>
            <button
              onClick={() => changeDate(1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Show Deleted Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-600">Show Deleted</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500" />
            </div>
          </label>
        </div>
      </header>

      {/* Patient List */}
      <main className="p-4 space-y-3 pb-24">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : schedulePatients.length === 0 ? (
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
            <h3 className="mt-4 text-sm font-medium text-gray-900">No visits scheduled</h3>
            <p className="mt-1 text-sm text-gray-500">
              No patients scheduled for this date.
            </p>
          </div>
        ) : (
          schedulePatients.map((patient) => (
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
                  </p>
                </div>
                <StatusBadge status={patient.status} />
              </div>

              {patient.address && (
                <p className="text-sm text-gray-500 mb-3 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                View Episode
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
