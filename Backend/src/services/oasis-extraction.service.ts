/**
 * OASIS Extraction Service
 *
 * Uses Claude AI to extract structured OASIS data from transcriptions
 * Maps natural language to OASIS response codes with confidence scores
 *
 * Features:
 * - Direct extraction of explicitly stated values
 * - Inference expansion for aggregate statements (e.g., "moderate assist with all ADLs")
 * - Confidence scoring and review flagging
 */

import Anthropic from '@anthropic-ai/sdk';
import { AssessmentType } from '../generated/prisma';
import prisma from '../config/prisma';
import {
  ADL_CATEGORIES,
  applyInferencePatterns,
} from '../constants/adl-inference.constants';

// ===========================================
// TYPES
// ===========================================

export interface OasisFieldMapping {
  itemCode: string;
  itemName: string;
  section: string;
  extractedValue: string | number;
  mappedResponseCode: string;
  confidence: number;
  sourceText: string;
  requiresReview: boolean;
  reviewReason?: string;
  alternativeValues?: Array<{
    value: string | number;
    responseCode: string;
    confidence: number;
  }>;
  // Inference tracking - when multiple items are inferred from a single statement
  inferredFrom?: {
    statement: string;
    category: string;
    itemCount: number;
  };
}

export interface ExtractionResult {
  mappedFields: OasisFieldMapping[];
  unmappedContent: string[];
  completionPercentage: number;
  confidenceMetrics: {
    overall: number;
    highConfidence: number;
    needsReview: number;
  };
}

interface OasisQuestionContext {
  itemCode: string;
  itemName: string;
  section: string;
  questionText: string;
  responseType: string;
  responses: Array<{ code: string; label: string }> | null;
}

// ===========================================
// EXTRACTION PROMPTS
// ===========================================

const SYSTEM_PROMPT = `You are an expert OASIS (Outcome and Assessment Information Set) assessment extraction specialist for home health care. Your role is to extract structured clinical data from transcribed clinician notes and map them to specific OASIS-E assessment fields.

IMPORTANT GUIDELINES:
1. Only extract information explicitly stated or strongly implied in the transcription
2. Provide confidence scores (0.0-1.0) based on clarity and directness of the information
3. Flag any ambiguous or uncertain extractions for human review
4. Use the exact response codes from the provided field options
5. Include the exact source text that led to each extraction
6. If information is missing or unclear, do not guess - leave it unmapped

AGGREGATE STATEMENT INFERENCE:
When clinicians use aggregate statements that apply to multiple OASIS items, expand them:
- "Patient requires moderate assistance with all ADLs" → Apply to ALL self-care items (GG0130A-H)
- "Independent with all mobility" → Apply to ALL mobility items (GG0170 series)
- "Requires max assist for all transfers" → Apply to all transfer items
- "Dressing upper and lower body requires partial assist" → Apply to GG0130F, GG0130G, GG0130H

For aggregate statements, include an "inferredFrom" field indicating:
- The original statement text
- Which category triggered the inference (e.g., "self_care_all", "transfers")
- How many items were inferred

ASSISTANCE LEVEL CODES (for GG functional items):
- 06 = Independent (no help needed)
- 05 = Setup or clean-up assistance
- 04 = Supervision or touching assistance (standby, cueing)
- 03 = Partial/moderate assistance (less than half effort by helper)
- 02 = Substantial/maximal assistance (more than half effort by helper)
- 01 = Dependent (total assistance)
- 07 = Patient refused
- 09 = Not applicable (medical condition prevents)
- 10 = Not attempted due to environmental limitations
- 88 = Not attempted - not part of usual routine

CONFIDENCE SCORING:
- 0.95-1.0: Explicit, unambiguous statement directly mapping to a response
- 0.80-0.94: Clear implication with high certainty
- 0.60-0.79: Reasonable inference but may need verification (flag for review)
- Below 0.60: Too uncertain, do not include

For inferred items from aggregate statements:
- Use 0.80-0.85 confidence when assistance level is clearly stated
- Use 0.70-0.79 when assistance level is implied but not explicitly stated
- Flag all inferred items for review

MEDICAL CONTEXT:
- Pain scale: 0 = no pain, 10 = worst possible pain
- Functional levels: Independent = no help needed, Dependent = cannot do at all
- GG items use 06 (Independent) to 01 (Dependent) or 07-10 for special cases
- Pressure ulcers: Stage 1-4, unstageable, DTI (Deep Tissue Injury)`;

