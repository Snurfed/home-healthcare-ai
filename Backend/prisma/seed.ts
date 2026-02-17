/**
 * Database Seed Script
 *
 * This script populates the database with initial data including:
 * - OASIS question library
 * - Default admin user (development only)
 * - Sample data for testing
 *
 * Run with: npx prisma db seed
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  Prisma,
  UserRole,
  UserStatus,
  VisitType,
  ClinicalEventType,
  TriggerPriority,
  NotificationChannel,
} from '../src/generated/prisma';
import { allOasisQuestions } from './seed/oasis-questions';
import * as bcrypt from 'bcryptjs';

// Create PostgreSQL connection pool
const connectionString = process.env['DATABASE_URL'] || 'postgresql://postgres@localhost:5432/homehealthai';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedOasisQuestions() {
  console.log('Seeding OASIS questions...');

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const question of allOasisQuestions) {
    try {
      const existing = await prisma.oasisQuestion.findUnique({
        where: { itemCode: question.itemCode },
      });

      const questionData = {
        itemName: question.itemName,
        section: question.section,
        questionText: question.questionText,
        helpText: question.helpText,
        responseType: question.responseType,
        responses: question.responses ? question.responses : Prisma.JsonNull,
        skipLogic: question.skipLogic ? question.skipLogic : Prisma.JsonNull,
        validationRules: question.validationRules ? question.validationRules : Prisma.JsonNull,
        assessmentTypes: question.assessmentTypes,
        effectiveDate: question.effectiveDate,
        cmsGuidance: question.cmsGuidance,
        sortOrder: question.sortOrder,
      };

      if (existing) {
        await prisma.oasisQuestion.update({
          where: { itemCode: question.itemCode },
          data: questionData,
        });
        updated++;
      } else {
        await prisma.oasisQuestion.create({
          data: {
            itemCode: question.itemCode,
            ...questionData,
          },
        });
        created++;
      }
    } catch (error) {
      console.error(`Error seeding question ${question.itemCode}:`, error);
      skipped++;
    }
  }

  console.log(`OASIS Questions: ${created} created, ${updated} updated, ${skipped} skipped`);
}

async function seedDefaultUsers() {
  // Only seed in development
  if (process.env['NODE_ENV'] === 'production') {
    console.log('Skipping default user seeding in production');
    return;
  }

  console.log('Seeding default users...');

  const defaultPasswordHash = await bcrypt.hash('password123', 12);

  const users = [
    {
      email: 'admin@homehealthai.test',
      firstName: 'System',
      lastName: 'Administrator',
      role: UserRole.ADMIN,
    },
    {
      email: 'supervisor@homehealthai.test',
      firstName: 'Sarah',
      lastName: 'Supervisor',
      role: UserRole.SUPERVISOR,
    },
    {
      email: 'nurse@homehealthai.test',
      firstName: 'Nancy',
      lastName: 'Nurse',
      role: UserRole.NURSE,
    },
    {
      email: 'pt@homehealthai.test',
      firstName: 'Peter',
      lastName: 'Therapist',
      role: UserRole.THERAPIST_PT,
    },
    {
      email: 'ot@homehealthai.test',
      firstName: 'Olivia',
      lastName: 'Therapist',
      role: UserRole.THERAPIST_OT,
    },
    {
      email: 'st@homehealthai.test',
      firstName: 'Steve',
      lastName: 'Therapist',
      role: UserRole.THERAPIST_ST,
    },
    {
      email: 'hha@homehealthai.test',
      firstName: 'Hannah',
      lastName: 'Aide',
      role: UserRole.HOME_HEALTH_AIDE,
    },
    {
      email: 'msw@homehealthai.test',
      firstName: 'Mary',
      lastName: 'Worker',
      role: UserRole.MEDICAL_SOCIAL_WORKER,
    },
    {
      email: 'billing@homehealthai.test',
      firstName: 'Bill',
      lastName: 'Specialist',
      role: UserRole.BILLING,
    },
    {
      email: 'readonly@homehealthai.test',
      firstName: 'Robert',
      lastName: 'Reader',
      role: UserRole.READONLY,
    },
  ];

  let created = 0;

  for (const user of users) {
    const existing = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!existing) {
      await prisma.user.create({
        data: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          passwordHash: defaultPasswordHash,
          status: UserStatus.ACTIVE,
        },
      });
      created++;
    }
  }

  console.log(`Users: ${created} created`);
}

/**
 * Assign clinicians to all existing patients for development/testing
 * This ensures nurses and therapists can access patient data
 */
