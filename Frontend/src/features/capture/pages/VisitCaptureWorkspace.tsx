/**
 * Visit Capture Workspace
 *
 * The main capture screen - single workspace for recording, document upload,
 * and real-time AI extraction. Replaces the multi-step Prepare/Visit/Documentation flow.
 *
 * Layout:
 * - Left: Patient/Episode info + Referral Documents
 * - Center: Recording controls + Live extraction timeline
 * - Right: EMR Template status + Go to Review
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useCaptureStore } from '../stores/captureStore';
import { RecordingControls } from '../components/RecordingControls';
import { ReferralDocsPanel } from '../components/ReferralDocsPanel';
import { ExtractionTimeline } from '../components/ExtractionTimeline';
import { EmrTemplatePanel } from '../components/EmrTemplatePanel';
import { PatientInfoCard } from '../components/PatientInfoCard';
import { QuickInputs } from '../components/QuickInputs';
import {
  processCapture,
  createAudioRecorder,
  type AudioRecorder,
} from '@/services/capture.service';
import type { EmrFieldType } from '@/types/capture.types';
import type { CaptureStatus } from '@/types/capture.types';

// =============================================================================
// ICONS
// =============================================================================

const ArrowLeftIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const CheckCircleIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// =============================================================================
// STATUS BADGE
// =============================================================================

const StatusBadge = ({ status }: { status: CaptureStatus }) => {
  const config: Record<CaptureStatus, { label: string; color: string; pulse?: boolean }> = {
    setup: { label: 'Setup', color: 'bg-gray-100 text-gray-700' },
    ready: { label: 'Ready', color: 'bg-blue-100 text-blue-700' },
    capturing: { label: 'Recording', color: 'bg-red-100 text-red-700', pulse: true },
    processing: { label: 'Analyzing', color: 'bg-yellow-100 text-yellow-700', pulse: true },
    review: { label: 'Ready for Review', color: 'bg-green-100 text-green-700' },
    approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
    exported: { label: 'Exported', color: 'bg-purple-100 text-purple-700' },
  };

  const { label, color, pulse } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${color}`}>
      {pulse && <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
      </span>}
      {label}
    </span>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function VisitCaptureWorkspace() {
  const { visitId: _visitId } = useParams<{ visitId?: string }>();
  void _visitId; // May be used for loading existing captures
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL params for quick start
  const patientId = searchParams.get('patientId') || '';
  const episodeId = searchParams.get('episodeId') || '';
  const visitType = searchParams.get('visitType') || 'FOLLOWUP';
  const discipline = searchParams.get('discipline') || 'RN';

  // Store
  const {
    currentCapture,
    recordingStatus,
    recordingDuration,
    isProcessing,
    processingProgress,
    processingMessage,
    timeline,
    emrTemplate,
    initCapture,
    setEmrTemplate,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    setRecordingDuration,
    addDocument,
    removeDocument,
    updateDocument,
    startProcessing,
    updateProcessingProgress,
    setExtractedEntities,
    setEmrAnswerMap,
    setVisitInfo,
    resetCapture,
  } = useCaptureStore();

  // Local state
  const [showPatientPicker, setShowPatientPicker] = useState(!patientId);
  const [audioRecorder, setAudioRecorder] = useState<AudioRecorder | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize capture session
  useEffect(() => {
    if (patientId && episodeId) {
      initCapture(patientId, episodeId, visitType, discipline);
      // Load default EMR template (mock)
      setEmrTemplate(getMockEmrTemplate(visitType, discipline));
    }

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [patientId, episodeId, visitType, discipline, initCapture, setEmrTemplate]);

  // Recording timer
  useEffect(() => {
    if (recordingStatus === 'recording') {
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(recordingDuration + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [recordingStatus, recordingDuration, setRecordingDuration]);

  // Handle start recording - initialize real audio recorder
  const handleStartRecording = useCallback(async () => {
    try {
      setProcessingError(null);
      const recorder = await createAudioRecorder();
      setAudioRecorder(recorder);
      await recorder.start();
      startRecording();
    } catch (error) {
      console.error('Failed to start recording:', error);
      setProcessingError('Microphone access denied. Please allow microphone permissions.');
    }
  }, [startRecording]);

  // Handle pause recording
  const handlePauseRecording = useCallback(() => {
    if (audioRecorder) {
      audioRecorder.pause();
      pauseRecording();
    }
  }, [audioRecorder, pauseRecording]);

  // Handle resume recording
  const handleResumeRecording = useCallback(() => {
    if (audioRecorder) {
      audioRecorder.resume();
      resumeRecording();
    }
  }, [audioRecorder, resumeRecording]);

  // Handle recording complete - stop and process with real AI
  const handleRecordingComplete = useCallback(async () => {
    if (!audioRecorder) return;

    try {
      // Stop recording and get audio blob
      const blob = await audioRecorder.stop();
      stopRecording();

      // Start AI processing
      startProcessing();
      setProcessingError(null);

      // Check if any documents are still being extracted
      const docs = currentCapture?.referralDocuments || [];
      const processingDocs = docs.filter(d => d.extractionStatus === 'processing');
      const completedDocs = docs.filter(d => d.extractionStatus === 'complete' && d.extractedText);
      const failedDocs = docs.filter(d => d.extractionStatus === 'error');

      console.log('[Capture] Documents status:', {
        total: docs.length,
        processing: processingDocs.length,
        completed: completedDocs.length,
        failed: failedDocs.length,
      });

      // Wait for processing documents if any (with timeout)
      if (processingDocs.length > 0) {
        updateProcessingProgress(5, `Waiting for ${processingDocs.length} document(s) to finish extracting...`);

        // Poll for completion (max 3 minutes)
        const maxWait = 180000;
        const pollInterval = 2000;
        let waited = 0;

        while (waited < maxWait) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          waited += pollInterval;

          // Re-check current state from store
          const currentDocs = useCaptureStore.getState().currentCapture?.referralDocuments || [];
          const stillProcessing = currentDocs.filter(d => d.extractionStatus === 'processing');

          if (stillProcessing.length === 0) {
            console.log('[Capture] All documents finished extracting');
            break;
          }

          updateProcessingProgress(5 + Math.min(10, (waited / maxWait) * 10),
            `Waiting for document extraction... (${Math.round(waited/1000)}s)`);
        }
      }

      // Get document texts from referral documents (re-fetch after waiting)
      const finalDocs = useCaptureStore.getState().currentCapture?.referralDocuments || [];
      const documentTexts = finalDocs
        .filter(d => d.extractedText && d.extractedText.length > 0)
        .map(d => d.extractedText!);

      console.log('[Capture] Document texts to process:', {
        count: documentTexts.length,
        totalChars: documentTexts.reduce((sum, t) => sum + t.length, 0),
        preview: documentTexts.length > 0 ? documentTexts[0].substring(0, 200) + '...' : 'none',
      });

      if (docs.length > 0 && documentTexts.length === 0) {
        console.warn('[Capture] WARNING: Documents were uploaded but no text was extracted!');
      }

      updateProcessingProgress(15, 'Uploading audio...');
      updateProcessingProgress(20, 'Transcribing audio with Whisper...');

      // Call real API
      const result = await processCapture({
        audioBlob: blob,
        documentTexts,
        patientName: currentCapture?.patientId, // TODO: Get actual patient name
        visitType,
        discipline,
      });

      if (!result.success) {
        throw new Error(result.error || 'Processing failed');
      }

      updateProcessingProgress(60, 'Extracting clinical entities...');

      // Set extracted entities if available - convert from backend format to frontend format
      if (result.extractedEntities) {
        const entities = result.extractedEntities;
        setExtractedEntities({
          diagnoses: entities.diagnoses.map(d => ({
            value: d.description,
            description: d.description,
            icdCode: d.code,
            isPrimary: false,
            confidence: d.confidence,
            source: { type: 'audio' as const },
          })),
          medications: entities.medications.map(m => ({
            value: m.name,
            name: m.name,
            dosage: m.dosage,
            frequency: m.frequency,
            confidence: m.confidence,
            source: { type: 'audio' as const },
          })),
          vitals: entities.vitals.map(v => ({
            type: v.type as 'bp_systolic' | 'bp_diastolic' | 'heart_rate' | 'respiratory_rate' | 'temperature' | 'spo2' | 'weight' | 'pain_level',
            value: typeof v.value === 'number' ? v.value : parseFloat(String(v.value)) || 0,
            unit: v.unit || '',
            confidence: v.confidence,
            source: { type: 'audio' as const },
          })),
          wounds: entities.wounds?.map(w => ({
            value: w.location,
            location: w.location,
            type: w.type,
            stage: w.stage,
            confidence: w.confidence,
            source: { type: 'audio' as const },
          })) || [],
          functionalStatus: entities.functionalStatus?.map(f => ({
            value: f.level,
            domain: 'self_care' as const,
            item: f.activity,
            description: f.activity,
            confidence: f.confidence,
            source: { type: 'audio' as const },
          })) || [],
        });
      }

      updateProcessingProgress(80, 'Mapping to EMR fields...');

      // Set EMR answer map
      if (result.emrAnswers && result.soapNote) {
        setEmrAnswerMap({
          visitId: currentCapture?.visitId || 'visit_' + Date.now(),
          templateId: emrTemplate?.id || 'default',
          templateName: emrTemplate?.name || 'Default Template',
          generatedAt: new Date().toISOString(),
          answers: result.emrAnswers.map(a => ({
            fieldId: a.fieldId,
            fieldLabel: a.fieldLabel,
            section: a.section,
            required: a.required,
            type: (a.type || 'text') as EmrFieldType,
            proposedAnswer: a.proposedAnswer,
            proposedAnswerLabel: a.proposedAnswerLabel,
            confidence: a.confidence,
            sources: a.sources.map(s => ({
              type: s.type,
              audioTimestamp: s.audioTimestamp,
              documentId: s.documentId,
            })),
            userModified: false,
            userApproved: false,
            status: (a.confidence < 0.7 ? 'low_confidence' : (a.proposedAnswer ? 'filled' : 'empty')) as 'filled' | 'low_confidence' | 'empty',
          })),
          totalFields: result.emrAnswers.length,
          filledFields: result.emrAnswers.filter(a => a.proposedAnswer).length,
          requiredFields: result.emrAnswers.filter(a => a.required).length,
          requiredFilledFields: result.emrAnswers.filter(a => a.required && a.proposedAnswer).length,
          lowConfidenceCount: result.emrAnswers.filter(a => a.confidence < 0.7 && a.proposedAnswer).length,
          soapNote: result.soapNote,
          visitNarrative: result.visitNarrative,
        });
      }

      updateProcessingProgress(100, 'Complete');

    } catch (error) {
      console.error('Processing failed:', error);
      setProcessingError(error instanceof Error ? error.message : 'Processing failed');
      updateProcessingProgress(0, 'Failed');
    }
  }, [
    audioRecorder, stopRecording, startProcessing, updateProcessingProgress,
    setExtractedEntities, setEmrAnswerMap, currentCapture, visitType, discipline, emrTemplate
  ]);

  // Navigate to review
  const handleGoToReview = useCallback(() => {
    if (currentCapture) {
      navigate(`/visit/${currentCapture.visitId}/review`);
    }
  }, [currentCapture, navigate]);

  // Handle back
  const handleBack = useCallback(() => {
    if (recordingStatus === 'recording' || recordingStatus === 'paused') {
      if (confirm('Recording in progress. Are you sure you want to leave?')) {
        resetCapture();
        navigate('/');
      }
    } else {
      navigate('/');
    }
  }, [recordingStatus, resetCapture, navigate]);

  // If no patient selected, show quick patient picker
  if (!patientId || showPatientPicker) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <QuickPatientPicker
          onSelect={(patient, episode) => {
            setShowPatientPicker(false);
            navigate(`/capture?patientId=${patient.id}&episodeId=${episode.id}&visitType=${visitType}&discipline=${discipline}`);
          }}
          onCancel={() => navigate('/')}
        />
      </div>
    );
  }

  const status = currentCapture?.status || 'ready';
  const isReadyForReview = status === 'review' || status === 'approved';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Visit Capture</h1>
                <p className="text-sm text-gray-500">
                  {discipline} • {visitType.replace('_', ' ')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <StatusBadge status={status} />

              {isReadyForReview && (
                <button
                  onClick={handleGoToReview}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  <CheckCircleIcon className="w-5 h-5" />
                  Review & Approve
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - 3 Column Layout */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - Patient & Documents */}
          <div className="lg:col-span-3 space-y-4">
            <PatientInfoCard
              patientId={patientId}
              episodeId={episodeId}
            />

            <ReferralDocsPanel
              documents={currentCapture?.referralDocuments || []}
              onUpload={addDocument}
              onUpdateDocument={updateDocument}
              onRemove={removeDocument}
              disabled={isProcessing}
            />

            <QuickInputs
              timeIn={currentCapture?.timeIn}
              timeOut={currentCapture?.timeOut}
              location={currentCapture?.location}
              onChange={setVisitInfo}
              disabled={isProcessing}
            />
          </div>

          {/* Center Column - Recording & Timeline */}
          <div className="lg:col-span-6 space-y-4">
            {/* Recording Controls */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <RecordingControls
                status={recordingStatus}
                duration={recordingDuration}
                onStart={handleStartRecording}
                onPause={handlePauseRecording}
                onResume={handleResumeRecording}
                onStop={handleRecordingComplete}
                disabled={isProcessing}
              />
              {processingError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{processingError}</p>
                </div>
              )}
            </div>

            {/* Processing Progress */}
            {isProcessing && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                  <span className="font-medium text-gray-900">AI Analysis in Progress</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${processingProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">{processingMessage}</p>
              </div>
            )}

            {/* Extraction Timeline */}
            <ExtractionTimeline
              items={timeline}
              entities={currentCapture?.extractedEntities}
              isProcessing={isProcessing}
            />
          </div>

          {/* Right Column - EMR Template */}
          <div className="lg:col-span-3">
            <EmrTemplatePanel
              template={emrTemplate}
              answerMap={currentCapture?.emrAnswerMap}
              onGoToReview={handleGoToReview}
              isReady={isReadyForReview}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

