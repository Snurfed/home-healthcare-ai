/**
 * SOAP Note View Component
 *
 * Displays a single SOAP note with edit, regenerate, and status update capabilities
 */

import { useState, useCallback, useEffect } from 'react';
import { Button, Spinner, Badge, Alert, Modal } from '@components/common';
import { soapNoteService } from '@services/soapNote.service';
import type {
  SoapNote,
  SoapSection,
  SoapNoteStatus,
} from '@typedefs/index';
import { SOAP_STATUS_CONFIG, SOAP_SECTION_CONFIG } from '@typedefs/index';

// ===========================================
// TYPES
// ===========================================

interface SOAPNoteViewProps {
  assessmentId: string;
  patientId: string;
  patientName?: string;
  onClose?: () => void;
  onStatusChange?: (status: SoapNoteStatus) => void;
}

interface SectionEditorProps {
  section: SoapSection;
  content: string | null;
  isEditing: boolean;
  isRegenerating: boolean;
  canEdit: boolean;
  onChange: (value: string) => void;
  onRegenerate: (instructions?: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
}

// ===========================================
// ICONS
// ===========================================

const SparkleIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
    />
  </svg>
);

const EditIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
);

const DownloadIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    />
  </svg>
);

const CheckIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ===========================================
// SECTION EDITOR COMPONENT
// ===========================================

