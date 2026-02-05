/**
 * Assessment List Page
 */

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAssessments } from '@hooks/index';
import { Button, Badge, Spinner, Alert, Select } from '@components/common';
import { STATUS_CONFIG, ASSESSMENT_TYPE_LABELS } from '@typedefs/oasis.types';
import type { AssessmentStatus, AssessmentType } from '@typedefs/index';

export default function AssessmentListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);

  const status = searchParams.get('status') as AssessmentStatus | null;
  const assessmentType = searchParams.get('type') as AssessmentType | null;

  const { data, isLoading, error } = useAssessments({
    page,
    limit: 20,
    status: status || undefined,
    assessmentType: assessmentType || undefined,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  const handleStatusFilter = (value: string) => {
    if (value) {
      searchParams.set('status', value);
    } else {
      searchParams.delete('status');
    }
    setSearchParams(searchParams);
    setPage(1);
  };

  const handleTypeFilter = (value: string) => {
    if (value) {
      searchParams.set('type', value);
    } else {
      searchParams.delete('type');
    }
    setSearchParams(searchParams);
    setPage(1);
  };

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    ...Object.entries(STATUS_CONFIG).map(([key, config]) => ({
      value: key,
      label: config.label,
    })),
  ];

  const typeOptions = [
    { value: '', label: 'All Types' },
    ...Object.entries(ASSESSMENT_TYPE_LABELS).map(([key, label]) => ({
      value: key,
      label,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">OASIS Assessments</h1>
          <p className="text-gray-500">Manage and review patient assessments</p>
        </div>
        <Link to="/assessments/new">
          <Button variant="primary">New Assessment</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Status"
            options={statusOptions}
            value={status || ''}
            onChange={(e) => handleStatusFilter(e.target.value)}
          />
          <Select
            label="Assessment Type"
            options={typeOptions}
            value={assessmentType || ''}
            onChange={(e) => handleTypeFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Assessment List */}
      <div className="bg-white rounded-lg shadow-card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="p-6">
            <Alert variant="error">Failed to load assessments</Alert>
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No assessments</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating a new assessment.
            </p>
            <div className="mt-6">
              <Link to="/assessments/new">
                <Button variant="primary">New Assessment</Button>
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
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Updated
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.data.map((assessment) => (
                    <tr key={assessment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {assessment.patient?.firstName} {assessment.patient?.lastName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {assessment.patient?.mrn}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {ASSESSMENT_TYPE_LABELS[assessment.assessmentType]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant="status" status={assessment.status}>
                          {STATUS_CONFIG[assessment.status].label}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className="bg-primary-600 h-2 rounded-full"
                              style={{ width: `${assessment.completionPercentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-500">
                            {assessment.completionPercentage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(assessment.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          to={
                            assessment.status === 'LOCKED'
                              ? `/assessments/${assessment.id}`
                              : `/assessments/${assessment.id}/edit`
                          }
                          className="text-primary-600 hover:text-primary-900"
                        >
                          {assessment.status === 'LOCKED' ? 'View' : 'Edit'}
                        </Link>
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
                  Showing {(page - 1) * 20 + 1} to{' '}
                  {Math.min(page * 20, data.pagination.total)} of{' '}
                  {data.pagination.total} results
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
    </div>
  );
}
