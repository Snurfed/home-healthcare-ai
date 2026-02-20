/**
 * Visit Note Service
 *
 * Business logic for visit note operations including:
 * - CRUD operations for visit notes
 * - AI draft generation for sections
 * - Visit note finalization with signatures
 */

import Anthropic from '@anthropic-ai/sdk';
import prisma from '../config/prisma';
import {
  getVisitFormConfig,
  type Discipline,
  type VisitPurpose,
  type VisitFormConfig,
} from '../constants/visitForm.constants';

// ===========================================
// LAZY-LOAD ANTHROPIC CLIENT
// ===========================================

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export interface VisitNoteResponse {
  questionCode: string;
  value: unknown;
  source?: 'manual' | 'voice' | 'ai_draft' | 'oasis' | 'system';
  aiConfidence?: number;
  updatedAt: string;
  updatedBy: string;
}

export interface VitalSigns {
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  temperatureUnit?: 'F' | 'C';
  oxygenSaturation?: number;
  oxygenSaturationOnRoom?: boolean;
  oxygenLitersPerMin?: number;
  weight?: number;
  weightUnit?: 'lbs' | 'kg';
  bloodGlucose?: number;
  bloodGlucoseTiming?: string;
  pain?: number;
  painLocation?: string;
}

export interface WoundAssessment {
  woundId?: string;
  location: string;
  type: string;
  stage?: string;
  length?: number;
  width?: number;
  depth?: number;
  healing?: string;
}

export interface VisitNoteSignature {
  type: 'clinician' | 'patient' | 'caregiver' | 'witness';
  signedBy: string;
  signedAt: string;
  signatureData?: string;
  relationship?: string;
}

export interface VisitNoteData {
  id: string;
  visitId: string;
  patientId: string;
  episodeId: string;
  clinicianId: string;
  discipline: Discipline;
  visitPurpose: VisitPurpose;
  status: 'draft' | 'in_progress' | 'pending_review' | 'finalized' | 'amended';
  visitDate: string;
  timeIn?: string;
  timeOut?: string;
  responses: Record<string, VisitNoteResponse>;
  vitalSigns?: VitalSigns;
  wounds?: WoundAssessment[];
  signatures: VisitNoteSignature[];
  aiDraftGenerated?: boolean;
  oasisLinked?: boolean;
  oasisAssessmentId?: string;
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
  finalizedBy?: string;
}

export interface CreateVisitNoteInput {
  visitId: string;
  patientId: string;
  episodeId: string;
  clinicianId: string;
  discipline: Discipline;
  visitPurpose: VisitPurpose;
  visitDate: string;
}

export interface UpdateVisitNoteInput {
  responses?: Record<string, Partial<VisitNoteResponse>>;
  vitalSigns?: VitalSigns;
  wounds?: WoundAssessment[];
  timeIn?: string;
  timeOut?: string;
}

export interface GenerateAIDraftInput {
  sectionId: string;
  questionCodes?: string[];
  context?: {
    patientHistory?: string;
    recentVisits?: string;
    oasisResponses?: Record<string, string>;
  };
}

