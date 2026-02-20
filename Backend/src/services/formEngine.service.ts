/**
 * Form Engine Service
 *
 * Business logic layer that wraps the domain form engine
 * and provides database integration for visit notes.
 */

import prisma from '../config/prisma';
import {
  buildForm,
  validateVisitNote,
  requiresOasis,
  FORM_DEFINITIONS,
  CANONICAL_SECTIONS,
  getQuestionByConceptId,
} from '../domain/canonical';
import type { BuiltForm } from '../domain/canonical/formEngine.service';
import type {
  CanonicalVisitNote,
  CanonicalResponse,
  CanonicalValidationResult,
  Discipline,
  VisitType,
  CanonicalFormDefinition,
  CanonicalValue,
} from '../domain/canonical/types';
// Helper to safely parse JSON string field from Prisma
function parseJsonField(value: string | null | undefined): Record<string, unknown> {
  if (value === null || value === undefined || value === '') {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

// Helper to stringify JSON for storage
function stringifyJsonField(value: Record<string, unknown>): string {
  return JSON.stringify(value);
}

// =============================================================================
// TYPES
// =============================================================================

export interface GetFormRequest {
  discipline: Discipline;
  visitType: VisitType;
  visitId?: string;
  activeModules?: string[];
}

export interface GetFormResponse {
  form: BuiltForm;
  visitNote?: CanonicalVisitNote;
  requiresOasis: boolean;
}

export interface SaveResponsesRequest {
  visitId: string;
  responses: Record<string, {
    value: unknown; // Accept unknown from controller, cast to CanonicalValue internally
    source?: 'manual' | 'voice' | 'ai_draft' | 'imported' | 'calculated' | 'default';
    confidence?: number;
    notes?: string;
  }>;
  activeModules?: string[];
}

export interface SaveResponsesResponse {
  success: boolean;
  validation: CanonicalValidationResult;
  updatedAt: string;
}

export interface ToggleModuleRequest {
  visitId: string;
  moduleId: string;
  active: boolean;
}

// =============================================================================
// FORM RETRIEVAL
// =============================================================================

/**
 * Get form definition for a discipline and visit type
 */
export async function getForm(request: GetFormRequest): Promise<GetFormResponse> {
  const { discipline, visitType, visitId, activeModules = [] } = request;

  // Get existing responses if visitId provided
  let existingResponses: Record<string, CanonicalResponse> = {};
  let visitNote: CanonicalVisitNote | undefined;
  let storedModules: string[] = activeModules;

  if (visitId) {
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        patient: true,
        episode: true,
      },
    });

    if (visit && visit.visitNotes) {
      const notes = parseJsonField(visit.visitNotes);
      existingResponses = (notes['responses'] as Record<string, CanonicalResponse>) || {};
      storedModules = (notes['activeModules'] as string[]) || activeModules;

      visitNote = {
        id: notes['id'] as string || visitId,
        patientId: visit.patientId,
        episodeId: visit.episodeId,
        clinicianId: visit.clinicianId || '',
        discipline,
        visitType,
        visitDate: visit.scheduledDate.toISOString().split('T')[0]!,
        timeIn: notes['timeIn'] as string | undefined,
        timeOut: notes['timeOut'] as string | undefined,
        status: (notes['status'] as CanonicalVisitNote['status']) || 'draft',
        responses: existingResponses,
        signatures: (notes['signatures'] as CanonicalVisitNote['signatures']) || [],
        createdAt: visit.createdAt.toISOString(),
        updatedAt: visit.updatedAt.toISOString(),
        activeModules: storedModules,
      };
    }
  }

  // Build the form
  const form = buildForm(discipline, visitType, existingResponses, storedModules);

  return {
    form,
    visitNote,
    requiresOasis: requiresOasis(visitType),
  };
}

/**
 * Get all available form definitions
 */
export function getAvailableFormDefinitions(): Array<{
  id: string;
  discipline: Discipline;
  visitType: VisitType;
  name: string;
  sectionCount: number;
  questionCount: number;
  requiresOasis: boolean;
}> {
  return Object.values(FORM_DEFINITIONS).map(def => ({
    id: def.id,
    discipline: def.discipline,
    visitType: def.visitType,
    name: def.name,
    sectionCount: def.sections.length,
    questionCount: def.sections.reduce((sum, s) => sum + s.questions.length, 0),
    requiresOasis: requiresOasis(def.visitType),
  }));
}

/**
 * Get a specific form definition by ID
 */
export function getFormDefinitionById(id: string): CanonicalFormDefinition | undefined {
  return Object.values(FORM_DEFINITIONS).find(def => def.id === id);
}

/**
 * Get all available sections
 */
export function getAvailableSections(): Array<{
  sectionId: string;
  name: string;
  category: string;
  questionCount: number;
  applicableDisciplines: Discipline[];
  applicableVisitTypes: VisitType[];
  isModule: boolean;
}> {
  return Object.values(CANONICAL_SECTIONS).map(section => ({
    sectionId: section.sectionId,
    name: section.name,
    category: section.category,
    questionCount: section.questions.length,
    applicableDisciplines: section.applicableDisciplines,
    applicableVisitTypes: section.applicableVisitTypes,
    isModule: section.isModule,
  }));
}

// =============================================================================
// RESPONSE MANAGEMENT
// =============================================================================

/**
 * Save responses for a visit note
 */
