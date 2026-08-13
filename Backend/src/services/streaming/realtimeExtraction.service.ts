/**
 * Real-time Extraction Service
 *
 * Extracts clinical entities from transcription text in real-time.
 * Uses Claude Haiku for fast inference with medical vocabulary context.
 * Debounces API calls to avoid excessive requests during continuous speech.
 */

import Anthropic from '@anthropic-ai/sdk';

import { MODELS } from '../../config/models';
// ===========================================
// TYPES
// ===========================================

export interface ExtractedEntity {
  type: EntityType;
  value: string | number;
  unit?: string;
  confidence: number;
  sourceText: string;
  oasisField?: string;
  oasisCode?: string;
  metadata?: Record<string, unknown>;
}

export type EntityType =
  | 'vital_bp'
  | 'vital_hr'
  | 'vital_rr'
  | 'vital_temp'
  | 'vital_spo2'
  | 'vital_weight'
  | 'vital_pain'
  | 'medication'
  | 'diagnosis'
  | 'diagnosis_code'
  | 'procedure'
  | 'functional_adl'
  | 'functional_mobility'
  | 'functional_transfer'
  | 'wound'
  | 'symptom'
  | 'mental_status'
  | 'fall_risk'
  | 'homebound_status';

export interface ExtractionResult {
  sessionId: string;
  entities: ExtractedEntity[];
  utteranceText: string;
  processedAt: number;
  confidence: number;
}

export interface ExtractionCallback {
  (result: ExtractionResult): void;
}

export interface ExtractionSessionConfig {
  sessionId: string;
  visitId: string;
  patientId: string;
  /** Debounce delay in ms (default 500ms) */
  debounceMs?: number;
  /** Patient context for better extraction */
  patientContext?: {
    name?: string;
    diagnoses?: string[];
    medications?: string[];
  };
}

// ===========================================
// EXTRACTION PROMPT
// ===========================================

const EXTRACTION_SYSTEM_PROMPT = `You are a clinical entity extraction specialist for home health care documentation. Extract structured medical data from clinician speech in real-time.

ENTITY TYPES TO EXTRACT:
1. VITALS:
   - vital_bp: Blood pressure (e.g., "120 over 80", "BP 130/85")
   - vital_hr: Heart rate/pulse (e.g., "pulse 72", "heart rate 88")
   - vital_rr: Respiratory rate (e.g., "respirations 18", "breathing 20")
   - vital_temp: Temperature (e.g., "temp 98.6", "afebrile")
   - vital_spo2: Oxygen saturation (e.g., "O2 sat 96%", "SpO2 94")
   - vital_weight: Weight (e.g., "weighs 165 pounds", "weight 75 kg")
   - vital_pain: Pain level (e.g., "pain 7 out of 10", "denies pain")

2. MEDICATIONS:
   - medication: Drug name with dosage (e.g., "Metformin 500mg twice daily")

3. DIAGNOSES:
   - diagnosis: Medical condition (e.g., "Type 2 diabetes", "CHF")
   - diagnosis_code: ICD-10 code if mentioned (e.g., "E11.9", "I50.9")

4. FUNCTIONAL STATUS:
   - functional_adl: ADL status (bathing, dressing, eating, toileting)
   - functional_mobility: Ambulation/gait (e.g., "ambulates with walker")
   - functional_transfer: Transfer ability (e.g., "requires moderate assist")

5. CLINICAL FINDINGS:
   - wound: Wound assessment (e.g., "Stage 2 pressure ulcer on sacrum")
   - symptom: Reported symptom (e.g., "complains of shortness of breath")
   - mental_status: Cognitive status (e.g., "alert and oriented x3")
   - fall_risk: Fall risk indicators (e.g., "unsteady gait", "fall history")
   - homebound_status: Homebound criteria (e.g., "requires assistance to leave home")

OASIS FIELD MAPPINGS (when applicable):
- vital_bp: M1030 (Therapist) or visit note
- vital_pain: M1242 (Pain severity)
- functional_adl bathing: GG0130A
- functional_adl dressing upper: GG0130E
- functional_adl dressing lower: GG0130F
- functional_transfer: GG0170C
- functional_mobility: GG0170I, GG0170J

ASSISTANCE LEVEL CODES (for functional items):
- 06 = Independent
- 05 = Setup/cleanup assistance
- 04 = Supervision/touching assistance
- 03 = Partial/moderate assistance
- 02 = Substantial/maximal assistance
- 01 = Dependent

CONFIDENCE SCORING:
- 0.95-1.0: Explicit, unambiguous value stated
- 0.85-0.94: Clear implication with context
- 0.70-0.84: Reasonable inference, may need verification
- Below 0.70: Do not extract

Return ONLY a JSON array of extracted entities. If no entities found, return empty array [].`;

// ===========================================
// REAL-TIME EXTRACTION SESSION
// ===========================================

export class RealtimeExtractionSession {
  private client: Anthropic | null = null;
  private config: ExtractionSessionConfig;
  private callback: ExtractionCallback;
  private debounceMs: number;

  private pendingText: string = '';
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isProcessing: boolean = false;
  private accumulatedEntities: ExtractedEntity[] = [];

  constructor(config: ExtractionSessionConfig, callback: ExtractionCallback) {
    this.config = config;
    this.callback = callback;
    this.debounceMs = config.debounceMs ?? 500;
  }

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
   * Get all extracted entities from this session
   */
  getAccumulatedEntities(): ExtractedEntity[] {
    return [...this.accumulatedEntities];
  }

  /**
   * Add transcription text for extraction (debounced)
   */
  addUtterance(text: string): void {
    if (!text.trim()) {
      return;
    }

    // Accumulate text
    this.pendingText += (this.pendingText ? ' ' : '') + text.trim();

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new debounce timer
    this.debounceTimer = setTimeout(() => {
      this.processAccumulatedText();
    }, this.debounceMs);
  }

