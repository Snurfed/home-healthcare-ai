/**
 * Test script for AI-powered clinical event detection
 * Run with: npx tsx scripts/test-ai-detection.ts
 */

import 'dotenv/config';
import prisma from '../src/config/prisma';
import * as detectionService from '../src/services/clinicalEventDetection.service';

const sampleTexts = [
  {
    name: "Subtle fall (no obvious keywords)",
    text: "Patient found on the floor this morning by daughter. States she 'just ended up down there' but doesn't remember what happened. Denies LOC. Small bruise noted on right hip."
  },
  {
    name: "Vital signs with actual numbers",
    text: "VS today: BP 182/98, HR 102, Temp 99.8F, SpO2 94% on RA. Patient reports feeling dizzy when standing. Previous BP was 130/80 last week."
  },
  {
    name: "Complex clinical scenario",
    text: "Patient's wound on left heel has increased in size from 2x2cm to 3x4cm over the past week. Noted yellow-green drainage with odor. Patient also reports increased pain at the site, now 7/10 up from 3/10. Blood glucose readings have been elevated, ranging 250-300 this week."
  },
  {
    name: "Medication non-compliance",
    text: "Patient admits to not taking Lisinopril for the past 5 days due to dizziness. Also stopped Metformin because 'it upsets my stomach'. Family unaware of these changes. Will need to notify physician about medication non-adherence."
  },
  {
    name: "Functional changes requiring therapy",
    text: "Patient having increased difficulty with ADLs. Now needs help getting dressed, was previously independent. Balance seems worse - holding onto furniture when walking. Gait is unsteady. May benefit from PT/OT evaluation."
  }
];

async function runAITests() {
  console.log("=".repeat(70));
  console.log("CLINICAL EVENT DETECTION TEST - FULL AI ANALYSIS");
  console.log("=".repeat(70));
  console.log("Note: This test uses the Claude API for contextual analysis\n");

  const context = {
    patientId: "test-patient-123",
    episodeId: "test-episode-456",
    clinicianId: "test-clinician-789"
  };

  for (const sample of sampleTexts) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`📋 Test: ${sample.name}`);
    console.log(`   Text: "${sample.text.substring(0, 70)}..."`);

    try {
      const startTime = Date.now();

      // Run full detection (keywords + AI)
      const result = await detectionService.detectClinicalEvents(sample.text, context, {
        runAI: true,
      });

      const duration = Date.now() - startTime;

      console.log(`\n   ⏱️  Detection time: ${duration}ms`);

      // Keyword results
      if (result.keywordMatches.length > 0) {
        console.log(`\n   📝 Keyword Matches (${result.keywordMatches.length}):`);
        for (const match of result.keywordMatches) {
          console.log(`      • ${match.eventType} (${match.priority}) - "${match.matchedKeywords.slice(0, 3).join(', ')}"`);
        }
      } else {
        console.log(`\n   📝 Keyword Matches: None`);
      }

      // AI results
      if (result.aiDetections.length > 0) {
        console.log(`\n   🤖 AI Detections (${result.aiDetections.length}):`);
        for (const detection of result.aiDetections) {
          console.log(`      • ${detection.eventType} (confidence: ${(detection.confidence * 100).toFixed(0)}%)`);
          if (detection.reasoning) {
            console.log(`        "${detection.reasoning.substring(0, 80)}..."`);
          }
        }
      } else {
        console.log(`\n   🤖 AI Detections: None`);
      }

      // Combined results
      console.log(`\n   ✅ Combined Events: ${result.combinedEvents.length}`);
      for (const event of result.combinedEvents) {
        const method = event.detectionMethod === 'both' ? '🔗 keyword+AI' :
                      event.detectionMethod === 'ai' ? '🤖 AI only' : '📝 keyword only';
        console.log(`      • ${event.eventType} (${event.priority}) - ${method}`);
        if (event.eventSummary) {
          console.log(`        Summary: ${event.eventSummary.substring(0, 70)}...`);
        }
      }

    } catch (error) {
      const err = error as Error;
      console.log(`   ❌ Error: ${err.message}`);
    }
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("AI DETECTION TEST COMPLETE");
  console.log("=".repeat(70));

  await prisma.$disconnect();
}

runAITests().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
