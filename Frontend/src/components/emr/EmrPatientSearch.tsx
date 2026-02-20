/**
 * EMR Patient Search Component
 *
 * Search for patients in connected EMR systems and import them.
 */

import { useState, useCallback } from 'react';
import {
  useEmrConnections,
  useEmrConnectionStatus,
  useEmrPatientSearch,
  useEmrAuthorize,
} from '@hooks/index';
import { Button, Input, Select, Spinner, Alert } from '@components/common';
import { ImportPatientModal } from './ImportPatientModal';
import type { EmrPatientSearchResult, EmrPatientSearchParams, EmrConnection } from '@typedefs/index';
import { EMR_VENDOR_CONFIG } from '@typedefs/index';

interface EmrPatientSearchProps {
  onPatientImported?: (patientId: string) => void;
}

export function EmrPatientSearch({ onPatientImported }: EmrPatientSearchProps) {
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [searchParams, setSearchParams] = useState<EmrPatientSearchParams>({});
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<EmrPatientSearchResult | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Fetch connections
  const { data: connections, isLoading: connectionsLoading } = useEmrConnections();

  // Get selected connection status
  const { data: connectionStatus } = useEmrConnectionStatus(selectedConnectionId);

  // Search patients
  const {
    data: searchResults,
    isLoading: searchLoading,
    error: searchError,
    refetch: refetchSearch,
  } = useEmrPatientSearch(selectedConnectionId, searchParams, {
    enabled: searchTriggered && !!selectedConnectionId && connectionStatus?.isAuthorized,
  });

  // OAuth mutation
  const authorizeMutation = useEmrAuthorize();

  // Handle connection selection
  const handleConnectionChange = (connectionId: string) => {
    setSelectedConnectionId(connectionId);
    setSearchTriggered(false);
    setSearchParams({});
  };

  // Handle search form submit
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSearchTriggered(true);
    if (searchTriggered) {
      refetchSearch();
    }
  }, [searchTriggered, refetchSearch]);

  // Handle OAuth authorization
  const handleAuthorize = async () => {
    if (!selectedConnectionId) return;

    try {
      await authorizeMutation.mutateAsync({
        connectionId: selectedConnectionId,
        redirectUri: `${window.location.origin}/api/emr/oauth/callback`,
      });
    } catch (error) {
      console.error('Authorization failed:', error);
    }
  };

  // Handle patient import click
  const handleImportClick = (patient: EmrPatientSearchResult) => {
    setSelectedPatient(patient);
    setShowImportModal(true);
  };

  // Handle successful import
  const handleImportSuccess = (patientId: string) => {
    setShowImportModal(false);
    setSelectedPatient(null);
    // Refresh search results to update "already imported" status
    refetchSearch();
    // Callback to parent
    onPatientImported?.(patientId);
  };

  // Get selected connection
  const selectedConnection = connections?.find((c: EmrConnection) => c.id === selectedConnectionId);

  // Connection options for select
  const connectionOptions = connections?.filter((c: EmrConnection) => c.isEnabled).map((c: EmrConnection) => ({
    value: c.id,
    label: `${c.name} (${EMR_VENDOR_CONFIG[c.vendor]?.label || c.vendor})`,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Connection Selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">EMR Connection</h3>

        {connectionsLoading ? (
          <div className="flex items-center justify-center py-4">
            <Spinner size="sm" />
            <span className="ml-2 text-sm text-gray-500">Loading connections...</span>
          </div>
        ) : connections?.length === 0 ? (
          <Alert variant="info">
            No EMR connections configured. Contact your administrator to set up EMR integration.
          </Alert>
        ) : (
          <div className="space-y-4">
            <Select
              label="Select EMR"
              value={selectedConnectionId}
              onChange={(e) => handleConnectionChange(e.target.value)}
              options={connectionOptions}
              placeholder="Choose an EMR system"
            />

            {selectedConnectionId && connectionStatus && !connectionStatus.isAuthorized && (
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div>
                  <p className="text-sm font-medium text-yellow-800">Authorization Required</p>
                  <p className="text-xs text-yellow-600">
                    Connect to {selectedConnection?.name} to search patients
                  </p>
                </div>
                <Button
                  onClick={handleAuthorize}
                  disabled={authorizeMutation.isLoading}
                  variant="primary"
                  size="sm"
                >
                  {authorizeMutation.isLoading ? 'Connecting...' : 'Connect'}
                </Button>
              </div>
            )}

            {connectionStatus?.isAuthorized && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Connected to {selectedConnection?.name}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search Form - Only show when authorized */}
      {connectionStatus?.isAuthorized && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Search Patients</h3>

          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Name"
                placeholder="Search by name..."
                value={searchParams.name || ''}
                onChange={(e) => setSearchParams(prev => ({ ...prev, name: e.target.value }))}
              />
              <Input
                label="Date of Birth"
                type="date"
                value={searchParams.birthdate || ''}
                onChange={(e) => setSearchParams(prev => ({ ...prev, birthdate: e.target.value }))}
              />
              <Input
                label="MRN"
                placeholder="Medical Record Number"
                value={searchParams.mrn || ''}
                onChange={(e) => setSearchParams(prev => ({ ...prev, mrn: e.target.value }))}
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={searchLoading || !Object.values(searchParams).some(Boolean)}
              >
                {searchLoading ? (
                  <>
                    <Spinner size="sm" />
                    <span className="ml-2">Searching...</span>
                  </>
                ) : (
                  'Search'
                )}
              </Button>
            </div>
          </form>

          {/* Search Error */}
          {searchError && (
            <Alert variant="error" className="mt-4">
              {searchError instanceof Error ? searchError.message : 'Search failed'}
            </Alert>
          )}
        </div>
      )}

      {/* Search Results */}
      {searchTriggered && connectionStatus?.isAuthorized && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-900">
              Search Results
              {searchResults && (
                <span className="ml-2 text-gray-500 font-normal">
                  ({searchResults.length} found)
                </span>
              )}
            </h3>
          </div>

          {searchLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : searchResults?.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="mt-2 text-sm text-gray-500">No patients found matching your search.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {searchResults?.map((patient: EmrPatientSearchResult) => (
                <div
                  key={patient.fhirId}
                  className="px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {patient.lastName}, {patient.firstName}
                      {patient.middleName && ` ${patient.middleName}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      DOB: {patient.dateOfBirth}
                      {patient.mrn && ` | MRN: ${patient.mrn}`}
                      {patient.phone && ` | ${patient.phone}`}
                    </p>
                    {patient.address?.city && (
                      <p className="text-xs text-gray-400">
                        {patient.address.city}, {patient.address.state}
                      </p>
                    )}
                  </div>
                  <div>
                    {patient.isAlreadyImported ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Imported
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleImportClick(patient)}
                      >
                        Import
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && selectedPatient && (
        <ImportPatientModal
          connectionId={selectedConnectionId}
          patient={selectedPatient}
          onClose={() => {
            setShowImportModal(false);
            setSelectedPatient(null);
          }}
          onSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
}

export default EmrPatientSearch;
