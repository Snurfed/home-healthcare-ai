import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';

// Lazy-loaded pages - Core auth and settings
const LoginPage = lazy(() => import('@pages/auth/LoginPage'));
const AgencySettingsPage = lazy(() => import('@pages/settings/AgencySettingsPage'));
const EmrConnectionsPage = lazy(() => import('@pages/settings/EmrConnectionsPage'));
const NotFoundPage = lazy(() => import('@pages/NotFoundPage'));

// Lazy-loaded pages - New capture workflow
const Dashboard = lazy(() => import('./features/dashboard/pages/Dashboard'));
const VisitCaptureWorkspace = lazy(() => import('./features/capture/pages/VisitCaptureWorkspace'));
const ReviewAndApprove = lazy(() => import('./features/review/pages/ReviewAndApprove'));
const EmrPreview = lazy(() => import('./features/review/pages/EmrPreview'));

// Legacy pages (kept for backwards compatibility during migration)
const EpisodePage = lazy(() => import('@pages/episode/EpisodePage'));

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

        {/* ============================================================ */}
        {/* NEW CAPTURE WORKFLOW ROUTES                                   */}
        {/* ============================================================ */}

        {/* Dashboard (Home) - Today's schedule + quick start */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Visit Capture Workspace - Audio recording + document upload */}
        <Route
          path="/capture"
          element={
            <ProtectedRoute>
              <VisitCaptureWorkspace />
            </ProtectedRoute>
          }
        />

        {/* Review & Approve - SOAP note + EMR field mapping */}
        <Route
          path="/visit/:visitId/review"
          element={
            <ProtectedRoute>
              <ReviewAndApprove />
            </ProtectedRoute>
          }
        />

        {/* Export - Same as review for now, can be split later */}
        <Route
          path="/visit/:visitId/export"
          element={
            <ProtectedRoute>
              <ReviewAndApprove />
            </ProtectedRoute>
          }
        />

        {/* EMR Preview - Test page to see how fields would be auto-filled */}
        <Route
          path="/emr-preview"
          element={
            <ProtectedRoute>
              <EmrPreview />
            </ProtectedRoute>
          }
        />

        {/* ============================================================ */}
        {/* LEGACY ROUTES (backwards compatibility)                       */}
        {/* ============================================================ */}

        {/* Old Schedule - redirect to new dashboard */}
        <Route path="/schedule" element={<Navigate to="/" replace />} />

        {/* Old Episode workflow - kept for legacy access */}
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

        {/* ============================================================ */}
        {/* SETTINGS ROUTES                                              */}
        {/* ============================================================ */}

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

        {/* 404 route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default App;