// ADL category names for AI prompt
const ADL_CATEGORY_DESCRIPTIONS = Object.entries(ADL_CATEGORIES)
  .map(([key, cat]) => `- ${key}: ${cat.name} (items: ${cat.itemCodes.join(', ')})`)
  .join('\n');

const buildExtractionPrompt = (
  transcription: string,
  questions: OasisQuestionContext[],
  assessmentType: AssessmentType
): string => {
  const questionsJson = questions.map((q) => ({
    itemCode: q.itemCode,
    itemName: q.itemName,
    section: q.section,
    question: q.questionText,
    responseType: q.responseType,
    options: q.responses?.map((r) => `${r.code}: ${r.label}`).join(' | ') || 'Free text',
  }));

  // Group GG items for aggregate statement handling
  const ggItemsByCategory = {
    selfCareAll: questions.filter(q => q.itemCode.startsWith('GG0130')).map(q => q.itemCode),
    mobilityAll: questions.filter(q => q.itemCode.startsWith('GG0170')).map(q => q.itemCode),
  };

  return `
ASSESSMENT TYPE: ${assessmentType}

TRANSCRIPTION:
"""
${transcription}
"""

AVAILABLE OASIS FIELDS TO EXTRACT:
${JSON.stringify(questionsJson, null, 2)}

ADL CATEGORIES FOR AGGREGATE INFERENCE:
${ADL_CATEGORY_DESCRIPTIONS}

GG ITEMS IN THIS ASSESSMENT:
- Self-Care (GG0130): ${ggItemsByCategory.selfCareAll.join(', ') || 'None'}
- Mobility (GG0170): ${ggItemsByCategory.mobilityAll.join(', ') || 'None'}

Extract all relevant OASIS field values from the transcription. Return a JSON object with this exact structure:

{
  "extractions": [
    {
      "itemCode": "M1240",
      "extractedValue": "1",
      "mappedResponseCode": "1",
      "confidence": 0.92,
      "sourceText": "patient reports pain level of 7",
      "requiresReview": false,
      "reasoning": "Patient explicitly reported pain (7/10 indicates pain is present)"
    }
  ],
  "aggregateInferences": [
    {
      "sourceText": "patient requires moderate assistance with all ADLs",
      "category": "self_care_all",
      "assistanceLevel": "03",
      "assistanceLevelLabel": "Partial/moderate assistance",
      "itemCodes": ["GG0130A", "GG0130B", "GG0130C", "GG0130D", "GG0130E", "GG0130F", "GG0130G", "GG0130H"],
      "confidence": 0.82,
      "reasoning": "Clinician stated moderate assistance for all ADLs - applying to all self-care items"
    }
  ],
  "unmappedContent": [
    "Information mentioned but not matching any OASIS field"
  ]
}

REQUIREMENTS:
- Only include extractions with confidence >= 0.60
- Set requiresReview: true if confidence < 0.80
- Include brief reasoning for each extraction
- For aggregate statements (like "all ADLs", "all transfers"), use aggregateInferences array
- Map assistance level terms to codes: independent=06, setup=05, supervision=04, partial/moderate=03, substantial/maximal=02, dependent=01
- List any clinically relevant content that couldn't be mapped

Return ONLY valid JSON, no additional text.`;
};

// ===========================================
// OASIS EXTRACTION SERVICE
// ===========================================

class OasisExtractionService {
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env['ANTHROPIC_API_KEY'];
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is not set');
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  /**
   * Fetch relevant OASIS questions for the assessment type
   */
  private async getRelevantQuestions(
    assessmentType: AssessmentType
  ): Promise<OasisQuestionContext[]> {
    const questions = await prisma.oasisQuestion.findMany({
      where: {
        assessmentTypes: { has: assessmentType },
        retiredDate: null,
      },
      select: {
        itemCode: true,
        itemName: true,
        section: true,
        questionText: true,
        responseType: true,
        responses: true,
      },
      orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
    });

    return questions.map((q) => ({
      itemCode: q.itemCode,
      itemName: q.itemName,
      section: q.section,
      questionText: q.questionText,
      responseType: q.responseType,
      responses: q.responses as Array<{ code: string; label: string }> | null,
    }));
  }

