/**
 * CommunicationDraftEditor Component
 *
 * Full-screen modal for editing AI-generated physician communications.
 * Supports editing subject, summary, and detailed content.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type {
  CommunicationTriggerWithStatus,
  PhysicianCommunication,
} from '../../types/communication.types';
import {
  COMMUNICATION_TYPE_CONFIG,
  COMMUNICATION_URGENCY_CONFIG,
} from '../../types/communication.types';
import { communicationService } from '../../services/communication.service';
import * as integrationService from '../../services/integration.service';
import type { SendMethod } from '../../types/integration.types';
import { PROVIDER_CONFIG } from '../../types/integration.types';

// Inline SVG icons
const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const SaveIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
  </svg>
);

const LoaderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const AlertTriangleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const CheckCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const EditIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const SendIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const MailIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const ShieldIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

interface CommunicationDraftEditorProps {
  isOpen: boolean;
  onClose: () => void;
  assessmentId: string;
  trigger?: CommunicationTriggerWithStatus;
  existingCommunication?: PhysicianCommunication;
  physicianName: string;
  physicianNpi?: string;
  onSaved?: (communication: PhysicianCommunication) => void;
}

type ViewMode = 'summary' | 'detailed';

export const CommunicationDraftEditor: React.FC<CommunicationDraftEditorProps> = ({
  isOpen,
  onClose,
  assessmentId,
  trigger,
  existingCommunication,
  physicianName,
  physicianNpi,
  onSaved,
}) => {
  // State
  const [communication, setCommunication] = useState<PhysicianCommunication | null>(
    existingCommunication || null
  );
  const [subject, setSubject] = useState('');
  const [summaryContent, setSummaryContent] = useState('');
  const [detailedContent, setDetailedContent] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerateInstructions, setRegenerateInstructions] = useState('');
  const [showRegenerateForm, setShowRegenerateForm] = useState(false);

  // Send-related state
  const [showSendForm, setShowSendForm] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendMethod, setSendMethod] = useState<SendMethod>('mailto');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  /**
   * Generate initial draft from trigger
   */
  const generateInitialDraft = useCallback(async () => {
    if (!trigger) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await communicationService.generateCommunication(assessmentId, {
        trigger: {
          ruleId: trigger.ruleId,
          type: trigger.type,
          urgency: trigger.urgency,
          title: trigger.title,
          description: trigger.description,
          triggerData: trigger.triggerData,
          relatedOasisItems: trigger.relatedOasisItems,
        },
        physicianName,
        physicianNpi,
      });

      setCommunication(response.communication);
      setSubject(response.communication.subject);
      setSummaryContent(response.communication.summaryContent);
      setDetailedContent(response.communication.detailedContent);
    } catch (err) {
      console.error('[Draft Editor] Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate communication');
    } finally {
      setIsGenerating(false);
    }
  }, [assessmentId, trigger, physicianName, physicianNpi]);

  // Initialize from existing communication or generate new
  useEffect(() => {
    if (!isOpen) return;

    if (existingCommunication) {
      setCommunication(existingCommunication);
      setSubject(existingCommunication.subject);
      setSummaryContent(existingCommunication.summaryContent);
      setDetailedContent(existingCommunication.detailedContent);
    } else if (trigger) {
      generateInitialDraft();
    }
  }, [isOpen, existingCommunication, trigger, generateInitialDraft]);

  /**
   * Regenerate with instructions
   */
  const handleRegenerate = async () => {
    if (!communication || !regenerateInstructions.trim()) return;

    setIsRegenerating(true);
    setError(null);

    try {
      const response = await communicationService.regenerateCommunication(
        communication.id,
        { instructions: regenerateInstructions }
      );

      setCommunication(response.communication);
      setSubject(response.communication.subject);
      setSummaryContent(response.communication.summaryContent);
      setDetailedContent(response.communication.detailedContent);
      setRegenerateInstructions('');
      setShowRegenerateForm(false);
    } catch (err) {
      console.error('[Draft Editor] Regeneration error:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate communication');
    } finally {
      setIsRegenerating(false);
    }
  };

  /**
   * Save draft
   */
  const handleSave = async () => {
    if (!communication) return;

    setIsSaving(true);
    setError(null);

    try {
      const updated = await communicationService.updateCommunication(communication.id, {
        subject,
        summaryContent,
        detailedContent,
      });

      setCommunication(updated);
      setIsEditing(false);
      onSaved?.(updated);
    } catch (err) {
      console.error('[Draft Editor] Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save communication');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Mark as ready to send
   */
  const handleMarkReady = async () => {
    if (!communication) return;

    setIsSaving(true);
    setError(null);

    try {
      const updated = await communicationService.updateCommunication(communication.id, {
        subject,
        summaryContent,
        detailedContent,
        status: 'READY_TO_SEND',
      });

      setCommunication(updated);
      onSaved?.(updated);
      onClose();
    } catch (err) {
      console.error('[Draft Editor] Mark ready error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update communication');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Send communication
   */
  const handleSend = async () => {
    if (!communication || !recipientEmail) return;

    setIsSending(true);
    setSendError(null);
    setSendSuccess(false);

    try {
      // First save any pending changes
      if (subject !== communication.subject ||
          summaryContent !== communication.summaryContent ||
          detailedContent !== communication.detailedContent) {
        await communicationService.updateCommunication(communication.id, {
          subject,
          summaryContent,
          detailedContent,
        });
      }

      // Send the communication
      const result = await integrationService.sendCommunication(communication.id, {
        method: sendMethod,
        recipientEmail,
        recipientName: physicianName,
      });

      if (result.success) {
        if (result.method === 'mailto' && result.mailtoUrl) {
          // Open the mailto URL in a new window/tab
          integrationService.openMailtoUrl(result.mailtoUrl);
          setSendSuccess(true);
          // Close after a short delay
          setTimeout(() => {
            onSaved?.(communication);
            onClose();
          }, 1500);
        } else {
          // Server-side send was successful
          setSendSuccess(true);
          setTimeout(() => {
            onSaved?.(communication);
            onClose();
          }, 1500);
        }
      } else {
        setSendError(result.error || 'Failed to send communication');
      }
    } catch (err) {
      console.error('[Draft Editor] Send error:', err);
      setSendError(err instanceof Error ? err.message : 'Failed to send communication');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  const typeConfig = trigger ? COMMUNICATION_TYPE_CONFIG[trigger.type] : null;
  const urgencyConfig = trigger ? COMMUNICATION_URGENCY_CONFIG[trigger.urgency] : null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute inset-4 md:inset-8 lg:inset-12 bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            {typeConfig && (
              <span
                className={`px-2.5 py-1 text-xs font-medium rounded-full ${typeConfig.bgColor} ${typeConfig.color}`}
              >
                {typeConfig.label}
              </span>
            )}
            {urgencyConfig && (
              <span
                className={`px-2.5 py-1 text-xs font-medium rounded-full ${urgencyConfig.bgColor} ${urgencyConfig.color}`}
              >
                {urgencyConfig.label}
              </span>
            )}
            <h2 className="text-lg font-semibold text-gray-900">
              Physician Communication Draft
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <LoaderIcon className="h-12 w-12 text-blue-500" />
              <p className="text-gray-600">Generating communication draft...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <AlertTriangleIcon className="h-12 w-12 text-red-500" />
              <p className="text-red-600">{error}</p>
              <button
                onClick={generateInitialDraft}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          ) : communication ? (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Recipient Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">To:</h3>
                <p className="text-gray-900">
                  {physicianName}
                  {physicianNpi && (
                    <span className="text-gray-500 ml-2">(NPI: {physicianNpi})</span>
                  )}
                </p>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter subject..."
                  />
                ) : (
                  <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">
                    {subject}
                  </p>
                )}
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg w-fit">
                <button
                  onClick={() => setViewMode('summary')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'summary'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Summary (3-5 sentences)
                </button>
                <button
                  onClick={() => setViewMode('detailed')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'detailed'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Detailed Version
                </button>
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {viewMode === 'summary' ? 'Summary Content' : 'Detailed Content'}
                </label>
                {isEditing ? (
                  <textarea
                    value={viewMode === 'summary' ? summaryContent : detailedContent}
                    onChange={(e) =>
                      viewMode === 'summary'
                        ? setSummaryContent(e.target.value)
                        : setDetailedContent(e.target.value)
                    }
                    rows={viewMode === 'summary' ? 6 : 12}
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    placeholder="Enter content..."
                  />
                ) : (
                  <div className="px-4 py-3 bg-gray-50 rounded-lg whitespace-pre-wrap text-gray-900 min-h-[150px]">
                    {viewMode === 'summary' ? summaryContent : detailedContent}
                  </div>
                )}
              </div>

              {/* Regenerate Form */}
              {showRegenerateForm && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <label className="block text-sm font-medium text-blue-900 mb-2">
                    Regeneration Instructions
                  </label>
                  <textarea
                    value={regenerateInstructions}
                    onChange={(e) => setRegenerateInstructions(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Make it more concise, add more clinical detail, change tone..."
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleRegenerate}
                      disabled={isRegenerating || !regenerateInstructions.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isRegenerating ? (
                        <LoaderIcon className="h-4 w-4" />
                      ) : (
                        <RefreshIcon className="h-4 w-4" />
                      )}
                      Regenerate
                    </button>
                    <button
                      onClick={() => {
                        setShowRegenerateForm(false);
                        setRegenerateInstructions('');
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Send Form */}
              {showSendForm && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-200 space-y-4">
                  <div className="flex items-start gap-3">
                    <ShieldIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">PHI Warning</p>
                      <p className="text-xs text-amber-700 mt-1">
                        This communication may contain Protected Health Information (PHI).
                        Ensure you are sending to an authorized recipient via a secure channel.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Recipient Email
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="physician@clinic.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Send Method
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSendMethod('mailto')}
                        className={`p-3 border rounded-lg text-left transition-colors ${
                          sendMethod === 'mailto'
                            ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{PROVIDER_CONFIG.MAILTO.icon}</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {PROVIDER_CONFIG.MAILTO.label}
                            </p>
                            <p className="text-xs text-gray-500">
                              {PROVIDER_CONFIG.MAILTO.description}
                            </p>
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSendMethod('smtp')}
                        className={`p-3 border rounded-lg text-left transition-colors ${
                          sendMethod === 'smtp'
                            ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{PROVIDER_CONFIG.SMTP.icon}</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {PROVIDER_CONFIG.SMTP.label}
                            </p>
                            <p className="text-xs text-gray-500">
                              {PROVIDER_CONFIG.SMTP.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {sendError && (
                    <div className="flex items-center gap-2 text-red-600 text-sm">
                      <AlertTriangleIcon className="h-4 w-4" />
                      {sendError}
                    </div>
                  )}

                  {sendSuccess && (
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                      <CheckCircleIcon className="h-4 w-4" />
                      {sendMethod === 'mailto'
                        ? 'Opening your email client...'
                        : 'Email sent successfully!'}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleSend}
                      disabled={isSending || !recipientEmail || sendSuccess}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSending ? (
                        <LoaderIcon className="h-4 w-4" />
                      ) : (
                        <SendIcon className="h-4 w-4" />
                      )}
                      {sendMethod === 'mailto' ? 'Open in Mail App' : 'Send Email'}
                    </button>
                    <button
                      onClick={() => {
                        setShowSendForm(false);
                        setSendError(null);
                        setSendSuccess(false);
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Generation Info */}
              {communication.aiModelUsed && (
                <p className="text-xs text-gray-500">
                  Generated by {communication.aiModelUsed} in{' '}
                  {communication.generationTimeMs}ms
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <p className="text-gray-600">No communication to display</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {communication && !isGenerating && (
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    <EditIcon className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => setShowRegenerateForm(true)}
                    disabled={showRegenerateForm}
                    className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                  >
                    <RefreshIcon className="h-4 w-4" />
                    Regenerate
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setIsEditing(false);
                    // Reset to saved values
                    setSubject(communication.subject);
                    setSummaryContent(communication.summaryContent);
                    setDetailedContent(communication.detailedContent);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel Editing
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {isEditing && (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? (
                    <LoaderIcon className="h-4 w-4" />
                  ) : (
                    <SaveIcon className="h-4 w-4" />
                  )}
                  Save Draft
                </button>
              )}
              <button
                onClick={handleMarkReady}
                disabled={isSaving || isEditing || showSendForm}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <LoaderIcon className="h-4 w-4" />
                ) : (
                  <CheckCircleIcon className="h-4 w-4" />
                )}
                Save & Close
              </button>
              <button
                onClick={() => setShowSendForm(true)}
                disabled={isSaving || isEditing || showSendForm}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <MailIcon className="h-4 w-4" />
                Send to Physician
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunicationDraftEditor;