export interface AIDraftResult {
  success: boolean;
  drafts: {
    questionCode: string;
    draftValue: string;
    confidence: number;
    suggestions?: string[];
  }[];
  generationTimeMs: number;
  error?: string;
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function generateId(): string {
  return `vn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ===========================================
// MAIN SERVICE FUNCTIONS
// ===========================================

/**
 * Get visit note by visit ID
 */
export async function getVisitNote(visitId: string): Promise<VisitNoteData | null> {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      patient: true,
      episode: true,
      clinician: true,
    },
  });

  if (!visit) {
    return null;
  }

  // Parse JSON fields from visit
  const visitNotes = visit.visitNotes as Record<string, unknown> | null;
  if (!visitNotes) {
    return null;
  }

  return visitNotes as unknown as VisitNoteData;
}

/**
 * Create a new visit note
 */
export async function createVisitNote(input: CreateVisitNoteInput): Promise<VisitNoteData> {
  const { visitId, patientId, episodeId, clinicianId, discipline, visitPurpose, visitDate } = input;

  // Validate form config exists
  const formConfig = getVisitFormConfig(discipline, visitPurpose);
  if (!formConfig) {
    throw new Error(`No form configuration found for ${discipline} ${visitPurpose}`);
  }

  const now = new Date().toISOString();
  const noteId = generateId();

  const visitNoteData: VisitNoteData = {
    id: noteId,
    visitId,
    patientId,
    episodeId,
    clinicianId,
    discipline,
    visitPurpose,
    status: 'draft',
    visitDate,
    responses: {},
    signatures: [],
    createdAt: now,
    updatedAt: now,
  };

  // Update visit with the new note data
  await prisma.visit.update({
    where: { id: visitId },
    data: {
      visitNotes: visitNoteData as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    },
  });

  return visitNoteData;
}

/**
 * Update an existing visit note
 */
export async function updateVisitNote(
  visitId: string,
  input: UpdateVisitNoteInput,
  userId: string
): Promise<VisitNoteData> {
  const existingNote = await getVisitNote(visitId);
  if (!existingNote) {
    throw new Error(`Visit note not found for visit ${visitId}`);
  }

  if (existingNote.status === 'finalized') {
    throw new Error('Cannot update a finalized visit note. Use amendment instead.');
  }

  const now = new Date().toISOString();

  // Merge responses
  const updatedResponses = { ...existingNote.responses };
  if (input.responses) {
    for (const [code, partial] of Object.entries(input.responses)) {
      updatedResponses[code] = {
        questionCode: code,
        value: partial.value,
        source: partial.source || 'manual',
        aiConfidence: partial.aiConfidence,
        updatedAt: now,
        updatedBy: userId,
      };
    }
  }

  const updatedNote: VisitNoteData = {
    ...existingNote,
    responses: updatedResponses,
    vitalSigns: input.vitalSigns ?? existingNote.vitalSigns,
    wounds: input.wounds ?? existingNote.wounds,
    timeIn: input.timeIn ?? existingNote.timeIn,
    timeOut: input.timeOut ?? existingNote.timeOut,
    status: existingNote.status === 'draft' ? 'in_progress' : existingNote.status,
    updatedAt: now,
  };

  // Update visit
  await prisma.visit.update({
    where: { id: visitId },
    data: {
      visitNotes: updatedNote as unknown as Record<string, unknown>,
      vitalSigns: input.vitalSigns as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    },
  });

  return updatedNote;
}

/**
 * Generate AI draft for a section
 */
export async function generateAIDraft(
  visitId: string,
  input: GenerateAIDraftInput
): Promise<AIDraftResult> {
  const startTime = Date.now();

  try {
    const existingNote = await getVisitNote(visitId);
    if (!existingNote) {
      throw new Error(`Visit note not found for visit ${visitId}`);
    }

    // Get form config
    const formConfig = getVisitFormConfig(existingNote.discipline, existingNote.visitPurpose);
    if (!formConfig) {
      throw new Error('Form configuration not found');
    }

    // Find the section
    const section = formConfig.sections.find((s) => s.id === input.sectionId);
    if (!section) {
      throw new Error(`Section ${input.sectionId} not found`);
    }

    // Get questions to draft
    const questionsToDraft = input.questionCodes
      ? section.questions.filter((q) => input.questionCodes!.includes(q.code))
      : section.questions.filter((q) => q.aiDraftEnabled);

    if (questionsToDraft.length === 0) {
      return {
        success: true,
        drafts: [],
        generationTimeMs: Date.now() - startTime,
      };
    }

    // Get patient and visit context
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        patient: true,
        episode: {
          include: {
            oasisAssessments: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    // Build context for AI
    const patientContext = visit?.patient
      ? `Patient: ${visit.patient.firstName} ${visit.patient.lastName}, ${visit.patient.gender}, DOB: ${visit.patient.dateOfBirth}`
      : '';

    const visitContext = `Visit Type: ${existingNote.visitPurpose}, Discipline: ${existingNote.discipline}`;

    // Build prompt
    const questionsPrompt = questionsToDraft
      .map((q) => `- ${q.code}: ${q.label}${q.placeholder ? ` (Example: ${q.placeholder})` : ''}`)
      .join('\n');

    const systemPrompt = `You are a clinical documentation assistant for home health care. Generate professional, HIPAA-compliant clinical documentation.

Guidelines:
- Use objective, clinical language
- Be specific and measurable where applicable
- Follow standard clinical documentation practices
- Keep responses concise but complete
- Use appropriate medical terminology

${patientContext}
${visitContext}`;

    const userPrompt = `Generate draft documentation for the following fields in the "${section.name}" section:

${questionsPrompt}

${input.context?.patientHistory ? `Patient History: ${input.context.patientHistory}` : ''}
${input.context?.recentVisits ? `Recent Visits: ${input.context.recentVisits}` : ''}

Respond with a JSON object where keys are the question codes and values are the draft text. Example:
{"SUBJ_CHIEF": "Patient reports...", "SUBJ_SYMPTOMS": "No new symptoms..."}`;

    // Call AI
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: systemPrompt,
    });

    // Parse response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from AI');
    }

    // Extract JSON from response
    let drafts: Record<string, string> = {};
    try {
      // Try to parse as JSON directly
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        drafts = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // If JSON parsing fails, try to extract key-value pairs
      console.warn('Failed to parse AI response as JSON, returning empty drafts');
    }

    // Format results
    const draftResults = questionsToDraft
      .filter((q) => drafts[q.code])
      .map((q) => ({
        questionCode: q.code,
        draftValue: drafts[q.code],
        confidence: 0.85, // Default confidence
      }));

    return {
      success: true,
      drafts: draftResults,
      generationTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('AI draft generation error:', error);
    return {
      success: false,
      drafts: [],
      generationTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Finalize a visit note with signatures
 */
export async function finalizeVisitNote(
  visitId: string,
  clinicianSignature: {
    signatureData: string;
    signedAt: string;
    signedBy: string;
  },
  patientSignature?: {
    signatureData: string;
    signedAt: string;
    signedBy: string;
    relationship?: string;
  }
): Promise<VisitNoteData> {
  const existingNote = await getVisitNote(visitId);
  if (!existingNote) {
    throw new Error(`Visit note not found for visit ${visitId}`);
  }

  if (existingNote.status === 'finalized') {
    throw new Error('Visit note is already finalized');
  }

  const now = new Date().toISOString();

  // Build signatures array
  const signatures: VisitNoteSignature[] = [
    {
      type: 'clinician',
      signedBy: clinicianSignature.signedBy,
      signedAt: clinicianSignature.signedAt,
      signatureData: clinicianSignature.signatureData,
    },
  ];

  if (patientSignature) {
    signatures.push({
      type: patientSignature.relationship ? 'caregiver' : 'patient',
      signedBy: patientSignature.signedBy,
      signedAt: patientSignature.signedAt,
      signatureData: patientSignature.signatureData,
      relationship: patientSignature.relationship,
    });
  }

  const finalizedNote: VisitNoteData = {
    ...existingNote,
    status: 'finalized',
    signatures,
    finalizedAt: now,
    finalizedBy: clinicianSignature.signedBy,
    updatedAt: now,
  };

  // Update visit
  await prisma.visit.update({
    where: { id: visitId },
    data: {
      visitNotes: finalizedNote as unknown as Record<string, unknown>,
      status: 'COMPLETED',
      updatedAt: new Date(),
    },
  });

  return finalizedNote;
}

/**
 * Get episode dashboard data
 */
export async function getEpisodeDashboard(episodeId: string) {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      patient: true,
      visits: {
        orderBy: { scheduledDate: 'desc' },
        take: 20,
        include: {
          clinician: true,
        },
      },
      oasisAssessments: {
        orderBy: { createdAt: 'desc' },
      },
      carePlans: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!episode) {
    throw new Error(`Episode ${episodeId} not found`);
  }

  // Calculate certification period
  const certStart = episode.startDate;
  const certEnd = episode.endDate || new Date(certStart.getTime() + 60 * 24 * 60 * 60 * 1000);
  const daysRemaining = Math.max(
    0,
    Math.ceil((certEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  );

  // Build required assessments
  const requiredAssessments = [];
  const socAssessment = episode.oasisAssessments.find((a) => a.assessmentType === 'SOC');
  if (!socAssessment) {
    requiredAssessments.push({
      type: 'SOC',
      dueDate: certStart.toISOString(),
      status: 'pending',
    });
  }

  // Build visit history
  const visitHistory = episode.visits.map((visit) => ({
    id: visit.id,
    visitDate: visit.scheduledDate.toISOString(),
    discipline: visit.visitType as Discipline,
    visitPurpose: 'FOLLOWUP' as VisitPurpose,
    clinicianName: visit.clinician
      ? `${visit.clinician.firstName} ${visit.clinician.lastName}`
      : 'Unassigned',
    status: visit.status.toLowerCase(),
    noteStatus: visit.visitNotes ? 'in_progress' : undefined,
  }));

  // Calculate completion progress
  const completedVisits = episode.visits.filter((v) => v.status === 'COMPLETED').length;

  return {
    episodeId: episode.id,
    episodeNumber: episode.episodeNumber || episode.id.slice(-8),
    patientId: episode.patientId,
    patientName: `${episode.patient.firstName} ${episode.patient.lastName}`,
    certificationPeriod: {
      startDate: certStart.toISOString(),
      endDate: certEnd.toISOString(),
      daysRemaining,
    },
    status: episode.status.toLowerCase(),
    primaryDiagnosis: episode.carePlans[0]?.primaryDiagnosisDesc,
    requiredAssessments,
    visitHistory,
    completionProgress: {
      totalVisits: episode.visits.length,
      completedVisits,
      scheduledVisits: episode.visits.filter((v) => v.status === 'SCHEDULED').length,
      documentsComplete: completedVisits,
      documentsPending: episode.visits.length - completedVisits,
    },
    alerts: [],
  };
}

export default {
  getVisitNote,
  createVisitNote,
  updateVisitNote,
  generateAIDraft,
  finalizeVisitNote,
  getEpisodeDashboard,
};