  /**
   * Process accumulated text immediately
   */
  async flush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.pendingText.trim()) {
      await this.processAccumulatedText();
    }

    // Wait for any in-progress processing
    while (this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Process the accumulated text
   */
  private async processAccumulatedText(): Promise<void> {
    const textToProcess = this.pendingText.trim();
    this.pendingText = '';

    if (!textToProcess || this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      console.log(
        `[RealtimeExtraction] Processing: "${textToProcess.substring(0, 100)}${textToProcess.length > 100 ? '...' : ''}"`
      );

      const entities = await this.extractEntities(textToProcess);

      if (entities.length > 0) {
        // Add to accumulated entities (avoiding duplicates)
        for (const entity of entities) {
          const isDuplicate = this.accumulatedEntities.some(
            e => e.type === entity.type && e.value === entity.value
          );
          if (!isDuplicate) {
            this.accumulatedEntities.push(entity);
          }
        }

        // Calculate overall confidence
        const avgConfidence = entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length;

        // Emit result
        const result: ExtractionResult = {
          sessionId: this.config.sessionId,
          entities,
          utteranceText: textToProcess,
          processedAt: Date.now(),
          confidence: avgConfidence,
        };

        this.callback(result);
      }
    } catch (error) {
      console.error('[RealtimeExtraction] Error processing text:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Extract entities from text using Claude Haiku
   */
  private async extractEntities(text: string): Promise<ExtractedEntity[]> {
    const client = this.getClient();

    // Build user prompt with context
    let userPrompt = `Extract clinical entities from this utterance:\n\n"${text}"`;

    if (this.config.patientContext) {
      userPrompt += '\n\nPatient Context:';
      if (this.config.patientContext.name) {
        userPrompt += `\n- Patient: ${this.config.patientContext.name}`;
      }
      if (this.config.patientContext.diagnoses?.length) {
        userPrompt += `\n- Known Diagnoses: ${this.config.patientContext.diagnoses.join(', ')}`;
      }
      if (this.config.patientContext.medications?.length) {
        userPrompt += `\n- Current Medications: ${this.config.patientContext.medications.join(', ')}`;
      }
    }

    userPrompt += '\n\nReturn JSON array of extracted entities only.';

    try {
      const response = await client.messages.create({
        model: MODELS.REALTIME,
        max_tokens: 1024,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const content = response.content[0];
      if (!content || content.type !== 'text') {
        return [];
      }

      // Parse JSON response
      const jsonText = this.extractJsonArray(content.text);
      const parsed = JSON.parse(jsonText);

      if (!Array.isArray(parsed)) {
        return [];
      }

      // Validate and transform entities
      return parsed
        .filter((e: unknown) => this.isValidEntity(e))
        .map((e: Record<string, unknown>) => this.normalizeEntity(e, text));
    } catch (error) {
      console.error('[RealtimeExtraction] API error:', error);
      return [];
    }
  }

  /**
   * Extract JSON array from response text
   */
  private extractJsonArray(text: string): string {
    let jsonText = text.trim();

    // Remove markdown code blocks
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

    // Find array boundaries
    const firstBracket = jsonText.indexOf('[');
    const lastBracket = jsonText.lastIndexOf(']');

    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      jsonText = jsonText.substring(firstBracket, lastBracket + 1);
    }

    return jsonText;
  }

  /**
   * Validate entity structure
   */
  private isValidEntity(entity: unknown): entity is Record<string, unknown> {
    if (!entity || typeof entity !== 'object') {
      return false;
    }

    const e = entity as Record<string, unknown>;
    return (
      typeof e['type'] === 'string' &&
      (typeof e['value'] === 'string' || typeof e['value'] === 'number') &&
      typeof e['confidence'] === 'number' &&
      e['confidence'] >= 0.7
    );
  }

  /**
   * Normalize entity to standard format
   */
  private normalizeEntity(raw: Record<string, unknown>, sourceText: string): ExtractedEntity {
    return {
      type: raw['type'] as EntityType,
      value: raw['value'] as string | number,
      unit: raw['unit'] as string | undefined,
      confidence: raw['confidence'] as number,
      sourceText: (raw['sourceText'] as string) || sourceText,
      oasisField: raw['oasisField'] as string | undefined,
      oasisCode: raw['oasisCode'] as string | undefined,
      metadata: raw['metadata'] as Record<string, unknown> | undefined,
    };
  }

  /**
   * Stop the extraction session
   */
  async stop(): Promise<ExtractedEntity[]> {
    await this.flush();
    return this.getAccumulatedEntities();
  }
}

// ===========================================
// SESSION MANAGER
// ===========================================

const activeSessions = new Map<string, RealtimeExtractionSession>();

/**
 * Create a new real-time extraction session
 */
export function createExtractionSession(
  config: ExtractionSessionConfig,
  callback: ExtractionCallback
): RealtimeExtractionSession {
  const session = new RealtimeExtractionSession(config, callback);
  activeSessions.set(config.sessionId, session);
  console.log(`[RealtimeExtraction] Session created: ${config.sessionId}`);
  return session;
}

/**
 * Get an active extraction session
 */
export function getExtractionSession(sessionId: string): RealtimeExtractionSession | undefined {
  return activeSessions.get(sessionId);
}

/**
 * Remove an extraction session
 */
export function removeExtractionSession(sessionId: string): void {
  activeSessions.delete(sessionId);
  console.log(`[RealtimeExtraction] Session removed: ${sessionId}`);
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  RealtimeExtractionSession,
  createExtractionSession,
  getExtractionSession,
  removeExtractionSession,
};
