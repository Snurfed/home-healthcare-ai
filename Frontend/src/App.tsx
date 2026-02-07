import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';

// Lazy-loaded pages
const LoginPage = lazy(() => import('@pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('@pages/dashboard/DashboardPage'));
const AssessmentListPage = lazy(() => import('@pages/oasis/AssessmentListPage'));
const CreateAssessmentPage = lazy(() => import('@pages/oasis/CreateAssessmentPage'));
const AssessmentWizardPage = lazy(() => import('@pages/oasis/AssessmentWizardPage'));
const AssessmentViewPage = lazy(() => import('@pages/oasis/AssessmentViewPage'));
const AssessmentReviewPage = lazy(() => import('@pages/oasis/AssessmentReviewPage'));
const PatientsListPage = lazy(() => import('@pages/patients/PatientsListPage'));
const NewPatientPage = lazy(() => import('@pages/patients/NewPatientPage'));
const PatientDetailPage = lazy(() => import('@pages/patients/PatientDetailPage'));
const NotFoundPage = lazy(() => import('@pages/NotFoundPage'));

// Layout and auth components
import AppLayout from '@components/layout/AppLayout';
import ProtectedRoute from '@components/auth/ProtectedRoute';
import RoleGuard from '@components/auth/RoleGuard';
import Spinner from '@components/common/Spinner';

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Spinner size="lg" />
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />

          {/* OASIS Assessment routes */}
          <Route path="assessments">
            <Route index element={<AssessmentListPage />} />
            <Route path="new" element={<CreateAssessmentPage />} />
            <Route path=":id" element={<AssessmentViewPage />} />
            <Route path=":id/edit" element={<AssessmentWizardPage />} />
            <Route
              path=":id/review"
              element={
                <RoleGuard allowedRoles={['ADMIN', 'SUPERVISOR']}>
                  <AssessmentReviewPage />
                </RoleGuard>
              }
            />
          </Route>

          {/* Patient routes */}
          <Route path="patients">
            <Route index element={<PatientsListPage />} />
            <Route path="new" element={<NewPatientPage />} />
            <Route path=":id" element={<PatientDetailPage />} />
            <Route path=":id/edit" element={<NewPatientPage />} />
          </Route>
        </Route>

        {/* 404 route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default App;
