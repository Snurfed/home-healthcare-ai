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
import { PrismaClient, Prisma, UserRole, UserStatus } from '../src/generated/prisma';
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
    await pool.end();
  });