// =============================================================================
// QUICK PATIENT PICKER (Inline, not modal)
// =============================================================================

interface QuickPatientPickerProps {
  onSelect: (patient: { id: string; name: string }, episode: { id: string }) => void;
  onCancel: () => void;
}

function QuickPatientPicker({ onSelect, onCancel }: QuickPatientPickerProps) {
  const [search, setSearch] = useState('');

  // Mock patients - replace with real API
  const patients = [
    { id: 'p1', name: 'Doe, John', mrn: 'MRN001', dob: '1945-03-15', episode: { id: 'e1' } },
    { id: 'p2', name: 'Smith, Jane', mrn: 'MRN002', dob: '1952-07-22', episode: { id: 'e2' } },
    { id: 'p3', name: 'Johnson, Robert', mrn: 'MRN003', dob: '1938-11-08', episode: { id: 'e3' } },
  ];

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.mrn.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Start New Visit</h2>

      <input
        type="text"
        placeholder="Search patient name or MRN..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
        autoFocus
      />

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {filtered.map((patient) => (
          <button
            key={patient.id}
            onClick={() => onSelect({ id: patient.id, name: patient.name }, patient.episode)}
            className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <p className="font-medium text-gray-900">{patient.name}</p>
            <p className="text-sm text-gray-500">{patient.mrn} • DOB: {patient.dob}</p>
          </button>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// MOCK DATA & SIMULATION
// =============================================================================

function getMockEmrTemplate(visitType: string, discipline: string) {
  return {
    id: `template_${visitType}_${discipline}`,
    name: `${discipline} ${visitType} Template`,
    vendor: 'Generic EMR',
    version: '1.0',
    visitType,
    discipline,
    fields: [
      { fieldId: 'visit_date', label: 'Visit Date', section: 'Admin', type: 'date' as const, required: true },
      { fieldId: 'time_in', label: 'Time In', section: 'Admin', type: 'time' as const, required: true },
      { fieldId: 'time_out', label: 'Time Out', section: 'Admin', type: 'time' as const, required: true },
      { fieldId: 'bp_systolic', label: 'Blood Pressure - Systolic', section: 'Vitals', type: 'number' as const, required: true },
      { fieldId: 'bp_diastolic', label: 'Blood Pressure - Diastolic', section: 'Vitals', type: 'number' as const, required: true },
      { fieldId: 'heart_rate', label: 'Heart Rate', section: 'Vitals', type: 'number' as const, required: true },
      { fieldId: 'temperature', label: 'Temperature', section: 'Vitals', type: 'number' as const, required: false },
      { fieldId: 'pain_level', label: 'Pain Level (0-10)', section: 'Vitals', type: 'scale' as const, required: true },
      { fieldId: 'chief_complaint', label: 'Chief Complaint', section: 'Subjective', type: 'textarea' as const, required: true },
      { fieldId: 'homebound_reason', label: 'Homebound Reason', section: 'Compliance', type: 'textarea' as const, required: true },
      { fieldId: 'skilled_need', label: 'Skilled Need Justification', section: 'Compliance', type: 'textarea' as const, required: true },
      { fieldId: 'soap_subjective', label: 'SOAP - Subjective', section: 'SOAP', type: 'textarea' as const, required: true },
      { fieldId: 'soap_objective', label: 'SOAP - Objective', section: 'SOAP', type: 'textarea' as const, required: true },
      { fieldId: 'soap_assessment', label: 'SOAP - Assessment', section: 'SOAP', type: 'textarea' as const, required: true },
      { fieldId: 'soap_plan', label: 'SOAP - Plan', section: 'SOAP', type: 'textarea' as const, required: true },
    ],
    sections: ['Admin', 'Vitals', 'Subjective', 'SOAP', 'Compliance'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Note: Old simulateAIProcessing function removed - now using real API via processCapture service
