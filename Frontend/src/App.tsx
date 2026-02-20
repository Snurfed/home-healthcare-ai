import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';

// Lazy-loaded pages
const LoginPage = lazy(() => import('@pages/auth/LoginPage'));
const SchedulePage = lazy(() => import('@pages/schedule/SchedulePage'));
const EpisodePage = lazy(() => import('@pages/episode/EpisodePage'));
const AgencySettingsPage = lazy(() => import('@pages/settings/AgencySettingsPage'));
const EmrConnectionsPage = lazy(() => import('@pages/settings/EmrConnectionsPage'));
const NotFoundPage = lazy(() => import('@pages/NotFoundPage'));

// Layout and auth components
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

        {/* Schedule (Home) */}
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

        {/* Episode workflow (standalone) */}
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

        {/* Settings - Admin/Supervisor only */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={['ADMIN', 'SUPERVISOR']}>
                <AppShell>
                  <AgencySettingsPage />
                </AppShell>
              </RoleGuard>
            </ProtectedRoute>
          }
        />

        {/* EMR Connections - Admin only */}
        <Route
          path="/settings/emr-connections"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={['ADMIN']}>
                <AppShell>
                  <EmrConnectionsPage />
                </AppShell>
              </RoleGuard>
            </ProtectedRoute>
          }
        />

        {/* Root redirect to schedule */}
        <Route path="/" element={<Navigate to="/schedule" replace />} />

        {/* 404 route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default App;
