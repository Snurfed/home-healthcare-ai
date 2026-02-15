import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';

// Lazy-loaded pages
const LoginPage = lazy(() => import('@pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('@pages/dashboard/DashboardPage'));
const SupervisorDashboardPage = lazy(() => import('@pages/supervisor/SupervisorDashboardPage'));
const AssessmentListPage = lazy(() => import('@pages/oasis/AssessmentListPage'));
const CreateAssessmentPage = lazy(() => import('@pages/oasis/CreateAssessmentPage'));
const AssessmentWizardPage = lazy(() => import('@pages/oasis/AssessmentWizardPage'));
const AssessmentViewPage = lazy(() => import('@pages/oasis/AssessmentViewPage'));
const AssessmentReviewPage = lazy(() => import('@pages/oasis/AssessmentReviewPage'));
const PatientsListPage = lazy(() => import('@pages/patients/PatientsListPage'));
const NewPatientPage = lazy(() => import('@pages/patients/NewPatientPage'));
const PatientDetailPage = lazy(() => import('@pages/patients/PatientDetailPage'));
const NotFoundPage = lazy(() => import('@pages/NotFoundPage'));
const AgencySettingsPage = lazy(() => import('@pages/settings/AgencySettingsPage'));

// New clinical workflow pages
const SchedulePage = lazy(() => import('@pages/schedule/SchedulePage'));
const EpisodePage = lazy(() => import('@pages/episode/EpisodePage'));

// Layout and auth components
import AppLayout from '@components/layout/AppLayout';
import AppShell from '@components/layout/AppShell';
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

        {/* New Clinical Workflow Routes (minimal AppShell) */}
        <Route
          path="/schedule"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<SchedulePage />} />
        </Route>

        {/* Episode workflow (standalone, no sidebar) */}
        <Route
          path="/episode/:patientId"
          element={
            <ProtectedRoute>
              <EpisodePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/episode/:patientId/:episodeId"
          element={
            <ProtectedRoute>
              <EpisodePage />
            </ProtectedRoute>
          }
        />

        {/* Legacy Protected routes (with sidebar) */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/schedule" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />

          {/* Supervisor Dashboard - role protected */}
          <Route
            path="supervisor"
            element={
              <RoleGuard allowedRoles={['ADMIN', 'SUPERVISOR']}>
                <SupervisorDashboardPage />
              </RoleGuard>
            }
          />

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

          {/* Settings routes - Admin/Supervisor only */}
          <Route
            path="settings"
            element={
              <RoleGuard allowedRoles={['ADMIN', 'SUPERVISOR']}>
                <AppShell>
                  <AgencySettingsPage />
                </AppShell>
              </RoleGuard>
            }
          />
        </Route>

        {/* 404 route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default App;
