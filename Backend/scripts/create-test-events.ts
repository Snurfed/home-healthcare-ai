/**
 * Create test clinical events for UI testing
 */

import 'dotenv/config';
import prisma from '../src/config/prisma';

async function createTestEvents() {
  // Get a patient and episode
  const patient = await prisma.patient.findFirst();
  const episode = await prisma.episode.findFirst();
  const user = await prisma.user.findFirst();

  if (!patient || !episode || !user) {
    console.log('No patient/episode/user found in database');
    await prisma.$disconnect();
    return;
  }

  console.log('Patient:', patient.id, '-', patient.firstName, patient.lastName);
  console.log('Episode:', episode.id);
  console.log('User:', user.id, '-', user.email);

  // Delete any existing test events for this patient
  const deleted = await prisma.detectedClinicalEvent.deleteMany({
    where: { patientId: patient.id },
  });
  console.log('Deleted existing events:', deleted.count);

  // Create test clinical events
  const events = [
    {
      patientId: patient.id,
      episodeId: episode.id,
      eventType: 'FALL' as const,
      priority: 'HIGH' as const,
      detectionMethod: 'keyword',
      matchedKeywords: ['fell', 'found on floor'],
      sourceText: 'Patient reported she fell in the bathroom this morning. Found on floor by caregiver.',
      eventSummary: 'Patient fall reported - found on floor in bathroom',
    },
    {
      patientId: patient.id,
      episodeId: episode.id,
      eventType: 'ABNORMAL_VITALS' as const,
      priority: 'CRITICAL' as const,
      detectionMethod: 'ai',
      matchedKeywords: [],
      detectionConfidence: 0.92,
      aiAnalysis: 'Blood pressure 185/102 significantly exceeds normal range. Heart rate elevated at 108 bpm.',
      sourceText: 'VS: BP 185/102, HR 108, Temp 98.6F. Patient reports dizziness and headache.',
      eventSummary: 'Critical: Blood pressure severely elevated at 185/102',
    },
    {
      patientId: patient.id,
      episodeId: episode.id,
      eventType: 'WOUND_CHANGE' as const,
      priority: 'HIGH' as const,
      detectionMethod: 'both',
      matchedKeywords: ['increased drainage', 'erythema', 'pressure ulcer'],
      detectionConfidence: 0.88,
      aiAnalysis: 'Wound shows signs of deterioration with increased size and drainage.',
      sourceText: 'Stage 2 pressure ulcer on sacrum now 4x5cm, previously 3x4cm. Increased serous drainage. Surrounding erythema noted.',
      eventSummary: 'Pressure ulcer deteriorating - increased size and drainage',
    },
  ];

  for (const eventData of events) {
    const event = await prisma.detectedClinicalEvent.create({
      data: eventData,
    });
    console.log('Created:', event.eventType, `(${event.priority})`, '-', event.id);
  }

  console.log('\nTest events created successfully!');
  console.log('Navigate to patient episode Documentation tab to see the alerts.');

  await prisma.$disconnect();
}

createTestEvents().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