function SectionEditor({
  section,
  content,
  isEditing,
  isRegenerating,
  canEdit,
  onChange,
  onRegenerate,
  onStartEdit,
  onCancelEdit,
}: SectionEditorProps) {
  const [regenerateInstructions, setRegenerateInstructions] = useState('');
  const [showRegenerateInput, setShowRegenerateInput] = useState(false);
  const config = SOAP_SECTION_CONFIG[section];

  const handleRegenerate = () => {
    onRegenerate(regenerateInstructions || undefined);
    setRegenerateInstructions('');
    setShowRegenerateInput(false);
  };

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
            {config.icon}
          </span>
          <div>
            <h3 className="font-medium text-gray-900">{config.label}</h3>
            <p className="text-xs text-gray-500">{config.description}</p>
          </div>
        </div>
        {canEdit && !isEditing && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRegenerateInput(!showRegenerateInput)}
              disabled={isRegenerating}
              title="Regenerate with AI"
            >
              {isRegenerating ? <Spinner size="sm" /> : <SparkleIcon />}
            </Button>
            <Button variant="ghost" size="sm" onClick={onStartEdit} title="Edit manually">
              <EditIcon />
            </Button>
          </div>
        )}
        {isEditing && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onCancelEdit} title="Cancel">
              <XIcon />
            </Button>
          </div>
        )}
      </div>

      {/* Regenerate instructions input */}
      {showRegenerateInput && !isEditing && (
        <div className="px-4 py-3 bg-blue-50 border-b">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Custom instructions (optional)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={regenerateInstructions}
              onChange={(e) => setRegenerateInstructions(e.target.value)}
              placeholder="e.g., Focus more on pain management..."
              className="flex-1 px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <Button size="sm" onClick={handleRegenerate} disabled={isRegenerating}>
              {isRegenerating ? <Spinner size="sm" /> : 'Regenerate'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowRegenerateInput(false);
                setRegenerateInstructions('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {isEditing ? (
          <textarea
            value={content || ''}
            onChange={(e) => onChange(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
            placeholder={`Enter ${config.label.toLowerCase()} notes...`}
          />
        ) : (
          <div className="prose prose-sm max-w-none">
            {content ? (
              <div className="whitespace-pre-wrap text-gray-700">{content}</div>
            ) : (
              <p className="text-gray-400 italic">No content yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export default function SOAPNoteView({
  assessmentId,
  patientId,
  patientName,
  onClose,
  onStatusChange,
}: SOAPNoteViewProps) {
  const [soapNote, setSoapNote] = useState<SoapNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<SoapSection | null>(null);
  const [editedContent, setEditedContent] = useState<Record<SoapSection, string>>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });
  const [regeneratingSection, setRegeneratingSection] = useState<SoapSection | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusAction, setStatusAction] = useState<'review' | 'finalize' | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [showGenerateOptions, setShowGenerateOptions] = useState(false);

  // Fetch existing SOAP note
  const fetchSoapNote = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const note = await soapNoteService.getSoapNoteByAssessment(assessmentId);
      setSoapNote(note);
      if (note) {
        setEditedContent({
          subjective: note.subjective || '',
          objective: note.objective || '',
          assessment: note.assessment || '',
          plan: note.plan || '',
        });
      }
    } catch (err) {
      console.error('Error fetching SOAP note:', err);
      setError('Failed to load SOAP note');
    } finally {
      setIsLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    fetchSoapNote();
  }, [fetchSoapNote]);

  // Generate new SOAP note
  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setShowGenerateOptions(false);
    try {
      const response = await soapNoteService.generateSoapNote(assessmentId, {
        additionalContext: additionalContext || undefined,
      });
      setSoapNote(response.soapNote);
      setEditedContent({
        subjective: response.soapNote.subjective || '',
        objective: response.soapNote.objective || '',
        assessment: response.soapNote.assessment || '',
        plan: response.soapNote.plan || '',
      });
      setAdditionalContext('');
    } catch (err: unknown) {
      console.error('Error generating SOAP note:', err);
      const errorMessage = err && typeof err === 'object' && 'message' in err
        ? String(err.message)
        : 'Failed to generate SOAP note';
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  // Regenerate a section
  const handleRegenerateSection = async (section: SoapSection, instructions?: string) => {
    if (!soapNote) return;
    setRegeneratingSection(section);
    setError(null);
    try {
      const response = await soapNoteService.regenerateSection(soapNote.id, section, instructions);
      setSoapNote((prev) =>
        prev
          ? {
              ...prev,
              [section]: response.content,
              updatedAt: response.soapNote.updatedAt,
            }
          : null
      );
      setEditedContent((prev) => ({
        ...prev,
        [section]: response.content,
      }));
    } catch (err) {
      console.error('Error regenerating section:', err);
      setError(`Failed to regenerate ${section} section`);
    } finally {
      setRegeneratingSection(null);
    }
  };

  // Save edited content
  const handleSave = async () => {
    if (!soapNote || !editingSection) return;
    setIsSaving(true);
    setError(null);
    try {
      const updateData: Record<string, string> = {};
      updateData[editingSection] = editedContent[editingSection];
      const updated = await soapNoteService.updateSoapNote(soapNote.id, updateData);
      setSoapNote((prev) =>
        prev
          ? {
              ...prev,
              ...updated,
            }
          : null
      );
      setEditingSection(null);
    } catch (err) {
      console.error('Error saving SOAP note:', err);
      setError('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  // Update status
  const handleStatusUpdate = async () => {
    if (!soapNote || !statusAction) return;
    setIsSaving(true);
    setError(null);
    try {
      const newStatus: SoapNoteStatus = statusAction === 'review' ? 'REVIEWED' : 'FINALIZED';
      const updated = await soapNoteService.updateSoapNoteStatus(soapNote.id, {
        status: newStatus,
        reviewNotes: reviewNotes || undefined,
      });
      setSoapNote((prev) =>
        prev
          ? {
              ...prev,
              status: updated.status,
              reviewedBy: updated.reviewedBy,
              reviewedAt: updated.reviewedAt,
              finalizedBy: updated.finalizedBy,
              finalizedAt: updated.finalizedAt,
            }
          : null
      );
      setStatusModalOpen(false);
      setStatusAction(null);
      setReviewNotes('');
      onStatusChange?.(newStatus);
    } catch (err: unknown) {
      console.error('Error updating status:', err);
      const errorMessage = err && typeof err === 'object' && 'message' in err
        ? String(err.message)
        : 'Failed to update status';
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Export PDF
  const handleExport = async () => {
    if (!soapNote) return;
    try {
      const name = patientName || `Patient_${patientId}`;
      await soapNoteService.downloadPdf(soapNote.id, name);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      setError('Failed to export SOAP note');
    }
  };

  // Check if can edit (only draft notes)
  const canEdit = soapNote?.status === 'DRAFT';
  const canReview = soapNote?.status === 'DRAFT';
  const canFinalize = soapNote?.status === 'REVIEWED';

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  // No SOAP note yet - show generate option
  if (!soapNote) {
    return (
      <div className="space-y-4">
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <SparkleIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Generate SOAP Note
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Use AI to automatically generate a comprehensive SOAP note from the assessment data.
          </p>

          {showGenerateOptions ? (
            <div className="max-w-md mx-auto space-y-4">
              <div className="text-left">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Context (optional)
                </label>
                <textarea
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add any additional context or instructions for the AI..."
                />
              </div>
              <div className="flex justify-center gap-3">
                <Button onClick={handleGenerate} disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <Spinner size="sm" className="mr-2" /> Generating...
                    </>
                  ) : (
                    <>
                      <SparkleIcon className="mr-2" /> Generate SOAP Note
                    </>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowGenerateOptions(false)}
                  disabled={isGenerating}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setShowGenerateOptions(true)}>
              <SparkleIcon className="mr-2" /> Generate with AI
            </Button>
          )}
        </div>
      </div>
    );
  }

  // SOAP Note view
  return (
    <div className="space-y-4">
      {/* Error alert */}
      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant={SOAP_STATUS_CONFIG[soapNote.status].color}>
            {SOAP_STATUS_CONFIG[soapNote.status].label}
          </Badge>
          <span className="text-sm text-gray-500">Version {soapNote.version}</span>
          {soapNote.aiModelUsed && (
            <span className="text-xs text-gray-400">AI: {soapNote.aiModelUsed}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? <Spinner size="sm" /> : <SparkleIcon className="mr-1" />}
              Regenerate All
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <DownloadIcon className="mr-1" /> Export
          </Button>
          {canReview && (
            <Button
              size="sm"
              onClick={() => {
                setStatusAction('review');
                setStatusModalOpen(true);
              }}
            >
              <CheckIcon className="mr-1" /> Mark Reviewed
            </Button>
          )}
          {canFinalize && (
            <Button
              size="sm"
              onClick={() => {
                setStatusAction('finalize');
                setStatusModalOpen(true);
              }}
            >
              <CheckIcon className="mr-1" /> Finalize
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <XIcon />
            </Button>
          )}
        </div>
      </div>

      {/* SOAP Sections */}
      <div className="space-y-4">
        {(['subjective', 'objective', 'assessment', 'plan'] as SoapSection[]).map((section) => (
          <SectionEditor
            key={section}
            section={section}
            content={editingSection === section ? editedContent[section] : (soapNote[section] as string | null)}
            isEditing={editingSection === section}
            isRegenerating={regeneratingSection === section}
            canEdit={canEdit}
            onChange={(value) =>
              setEditedContent((prev) => ({ ...prev, [section]: value }))
            }
            onRegenerate={(instructions) => handleRegenerateSection(section, instructions)}
            onStartEdit={() => {
              setEditingSection(section);
              setEditedContent((prev) => ({
                ...prev,
                [section]: (soapNote[section] as string) || '',
              }));
            }}
            onCancelEdit={() => {
              setEditingSection(null);
            }}
          />
        ))}
      </div>

      {/* Save button when editing */}
      {editingSection && (
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="secondary"
            onClick={() => setEditingSection(null)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Spinner size="sm" className="mr-2" /> : null}
            Save Changes
          </Button>
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-gray-500 border-t pt-4 space-y-1">
        {soapNote.generatedBy && (
          <p>
            Generated by {soapNote.generatedBy.firstName} {soapNote.generatedBy.lastName} on{' '}
            {new Date(soapNote.generatedAt).toLocaleString()}
          </p>
        )}
        {soapNote.reviewedBy && (
          <p>
            Reviewed by {soapNote.reviewedBy.firstName} {soapNote.reviewedBy.lastName} on{' '}
            {soapNote.reviewedAt ? new Date(soapNote.reviewedAt).toLocaleString() : 'N/A'}
          </p>
        )}
        {soapNote.finalizedBy && (
          <p>
            Finalized by {soapNote.finalizedBy.firstName} {soapNote.finalizedBy.lastName} on{' '}
            {soapNote.finalizedAt ? new Date(soapNote.finalizedAt).toLocaleString() : 'N/A'}
          </p>
        )}
      </div>

      {/* Status update modal */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => {
          setStatusModalOpen(false);
          setStatusAction(null);
          setReviewNotes('');
        }}
        title={statusAction === 'review' ? 'Mark as Reviewed' : 'Finalize SOAP Note'}
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            {statusAction === 'review'
              ? 'This will mark the SOAP note as reviewed. You can add review notes below.'
              : 'This will finalize the SOAP note. Once finalized, it cannot be edited. Only supervisors can perform this action.'}
          </p>
          {statusAction === 'review' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Review Notes (optional)
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add any review comments..."
              />
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setStatusModalOpen(false);
                setStatusAction(null);
                setReviewNotes('');
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleStatusUpdate} disabled={isSaving}>
              {isSaving ? <Spinner size="sm" className="mr-2" /> : null}
              {statusAction === 'review' ? 'Mark Reviewed' : 'Finalize'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
