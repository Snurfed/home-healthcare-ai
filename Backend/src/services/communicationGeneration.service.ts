/**
 * Communication Generation Service
 *
 * AI-powered physician communication draft generation using Claude.
 * Generates both summary (3-5 sentences) and detailed versions.
 */

import Anthropic from '@anthropic-ai/sdk';
import prisma from '../config/prisma';
import type { CommunicationTriggerResult } from '../constants/communication-rules.constants';

import { MODELS } from '../config/models';
// =============================================================================
// LAZY-LOAD ANTHROPIC CLIENT
// =============================================================================

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

// =============================================================================
// TYPES
// =============================================================================

export interface GenerationInput {
  assessmentId: string;
  patientId: string;
  episodeId: string;
  trigger: CommunicationTriggerResult;
  physicianName: string;
  physicianNpi?: string;
  additionalContext?: string;
}

export interface GeneratedCommunication {
  subject: string;
  summaryContent: string;
  detailedContent: string;
}

export interface GenerationResult {
  success: boolean;
  communication?: GeneratedCommunication;
  aiModelUsed: string;
  generationTimeMs: number;
  error?: string;
}

interface PatientData {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  mrn: string;
  primaryPhysicianName?: string | null;
}

interface AssessmentData {
  assessmentType: string;
  responses: Array<{
    itemCode: string;
    responseValue: string | null;
    responseCode: string | null;
  }>;
}

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const COMMUNICATION_SYSTEM_PROMPT = `You are a clinical documentation specialist helping home health nurses communicate with physicians. Generate professional, concise physician communications based on OASIS assessment findings.

Your communications should:
1. Be professional and clinical in tone
2. Clearly state the reason for communication
3. Include relevant assessment findings
4. Suggest appropriate follow-up actions
5. Be HIPAA compliant (no unnecessary PHI)

Generate TWO versions of the communication:

SUMMARY VERSION (3-5 sentences):
- Brief overview suitable for fax cover sheet or quick review
- Key finding, current status, and requested action
- No detailed measurements unless critical

DETAILED VERSION (2-3 paragraphs):
- Full clinical context
- Relevant OASIS assessment findings with specific values
- Patient's current functional status
- Recommended interventions or orders
- Any time-sensitive considerations

Return your response as JSON with this exact structure:
{
  "subject": "Brief subject line (under 60 characters)",
  "summary": "The 3-5 sentence summary version",
  "detailed": "The full detailed version with paragraphs"
}

Do not include any text outside the JSON structure.`;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Format patient data for the prompt
 */
function formatPatientData(patient: PatientData): string {
  const age = calculateAge(patient.dateOfBirth);
  return `Patient: ${patient.firstName} ${patient.lastName}
MRN: ${patient.mrn}
Age: ${age} years
Primary Physician: ${patient.primaryPhysicianName || 'On file'}`;
}

/**
 * Format relevant assessment responses
 */
function formatAssessmentData(
  assessment: AssessmentData,
  relatedItems: string[]
): string {
  let output = `Assessment Type: ${assessment.assessmentType}\n\nRelevant Findings:\n`;

  for (const response of assessment.responses) {
    if (relatedItems.includes(response.itemCode)) {
      const value = response.responseValue || response.responseCode || 'Not documented';
      output += `- ${response.itemCode}: ${value}\n`;
    }
  }

  return output;
}

/**
 * Format trigger data for the prompt
 */
function formatTriggerData(trigger: CommunicationTriggerResult): string {
  let output = `Communication Type: ${trigger.type.replace(/_/g, ' ')}
Urgency: ${trigger.urgency}
Trigger: ${trigger.title}
Description: ${trigger.description}

Trigger Details:\n`;

  for (const [key, value] of Object.entries(trigger.triggerData)) {
    if (key !== 'questionCode') {
      output += `- ${key}: ${value}\n`;
    }
  }

  return output;
}

/**
 * Parse JSON response from Claude
 */
function parseJsonResponse(text: string): GeneratedCommunication {
  let jsonText = text.trim();

  // Remove markdown code blocks if present
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

  return {
    subject: parsed.subject || 'Physician Communication',
    summaryContent: parsed.summary || '',
    detailedContent: parsed.detailed || '',
  };
}

// =============================================================================
// MAIN GENERATION FUNCTIONS
// =============================================================================

/**
 * Generate physician communication draft
 */
