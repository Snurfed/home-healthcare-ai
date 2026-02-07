/**
 * Patients List Page
 *
 * Displays a searchable, filterable list of patients with management actions
 */

import { useState, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePatientSearch } from '@hooks/index';
import { Button, Badge, Spinner, Alert, Select, Input } from '@components/common';
import type { PatientListItem } from '@services/patient.service';

// Patient status configuration
const PATIENT_STATUS_CONFIG: Record<
  PatientListItem['status'],
  { label: string; color: 'success' | 'warning' | 'error' | 'info' | 'default' }
> = {
  ACTIVE: { label: 'Active', color: 'success' },
  INACTIVE: { label: 'Inactive', color: 'default' },
  DISCHARGED: { label: 'Discharged', color: 'info' },
  PENDING: { label: 'Pending', color: 'warning' },
  DECEASED: { label: 'Deceased', color: 'error' },
};

// Gender display labels
const GENDER_LABELS: Record<PatientListItem['gender'], string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
  PREFER_NOT_TO_SAY: 'Not Specified',
};

// Sort options
const SORT_OPTIONS = [
  { value: 'lastName:asc', label: 'Name (A-Z)' },
  { value: 'lastName:desc', label: 'Name (Z-A)' },
  { value: 'dateOfBirth:asc', label: 'Age (Oldest)' },
  { value: 'dateOfBirth:desc', label: 'Age (Youngest)' },
  { value: 'admissionDate:desc', label: 'Recently Admitted' },
  { value: 'createdAt:desc', label: 'Recently Added' },
];

