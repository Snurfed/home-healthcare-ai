/**
 * Dashboard Page
 */

import { Link } from 'react-router-dom';
import { useAuthStore } from '@context/stores/authStore';
import { useAssessments } from '@hooks/index';
import { Button, Badge, Spinner, Alert } from '@components/common';
import { STATUS_CONFIG, ASSESSMENT_TYPE_LABELS } from '@typedefs/oasis.types';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data, isLoading, error } = useAssessments({ limit: 5 });

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-lg shadow-card p-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.firstName}
        </h1>
        <p className="mt-1 text-gray-500">
          Here's an overview of your recent activity
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/assessments/new"
          className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg p-6 transition-colors"
        >
          <div className="flex items-center">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <div className="ml-4">
              <h3 className="font-semibold">New Assessment</h3>
              <p className="text-sm text-primary-100">Start OASIS assessment</p>
            </div>
          </div>
        </Link>

        <Link
          to="/assessments?status=IN_PROGRESS"
          className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-6 transition-colors"
        >
          <div className="flex items-center">
            <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <div className="ml-4">
              <h3 className="font-semibold text-gray-900">Continue Draft</h3>
              <p className="text-sm text-gray-500">Resume in-progress work</p>
            </div>
          </div>
        </Link>

        <Link
          to="/assessments?status=PENDING_REVIEW"
          className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg p-6 transition-colors"
        >
          <div className="flex items-center">
            <svg className="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <div className="ml-4">
              <h3 className="font-semibold text-gray-900">Pending Review</h3>
              <p className="text-sm text-gray-500">Assessments awaiting approval</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Assessments */}
      <div className="bg-white rounded-lg shadow-card">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Assessments</h2>
          <Link to="/assessments">
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </Link>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : error ? (
            <Alert variant="error">Failed to load assessments</Alert>
          ) : !data?.data.length ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No assessments yet</p>
              <Link to="/assessments/new">
                <Button variant="primary" className="mt-4">
                  Create Your First Assessment
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {data.data.map((assessment) => (
                <Link
                  key={assessment.id}
                  to={`/assessments/${assessment.id}`}
                  className="block p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {assessment.patient?.firstName} {assessment.patient?.lastName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {ASSESSMENT_TYPE_LABELS[assessment.assessmentType]} - {assessment.patient?.mrn}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="status" status={assessment.status}>
                        {STATUS_CONFIG[assessment.status].label}
                      </Badge>
                      <p className="text-sm text-gray-500 mt-1">
                        {assessment.completionPercentage}% complete
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
