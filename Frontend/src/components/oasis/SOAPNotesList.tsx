/**
 * SOAP Notes List Component
 *
 * Displays all SOAP notes for a patient with filtering and actions
 */

import { useState, useEffect, useCallback } from 'react';
import { Button, Spinner, Badge, Alert, Modal } from '@components/common';
import { soapNoteService } from '@services/soapNote.service';
import SOAPNoteView from './SOAPNoteView';
import type {
  SoapNoteListItem,
  SoapNoteStatus,
  SoapNotesListParams,
} from '@typedefs/index';
import { SOAP_STATUS_CONFIG, ASSESSMENT_TYPE_LABELS } from '@typedefs/index';

// ===========================================
// TYPES
// ===========================================

interface SOAPNotesListProps {
  patientId: string;
  patientName?: string;
  onNoteSelect?: (noteId: string) => void;
  selectedAssessmentId?: string;
}

// ===========================================
// ICONS
// ===========================================

const DocumentIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const EyeIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
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

const FilterIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
    />
  </svg>
);

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ===========================================
// COMPONENT
// ===========================================

export default function SOAPNotesList({
  patientId,
  patientName,
  onNoteSelect,
}: SOAPNotesListProps) {
  const [notes, setNotes] = useState<SoapNoteListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<SoapNoteListItem | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [filters, setFilters] = useState<SoapNotesListParams>({});
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  // Fetch SOAP notes
  const fetchNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await soapNoteService.listByPatient(patientId, {
        ...filters,
        page: pagination.page,
        limit: pagination.limit,
      });
      setNotes(response.data);
      setPagination(response.pagination);
    } catch (err) {
      console.error('Error fetching SOAP notes:', err);
      setError('Failed to load SOAP notes');
    } finally {
      setIsLoading(false);
    }
  }, [patientId, filters, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Handle view note
  const handleViewNote = (note: SoapNoteListItem) => {
    setSelectedNote(note);
    setIsViewModalOpen(true);
    onNoteSelect?.(note.id);
  };

  // Handle export
  const handleExport = async (note: SoapNoteListItem) => {
    try {
      const name = patientName || `Patient_${patientId}`;
      await soapNoteService.downloadPdf(note.id, name);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      setError('Failed to export SOAP note');
    }
  };

  // Handle status filter change
  const handleStatusFilter = (status: SoapNoteStatus | '') => {
    setFilters((prev) => ({
      ...prev,
      status: status || undefined,
    }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Loading state
  if (isLoading && notes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  // Error state
  if (error && notes.length === 0) {
    return (
      <Alert variant="error">
        {error}
        <Button variant="ghost" size="sm" onClick={fetchNotes} className="ml-2">
          Retry
        </Button>
      </Alert>
    );
  }

  // Empty state
  if (notes.length === 0 && !filters.status) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
        <DocumentIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No SOAP Notes</h3>
        <p className="text-gray-500">
          SOAP notes will appear here after they are generated from assessments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error alert */}
      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          SOAP Notes ({pagination.total})
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <FilterIcon className="mr-1" /> Filters
        </Button>
      </div>

      {showFilters && (
        <div className="bg-gray-50 p-4 rounded-lg border">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleStatusFilter(e.target.value as SoapNoteStatus | '')}
                className="px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="REVIEWED">Reviewed</option>
                <option value="FINALIZED">Finalized</option>
                <option value="AMENDED">Amended</option>
              </select>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters({});
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      )}

      {/* Notes list */}
      <div className="bg-white rounded-lg border divide-y">
        {notes.map((note) => (
          <div
            key={note.id}
            className="p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between gap-4">
              {/* Note info */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="flex-shrink-0 p-2 bg-blue-50 rounded-lg">
                  <DocumentIcon className="w-6 h-6 text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-gray-900">
                      {note.assessment?.assessmentType
                        ? ASSESSMENT_TYPE_LABELS[note.assessment.assessmentType as keyof typeof ASSESSMENT_TYPE_LABELS] || note.assessment.assessmentType.replace(/_/g, ' ')
                        : 'SOAP Note'}
                    </h4>
                    <Badge variant={SOAP_STATUS_CONFIG[note.status].color}>
                      {SOAP_STATUS_CONFIG[note.status].label}
                    </Badge>
                    <span className="text-xs text-gray-400">v{note.version}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                    <span>{formatDate(note.generatedAt)}</span>
                    {note.generatedBy && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span>
                          {note.generatedBy.firstName} {note.generatedBy.lastName}
                        </span>
                      </>
                    )}
                    {note.finalizedAt && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span className="text-green-600">
                          Finalized {new Date(note.finalizedAt).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewNote(note)}
                  title="View"
                >
                  <EyeIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExport(note)}
                  title="Export"
                >
                  <DownloadIcon />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              disabled={!pagination.hasPrev}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              disabled={!pagination.hasNext}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* View modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedNote(null);
        }}
        title="SOAP Note"
        size="xl"
        closeOnOverlayClick={false}
      >
        {selectedNote && (
          <div className="h-[70vh] overflow-y-auto">
            <SOAPNoteView
              assessmentId={selectedNote.assessmentId}
              patientId={patientId}
              patientName={patientName}
              onClose={() => {
                setIsViewModalOpen(false);
                setSelectedNote(null);
              }}
              onStatusChange={() => {
                fetchNotes();
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
