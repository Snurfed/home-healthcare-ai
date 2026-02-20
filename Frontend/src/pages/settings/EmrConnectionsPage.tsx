/**
 * EMR Connections Page
 *
 * Admin page for managing EMR/FHIR connections
 */

import { useState } from 'react';
import {
  useEmrConnections,
  useCreateEmrConnection,
  useUpdateEmrConnection,
  useDeleteEmrConnection,
  useTestEmrConnection,
} from '@hooks/index';
import { Button, Modal, Input, Select, Alert, Spinner } from '@components/common';
import type { EmrConnection, CreateEmrConnectionRequest, EmrVendor } from '@typedefs/index';
import { EMR_VENDOR_CONFIG } from '@typedefs/index';

const VENDOR_OPTIONS = Object.entries(EMR_VENDOR_CONFIG).map(([value, config]) => ({
  value,
  label: config.label,
}));

const DEFAULT_SCOPES = ['patient/*.read', 'launch/patient'];

export default function EmrConnectionsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingConnection, setEditingConnection] = useState<EmrConnection | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  // Queries and mutations
  const { data: connections, isLoading } = useEmrConnections();
  const createMutation = useCreateEmrConnection();
  const updateMutation = useUpdateEmrConnection();
  const deleteMutation = useDeleteEmrConnection();
  const testMutation = useTestEmrConnection();

  // Handle test connection
  const handleTest = async (id: string) => {
    try {
      const result = await testMutation.mutateAsync(id);
      setTestResults(prev => ({ ...prev, [id]: result }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [id]: {
          success: false,
          message: error instanceof Error ? error.message : 'Test failed',
        },
      }));
    }
  };

  // Handle delete
  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the connection "${name}"?`)) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error('Delete failed:', error);
      }
    }
  };

  // Handle toggle enabled
  const handleToggleEnabled = async (id: string, currentEnabled: boolean) => {
    try {
      await updateMutation.mutateAsync({
        id,
        data: { isEnabled: !currentEnabled },
      });
    } catch (error) {
      console.error('Toggle failed:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">EMR Connections</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage connections to external EMR systems via FHIR R4
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          Add Connection
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && connections?.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <svg
            className="mx-auto h-12 w-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h3 className="mt-4 text-sm font-medium text-gray-900">No EMR connections</h3>
          <p className="mt-1 text-sm text-gray-500">
            Add a connection to enable patient import from EMR systems.
          </p>
          <Button className="mt-4" onClick={() => setShowAddModal(true)}>
            Add First Connection
          </Button>
        </div>
      )}

      {/* Connections List */}
      {connections && connections.length > 0 && (
        <div className="space-y-4">
          {connections.map((connection: EmrConnection) => (
            <div
              key={connection.id}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${EMR_VENDOR_CONFIG[connection.vendor]?.color || 'bg-gray-100 text-gray-800'}`}>
                    {EMR_VENDOR_CONFIG[connection.vendor]?.label || connection.vendor}
                  </span>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{connection.name}</h3>
                    <p className="text-xs text-gray-500">{connection.fhirBaseUrl}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={connection.isEnabled}
                      onChange={() => handleToggleEnabled(connection.id, connection.isEnabled)}
                      className="sr-only"
                    />
                    <div className={`relative w-10 h-5 rounded-full transition-colors ${
                      connection.isEnabled ? 'bg-green-500' : 'bg-gray-300'
                    }`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        connection.isEnabled ? 'translate-x-5' : ''
                      }`} />
                    </div>
                    <span className="ml-2 text-xs text-gray-500">
                      {connection.isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Status */}
              <div className="mt-3 flex items-center gap-4 text-xs">
                {connection.lastConnectedAt && (
                  <span className="text-gray-500">
                    Last connected: {new Date(connection.lastConnectedAt).toLocaleString()}
                  </span>
                )}
                {connection.lastConnectionError && (
                  <span className="text-red-500">
                    Error: {connection.lastConnectionError}
                  </span>
                )}
              </div>

              {/* Test Result */}
              {testResults[connection.id] && (
                <div className={`mt-3 text-xs ${testResults[connection.id]?.success ? 'text-green-600' : 'text-red-600'}`}>
                  {testResults[connection.id]?.message}
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleTest(connection.id)}
                  disabled={testMutation.isLoading}
                >
                  {testMutation.isLoading ? 'Testing...' : 'Test Connection'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditingConnection(connection)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleDelete(connection.id, connection.name)}
                  disabled={deleteMutation.isLoading}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingConnection) && (
        <ConnectionFormModal
          connection={editingConnection}
          onClose={() => {
            setShowAddModal(false);
            setEditingConnection(null);
          }}
          onSave={async (data) => {
            if (editingConnection) {
              await updateMutation.mutateAsync({ id: editingConnection.id, data });
            } else {
              await createMutation.mutateAsync(data);
            }
            setShowAddModal(false);
            setEditingConnection(null);
          }}
          isSaving={createMutation.isLoading || updateMutation.isLoading}
          error={(createMutation.error || updateMutation.error) as Error | null}
        />
      )}
    </div>
  );
}

// ===========================================
// CONNECTION FORM MODAL
// ===========================================

interface ConnectionFormModalProps {
  connection: EmrConnection | null;
  onClose: () => void;
  onSave: (data: CreateEmrConnectionRequest) => Promise<void>;
  isSaving: boolean;
  error: Error | null;
}

function ConnectionFormModal({
  connection,
  onClose,
  onSave,
  isSaving,
  error,
}: ConnectionFormModalProps) {
  const [formData, setFormData] = useState<CreateEmrConnectionRequest>({
    name: connection?.name || '',
    vendor: (connection?.vendor || 'CUSTOM') as EmrVendor,
    fhirBaseUrl: connection?.fhirBaseUrl || '',
    clientId: '',
    clientSecret: '',
    scopes: connection?.scopes || DEFAULT_SCOPES,
    authorizationUrl: '',
    tokenUrl: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={connection ? 'Edit EMR Connection' : 'Add EMR Connection'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="error">
            {error.message}
          </Alert>
        )}

        <Input
          label="Connection Name"
          placeholder="e.g., City Hospital Epic"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
        />

        <Select
          label="EMR Vendor"
          value={formData.vendor}
          onChange={(e) => setFormData(prev => ({ ...prev, vendor: e.target.value as EmrVendor }))}
          options={VENDOR_OPTIONS}
          required
        />

        <Input
          label="FHIR Base URL"
          placeholder="https://hospital.example.com/fhir/r4"
          value={formData.fhirBaseUrl}
          onChange={(e) => setFormData(prev => ({ ...prev, fhirBaseUrl: e.target.value }))}
          required
        />

        <Input
          label="Client ID"
          placeholder="OAuth Client ID"
          value={formData.clientId}
          onChange={(e) => setFormData(prev => ({ ...prev, clientId: e.target.value }))}
          required
        />

        <Input
          label="Client Secret (optional)"
          type="password"
          placeholder="For confidential clients only"
          value={formData.clientSecret || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, clientSecret: e.target.value }))}
        />

        <Input
          label="Authorization URL"
          placeholder="https://hospital.example.com/oauth/authorize"
          value={formData.authorizationUrl || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, authorizationUrl: e.target.value }))}
        />

        <Input
          label="Token URL"
          placeholder="https://hospital.example.com/oauth/token"
          value={formData.tokenUrl || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, tokenUrl: e.target.value }))}
        />

        <Input
          label="Scopes (comma-separated)"
          placeholder="patient/*.read, launch/patient"
          value={formData.scopes?.join(', ') || ''}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            scopes: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
          }))}
        />

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : connection ? 'Update Connection' : 'Add Connection'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
