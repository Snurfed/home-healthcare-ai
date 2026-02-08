/**
 * HIPPS Calculator Component
 *
 * Displays HIPPS code with breakdown, reimbursement estimate, and optimization suggestions
 */

import { useState } from 'react';
import { Badge, Button, Alert, Tooltip, Modal } from '@components/common';
import { useHippsDetails, useCalculateEnhancedScore } from '@hooks/queries/useAssessments';
import type {
  HIPPSCodePosition,
  OptimizationSuggestion,
} from '@typedefs/index';
import {
  HIPPS_POSITION_EXPLANATIONS,
  REIMBURSEMENT_DISCLAIMERS,
  PDGM_EDUCATION,
} from '@constants/hipps-education';

interface HIPPSCalculatorProps {
  assessmentId: string;
  showOptimizations?: boolean;
  wageIndex?: number;
  isLocked?: boolean;
}

// Priority badge colors
const PRIORITY_COLORS: Record<string, 'error' | 'warning' | 'info'> = {
  high: 'error',
  medium: 'warning',
  low: 'info',
};

export default function HIPPSCalculator({
  assessmentId,
  showOptimizations = false,
  wageIndex,
  isLocked = false,
}: HIPPSCalculatorProps) {
  const [isBreakdownExpanded, setIsBreakdownExpanded] = useState(false);
  const [isOptimizationsExpanded, setIsOptimizationsExpanded] = useState(false);
  const [isPdgmModalOpen, setIsPdgmModalOpen] = useState(false);
  const [isLearnMoreExpanded, setIsLearnMoreExpanded] = useState(false);

  // Fetch HIPPS details
  const {
    data: hippsData,
    isLoading,
    error,
    refetch,
  } = useHippsDetails(assessmentId, {
    includeOptimizations: showOptimizations,
    wageIndex,
  });

  // Mutation for recalculating
  const calculateMutation = useCalculateEnhancedScore(assessmentId);

  const handleRecalculate = async () => {
    await calculateMutation.mutateAsync({
      includeOptimizations: showOptimizations,
      wageIndex,
    });
    refetch();
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          <span className="ml-3 text-gray-500">Calculating HIPPS code...</span>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <Alert variant="error" title="HIPPS Calculation Error">
          {error.message || 'Failed to calculate HIPPS code. Please try again.'}
        </Alert>
        <Button
          onClick={handleRecalculate}
          disabled={calculateMutation.isLoading}
          className="mt-4"
        >
          Retry Calculation
        </Button>
      </div>
    );
  }

  // No data yet
  if (!hippsData) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center py-6">
          <p className="text-gray-500 mb-4">HIPPS code not yet calculated</p>
          <Button
            onClick={handleRecalculate}
            disabled={calculateMutation.isLoading || isLocked}
          >
            {calculateMutation.isLoading ? 'Calculating...' : 'Calculate HIPPS Code'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
      {/* Header with HIPPS Code and Reimbursement */}
      <div className="p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-sm text-gray-500 flex items-center gap-1">
                HIPPS Code
                <button
                  onClick={() => setIsPdgmModalOpen(true)}
                  className="text-gray-400 hover:text-primary-600 transition-colors"
                  aria-label="Learn about HIPPS codes"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </span>
              <span className="text-3xl font-bold text-primary-600 tracking-wider">
                {hippsData.hippsCode}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <Badge variant="info">{hippsData.version}</Badge>
              {isLocked && <Badge variant="default">Locked</Badge>}
            </div>
          </div>

          <div className="text-right">
            <span className="text-sm text-gray-500 block">Est. Reimbursement (30-day)</span>
            <span className="text-2xl font-bold text-green-600">
              {formatCurrency(hippsData.reimbursement.totalEstimate)}
            </span>
          </div>

          {!isLocked && (
            <Button
              variant="secondary"
              onClick={handleRecalculate}
              disabled={calculateMutation.isLoading}
            >
              {calculateMutation.isLoading ? 'Recalculating...' : 'Recalculate'}
            </Button>
          )}
        </div>
      </div>

      {/* Validation Warnings */}
      {hippsData.validationWarnings && hippsData.validationWarnings.length > 0 && (
        <div className="p-4 bg-yellow-50">
          <Alert variant="warning" title="Calculation Warnings">
            <ul className="list-disc list-inside text-sm">
              {hippsData.validationWarnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </Alert>
        </div>
      )}

      {/* Component Scores Summary */}
      <div className="p-6">
        <h4 className="text-sm font-medium text-gray-500 mb-3">Component Scores</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <span className="text-xs text-gray-500 block">Functional</span>
            <span className="text-lg font-semibold text-gray-900">
              {hippsData.scores.functionalScore.toFixed(1)}
            </span>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <span className="text-xs text-gray-500 block">Clinical</span>
            <span className="text-lg font-semibold text-gray-900">
              {hippsData.scores.clinicalScore.toFixed(1)}
            </span>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <span className="text-xs text-gray-500 block">Service Util.</span>
            <span className="text-lg font-semibold text-gray-900">
              {hippsData.scores.serviceUtilizationScore.toFixed(1)}
            </span>
          </div>
          <div className="text-center p-3 bg-primary-50 rounded-lg border border-primary-200">
            <span className="text-xs text-primary-600 block">Case Mix Weight</span>
            <span className="text-lg font-bold text-primary-700">
              {hippsData.scores.caseMixWeight.toFixed(4)}
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Code Breakdown */}
      <div>
        <button
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          onClick={() => setIsBreakdownExpanded(!isBreakdownExpanded)}
          aria-expanded={isBreakdownExpanded}
        >
          <span className="font-medium text-gray-900">Code Breakdown</span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isBreakdownExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isBreakdownExpanded && (
          <div className="px-6 pb-6 space-y-4">
            {/* Position Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-gray-500 font-medium">Pos</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Code</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Component</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {renderBreakdownRow(1, hippsData.breakdown.position1)}
                  {renderBreakdownRow(2, hippsData.breakdown.position2)}
                  {renderBreakdownRow(3, hippsData.breakdown.position3)}
                  {renderBreakdownRow(4, hippsData.breakdown.position4)}
                  {renderBreakdownRow(5, hippsData.breakdown.position5)}
                </tbody>
              </table>
            </div>

            {/* Clinical Grouping Details */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-2">Clinical Grouping Details</h5>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-gray-500">Category:</dt>
                <dd className="font-medium">{hippsData.clinicalGrouping.category}</dd>
                <dt className="text-gray-500">Timing:</dt>
                <dd className="font-medium">{hippsData.clinicalGrouping.isEarlyTiming ? 'Early' : 'Late'}</dd>
                <dt className="text-gray-500">Admission Source:</dt>
                <dd className="font-medium capitalize">{hippsData.clinicalGrouping.admissionSource}</dd>
                {hippsData.clinicalGrouping.matchedDiagnosis && (
                  <>
                    <dt className="text-gray-500">Primary Diagnosis:</dt>
                    <dd className="font-medium">{hippsData.clinicalGrouping.matchedDiagnosis}</dd>
                  </>
                )}
              </dl>
            </div>

            {/* Comorbidity Details */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-2">Comorbidity Assessment</h5>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-gray-500">Adjustment Level:</dt>
                <dd>
                  <Badge
                    variant={
                      hippsData.comorbidity.adjustment === 'H'
                        ? 'error'
                        : hippsData.comorbidity.adjustment === 'L'
                        ? 'warning'
                        : 'success'
                    }
                  >
                    {hippsData.comorbidity.description}
                  </Badge>
                </dd>
                {hippsData.comorbidity.triggeringDiagnoses &&
                  hippsData.comorbidity.triggeringDiagnoses.length > 0 && (
                    <>
                      <dt className="text-gray-500">Triggering Diagnoses:</dt>
                      <dd className="font-medium">{hippsData.comorbidity.triggeringDiagnoses.join(', ')}</dd>
                    </>
                  )}
                {hippsData.comorbidity.matchedPairDescription && (
                  <>
                    <dt className="text-gray-500">Interaction:</dt>
                    <dd className="font-medium">{hippsData.comorbidity.matchedPairDescription}</dd>
                  </>
                )}
              </dl>
            </div>

            {/* Reimbursement Details */}
            <div className="bg-green-50 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-2">Reimbursement Calculation</h5>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-gray-500">Base Rate (National):</dt>
                <dd className="font-medium">{formatCurrency(hippsData.reimbursement.baseAmount)}</dd>
                <dt className="text-gray-500">Wage Index:</dt>
                <dd className="font-medium">{hippsData.reimbursement.wageIndex.toFixed(4)}</dd>
                <dt className="text-gray-500">Wage-Adjusted:</dt>
                <dd className="font-medium">{formatCurrency(hippsData.reimbursement.wageAdjustedAmount)}</dd>
                <dt className="text-gray-500">Case Mix Weight:</dt>
                <dd className="font-medium">&times; {hippsData.scores.caseMixWeight.toFixed(4)}</dd>
                <dt className="text-gray-500 font-medium">Estimated Payment:</dt>
                <dd className="font-bold text-green-700">{formatCurrency(hippsData.reimbursement.totalEstimate)}</dd>
              </dl>

              {/* Disclaimer Banner */}
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-xs font-medium text-yellow-800">Estimate Disclaimer</p>
                    <p className="text-xs text-yellow-700 mt-1">{hippsData.reimbursement.disclaimer}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Learn More Section */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                onClick={() => setIsLearnMoreExpanded(!isLearnMoreExpanded)}
                aria-expanded={isLearnMoreExpanded}
              >
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Learn More About PDGM
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${isLearnMoreExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isLearnMoreExpanded && (
                <div className="p-4 bg-white text-sm">
                  <p className="text-gray-600 mb-4">{PDGM_EDUCATION.overview}</p>
                  <h6 className="font-medium text-gray-900 mb-2">Key Components:</h6>
                  <ul className="space-y-2">
                    {PDGM_EDUCATION.keyComponents.map((component, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-primary-600 font-bold">{i + 1}.</span>
                        <div>
                          <span className="font-medium text-gray-800">{component.title}:</span>{' '}
                          <span className="text-gray-600">{component.description}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h6 className="font-medium text-gray-900 mb-2">Important Disclaimers:</h6>
                    <ul className="space-y-1 text-xs text-gray-500">
                      {REIMBURSEMENT_DISCLAIMERS.map((disclaimer, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-gray-400">&bull;</span>
                          {disclaimer}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Optimization Suggestions (Supervisors Only) */}
      {showOptimizations &&
        hippsData.optimizationSuggestions &&
        hippsData.optimizationSuggestions.length > 0 && (
          <div>
            <button
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              onClick={() => setIsOptimizationsExpanded(!isOptimizationsExpanded)}
              aria-expanded={isOptimizationsExpanded}
            >
              <span className="font-medium text-gray-900 flex items-center gap-2">
                Optimization Suggestions
                <Badge variant="info">{hippsData.optimizationSuggestions.length}</Badge>
              </span>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${isOptimizationsExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isOptimizationsExpanded && (
              <div className="px-6 pb-6 space-y-3">
                {hippsData.optimizationSuggestions.map((suggestion) => (
                  <OptimizationCard key={suggestion.id} suggestion={suggestion} />
                ))}
              </div>
            )}
          </div>
        )}

      {/* Calculation Timestamp */}
      <div className="px-6 py-3 bg-gray-50 text-xs text-gray-500">
        Calculated: {new Date(hippsData.calculatedAt).toLocaleString()}
      </div>

      {/* PDGM Education Modal */}
      <Modal
        isOpen={isPdgmModalOpen}
        onClose={() => setIsPdgmModalOpen(false)}
        title="Understanding HIPPS Codes & PDGM"
        size="lg"
      >
        <div className="space-y-6">
          {/* Overview */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{PDGM_EDUCATION.title}</h3>
            <p className="text-gray-600">{PDGM_EDUCATION.overview}</p>
          </div>

          {/* HIPPS Code Positions */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">HIPPS Code Positions</h4>
            <div className="space-y-3">
              {Object.entries(HIPPS_POSITION_EXPLANATIONS).map(([key, value]) => (
                <div key={key} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-sm font-bold">
                      {key.replace('position', '')}
                    </span>
                    <span className="font-medium text-gray-900">{value.title}</span>
                  </div>
                  <p className="text-sm text-gray-600 ml-8">{value.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Key Components */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Key Payment Components</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PDGM_EDUCATION.keyComponents.map((component, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3">
                  <h5 className="font-medium text-gray-800 mb-1">{component.title}</h5>
                  <p className="text-sm text-gray-600">{component.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimers */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">Important Disclaimers</h4>
            <ul className="space-y-1 text-sm text-yellow-700">
              {REIMBURSEMENT_DISCLAIMERS.map((disclaimer, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-yellow-500">&bull;</span>
                  {disclaimer}
                </li>
              ))}
            </ul>
          </div>

          {/* External Links */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-medium text-gray-900 mb-2">Additional Resources</h4>
            <div className="flex flex-wrap gap-2">
              {PDGM_EDUCATION.links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 hover:underline"
                >
                  {link.title}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setIsPdgmModalOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Helper function to render breakdown row with tooltip
function renderBreakdownRow(position: number, data: HIPPSCodePosition) {
  const positionKey = `position${position}` as keyof typeof HIPPS_POSITION_EXPLANATIONS;
  const explanation = HIPPS_POSITION_EXPLANATIONS[positionKey];

  return (
    <tr key={position}>
      <td className="py-2 text-gray-600">{position}</td>
      <td className="py-2">
        <Tooltip
          content={
            <div className="max-w-xs">
              <p className="font-medium mb-1">{explanation?.title}</p>
              <p className="text-gray-300 text-xs">{explanation?.description}</p>
            </div>
          }
          position="right"
        >
          <span className="font-bold text-primary-600 border-b border-dashed border-primary-400 cursor-help">
            {data.code}
          </span>
        </Tooltip>
      </td>
      <td className="py-2 text-gray-700">{data.label}</td>
      <td className="py-2 text-gray-600">{data.description}</td>
    </tr>
  );
}

// Optimization suggestion card component
function OptimizationCard({ suggestion }: { suggestion: OptimizationSuggestion }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant={PRIORITY_COLORS[suggestion.priority]}>{suggestion.priority.toUpperCase()}</Badge>
        <Badge variant="default">{suggestion.category}</Badge>
      </div>
      <p className="text-sm text-gray-700 mb-2">{suggestion.suggestion}</p>
      <p className="text-xs text-gray-500">
        <strong>Potential Impact:</strong> {suggestion.potentialImpact}
      </p>
    </div>
  );
}

// Compact version for inline display
export function HIPPSCodeBadge({
  hippsCode,
  caseMixWeight,
}: {
  assessmentId: string;
  hippsCode?: string;
  caseMixWeight?: number;
}) {
  if (!hippsCode) {
    return <span className="text-gray-400 italic text-sm">Not calculated</span>;
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono font-bold text-primary-600">{hippsCode}</span>
      {caseMixWeight && (
        <span className="text-xs text-gray-500">({caseMixWeight.toFixed(2)})</span>
      )}
    </span>
  );
}
