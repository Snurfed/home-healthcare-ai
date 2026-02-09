/**
 * Script to assign Nancy Nurse to a specific patient
 *
 * Run with: npx tsx scripts/assign-nurse-to-patient.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, VisitType } from '../src/generated/prisma';

const PATIENT_ID = 'f74a4e40-a554-40d5-9fe7-b8faa6a92704';
const NURSE_EMAIL = 'nurse@homehealthai.test';

async function main() {
  const connectionString = process.env['DATABASE_URL'] || 'postgresql://postgres@localhost:5432/homehealthai';
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Find Nancy Nurse
    const nurse = await prisma.user.findUnique({
      where: { email: NURSE_EMAIL },
    });

    if (!nurse) {
      console.error(`User with email ${NURSE_EMAIL} not found. Run the seed script first.`);
      process.exit(1);
    }

    console.log(`Found nurse: ${nurse.firstName} ${nurse.lastName} (${nurse.id})`);

    // Find the patient
    const patient = await prisma.patient.findUnique({
      where: { id: PATIENT_ID },
    });

    if (!patient) {
      console.error(`Patient with ID ${PATIENT_ID} not found.`);
      process.exit(1);
    }

    console.log(`Found patient: ${patient.firstName} ${patient.lastName} (${patient.id})`);

    // Check if assignment already exists
    const existingAssignment = await prisma.patientAssignment.findFirst({
      where: {
        patientId: PATIENT_ID,
        userId: nurse.id,
        endDate: null,
      },
    });

    if (existingAssignment) {
      console.log('Assignment already exists!');
      console.log(`Assignment ID: ${existingAssignment.id}`);
      return;
    }

    // Create the assignment
    const assignment = await prisma.patientAssignment.create({
      data: {
        patientId: PATIENT_ID,
        userId: nurse.id,
        discipline: VisitType.SKILLED_NURSING,
        isPrimary: true,
        startDate: new Date(),
        notes: 'Assigned via script',
      },
    });

    console.log(`\nCreated patient assignment!`);
    console.log(`Assignment ID: ${assignment.id}`);
    console.log(`Patient: ${patient.firstName} ${patient.lastName}`);
    console.log(`Clinician: ${nurse.firstName} ${nurse.lastName}`);
    console.log(`Discipline: ${assignment.discipline}`);
    console.log(`Is Primary: ${assignment.isPrimary}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