  /**
   * Extract OASIS fields from transcription using Claude AI
   */
  async extractOasisFields(
    transcriptionText: string,
    assessmentType: AssessmentType,
    existingResponses?: Record<string, { responseCode?: string; responseValue?: string }>
  ): Promise<ExtractionResult> {
    const client = this.getClient();

    // Get relevant questions for this assessment type
    const questions = await this.getRelevantQuestions(assessmentType);

    if (questions.length === 0) {
      return {
        mappedFields: [],
        unmappedContent: [transcriptionText],
        completionPercentage: 0,
        confidenceMetrics: { overall: 0, highConfidence: 0, needsReview: 0 },
      };
    }

    // Filter out questions that already have responses (optional)
    const unansweredQuestions = existingResponses
      ? questions.filter((q) => {
          const existing = existingResponses[q.itemCode];
          return !existing?.responseCode && !existing?.responseValue;
        })
      : questions;

    // Build the extraction prompt
    const userPrompt = buildExtractionPrompt(
      transcriptionText,
      unansweredQuestions.length > 0 ? unansweredQuestions : questions,
      assessmentType
    );

    try {
      // Call Claude API
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      // Parse the response
      const content = response.content[0];
      if (!content || content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      // Extract JSON from response (handle markdown code blocks)
      let jsonText = content.text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7);
      }
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3);
      }
      jsonText = jsonText.trim();

      const parsed = JSON.parse(jsonText);

      // Transform direct extractions to our format
      const mappedFields: OasisFieldMapping[] = (parsed.extractions || []).map(
        (ext: {
          itemCode: string;
          extractedValue: string | number;
          mappedResponseCode: string;
          confidence: number;
          sourceText: string;
          requiresReview: boolean;
          reasoning?: string;
          alternativeValues?: Array<{
            value: string | number;
            responseCode: string;
            confidence: number;
          }>;
        }) => {
          // Find the question for additional context
          const question = questions.find((q) => q.itemCode === ext.itemCode);

          return {
            itemCode: ext.itemCode,
            itemName: question?.itemName || ext.itemCode,
            section: question?.section || 'unknown',
            extractedValue: ext.extractedValue,
            mappedResponseCode: ext.mappedResponseCode,
            confidence: ext.confidence,
            sourceText: ext.sourceText,
            requiresReview: ext.requiresReview || ext.confidence < 0.8,
            reviewReason: ext.requiresReview
              ? ext.reasoning || 'Confidence below threshold'
              : undefined,
            alternativeValues: ext.alternativeValues,
          };
        }
      );

      // Process aggregate inferences - expand to individual field mappings
      const aggregateInferences = parsed.aggregateInferences || [];
      for (const inference of aggregateInferences as Array<{
        sourceText: string;
        category: string;
        assistanceLevel: string;
        assistanceLevelLabel: string;
        itemCodes: string[];
        confidence: number;
        reasoning?: string;
      }>) {
        const { sourceText, category, assistanceLevel, assistanceLevelLabel: _assistanceLevelLabel, itemCodes, confidence, reasoning } = inference;

        // Expand to individual items
        for (const itemCode of itemCodes) {
          // Skip if we already have a direct extraction for this item
          if (mappedFields.some(f => f.itemCode === itemCode)) {
            continue;
          }

          // Find the question for context
          const question = questions.find((q) => q.itemCode === itemCode);
          if (!question) continue;

          // Add as inferred mapping
          mappedFields.push({
            itemCode,
            itemName: question.itemName,
            section: question.section,
            extractedValue: assistanceLevel,
            mappedResponseCode: assistanceLevel,
            confidence,
            sourceText,
            requiresReview: true, // Always flag inferred items for review
            reviewReason: reasoning || `Inferred from aggregate statement: "${sourceText}"`,
            inferredFrom: {
              statement: sourceText,
              category,
              itemCount: itemCodes.length,
            },
          });
        }
      }

      // Also apply local inference patterns as a fallback
      // This catches patterns the AI might have missed
      const localInferences = this.applyLocalInferencePatterns(transcriptionText, questions, mappedFields);
      mappedFields.push(...localInferences);

      // Calculate metrics
      const highConfidence = mappedFields.filter((f) => f.confidence >= 0.8).length;
      const needsReview = mappedFields.filter((f) => f.requiresReview).length;
      const overallConfidence =
        mappedFields.length > 0
          ? mappedFields.reduce((sum, f) => sum + f.confidence, 0) / mappedFields.length
          : 0;

      // Calculate completion percentage based on total questions
      const completionPercentage = Math.round(
        (mappedFields.length / questions.length) * 100
      );

      return {
        mappedFields,
        unmappedContent: parsed.unmappedContent || [],
        completionPercentage,
        confidenceMetrics: {
          overall: overallConfidence,
          highConfidence,
          needsReview,
        },
      };
    } catch (error) {
      console.error('[OASIS Extraction Error]', error);

      // Return empty result on error
      return {
        mappedFields: [],
        unmappedContent: [`Error processing transcription: ${error instanceof Error ? error.message : 'Unknown error'}`],
        completionPercentage: 0,
        confidenceMetrics: { overall: 0, highConfidence: 0, needsReview: 0 },
      };
    }
  }

  /**
   * Apply local inference patterns to extract ADL categories from text
   * This serves as a fallback when the AI doesn't catch aggregate statements
   */
  private applyLocalInferencePatterns(
    transcriptionText: string,
    questions: OasisQuestionContext[],
    existingMappings: OasisFieldMapping[]
  ): OasisFieldMapping[] {
    const additionalMappings: OasisFieldMapping[] = [];
    const existingItemCodes = new Set(existingMappings.map(m => m.itemCode));

    // Apply inference patterns from constants
    const inferences = applyInferencePatterns(transcriptionText);

    for (const inference of inferences) {
      const { category, assistanceLevel, sourceText, patternConfidence } = inference;

      if (!assistanceLevel) continue;

      // Expand category to individual items
      for (const itemCode of category.itemCodes) {
        // Skip if already mapped
        if (existingItemCodes.has(itemCode)) continue;

        // Find the question
        const question = questions.find(q => q.itemCode === itemCode);
        if (!question) continue;

        // Validate the response code is valid for this question
        if (question.responses) {
          const validCodes = question.responses.map(r => r.code);
          if (!validCodes.includes(assistanceLevel.code)) continue;
        }

        additionalMappings.push({
          itemCode,
          itemName: question.itemName,
          section: question.section,
          extractedValue: assistanceLevel.code,
          mappedResponseCode: assistanceLevel.code,
          confidence: Math.min(patternConfidence, assistanceLevel.confidence) * 0.95, // Slightly lower for local inference
          sourceText,
          requiresReview: true,
          reviewReason: `Inferred from pattern match: "${sourceText}"`,
          inferredFrom: {
            statement: sourceText,
            category: category.name,
            itemCount: category.itemCodes.length,
          },
        });

        existingItemCodes.add(itemCode);
      }
    }

    return additionalMappings;
  }

  /**
   * Validate extracted field against question options
   */
  validateExtraction(
    extraction: OasisFieldMapping,
    question: OasisQuestionContext
  ): boolean {
    // For single/multi select, check if the response code is valid
    if (
      question.responseType === 'single_select' ||
      question.responseType === 'multi_select'
    ) {
      if (!question.responses) return true;

      const validCodes = question.responses.map((r) => r.code);
      const extractedCodes = extraction.mappedResponseCode.split(',');

      return extractedCodes.every((code) => validCodes.includes(code.trim()));
    }

    // For numeric, check if it's a valid number
    if (question.responseType === 'numeric') {
      const num = Number(extraction.extractedValue);
      return !isNaN(num);
    }

    // For date, check if it's a valid date format
    if (question.responseType === 'date') {
      const date = new Date(extraction.extractedValue as string);
      return !isNaN(date.getTime());
    }

    // For ICD-10, check format
    if (question.responseType === 'icd10') {
      const icd10Pattern = /^[A-Z]\d{2}(?:\.\d{1,4})?$/;
      return icd10Pattern.test(extraction.extractedValue as string);
    }

    return true;
  }
}

// Export singleton instance
export const oasisExtractionService = new OasisExtractionService();
export default oasisExtractionService;