// Calculate age from date of birth
function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Format phone number
function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export default function PatientsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');

  // Get filter values from URL
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || 'lastName:asc';

  // Parse sort parameter
  const [sortBy, sortOrder] = useMemo(() => {
    const [field, order] = sort.split(':');
    return [
      field as 'lastName' | 'firstName' | 'dateOfBirth' | 'admissionDate' | 'createdAt',
      order as 'asc' | 'desc',
    ];
  }, [sort]);

  // Fetch patients
  const { data, isLoading, error, refetch } = usePatientSearch({
    search: search || undefined,
    status: status || undefined,
    page,
    limit: 20,
    sortBy,
    sortOrder,
  });

  // Handle search submit
  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchInput.trim()) {
        searchParams.set('search', searchInput.trim());
      } else {
        searchParams.delete('search');
      }
      setSearchParams(searchParams);
      setPage(1);
    },
    [searchInput, searchParams, setSearchParams]
  );

  // Handle filter changes
  const handleStatusFilter = (value: string) => {
    if (value) {
      searchParams.set('status', value);
    } else {
      searchParams.delete('status');
    }
    setSearchParams(searchParams);
    setPage(1);
  };

  const handleSortChange = (value: string) => {
    searchParams.set('sort', value);
    setSearchParams(searchParams);
    setPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchInput('');
    setSearchParams({});
    setPage(1);
  };

  // Status filter options
  const statusOptions = [
    { value: '', label: 'All Statuses' },
    ...Object.entries(PATIENT_STATUS_CONFIG).map(([key, config]) => ({
      value: key,
      label: config.label,
    })),
  ];

  const hasActiveFilters = status || search;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-500">Manage patient records and information</p>
        </div>
        <Link to="/patients/new">
          <Button variant="primary">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Add Patient
          </Button>
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="md:col-span-5">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search by name, MRN, or phone..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
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
              </div>
              <button
                type="submit"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-primary-600 hover:text-primary-700"
              >
                Search
              </button>
            </div>
          </form>

          {/* Status Filter */}
          <div className="md:col-span-3">
            <Select
              options={statusOptions}
              value={status}
              onChange={(e) => handleStatusFilter(e.target.value)}
            />
          </div>

          {/* Sort */}
          <div className="md:col-span-3">
            <Select
              options={SORT_OPTIONS}
              value={sort}
              onChange={(e) => handleSortChange(e.target.value)}
            />
          </div>

          {/* Clear Filters */}
          <div className="md:col-span-1 flex items-end">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <span>Showing:</span>
            {search && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-primary-100 text-primary-700">
                "{search}"
                <button
                  onClick={() => {
                    setSearchInput('');
                    searchParams.delete('search');
                    setSearchParams(searchParams);
                  }}
                  className="ml-1 hover:text-primary-900"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </span>
            )}
            {status && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                {PATIENT_STATUS_CONFIG[status as PatientListItem['status']]?.label}
                <button
                  onClick={() => handleStatusFilter('')}
                  className="ml-1 hover:text-gray-900"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Patient List */}
      <div className="bg-white rounded-lg shadow-card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="p-6">
            <Alert variant="error">
              <div className="flex items-center justify-between">
                <span>Failed to load patients</span>
                <Button variant="secondary" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            </Alert>
          </div>
        ) : !data?.data.length ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {hasActiveFilters ? 'No patients found' : 'No patients yet'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {hasActiveFilters
                ? 'Try adjusting your search or filters.'
                : 'Get started by adding a new patient.'}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              {hasActiveFilters && (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
              <Link to="/patients/new">
                <Button variant="primary">Add Patient</Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Activity
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.data.map((patient) => (
                    <tr key={patient.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <span className="text-primary-700 font-medium text-sm">
                              {patient.firstName[0]}
                              {patient.lastName[0]}
                            </span>
                          </div>
                          <div className="ml-4">
                            <Link
                              to={`/patients/${patient.id}`}
                              className="text-sm font-medium text-gray-900 hover:text-primary-600"
                            >
                              {patient.lastName}, {patient.firstName}
                              {patient.middleName ? ` ${patient.middleName[0]}.` : ''}
                            </Link>
                            <div className="text-sm text-gray-500 flex items-center gap-2">
                              <span>MRN: {patient.mrn}</span>
                              <span className="text-gray-300">|</span>
                              <span>
                                {GENDER_LABELS[patient.gender]}, {calculateAge(patient.dateOfBirth)}{' '}
                                yrs
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatPhone(patient.phoneMobile)}
                        </div>
                        {patient.primaryPhysicianName && (
                          <div className="text-sm text-gray-500">
                            Dr. {patient.primaryPhysicianName}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {patient.addressCity}, {patient.addressState}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={PATIENT_STATUS_CONFIG[patient.status].color}>
                          {PATIENT_STATUS_CONFIG[patient.status].label}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {patient._count && (
                          <div className="flex items-center gap-3">
                            <span
                              className="flex items-center gap-1"
                              title={`${patient._count.assessments} assessments`}
                            >
                              <svg
                                className="w-4 h-4 text-gray-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                />
                              </svg>
                              {patient._count.assessments}
                            </span>
                            <span
                              className="flex items-center gap-1"
                              title={`${patient._count.visits} visits`}
                            >
                              <svg
                                className="w-4 h-4 text-gray-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                              {patient._count.visits}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/patients/${patient.id}`}
                            className="text-primary-600 hover:text-primary-900"
                          >
                            View
                          </Link>
                          <Link
                            to={`/patients/${patient.id}/edit`}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            Edit
                          </Link>
                          <Link
                            to={`/assessments/new?patientId=${patient.id}`}
                            className="text-green-600 hover:text-green-900"
                          >
                            Assessment
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, data.pagination.total)} of{' '}
                  {data.pagination.total} patients
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!data.pagination.hasPrev}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-3 text-sm text-gray-600">
                    Page {page} of {data.pagination.totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!data.pagination.hasNext}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick Stats */}
      {data && data.pagination.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-card p-4">
            <p className="text-sm font-medium text-gray-500">Total Patients</p>
            <p className="text-2xl font-bold text-gray-900">{data.pagination.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow-card p-4">
            <p className="text-sm font-medium text-gray-500">Active</p>
            <p className="text-2xl font-bold text-green-600">
              {data.data.filter((p) => p.status === 'ACTIVE').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-card p-4">
            <p className="text-sm font-medium text-gray-500">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">
              {data.data.filter((p) => p.status === 'PENDING').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-card p-4">
            <p className="text-sm font-medium text-gray-500">On This Page</p>
            <p className="text-2xl font-bold text-gray-600">{data.data.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
