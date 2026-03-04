/**
 * Capture Controller
 *
 * Handles voice capture workflow API endpoints
 */

import type { Request, Response } from 'express';
import { processCapture, type CaptureInput } from '../services/capture.service';

/**
 * Process a voice capture
 * POST /api/capture/process
 */
export async function processCaptureRequest(req: Request, res: Response): Promise<void> {
  try {
    const file = req.file;
    const body = req.body as {
      documentTexts?: string;
      patientName?: string;
      patientDob?: string;
      diagnoses?: string;
      visitType?: string;
      discipline?: string;
    };

    // Build input
    const input: CaptureInput = {};

    // Audio file
    if (file) {
      input.audioBuffer = file.buffer;
    }

    // Document texts (JSON array as string)
    if (body.documentTexts) {
      try {
        input.documentTexts = JSON.parse(body.documentTexts);
        console.log('[Capture Controller] Received document texts:', {
          count: input.documentTexts?.length || 0,
          totalChars: input.documentTexts?.reduce((sum, t) => sum + t.length, 0) || 0,
        });
      } catch {
        input.documentTexts = [body.documentTexts];
        console.log('[Capture Controller] Received single document text:', body.documentTexts.length, 'chars');
      }
    } else {
      console.log('[Capture Controller] No document texts received');
    }

    // Patient context
    if (body.patientName || body.patientDob || body.diagnoses) {
      input.patientContext = {
        name: body.patientName,
        dateOfBirth: body.patientDob,
        diagnoses: body.diagnoses ? JSON.parse(body.diagnoses) : undefined,
      };
    }

    input.visitType = body.visitType;
    input.discipline = body.discipline;

    // Validate we have some input
    if (!input.audioBuffer && (!input.documentTexts || input.documentTexts.length === 0)) {
      res.status(400).json({
        success: false,
        error: 'No audio file or document content provided',
      });
      return;
    }

    // Process capture
    const result = await processCapture(input);

    if (!result.success) {
      res.status(500).json(result);
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('[Capture Controller Error]', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Capture processing failed',
    });
  }
}

/**
 * Health check for capture service
 * GET /api/capture/health
 */
export async function healthCheck(_req: Request, res: Response): Promise<void> {
  const hasOpenAI = !!process.env['OPENAI_API_KEY'];
  const hasAnthropic = !!process.env['ANTHROPIC_API_KEY'];

  res.json({
    status: hasOpenAI && hasAnthropic ? 'healthy' : 'degraded',
    services: {
      whisper: hasOpenAI ? 'available' : 'missing OPENAI_API_KEY',
      claude: hasAnthropic ? 'available' : 'missing ANTHROPIC_API_KEY',
    },
  });
}
