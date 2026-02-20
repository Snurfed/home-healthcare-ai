/**
 * Form Engine Controller
 *
 * HTTP handlers for form engine operations including:
 * - Form definition retrieval
 * - Response saving
 * - Validation
 * - Module toggling
 */

import { Request, Response } from 'express';
import formEngineService from '../services/formEngine.service';
import type { Discipline, VisitType } from '../domain/canonical/types';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface GetFormQuery {
  discipline: Discipline;
  visitType: VisitType;
  visitId?: string;
  activeModules?: string;
}

interface SaveResponsesBody {
  responses: Record<string, {
    value: unknown;
    source?: 'manual' | 'voice' | 'ai_draft' | 'imported' | 'calculated' | 'default';
    confidence?: number;
    notes?: string;
  }>;
  activeModules?: string[];
}

interface ToggleModuleBody {
  moduleId: string;
  active: boolean;
}

// =============================================================================
// FORM DEFINITION ENDPOINTS
// =============================================================================

/**
 * Get form for a discipline and visit type
 * GET /api/forms?discipline=RN&visitType=FOLLOWUP&visitId=xxx
 */
export async function getForm(req: Request, res: Response): Promise<void> {
  try {
    const query = req.query as unknown as GetFormQuery;

    if (!query.discipline) {
      res.status(400).json({ error: 'Discipline is required' });
      return;
    }

    if (!query.visitType) {
      res.status(400).json({ error: 'Visit type is required' });
      return;
    }

    // Validate discipline
    const validDisciplines: Discipline[] = ['RN', 'LVN', 'PT', 'OT', 'SLP', 'MSW', 'HHA'];
    if (!validDisciplines.includes(query.discipline)) {
      res.status(400).json({ error: `Invalid discipline. Must be one of: ${validDisciplines.join(', ')}` });
      return;
    }

    // Validate visit type
    const validVisitTypes: VisitType[] = ['SOC', 'ROC', 'RECERT', 'FOLLOWUP', 'DISCHARGE', 'EVAL', 'SUPERVISORY'];
    if (!validVisitTypes.includes(query.visitType)) {
      res.status(400).json({ error: `Invalid visit type. Must be one of: ${validVisitTypes.join(', ')}` });
      return;
    }

    // Parse activeModules from comma-separated string
    const activeModules = query.activeModules ? query.activeModules.split(',') : [];

    const result = await formEngineService.getForm({
      discipline: query.discipline,
      visitType: query.visitType,
      visitId: query.visitId,
      activeModules,
    });

    res.json(result);
  } catch (error) {
    console.error('Error getting form:', error);
    res.status(500).json({
      error: 'Failed to get form',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get form for a specific visit
 * GET /api/visits/:visitId/form
 */
export async function getVisitForm(req: Request, res: Response): Promise<void> {
  try {
    const visitId = req.params['visitId'];
    const query = req.query as { discipline?: Discipline; visitType?: VisitType };

    if (!visitId) {
      res.status(400).json({ error: 'Visit ID is required' });
      return;
    }

    // Default to RN FOLLOWUP if not specified
    const discipline = query.discipline || 'RN';
    const visitType = query.visitType || 'FOLLOWUP';

    const result = await formEngineService.getForm({
      discipline,
      visitType,
      visitId,
    });

    res.json(result);
  } catch (error) {
    console.error('Error getting visit form:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: 'Failed to get visit form',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get all available form definitions
 * GET /api/forms/definitions
 */
export async function getFormDefinitions(_req: Request, res: Response): Promise<void> {
  try {
    const definitions = formEngineService.getAvailableFormDefinitions();
    res.json(definitions);
  } catch (error) {
    console.error('Error getting form definitions:', error);
    res.status(500).json({
      error: 'Failed to get form definitions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get a specific form definition by ID
 * GET /api/forms/definitions/:definitionId
 */
export async function getFormDefinitionById(req: Request, res: Response): Promise<void> {
  try {
    const definitionId = req.params['definitionId'];

    if (!definitionId) {
      res.status(400).json({ error: 'Definition ID is required' });
      return;
    }

    const definition = formEngineService.getFormDefinitionById(definitionId);

    if (!definition) {
      res.status(404).json({ error: 'Form definition not found' });
      return;
    }

    res.json(definition);
  } catch (error) {
    console.error('Error getting form definition:', error);
    res.status(500).json({
      error: 'Failed to get form definition',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get all available sections
 * GET /api/forms/sections
 */
export async function getSections(_req: Request, res: Response): Promise<void> {
  try {
    const sections = formEngineService.getAvailableSections();
    res.json(sections);
  } catch (error) {
    console.error('Error getting sections:', error);
    res.status(500).json({
      error: 'Failed to get sections',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// =============================================================================
// RESPONSE MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * Save responses for a visit
 * POST /api/visits/:visitId/form/responses
 */
export async function saveResponses(req: Request, res: Response): Promise<void> {
  try {
    const visitId = req.params['visitId'];
    const body = req.body as SaveResponsesBody;

    if (!visitId) {
      res.status(400).json({ error: 'Visit ID is required' });
      return;
    }

    if (!body.responses || Object.keys(body.responses).length === 0) {
      res.status(400).json({ error: 'At least one response is required' });
      return;
    }

    const result = await formEngineService.saveResponses({
      visitId,
      responses: body.responses,
      activeModules: body.activeModules,
    });

    res.json(result);
  } catch (error) {
    console.error('Error saving responses:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: 'Failed to save responses',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Toggle a module on/off
 * POST /api/visits/:visitId/form/modules
 */
export async function toggleModule(req: Request, res: Response): Promise<void> {
  try {
    const visitId = req.params['visitId'];
    const body = req.body as ToggleModuleBody;

    if (!visitId) {
      res.status(400).json({ error: 'Visit ID is required' });
      return;
    }

    if (!body.moduleId) {
      res.status(400).json({ error: 'Module ID is required' });
      return;
    }

    if (typeof body.active !== 'boolean') {
      res.status(400).json({ error: 'Active must be a boolean' });
      return;
    }

    const result = await formEngineService.toggleModule({
      visitId,
      moduleId: body.moduleId,
      active: body.active,
    });

    res.json(result);
  } catch (error) {
    console.error('Error toggling module:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: 'Failed to toggle module',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// =============================================================================
// VALIDATION ENDPOINTS
// =============================================================================

/**
 * Validate a visit note
 * GET /api/visits/:visitId/form/validate
 */
export async function validateVisitNote(req: Request, res: Response): Promise<void> {
  try {
    const visitId = req.params['visitId'];

    if (!visitId) {
      res.status(400).json({ error: 'Visit ID is required' });
      return;
    }

    const result = await formEngineService.validateVisitNoteById(visitId);
    res.json(result);
  } catch (error) {
    console.error('Error validating visit note:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: 'Failed to validate visit note',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// =============================================================================
// QUESTION LOOKUP ENDPOINTS
// =============================================================================

/**
 * Get a question by concept ID
 * GET /api/forms/questions/:conceptId
 */
export async function getQuestion(req: Request, res: Response): Promise<void> {
  try {
    const conceptId = req.params['conceptId'];

    if (!conceptId) {
      res.status(400).json({ error: 'Concept ID is required' });
      return;
    }

    const question = formEngineService.getQuestion(conceptId);

    if (!question) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }

    res.json(question);
  } catch (error) {
    console.error('Error getting question:', error);
    res.status(500).json({
      error: 'Failed to get question',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Search questions
 * GET /api/forms/questions?q=pain&limit=20
 */
export async function searchQuestions(req: Request, res: Response): Promise<void> {
  try {
    const query = req.query['q'] as string;
    const limit = parseInt(req.query['limit'] as string) || 20;

    if (!query || query.length < 2) {
      res.status(400).json({ error: 'Search query must be at least 2 characters' });
      return;
    }

    const results = formEngineService.searchQuestions(query, limit);
    res.json(results);
  } catch (error) {
    console.error('Error searching questions:', error);
    res.status(500).json({
      error: 'Failed to search questions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export default {
  getForm,
  getVisitForm,
  getFormDefinitions,
  getFormDefinitionById,
  getSections,
  saveResponses,
  toggleModule,
  validateVisitNote,
  getQuestion,
  searchQuestions,
};
