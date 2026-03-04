/**
 * Export Utilities
 *
 * Functions for exporting SOAP notes and EMR answers in various formats.
 */

import type { SoapNote, EmrAnswer } from '@/types/capture.types';

// =============================================================================
// EMR ANSWER EXPORT
// =============================================================================

export interface EmrExportData {
  exportedAt: string;
  fieldCount: number;
  answers: Record<string, string | number | boolean | string[]>;
  metadata: {
    requiredFieldsFilled: number;
    totalRequiredFields: number;
    averageConfidence: number;
  };
}

/**
 * Export EMR answers to JSON or CSV format
 */
export function exportEmrAnswers(
  answers: EmrAnswer[],
  format: 'json' | 'csv'
): string {
  if (format === 'json') {
    return exportToJson(answers);
  }
  return exportToCsv(answers);
}

function exportToJson(answers: EmrAnswer[]): string {
  const answerMap: Record<string, string | number | boolean | string[]> = {};

  let confidenceSum = 0;
  let confidenceCount = 0;
  let requiredFilled = 0;
  let totalRequired = 0;

  for (const answer of answers) {
    const value = answer.userAnswer ?? answer.proposedAnswer;
    if (value !== undefined) {
      answerMap[answer.fieldId] = value;
    }

    if (answer.confidence > 0) {
      confidenceSum += answer.confidence;
      confidenceCount++;
    }

    if (answer.required) {
      totalRequired++;
      if (value !== undefined) {
        requiredFilled++;
      }
    }
  }

  const exportData: EmrExportData = {
    exportedAt: new Date().toISOString(),
    fieldCount: Object.keys(answerMap).length,
    answers: answerMap,
    metadata: {
      requiredFieldsFilled: requiredFilled,
      totalRequiredFields: totalRequired,
      averageConfidence: confidenceCount > 0 ? confidenceSum / confidenceCount : 0,
    },
  };

  return JSON.stringify(exportData, null, 2);
}

function exportToCsv(answers: EmrAnswer[]): string {
  const headers = ['Field ID', 'Field Label', 'Section', 'Required', 'Value', 'Confidence', 'Source'];
  const rows = [headers.join(',')];

  for (const answer of answers) {
    const value = answer.userAnswer ?? answer.proposedAnswer;
    const sourceStr = answer.sources
      .map(s => s.type === 'audio' ? `audio:${s.audioTimestamp}` : `doc:${s.documentId}`)
      .join(';');

    const row = [
      answer.fieldId,
      `"${answer.fieldLabel.replace(/"/g, '""')}"`,
      answer.section,
      answer.required ? 'Yes' : 'No',
      typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : String(value ?? ''),
      Math.round(answer.confidence * 100) + '%',
      sourceStr,
    ];

    rows.push(row.join(','));
  }

  return rows.join('\n');
}

// =============================================================================
// SOAP NOTE EXPORT
// =============================================================================

/**
 * Format SOAP note as a single text block
 */
export function formatSoapNote(soapNote: SoapNote): string {
  const sections = [
    { label: 'SUBJECTIVE', content: soapNote.subjective },
    { label: 'OBJECTIVE', content: soapNote.objective },
    { label: 'ASSESSMENT', content: soapNote.assessment },
    { label: 'PLAN', content: soapNote.plan },
  ];

  const additionalSections = [
    { label: 'INTERVENTIONS', content: soapNote.interventions },
    { label: 'PATIENT EDUCATION', content: soapNote.patientEducation },
    { label: 'COORDINATION OF CARE', content: soapNote.coordinationOfCare },
    { label: 'HOMEBOUND STATUS', content: soapNote.homeboundStatus },
    { label: 'SKILLED NEED', content: soapNote.skilledNeed },
  ].filter(s => s.content);

  const allSections = [...sections, ...additionalSections];

  return allSections
    .filter(s => s.content)
    .map(s => `${s.label}:\n${s.content}`)
    .join('\n\n');
}

/**
 * Copy SOAP note to clipboard
 */
export async function copySoapToClipboard(soapNote: SoapNote): Promise<void> {
  const text = formatSoapNote(soapNote);
  await navigator.clipboard.writeText(text);
}

/**
 * Copy all content (SOAP + EMR fields) to clipboard
 */
export async function copyAllToClipboard(
  soapNote: SoapNote | undefined,
  answers: EmrAnswer[],
  visitNarrative?: string
): Promise<void> {
  const parts: string[] = [];

  // Add visit narrative
  if (visitNarrative) {
    parts.push(`VISIT NARRATIVE:\n${visitNarrative}`);
  }

  // Add SOAP note
  if (soapNote) {
    parts.push(`\n${'='.repeat(50)}\nSOAP NOTE\n${'='.repeat(50)}\n`);
    parts.push(formatSoapNote(soapNote));
  }

  // Add EMR fields
  parts.push(`\n${'='.repeat(50)}\nEMR FIELD VALUES\n${'='.repeat(50)}\n`);

  // Group by section
  const sections = answers.reduce<Record<string, EmrAnswer[]>>((acc, answer) => {
    if (!acc[answer.section]) {
      acc[answer.section] = [];
    }
    acc[answer.section]!.push(answer);
    return acc;
  }, {});

  for (const [section, sectionAnswers] of Object.entries(sections)) {
    parts.push(`\n[${section}]`);
    for (const answer of sectionAnswers) {
      const value = answer.userAnswer ?? answer.proposedAnswer;
      if (value !== undefined) {
        parts.push(`${answer.fieldLabel}: ${value}`);
      }
    }
  }

  await navigator.clipboard.writeText(parts.join('\n'));
}

// =============================================================================
// EMR INTEGRATION HELPERS
// =============================================================================

/**
 * Placeholder for future EMR integration
 * This would be replaced with actual EMR API calls or browser automation
 */
export interface EmrIntegrationAdapter {
  name: string;
  type: 'api' | 'browser_extension' | 'manual';

  // Check if the adapter is available
  isAvailable(): Promise<boolean>;

  // Push answers to EMR
  pushAnswers(answers: EmrAnswer[]): Promise<{ success: boolean; errors?: string[] }>;

  // Open EMR to specific visit (for manual copy)
  openVisit?(visitId: string): Promise<void>;
}

/**
 * Manual copy adapter (default)
 */
export const manualCopyAdapter: EmrIntegrationAdapter = {
  name: 'Manual Copy',
  type: 'manual',

  async isAvailable() {
    return true;
  },

  async pushAnswers(_answers: EmrAnswer[]) {
    // Manual mode - user copies and pastes
    return { success: true };
  },
};

/**
 * Get the appropriate EMR adapter
 * In the future, this could detect available integrations
 */
export function getEmrAdapter(): EmrIntegrationAdapter {
  // For now, always return manual adapter
  // Future: check for browser extension, API credentials, etc.
  return manualCopyAdapter;
}
