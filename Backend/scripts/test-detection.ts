/**
 * Test script for clinical event detection
 * Run with: npx tsx scripts/test-detection.ts
 */

import 'dotenv/config';
import prisma from '../src/config/prisma';
import * as detectionService from '../src/services/clinicalEventDetection.service';

const sampleTexts = [
  {
    name: "Fall incident",
    text: "Patient reported she fell in the bathroom last night while getting up to use the toilet. No injuries sustained but is now afraid to ambulate independently. Recommending PT evaluation for fall prevention."
  },
  {
    name: "Vital signs concern",
    text: "VS today: BP 182/98, HR 102, Temp 99.8F. Patient reports feeling dizzy and short of breath. Blood pressure significantly elevated from baseline of 130/80."
  },
  {
    name: "Pain increase",
    text: "Patient states pain level is now 8/10 in lower back, increased from 4/10 last visit. Having difficulty sleeping due to pain. Current pain medication not providing adequate relief."
  },
  {
    name: "Functional decline",
    text: "Patient now requires max assist for transfers, previously needed only standby assist. Unable to ambulate to bathroom independently. Family concerned about increased weakness over past week."
  },
  {
    name: "Wound deterioration",
    text: "Stage 2 pressure ulcer on sacrum appears larger today, approximately 3x4cm. Increased drainage noted with yellowish exudate. Surrounding skin is erythematous. Wound bed looks infected."
  },
  {
    name: "Hospitalization report",
    text: "Patient was admitted to Memorial Hospital ER on Friday for chest pain. Discharged Saturday with new diagnosis of angina. New medications include nitroglycerin sublingual PRN."
  },
  {
    name: "Medication changes",
    text: "Physician discontinued Metformin due to GI side effects. Started new medication Jardiance 10mg daily for diabetes management. Patient to monitor blood sugar more frequently."
  },
  {
    name: "Normal visit (no triggers)",
    text: "Patient doing well today. Vitals stable at 128/76, HR 72. Ambulating independently with walker. Pain controlled at 2/10. Medication compliance good. No new concerns."
  }
];

async function runTests() {
  console.log("=".repeat(70));
  console.log("CLINICAL EVENT DETECTION TEST - KEYWORD MATCHING");
  console.log("=".repeat(70));

  const context = {
    patientId: "test-patient-123",
    episodeId: "test-episode-456",
    clinicianId: "test-clinician-789"
  };

  let totalMatches = 0;

  for (const sample of sampleTexts) {
    console.log(`\n📋 Test: ${sample.name}`);
    console.log(`   Text: "${sample.text.substring(0, 70)}..."`);

    try {
      const keywordMatches = await detectionService.detectByKeywords(sample.text, context);

      if (keywordMatches.length > 0) {
        totalMatches += keywordMatches.length;
        console.log(`   ✅ Keyword matches: ${keywordMatches.length}`);
        for (const match of keywordMatches) {
          console.log(`      - ${match.eventType} (${match.priority})`);
          console.log(`        Keywords: "${match.matchedKeywords.join(', ')}"`);
        }
      } else {
        console.log(`   ⚪ No keyword matches (expected for normal visits)`);
      }
    } catch (error) {
      const err = error as Error;
      console.log(`   ❌ Error: ${err.message}`);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(`SUMMARY: ${totalMatches} total events detected across ${sampleTexts.length} samples`);
  console.log("=".repeat(70));

  await prisma.$disconnect();
}

runTests().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