async function seedPatientAssignments() {
  // Only seed in development
  if (process.env['NODE_ENV'] === 'production') {
    console.log('Skipping patient assignment seeding in production');
    return;
  }

  console.log('Seeding patient assignments...');

  // Get all patients
  const patients = await prisma.patient.findMany({
    where: { deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });

  if (patients.length === 0) {
    console.log('No patients found to assign clinicians to');
    return;
  }

  // Get clinicians who need assignments (non-admin roles)
  const clinicianRoles = [
    { email: 'nurse@homehealthai.test', discipline: VisitType.SKILLED_NURSING },
    { email: 'pt@homehealthai.test', discipline: VisitType.PHYSICAL_THERAPY },
    { email: 'ot@homehealthai.test', discipline: VisitType.OCCUPATIONAL_THERAPY },
    { email: 'st@homehealthai.test', discipline: VisitType.SPEECH_THERAPY },
    { email: 'hha@homehealthai.test', discipline: VisitType.HOME_HEALTH_AIDE },
    { email: 'msw@homehealthai.test', discipline: VisitType.MEDICAL_SOCIAL_WORK },
  ];

  let created = 0;
  let skipped = 0;

  for (const patient of patients) {
    for (const { email, discipline } of clinicianRoles) {
      const clinician = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (!clinician) continue;

      // Check if assignment already exists
      const existing = await prisma.patientAssignment.findFirst({
        where: {
          patientId: patient.id,
          userId: clinician.id,
          discipline,
          endDate: null,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      try {
        await prisma.patientAssignment.create({
          data: {
            patientId: patient.id,
            userId: clinician.id,
            discipline,
            isPrimary: discipline === VisitType.SKILLED_NURSING,
            startDate: new Date(),
            notes: 'Auto-assigned via seed script',
          },
        });
        created++;
      } catch (error) {
        // Ignore unique constraint violations (duplicate assignments)
        skipped++;
      }
    }
  }

  console.log(`Patient Assignments: ${created} created, ${skipped} skipped`);
}

async function seedAgencySettings() {
  console.log('Seeding agency settings...');

  // Check if agency settings already exist
  const existing = await prisma.agencySettings.findFirst({
    where: { isPrimary: true },
  });

  if (existing) {
    console.log('Agency Settings: already exists, skipping');
    return;
  }

  // Create default agency settings
  await prisma.agencySettings.create({
    data: {
      agencyName: 'HomeHealth AI Demo Agency',
      cmsNumber: '123456',        // M0010 - 6-digit CMS certification number
      branchState: 'CA',          // M0014 - 2-character state code
      branchId: '1234567890',     // M0016 - 10-digit branch ID
      facilityNpi: '1234567890',  // M0030/A0100 - 10-digit facility NPI
      providerType: '01',         // A0200 - Home Health Agency
      agencyAddress: '123 Healthcare Drive',
      agencyCity: 'Los Angeles',
      agencyState: 'CA',
      agencyZip: '90001',
      agencyPhone: '(555) 123-4567',
      agencyFax: '(555) 123-4568',
      isActive: true,
      isPrimary: true,
    },
  });

  console.log('Agency Settings: created default settings');
}

async function seedClinicalEventTriggers() {
  console.log('Seeding clinical event triggers...');

  // Define the 10 clinical event triggers with their configurations
  const triggers = [
    {
      eventType: ClinicalEventType.FALL,
      name: 'Fall Event',
      description: 'Patient fall or near-fall incident requiring physician notification',
      priority: TriggerPriority.HIGH,
      keywords: [
        'fall', 'fell', 'fallen', 'trip', 'tripped', 'stumble', 'stumbled',
        'lost balance', 'near fall', 'almost fell', 'slip', 'slipped',
        'found on floor', 'found on ground', 'unwitnessed fall'
      ],
      excludeKeywords: ['fall risk assessment', 'fall prevention', 'no falls'],
      monitoredOasisFields: ['J1800', 'J1900A', 'J1900B', 'J1900C'],
      aiPromptContext: 'Detect any mention of patient falls, near-falls, or balance issues that resulted in a fall event.',
      defaultRecipientRole: 'PCP',
    },
    {
      eventType: ClinicalEventType.HOSPITALIZATION,
      name: 'Hospitalization/ER Visit',
      description: 'Patient emergency room visit or hospital admission',
      priority: TriggerPriority.HIGH,
      keywords: [
        'hospital', 'hospitalized', 'hospitalization', 'admitted', 'admission',
        'emergency room', 'ER visit', 'emergency department', 'ED visit',
        'inpatient', '911', 'ambulance', 'transported to hospital'
      ],
      excludeKeywords: ['discharge from hospital', 'previous hospitalization'],
      monitoredOasisFields: ['M2301'],
      aiPromptContext: 'Detect any mention of new hospital admissions, ER visits, or emergency medical transport.',
      defaultRecipientRole: 'PCP',
    },
    {
      eventType: ClinicalEventType.MEDICATION_CHANGE,
      name: 'Medication Change',
      description: 'New medication, dosage change, or adverse drug reaction',
      priority: TriggerPriority.MEDIUM,
      keywords: [
        'new medication', 'medication change', 'dosage change', 'dose change',
        'started on', 'discontinued', 'stopped taking', 'adverse reaction',
        'drug reaction', 'side effect', 'allergic reaction', 'medication error',
        'missed doses', 'non-compliant', 'non-adherent', 'ran out of'
      ],
      excludeKeywords: ['no medication changes', 'medications unchanged'],
      monitoredOasisFields: ['N0415', 'M2001', 'M2003', 'M2005'],
      aiPromptContext: 'Detect medication changes, new prescriptions, discontinuations, or adverse drug events.',
      defaultRecipientRole: 'PCP',
    },
    {
      eventType: ClinicalEventType.FUNCTIONAL_DECLINE,
      name: 'Functional Decline',
      description: 'Significant decline in ADLs, mobility, or cognitive function',
      priority: TriggerPriority.MEDIUM,
      keywords: [
        'decline', 'declined', 'declining', 'worsening', 'deteriorating',
        'weaker', 'less independent', 'more assistance', 'can no longer',
        'unable to', 'lost ability', 'decreased mobility', 'increased dependence',
        'cognitive decline', 'confusion', 'disoriented'
      ],
      excludeKeywords: ['no decline', 'stable', 'improved', 'improving'],
      monitoredOasisFields: [
        'GG0130A1', 'GG0130B1', 'GG0130C1', 'GG0130E1', 'GG0130F1', 'GG0130G1', 'GG0130H1',
        'GG0170A1', 'GG0170B1', 'GG0170C1', 'GG0170D1', 'GG0170E1', 'GG0170F1',
        'GG0170I1', 'GG0170J1', 'GG0170K1', 'M1700', 'M1710'
      ],
      declineThreshold: 2,
      aiPromptContext: 'Detect significant functional decline in ADLs, mobility, transfers, or cognitive status compared to prior assessments.',
      defaultRecipientRole: 'PCP',
    },
    {
      eventType: ClinicalEventType.WOUND_CHANGE,
      name: 'Wound Status Change',
      description: 'New wound, wound deterioration, or signs of infection',
      priority: TriggerPriority.HIGH,
      keywords: [
        'new wound', 'wound worsening', 'wound deteriorating', 'wound larger',
        'increased drainage', 'purulent', 'foul odor', 'necrotic', 'tunneling',
        'undermining', 'infected', 'infection', 'cellulitis', 'erythema',
        'dehiscence', 'wound opened', 'pressure ulcer', 'pressure injury',
        'stage 3', 'stage 4', 'unstageable'
      ],
      excludeKeywords: ['wound healing', 'wound improved', 'wound stable'],
      monitoredOasisFields: ['M1306', 'M1307', 'M1311', 'M1322', 'M1324', 'M1330', 'M1340', 'M1342'],
      aiPromptContext: 'Detect wound status changes including new wounds, deterioration, infection signs, or staging changes.',
      defaultRecipientRole: 'PCP',
    },
    {
      eventType: ClinicalEventType.ABNORMAL_VITALS,
      name: 'Abnormal Vital Signs',
      description: 'Critical vital sign readings requiring physician attention',
      priority: TriggerPriority.CRITICAL,
      keywords: [
        'hypertension', 'hypertensive', 'hypotension', 'hypotensive',
        'tachycardia', 'tachycardic', 'bradycardia', 'bradycardic',
        'fever', 'febrile', 'hypothermia', 'hypoxia', 'hypoxic', 'desaturation',
        'blood pressure high', 'blood pressure low', 'BP elevated', 'BP dropped',
        'heart rate high', 'heart rate low', 'pulse irregular', 'pulse rapid', 'oxygen low',
        'SpO2 below', 'temperature elevated', 'temp 101', 'temp 102', 'temp 103',
        'significantly elevated', 'critically high', 'critically low', 'dangerously',
        'abnormal vitals', 'vital signs concerning', 'alarming'
      ],
      excludeKeywords: ['vitals stable', 'vitals within normal limits', 'vitals WNL'],
      monitoredOasisFields: [],
      aiPromptContext: 'Detect abnormal vital signs: BP >180/110 or <90/60, HR >120 or <50, Temp >101F, SpO2 <90%.',
      defaultRecipientRole: 'PCP',
    },
    {
      eventType: ClinicalEventType.PAIN_INCREASE,
      name: 'Significant Pain Increase',
      description: 'Notable increase in pain level or new pain complaint',
      priority: TriggerPriority.MEDIUM,
      keywords: [
        'pain increased', 'pain worse', 'more pain', 'severe pain',
        'pain level', 'pain scale', 'new pain', 'uncontrolled pain',
        'breakthrough pain', 'pain not controlled', 'pain medication not working',
        'crying from pain', 'grimacing', 'guarding'
      ],
      excludeKeywords: ['pain controlled', 'pain stable', 'pain decreased', 'no pain'],
      monitoredOasisFields: ['J0510A', 'J0510B', 'J0520'],
      declineThreshold: 3,
      aiPromptContext: 'Detect significant pain increases (3+ points on pain scale) or new pain complaints.',
      defaultRecipientRole: 'PCP',
    },
    {
      eventType: ClinicalEventType.ORDER_REQUEST,
      name: 'New Order Request',
      description: 'Clinical need identified requiring new physician orders',
      priority: TriggerPriority.MEDIUM,
      keywords: [
        'needs order', 'need orders', 'order needed', 'requesting order',
        'recommend', 'suggest', 'would benefit from', 'requires',
        'therapy evaluation', 'PT evaluation', 'OT evaluation', 'ST evaluation',
        'lab order', 'imaging', 'referral needed', 'specialist consult',
        'DME needed', 'supply order'
      ],
      excludeKeywords: ['order received', 'orders in place'],
      monitoredOasisFields: [],
      aiPromptContext: 'Detect clinical recommendations or requests for new physician orders, referrals, or evaluations.',
      defaultRecipientRole: 'PCP',
    },
    {
      eventType: ClinicalEventType.DISCHARGE_READY,
      name: 'Discharge Readiness',
      description: 'Patient has met goals and may be ready for discharge',
      priority: TriggerPriority.LOW,
      keywords: [
        'goals met', 'goals achieved', 'discharge ready', 'ready for discharge',
        'independent', 'no longer needs', 'plateau', 'plateaued',
        'maximum benefit', 'recommend discharge', 'suggest discharge',
        'caregiver trained', 'family trained'
      ],
      excludeKeywords: ['not ready for discharge', 'goals not met'],
      monitoredOasisFields: ['GG0130A1', 'GG0130B1', 'GG0170I1', 'GG0170J1'],
      aiPromptContext: 'Detect indicators that patient has met therapy goals and may be appropriate for discharge.',
      defaultRecipientRole: 'PCP',
    },
    {
      eventType: ClinicalEventType.RECERTIFICATION_DUE,
      name: 'Recertification Due',
      description: 'Episode nearing end, recertification decision needed',
      priority: TriggerPriority.MEDIUM,
      keywords: [
        'recertification', 'recert', 'certification period', 'episode ending',
        '60 day', 'end of episode', 'continued need', 'ongoing need',
        'recommend continued services', 'requires additional'
      ],
      excludeKeywords: [],
      monitoredOasisFields: [],
      aiPromptContext: 'Detect discussions about recertification needs or continued service requirements.',
      defaultRecipientRole: 'PCP',
    },
  ];

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const trigger of triggers) {
    try {
      const existing = await prisma.clinicalEventTriggerConfig.findUnique({
        where: { eventType: trigger.eventType },
      });

      const triggerData = {
        name: trigger.name,
        description: trigger.description,
        isEnabled: true,
        priority: trigger.priority,
        keywords: trigger.keywords,
        keywordMatchThreshold: 1,
        excludeKeywords: trigger.excludeKeywords,
        aiDetectionEnabled: true,
        aiPromptContext: trigger.aiPromptContext,
        aiConfidenceThreshold: new Prisma.Decimal(0.7),
        monitoredOasisFields: trigger.monitoredOasisFields,
        declineThreshold: trigger.declineThreshold,
        defaultRecipientRole: trigger.defaultRecipientRole,
        alwaysNotifyRoles: [],
        autoGenerateDraft: true,
        requiresReview: true,
        cooldownMinutes: trigger.priority === TriggerPriority.CRITICAL ? 0 : 60,
      };

      if (existing) {
        await prisma.clinicalEventTriggerConfig.update({
          where: { eventType: trigger.eventType },
          data: triggerData,
        });
        updated++;
      } else {
        await prisma.clinicalEventTriggerConfig.create({
          data: {
            eventType: trigger.eventType,
            ...triggerData,
          },
        });
        created++;
      }
    } catch (error) {
      console.error(`Error seeding trigger ${trigger.eventType}:`, error);
      skipped++;
    }
  }

  console.log(`Clinical Event Triggers: ${created} created, ${updated} updated, ${skipped} skipped`);

  // Seed default notification templates for each trigger
  await seedNotificationTemplates();
}

async function seedNotificationTemplates() {
  console.log('Seeding notification templates...');

  const triggers = await prisma.clinicalEventTriggerConfig.findMany();
  let created = 0;
  let skipped = 0;

  for (const trigger of triggers) {
    // Check if email template exists
    const existingEmail = await prisma.notificationTemplate.findFirst({
      where: {
        triggerId: trigger.id,
        channel: NotificationChannel.EMAIL,
        isDefault: true,
      },
    });

    if (!existingEmail) {
      await prisma.notificationTemplate.create({
        data: {
          triggerId: trigger.id,
          name: `${trigger.name} - Email Template`,
          channel: NotificationChannel.EMAIL,
          isDefault: true,
          subject: `[{{urgency}}] {{eventType}} - {{patientName}} (MRN: {{patientMrn}})`,
          bodyTemplate: `Dear Dr. {{physicianName}},

This is to notify you of a {{eventType}} for your patient:

**Patient:** {{patientName}}
**DOB:** {{patientDob}}
**MRN:** {{patientMrn}}

**Event Date:** {{eventDate}}
**Reported By:** {{clinicianName}}, {{clinicianCredentials}}

**Summary:**
{{eventSummary}}

**Details:**
{{eventDetails}}

**Clinical Significance:**
{{clinicalSignificance}}

**Recommended Actions:**
{{recommendedActions}}

---
This notification was generated by HomeHealth AI Assistant.
Please contact our office at {{agencyPhone}} if you have questions or need additional information.

{{agencyName}}
{{agencyAddress}}
{{agencyPhone}}`,
          summaryTemplate: `{{eventType}} for {{patientName}}: {{eventSummary}}`,
          availableVariables: [
            'patientName', 'patientDob', 'patientMrn', 'physicianName',
            'eventType', 'eventDate', 'eventSummary', 'eventDetails',
            'clinicalSignificance', 'recommendedActions', 'clinicianName',
            'clinicianCredentials', 'urgency', 'agencyName', 'agencyPhone', 'agencyAddress'
          ],
          format: 'html',
          includeClinicalData: true,
          includePatientDemo: true,
          includePhysicianInfo: true,
          autoAttachDocuments: [],
          isActive: true,
        },
      });
      created++;
    } else {
      skipped++;
    }

    // Check if fax template exists
    const existingFax = await prisma.notificationTemplate.findFirst({
      where: {
        triggerId: trigger.id,
        channel: NotificationChannel.FAX,
        isDefault: true,
      },
    });

    if (!existingFax) {
      await prisma.notificationTemplate.create({
        data: {
          triggerId: trigger.id,
          name: `${trigger.name} - Fax Template`,
          channel: NotificationChannel.FAX,
          isDefault: true,
          subject: `CLINICAL NOTIFICATION: {{eventType}}`,
          bodyTemplate: `CONFIDENTIAL MEDICAL INFORMATION
INTENDED RECIPIENT: Dr. {{physicianName}}

FROM: {{agencyName}}
PHONE: {{agencyPhone}}
FAX: {{agencyFax}}
DATE: {{currentDate}}

RE: {{patientName}} (DOB: {{patientDob}}, MRN: {{patientMrn}})

NOTIFICATION TYPE: {{eventType}}
PRIORITY: {{urgency}}

SUMMARY:
{{eventSummary}}

DETAILS:
{{eventDetails}}

CLINICAL SIGNIFICANCE:
{{clinicalSignificance}}

RECOMMENDED ACTIONS:
{{recommendedActions}}

REPORTED BY: {{clinicianName}}, {{clinicianCredentials}}
DATE/TIME: {{eventDate}}

---
If you have questions or need additional information, please contact our office.

This fax contains confidential patient information protected by HIPAA.
If you received this in error, please notify the sender immediately.`,
          summaryTemplate: `{{eventType}} for {{patientName}}: {{eventSummary}}`,
          availableVariables: [
            'patientName', 'patientDob', 'patientMrn', 'physicianName',
            'eventType', 'eventDate', 'eventSummary', 'eventDetails',
            'clinicalSignificance', 'recommendedActions', 'clinicianName',
            'clinicianCredentials', 'urgency', 'agencyName', 'agencyPhone',
            'agencyFax', 'currentDate'
          ],
          format: 'pdf',
          includeClinicalData: true,
          includePatientDemo: true,
          includePhysicianInfo: true,
          autoAttachDocuments: [],
          isActive: true,
        },
      });
      created++;
    } else {
      skipped++;
    }
  }

  console.log(`Notification Templates: ${created} created, ${skipped} skipped`);
}

async function main() {
  console.log('Starting database seed...\n');

  try {
    await seedOasisQuestions();
    await seedDefaultUsers();
    await seedPatientAssignments();
    await seedAgencySettings();
    await seedClinicalEventTriggers();

    console.log('\nDatabase seed completed successfully!');
  } catch (error) {
    console.error('Error during seed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
