/**
 * Assessment Review Page
 *
 * Comprehensive supervisor review interface for approving/rejecting assessments
 * with inline feedback and correction tracking
 */

import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useAssessment, useReviewAssessment, useQuestions, useLockAssessment } from '@hooks/index';
import { Button, Spinner, Alert, Badge, Modal } from '@components/common';
import { HIPPSCalculator } from '@components/oasis';
import { STATUS_CONFIG, ASSESSMENT_TYPE_LABELS, OASIS_SECTIONS } from '@typedefs/oasis.types';
import { getErrorMessage } from '@services/index';
import type { OASISQuestion, OASISResponse, OASISSectionId } from '@typedefs/index';

// Correction categories
const CORRECTION_CATEGORIES = [
  { id: 'missing_data', label: 'Missing Data', color: 'red' },
  { id: 'incorrect_response', label: 'Incorrect Response', color: 'orange' },
  { id: 'inconsistent', label: 'Inconsistent with Other Items', color: 'yellow' },
  { id: 'documentation', label: 'Documentation Issue', color: 'blue' },
  { id: 'clarification', label: 'Needs Clarification', color: 'purple' },
];

interface QuestionFeedback {
  itemCode: string;
  category: string;
  comment: string;
}

export default function AssessmentReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: assessment, isLoading, error } = useAssessment(id);
  const { data: questions } = useQuestions(
    assessment?.assessmentType ? { assessmentType: assessment.assessmentType } : undefined
  );
  const reviewMutation = useReviewAssessment(id!);
  const lockMutation = useLockAssessment(id!);

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['clinical_record']));
  const [questionFeedback, setQuestionFeedback] = useState<QuestionFeedback[]>([]);
  const [feedbackInput, setFeedbackInput] = useState<{ itemCode: string; category: string; comment: string } | null>(null);
  const [lockAfterApproval, setLockAfterApproval] = useState(true);

  // Group questions by section
  const questionsBySection = useMemo(() => {
    if (!questions) return new Map<OASISSectionId, OASISQuestion[]>();

    const grouped = new Map<OASISSectionId, OASISQuestion[]>();
    for (const question of questions) {
      if (!grouped.has(question.section)) {
        grouped.set(question.section, []);
      }
      grouped.get(question.section)!.push(question);
    }

    // Sort questions within each section
    grouped.forEach((sectionQuestions) => {
      sectionQuestions.sort((a, b) => a.sortOrder - b.sortOrder);
    });

    return grouped;
  }, [questions]);

  // Calculate section stats
  const sectionStats = useMemo(() => {
    const stats: Record<string, { total: number; answered: number; withFeedback: number }> = {};

    questionsBySection.forEach((sectionQuestions, sectionId) => {
      const answered = sectionQuestions.filter(q => {
        const response = assessment?.responses?.[q.itemCode];
        return response?.responseValue || response?.responseCode || response?.responseText || response?.responseNumeric !== undefined;
      }).length;

      const withFeedback = sectionQuestions.filter(q =>
        questionFeedback.some(f => f.itemCode === q.itemCode)
      ).length;

      stats[sectionId] = {
        total: sectionQuestions.length,
        answered,
        withFeedback,
      };
    });

    return stats;
  }, [questionsBySection, assessment?.responses, questionFeedback]);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const expandAllSections = () => {
    setExpandedSections(new Set(OASIS_SECTIONS.map(s => s.id)));
  };

  const collapseAllSections = () => {
    setExpandedSections(new Set());
  };

  const addFeedback = (itemCode: string, category: string, comment: string) => {
    setQuestionFeedback(prev => [
      ...prev.filter(f => f.itemCode !== itemCode),
      { itemCode, category, comment },
    ]);
    setFeedbackInput(null);
  };

  const removeFeedback = (itemCode: string) => {
    setQuestionFeedback(prev => prev.filter(f => f.itemCode !== itemCode));
  };

  const getFeedbackForQuestion = (itemCode: string) => {
    return questionFeedback.find(f => f.itemCode === itemCode);
  };

  const formatResponseValue = (question: OASISQuestion, response: OASISResponse | undefined) => {
    if (!response) return <span className="text-gray-400 italic">Not answered</span>;

    const value = response.responseValue || response.responseCode || response.responseText ||
      (response.responseNumeric !== undefined ? String(response.responseNumeric) : null) ||
      response.responseDate;

    if (!value) return <span className="text-gray-400 italic">Not answered</span>;

    // For select types, show the label
    if ((question.responseType === 'single_select' || question.responseType === 'multi_select') && question.responses) {
      const codes = value.split(',');
      const labels = codes.map(code => {
        const option = question.responses?.find(r => r.code === code);
        return option ? `${code} - ${option.label}` : code;
      });
      return <span>{labels.join(', ')}</span>;
    }

    return <span>{value}</span>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" label="Loading assessment..." />
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="max-w-2xl mx-auto">
        <Alert variant="error" title="Error loading assessment">
          {error?.message || 'Assessment not found'}
        </Alert>
        <Link to="/assessments" className="mt-4 inline-block">
          <Button variant="secondary">Back to Assessments</Button>
        </Link>
      </div>
    );
  }

  if (assessment.status !== 'PENDING_REVIEW' && assessment.status !== 'APPROVED') {
    return (
      <div className="max-w-2xl mx-auto">
        <Alert variant="warning" title="Cannot review">
          This assessment is not pending review. Current status:{' '}
          {STATUS_CONFIG[assessment.status].label}
        </Alert>
        <Link to={`/assessments/${id}`} className="mt-4 inline-block">
          <Button variant="secondary">View Assessment</Button>
        </Link>
      </div>
    );
  }

  const handleApprove = async () => {
    setSubmitError(null);
    try {
      await reviewMutation.mutateAsync({
        approved: true,
        notes: reviewNotes || undefined,
      });

      if (lockAfterApproval) {
        try {
          await lockMutation.mutateAsync();
        } catch {
          // Lock failed, but approval succeeded
        }
      }

      setShowApproveModal(false);
      navigate(`/assessments/${id}`);
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  const handleReject = async () => {
    if (questionFeedback.length === 0) {
      setSubmitError('Please add at least one feedback item to specify what needs correction');
      return;
    }

    setSubmitError(null);

    // Build correction reason from feedback
    const correctionReason = questionFeedback
      .map(f => {
        const category = CORRECTION_CATEGORIES.find(c => c.id === f.category)?.label || f.category;
        return `[${category}] ${f.itemCode}: ${f.comment}`;
      })
      .join('\n\n');

    try {
      await reviewMutation.mutateAsync({
        approved: false,
        correctionReason,
        notes: reviewNotes || undefined,
      });
      setShowRejectModal(false);
      navigate(`/assessments/${id}`);
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Review Assessment</h1>
              <Badge variant="status" status={assessment.status}>
                {STATUS_CONFIG[assessment.status].label}
              </Badge>
            </div>
            <p className="text-gray-500">
              {assessment.patient?.firstName} {assessment.patient?.lastName} -{' '}
              {ASSESSMENT_TYPE_LABELS[assessment.assessmentType]}
            </p>
          </div>
          <Link to="/assessments?status=PENDING_REVIEW">
            <Button variant="secondary">Back to Review Queue</Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Assessment Summary */}
          <div className="bg-white rounded-lg shadow-card p-6">
            <h2 className="text-lg font-semibold mb-4">Assessment Summary</h2>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Patient</dt>
                <dd className="font-medium">
                  {assessment.patient?.firstName} {assessment.patient?.lastName}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">MRN</dt>
                <dd className="font-medium">{assessment.patient?.mrn}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Completion</dt>
                <dd className="font-medium">{assessment.completionPercentage}%</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Submitted By</dt>
                <dd className="font-medium">
                  {assessment.clinician?.firstName} {assessment.clinician?.lastName}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Submitted At</dt>
                <dd className="font-medium">
                  {assessment.workflow.submittedAt
                    ? new Date(assessment.workflow.submittedAt).toLocaleString()
                    : 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Episode</dt>
                <dd className="font-medium">#{assessment.episode?.episodeNumber}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Responses</dt>
                <dd className="font-medium">{Object.keys(assessment.responses || {}).length}</dd>
              </div>
            </dl>
          </div>

          {/* HIPPS Calculator with Optimization Suggestions */}
          <div className="bg-white rounded-lg shadow-card p-6">
            <h2 className="text-lg font-semibold mb-4">HIPPS Code & Reimbursement</h2>
            <HIPPSCalculator
              assessmentId={assessment.id}
              showOptimizations={true}
              isLocked={false}  // Review page only shows PENDING_REVIEW/APPROVED, never LOCKED
            />
          </div>

          {/* Validation Errors */}
          {assessment.validationErrors && assessment.validationErrors.length > 0 && (
            <Alert variant="warning">
              <div>
                <p className="font-medium">
                  {assessment.validationErrors.length} validation issue(s) detected
                </p>
                <ul className="mt-2 text-sm list-disc list-inside">
                  {assessment.validationErrors.slice(0, 5).map((err, i) => (
                    <li key={i}>
                      <span className="font-medium">{err.itemCode}:</span> {err.message}
                    </li>
                  ))}
                  {assessment.validationErrors.length > 5 && (
                    <li className="text-gray-600">
                      ...and {assessment.validationErrors.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            </Alert>
          )}

          {/* Section Controls */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Assessment Responses</h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={expandAllSections}>
                Expand All
              </Button>
              <Button variant="ghost" size="sm" onClick={collapseAllSections}>
                Collapse All
              </Button>
            </div>
          </div>

          {/* Sections */}
          {OASIS_SECTIONS.map((section) => {
            const sectionQuestions = questionsBySection.get(section.id) || [];
            const stats = sectionStats[section.id] || { total: 0, answered: 0, withFeedback: 0 };
            const isExpanded = expandedSections.has(section.id);

            if (sectionQuestions.length === 0) return null;

            return (
              <div key={section.id} className="bg-white rounded-lg shadow-card overflow-hidden">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-semibold text-gray-900">{section.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">
                      {stats.answered}/{stats.total} answered
                    </span>
                    {stats.withFeedback > 0 && (
                      <Badge variant="warning">{stats.withFeedback} feedback</Badge>
                    )}
                  </div>
                </button>

                {/* Section Content */}
                {isExpanded && (
                  <div className="border-t border-gray-200 divide-y divide-gray-100">
                    {sectionQuestions.map((question) => {
                      const response = assessment.responses?.[question.itemCode];
                      const feedback = getFeedbackForQuestion(question.itemCode);
                      const isAddingFeedback = feedbackInput?.itemCode === question.itemCode;

                      return (
                        <div
                          key={question.id}
                          className={`px-6 py-4 ${feedback ? 'bg-yellow-50' : ''}`}
                        >
                          {/* Question Header */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-primary-600">
                                  {question.itemCode}
                                </span>
                                <span className="text-sm font-semibold text-gray-900">
                                  {question.itemName}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-gray-600">{question.questionText}</p>
                            </div>

                            {/* Add Feedback Button */}
                            {!feedback && !isAddingFeedback && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setFeedbackInput({ itemCode: question.itemCode, category: '', comment: '' })}
                                className="text-gray-400 hover:text-yellow-600"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                </svg>
                              </Button>
                            )}
                          </div>

                          {/* Response Value */}
                          <div className="mt-2 p-3 bg-gray-50 rounded-md">
                            <span className="text-sm font-medium text-gray-700">Response: </span>
                            <span className="text-sm text-gray-900">
                              {formatResponseValue(question, response)}
                            </span>
                            {response?.sourceType === 'voice' && (
                              <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                Voice
                              </span>
                            )}
                            {response?.confidence && (
                              <span className="ml-2 text-xs text-gray-500">
                                ({Math.round(response.confidence * 100)}% confidence)
                              </span>
                            )}
                          </div>

                          {/* Existing Feedback */}
                          {feedback && (
                            <div className="mt-3 p-3 bg-yellow-100 border border-yellow-200 rounded-md">
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-${CORRECTION_CATEGORIES.find(c => c.id === feedback.category)?.color}-100 text-${CORRECTION_CATEGORIES.find(c => c.id === feedback.category)?.color}-800`}>
                                    {CORRECTION_CATEGORIES.find(c => c.id === feedback.category)?.label}
                                  </span>
                                  <p className="mt-1 text-sm text-gray-700">{feedback.comment}</p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFeedback(question.itemCode)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Add Feedback Form */}
                          {isAddingFeedback && (
                            <div className="mt-3 p-3 bg-gray-100 border border-gray-200 rounded-md space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Category
                                </label>
                                <select
                                  value={feedbackInput.category}
                                  onChange={(e) => setFeedbackInput({ ...feedbackInput, category: e.target.value })}
                                  className="form-input text-sm"
                                >
                                  <option value="">Select category...</option>
                                  {CORRECTION_CATEGORIES.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Comment
                                </label>
                                <textarea
                                  value={feedbackInput.comment}
                                  onChange={(e) => setFeedbackInput({ ...feedbackInput, comment: e.target.value })}
                                  rows={2}
                                  className="form-input text-sm"
                                  placeholder="Describe the issue or correction needed..."
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => {
                                    if (feedbackInput.category && feedbackInput.comment) {
                                      addFeedback(feedbackInput.itemCode, feedbackInput.category, feedbackInput.comment);
                                    }
                                  }}
                                  disabled={!feedbackInput.category || !feedbackInput.comment}
                                >
                                  Add Feedback
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setFeedbackInput(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar */}
        <div className="hidden lg:block w-80 flex-shrink-0">
          <div className="sticky top-24 space-y-4">
            {/* Review Actions */}
            <div className="bg-white rounded-lg shadow-card p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Review Actions</h3>

              <div className="space-y-3">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => setShowApproveModal(true)}
                  disabled={reviewMutation.isLoading}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve Assessment
                </Button>

                <Button
                  variant="danger"
                  className="w-full"
                  onClick={() => setShowRejectModal(true)}
                  disabled={reviewMutation.isLoading || questionFeedback.length === 0}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Request Corrections
                </Button>

                {questionFeedback.length === 0 && (
                  <p className="text-xs text-gray-500 text-center">
                    Add feedback to questions to enable corrections
                  </p>
                )}
              </div>
            </div>

            {/* Feedback Summary */}
            <div className="bg-white rounded-lg shadow-card p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Feedback Summary</h3>

              {questionFeedback.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No feedback added yet. Click the comment icon on any question to add feedback.
                </p>
              ) : (
                <div className="space-y-2">
                  {questionFeedback.map((f) => (
                    <div
                      key={f.itemCode}
                      className="p-2 bg-yellow-50 border border-yellow-100 rounded text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{f.itemCode}</span>
                        <button
                          onClick={() => removeFeedback(f.itemCode)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-gray-600 truncate">{f.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow-card p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Quick Stats</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Total Questions</dt>
                  <dd className="font-medium">{questions?.length || 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Answered</dt>
                  <dd className="font-medium">{Object.keys(assessment.responses || {}).length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Completion</dt>
                  <dd className="font-medium">{assessment.completionPercentage}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Validation Issues</dt>
                  <dd className="font-medium text-red-600">
                    {assessment.validationErrors?.length || 0}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Feedback Items</dt>
                  <dd className="font-medium text-yellow-600">{questionFeedback.length}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Approve Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve Assessment"
      >
        <div className="space-y-4">
          {submitError && <Alert variant="error">{submitError}</Alert>}

          <p className="text-gray-600">
            You are about to approve this assessment. This confirms that the responses
            are accurate and complete.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Review Notes (Optional)
            </label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={3}
              className="form-input"
              placeholder="Add any notes about this approval..."
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={lockAfterApproval}
              onChange={(e) => setLockAfterApproval(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Lock assessment after approval (prevents further edits)</span>
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowApproveModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleApprove}
              isLoading={reviewMutation.isLoading}
            >
              Approve Assessment
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Request Corrections"
      >
        <div className="space-y-4">
          {submitError && <Alert variant="error">{submitError}</Alert>}

          <p className="text-gray-600">
            You are requesting corrections for this assessment. The clinician will be
            notified and the assessment will be returned for updates.
          </p>

          {/* Feedback Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">
              Corrections Requested ({questionFeedback.length})
            </h4>
            <ul className="space-y-2 text-sm">
              {questionFeedback.map((f) => (
                <li key={f.itemCode} className="flex items-start gap-2">
                  <span className="font-medium text-gray-700">{f.itemCode}:</span>
                  <span className="text-gray-600">{f.comment}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes (Optional)
            </label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={3}
              className="form-input"
              placeholder="Add any additional instructions or context..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              isLoading={reviewMutation.isLoading}
            >
              Request Corrections
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
