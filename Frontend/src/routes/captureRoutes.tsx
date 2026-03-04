/**
 * Capture Routes
 *
 * New simplified route structure for the audio-first capture workflow.
 *
 * Route Map:
 * /                     - Dashboard (schedule + quick start)
 * /capture              - Visit Capture Workspace (main recording screen)
 * /visit/:visitId/review - Review & Approve (SOAP + EMR fields)
 * /visit/:visitId/export - Export (copy/download)
 * /settings             - Settings (EMR templates, etc.)
 *
 * REMOVED ROUTES (from old flow):
 * /episode/:patientId/:episodeId - Old multi-tab flow (Prepare/Visit/Documentation)
 * /oasis/* - Internal OASIS questionnaire
 */

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Lazy load pages for code splitting
const Dashboard = lazy(() => import('../features/dashboard/pages/Dashboard'));
const VisitCaptureWorkspace = lazy(() => import('../features/capture/pages/VisitCaptureWorkspace'));
const ReviewAndApprove = lazy(() => import('../features/review/pages/ReviewAndApprove'));

// Loading fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
      <p className="text-gray-500">Loading...</p>
    </div>
  </div>
);

export function CaptureRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Dashboard / Home */}
        <Route path="/" element={<Dashboard />} />

        {/* Visit Capture Workspace */}
        <Route path="/capture" element={<VisitCaptureWorkspace />} />

        {/* Review & Approve */}
        <Route path="/visit/:visitId/review" element={<ReviewAndApprove />} />

        {/* Export (could be a separate page or part of review) */}
        <Route path="/visit/:visitId/export" element={<ReviewAndApprove />} />

        {/* Redirect old routes to new flow */}
        <Route path="/episode/*" element={<Navigate to="/" replace />} />
        <Route path="/schedule" element={<Navigate to="/" replace />} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default CaptureRoutes;