export async function saveResponses(request: SaveResponsesRequest): Promise<SaveResponsesResponse> {
  const { visitId, responses, activeModules } = request;

  // Get the visit
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
  });

  if (!visit) {
    throw new Error(`Visit ${visitId} not found`);
  }

  // Get existing visit notes
  const existingNotes = parseJsonField(visit.visitNotes);
  const existingResponses = (existingNotes['responses'] as Record<string, CanonicalResponse>) || {};

  // Merge new responses
  const now = new Date().toISOString();
  const clinicianId = visit.clinicianId || 'system';

  const updatedResponses: Record<string, CanonicalResponse> = { ...existingResponses };

  for (const [conceptId, data] of Object.entries(responses)) {
    updatedResponses[conceptId] = {
      conceptId,
      value: data.value as CanonicalValue,
      source: data.source || 'manual',
      confidence: data.confidence,
      timestamp: now,
      clinicianId,
      notes: data.notes,
      originalValue: existingResponses[conceptId]?.value,
    };
  }

  // Build updated visit notes
  const updatedNotes = {
    ...existingNotes,
    id: existingNotes['id'] || `note_${visitId}`,
    responses: updatedResponses,
    activeModules: activeModules || existingNotes['activeModules'] || [],
    updatedAt: now,
  };

  // Update the visit
  await prisma.visit.update({
    where: { id: visitId },
    data: {
      visitNotes: stringifyJsonField(updatedNotes),
      updatedAt: new Date(),
    },
  });

  // Get discipline and visit type for validation
  const discipline = (existingNotes['discipline'] as Discipline) || 'RN';
  const visitType = (existingNotes['visitType'] as VisitType) || 'FOLLOWUP';

  // Build canonical visit note for validation
  const canonicalNote: CanonicalVisitNote = {
    id: updatedNotes['id'] as string,
    patientId: visit.patientId,
    episodeId: visit.episodeId,
    clinicianId,
    discipline,
    visitType,
    visitDate: visit.scheduledDate.toISOString().split('T')[0]!,
    status: 'in_progress',
    responses: updatedResponses,
    signatures: [],
    createdAt: visit.createdAt.toISOString(),
    updatedAt: now,
    activeModules: (updatedNotes['activeModules'] as string[]) || [],
  };

  // Validate
  const validation = validateVisitNote(canonicalNote);

  return {
    success: true,
    validation,
    updatedAt: now,
  };
}

/**
 * Toggle a module on/off for a visit note
 */
export async function toggleModule(request: ToggleModuleRequest): Promise<{
  success: boolean;
  activeModules: string[];
}> {
  const { visitId, moduleId, active } = request;

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
  });

  if (!visit) {
    throw new Error(`Visit ${visitId} not found`);
  }

  const existingNotes = parseJsonField(visit.visitNotes);
  let currentActiveModules = (existingNotes['activeModules'] as string[]) || [];

  if (active && !currentActiveModules.includes(moduleId)) {
    currentActiveModules = [...currentActiveModules, moduleId];
  } else if (!active) {
    currentActiveModules = currentActiveModules.filter(m => m !== moduleId);
  }

  const updatedNotes = {
    ...existingNotes,
    activeModules: currentActiveModules,
    updatedAt: new Date().toISOString(),
  };

  await prisma.visit.update({
    where: { id: visitId },
    data: {
      visitNotes: stringifyJsonField(updatedNotes),
      updatedAt: new Date(),
    },
  });

  return {
    success: true,
    activeModules: currentActiveModules,
  };
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate a visit note
 */
export async function validateVisitNoteById(visitId: string): Promise<CanonicalValidationResult> {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
  });

  if (!visit) {
    throw new Error(`Visit ${visitId} not found`);
  }

  const notes = parseJsonField(visit.visitNotes);
  const responses = (notes['responses'] as Record<string, CanonicalResponse>) || {};
  const discipline = (notes['discipline'] as Discipline) || 'RN';
  const visitType = (notes['visitType'] as VisitType) || 'FOLLOWUP';

  const canonicalNote: CanonicalVisitNote = {
    id: notes['id'] as string || visitId,
    patientId: visit.patientId,
    episodeId: visit.episodeId,
    clinicianId: visit.clinicianId || 'system',
    discipline,
    visitType,
    visitDate: visit.scheduledDate.toISOString().split('T')[0]!,
    status: (notes['status'] as CanonicalVisitNote['status']) || 'draft',
    responses,
    signatures: (notes['signatures'] as CanonicalVisitNote['signatures']) || [],
    createdAt: visit.createdAt.toISOString(),
    updatedAt: visit.updatedAt.toISOString(),
    activeModules: (notes['activeModules'] as string[]) || [],
  };

  return validateVisitNote(canonicalNote);
}

// =============================================================================
// QUESTION LOOKUP
// =============================================================================

/**
 * Get a question by its concept ID
 */
export function getQuestion(conceptId: string) {
  return getQuestionByConceptId(conceptId);
}

/**
 * Search questions by label or concept ID
 */
export function searchQuestions(query: string, limit = 20): Array<{
  conceptId: string;
  label: string;
  type: string;
  sectionId: string;
  sectionName: string;
}> {
  const results: Array<{
    conceptId: string;
    label: string;
    type: string;
    sectionId: string;
    sectionName: string;
  }> = [];

  const lowerQuery = query.toLowerCase();

  for (const section of Object.values(CANONICAL_SECTIONS)) {
    for (const question of section.questions) {
      if (
        question.conceptId.toLowerCase().includes(lowerQuery) ||
        question.label.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          conceptId: question.conceptId,
          label: question.label,
          type: question.type,
          sectionId: section.sectionId,
          sectionName: section.name,
        });

        if (results.length >= limit) {
          return results;
        }
      }
    }
  }

  return results;
}

export default {
  getForm,
  getAvailableFormDefinitions,
  getFormDefinitionById,
  getAvailableSections,
  saveResponses,
  toggleModule,
  validateVisitNoteById,
  getQuestion,
  searchQuestions,
};
