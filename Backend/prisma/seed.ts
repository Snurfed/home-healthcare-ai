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

import { PrismaClient, UserRole } from '../src/generated/prisma';
import { allOasisQuestions } from './seed/oasis-questions';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

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

      if (existing) {
        // Update if question text or responses changed
        await prisma.oasisQuestion.update({
          where: { itemCode: question.itemCode },
          data: {
            itemName: question.itemName,
            section: question.section,
            questionText: question.questionText,
            helpText: question.helpText,
            responseType: question.responseType,
            responses: question.responses || null,
            skipLogic: question.skipLogic || null,
            validationRules: question.validationRules || null,
            assessmentTypes: question.assessmentTypes,
            effectiveDate: question.effectiveDate,
            cmsGuidance: question.cmsGuidance,
            sortOrder: question.sortOrder,
          },
        });
        updated++;
      } else {
        await prisma.oasisQuestion.create({
          data: {
            itemCode: question.itemCode,
            itemName: question.itemName,
            section: question.section,
            questionText: question.questionText,
            helpText: question.helpText,
            responseType: question.responseType,
            responses: question.responses || null,
            skipLogic: question.skipLogic || null,
            validationRules: question.validationRules || null,
            assessmentTypes: question.assessmentTypes,
            effectiveDate: question.effectiveDate,
            cmsGuidance: question.cmsGuidance,
            sortOrder: question.sortOrder,
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
  if (process.env.NODE_ENV === 'production') {
    console.log('Skipping default user seeding in production');
    return;
  }

  console.log('Seeding default users...');

  const defaultPassword = await bcrypt.hash('password123', 12);

  const users = [
    {
      email: 'admin@homehealthai.test',
      firstName: 'System',
      lastName: 'Administrator',
      role: UserRole.ADMIN,
      password: defaultPassword,
    },
    {
      email: 'supervisor@homehealthai.test',
      firstName: 'Sarah',
      lastName: 'Supervisor',
      role: UserRole.SUPERVISOR,
      password: defaultPassword,
    },
    {
      email: 'nurse@homehealthai.test',
      firstName: 'Nancy',
      lastName: 'Nurse',
      role: UserRole.NURSE,
      password: defaultPassword,
    },
    {
      email: 'pt@homehealthai.test',
      firstName: 'Peter',
      lastName: 'Physical Therapist',
      role: UserRole.THERAPIST_PT,
      password: defaultPassword,
    },
    {
      email: 'ot@homehealthai.test',
      firstName: 'Olivia',
      lastName: 'Occupational Therapist',
      role: UserRole.THERAPIST_OT,
      password: defaultPassword,
    },
    {
      email: 'st@homehealthai.test',
      firstName: 'Steve',
      lastName: 'Speech Therapist',
      role: UserRole.THERAPIST_ST,
      password: defaultPassword,
    },
    {
      email: 'hha@homehealthai.test',
      firstName: 'Hannah',
      lastName: 'Home Health Aide',
      role: UserRole.HOME_HEALTH_AIDE,
      password: defaultPassword,
    },
    {
      email: 'msw@homehealthai.test',
      firstName: 'Mary',
      lastName: 'Medical Social Worker',
      role: UserRole.MEDICAL_SOCIAL_WORKER,
      password: defaultPassword,
    },
    {
      email: 'billing@homehealthai.test',
      firstName: 'Bill',
      lastName: 'Billing Specialist',
      role: UserRole.BILLING,
      password: defaultPassword,
    },
    {
      email: 'readonly@homehealthai.test',
      firstName: 'Robert',
      lastName: 'Reader',
      role: UserRole.READONLY,
      password: defaultPassword,
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
          password: user.password,
          isActive: true,
          emailVerified: true,
        },
      });
      created++;
    }
  }

  console.log(`Users: ${created} created`);
}

async function main() {
  console.log('Starting database seed...\n');

  try {
    await seedOasisQuestions();
    await seedDefaultUsers();

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
  });
