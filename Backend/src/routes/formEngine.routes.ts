/**
 * Form Engine Routes
 *
 * API endpoints for the form engine:
 * - Form retrieval by discipline/visit type
 * - Response saving
 * - Module toggling
 * - Validation
 * - Question lookup
 */

import { Router } from 'express';
import formEngineController from '../controllers/formEngine.controller';

const router = Router();

// =============================================================================
// FORM DEFINITIONS
// =============================================================================

/**
 * Get form for a discipline and visit type
 * @route GET /api/forms
 * @query discipline - RN, LVN, PT, OT, SLP, MSW, HHA
 * @query visitType - SOC, ROC, RECERT, FOLLOWUP, DISCHARGE, EVAL, SUPERVISORY
 * @query visitId - Optional visit ID to load existing responses
 * @query activeModules - Optional comma-separated list of active modules
 */
router.get('/forms', formEngineController.getForm);

/**
 * Get all available form definitions
 * @route GET /api/forms/definitions
 */
router.get('/forms/definitions', formEngineController.getFormDefinitions);

/**
 * Get a specific form definition by ID
 * @route GET /api/forms/definitions/:definitionId
 */
router.get('/forms/definitions/:definitionId', formEngineController.getFormDefinitionById);

/**
 * Get all available sections
 * @route GET /api/forms/sections
 */
router.get('/forms/sections', formEngineController.getSections);

// =============================================================================
// QUESTION LOOKUP
// =============================================================================

/**
 * Search questions by label or concept ID
 * @route GET /api/forms/questions
 * @query q - Search query (min 2 characters)
 * @query limit - Max results (default 20)
 */
router.get('/forms/questions', formEngineController.searchQuestions);

/**
 * Get a question by concept ID
 * @route GET /api/forms/questions/:conceptId
 */
router.get('/forms/questions/:conceptId', formEngineController.getQuestion);

// =============================================================================
// VISIT-SPECIFIC ENDPOINTS
// =============================================================================

/**
 * Get form for a specific visit
 * @route GET /api/visits/:visitId/form
 * @query discipline - Override discipline (optional)
 * @query visitType - Override visit type (optional)
 */
router.get('/visits/:visitId/form', formEngineController.getVisitForm);

/**
 * Save responses for a visit
 * @route POST /api/visits/:visitId/form/responses
 * @body responses - Object of conceptId -> { value, source?, confidence?, notes? }
 * @body activeModules - Optional array of active module IDs
 */
router.post('/visits/:visitId/form/responses', formEngineController.saveResponses);

/**
 * Toggle a module on/off for a visit
 * @route POST /api/visits/:visitId/form/modules
 * @body moduleId - The module ID to toggle
 * @body active - Boolean indicating whether to activate or deactivate
 */
router.post('/visits/:visitId/form/modules', formEngineController.toggleModule);

/**
 * Validate a visit note
 * @route GET /api/visits/:visitId/form/validate
 */
router.get('/visits/:visitId/form/validate', formEngineController.validateVisitNote);

export default router;