export async function generateCommunication(
  input: GenerationInput
): Promise<GenerationResult> {
  const startTime = Date.now();
  const modelUsed = MODELS.GENERATION;

  try {
    // Fetch assessment data
    const assessment = await prisma.oasisAssessment.findUnique({
      where: { id: input.assessmentId },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            mrn: true,
            primaryPhysicianName: true,
          },
        },
        responses: {
          where: {
            itemCode: {
              in: input.trigger.relatedOasisItems,
            },
          },
          select: {
            itemCode: true,
            responseValue: true,
            responseCode: true,
          },
        },
      },
    });

    if (!assessment) {
      throw new Error(`Assessment not found: ${input.assessmentId}`);
    }

    // Build user prompt
    let userPrompt = `Generate a physician communication for the following situation:\n\n`;
    userPrompt += formatPatientData(assessment.patient);
    userPrompt += `\n\nPhysician: ${input.physicianName}`;
    if (input.physicianNpi) {
      userPrompt += ` (NPI: ${input.physicianNpi})`;
    }
    userPrompt += '\n\n';
    userPrompt += formatTriggerData(input.trigger);
    userPrompt += '\n';
    userPrompt += formatAssessmentData(
      {
        assessmentType: assessment.assessmentType,
        responses: assessment.responses,
      },
      input.trigger.relatedOasisItems
    );

    if (input.additionalContext) {
      userPrompt += `\nAdditional Context:\n${input.additionalContext}\n`;
    }

    console.log('[Communication Generation] Sending request to Claude...');

    // Call Claude API
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: modelUsed,
      max_tokens: 2048,
      system: COMMUNICATION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Parse response
    const content = response.content[0];
    if (!content || content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const textContent = content as { type: 'text'; text: string };
    const communication = parseJsonResponse(textContent.text);

    console.log('[Communication Generation] Successfully generated communication');

    return {
      success: true,
      communication,
      aiModelUsed: modelUsed,
      generationTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[Communication Generation Error]', error);
    return {
      success: false,
      aiModelUsed: modelUsed,
      generationTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Failed to generate communication',
    };
  }
}

/**
 * Regenerate communication with user edits/instructions
 */
export async function regenerateCommunication(
  communicationId: string,
  instructions: string
): Promise<GenerationResult> {
  const startTime = Date.now();
  const modelUsed = MODELS.GENERATION;

  try {
    // Fetch existing communication
    const existing = await prisma.physicianCommunication.findUnique({
      where: { id: communicationId },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            mrn: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error(`Communication not found: ${communicationId}`);
    }

    // Build regeneration prompt
    let userPrompt = `Regenerate the following physician communication based on these instructions:\n\n`;
    userPrompt += `Instructions: ${instructions}\n\n`;
    userPrompt += `Current Subject: ${existing.subject}\n\n`;
    userPrompt += `Current Summary:\n${existing.summaryContent}\n\n`;
    userPrompt += `Current Detailed:\n${existing.detailedContent}\n\n`;
    userPrompt += `Patient: ${existing.patient.firstName} ${existing.patient.lastName} (MRN: ${existing.patient.mrn})\n`;
    userPrompt += `Communication Type: ${existing.communicationType}\n`;
    userPrompt += `Urgency: ${existing.urgency}\n`;

    console.log('[Communication Regeneration] Sending request to Claude...');

    // Call Claude API
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: modelUsed,
      max_tokens: 2048,
      system: COMMUNICATION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Parse response
    const content = response.content[0];
    if (!content || content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const textContent = content as { type: 'text'; text: string };
    const communication = parseJsonResponse(textContent.text);

    console.log('[Communication Regeneration] Successfully regenerated communication');

    return {
      success: true,
      communication,
      aiModelUsed: modelUsed,
      generationTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[Communication Regeneration Error]', error);
    return {
      success: false,
      aiModelUsed: modelUsed,
      generationTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Failed to regenerate communication',
    };
  }
}

/**
 * Generate a post-visit summary communication
 */
export async function generatePostVisitSummary(
  assessmentId: string,
  physicianName: string
): Promise<GenerationResult> {
  const startTime = Date.now();
  const modelUsed = MODELS.GENERATION;

  try {
    // Fetch complete assessment data
    const assessment = await prisma.oasisAssessment.findUnique({
      where: { id: assessmentId },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            mrn: true,
            primaryPhysicianName: true,
          },
        },
        responses: {
          orderBy: { itemCode: 'asc' },
        },
      },
    });

    if (!assessment) {
      throw new Error(`Assessment not found: ${assessmentId}`);
    }

    // Build comprehensive prompt
    let userPrompt = `Generate a comprehensive post-visit summary for the physician.\n\n`;
    userPrompt += formatPatientData(assessment.patient);
    userPrompt += `\n\nPhysician: ${physicianName}\n`;
    userPrompt += `Assessment Type: ${assessment.assessmentType}\n`;
    userPrompt += `Assessment Date: ${assessment.createdAt.toISOString().split('T')[0]}\n\n`;
    userPrompt += `All Assessment Findings:\n`;

    for (const response of assessment.responses) {
      const value = response.responseValue || response.responseCode || 'Not documented';
      userPrompt += `- ${response.itemCode}: ${value}\n`;
    }

    console.log('[Post-Visit Summary] Sending request to Claude...');

    // Call Claude API with modified system prompt
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: modelUsed,
      max_tokens: 4096,
      system: `${COMMUNICATION_SYSTEM_PROMPT}

For post-visit summaries, include:
- Reason for home health services
- Current diagnoses and medications review needs
- Functional status summary
- Key clinical findings
- Care plan updates
- Any concerns requiring physician attention`,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Parse response
    const content = response.content[0];
    if (!content || content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const textContent = content as { type: 'text'; text: string };
    const communication = parseJsonResponse(textContent.text);

    console.log('[Post-Visit Summary] Successfully generated summary');

    return {
      success: true,
      communication,
      aiModelUsed: modelUsed,
      generationTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[Post-Visit Summary Error]', error);
    return {
      success: false,
      aiModelUsed: modelUsed,
      generationTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Failed to generate summary',
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  generateCommunication,
  regenerateCommunication,
  generatePostVisitSummary,
};
