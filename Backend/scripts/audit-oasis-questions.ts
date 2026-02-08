#!/usr/bin/env npx tsx
/**
 * OASIS-E1 Questions Audit Script
 *
 * Compares the database against the official CMS OASIS-E1 specification
 * (effective January 1, 2025) and generates a detailed audit report.
 *
 * Usage: cd Backend && npx tsx scripts/audit-oasis-questions.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma';
import * as fs from 'fs';
import * as path from 'path';

// Create PostgreSQL connection pool
const connectionString = process.env['DATABASE_URL'] || 'postgresql://postgres@localhost:5432/homehealthai';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

// =============================================================================
// OASIS-E1 SPECIFICATION (CMS Effective 01/01/2025)
// =============================================================================

interface OASISItemSpec {
  code: string;
  name: string;
  section: string;
  sectionName: string;
  required: boolean;
  hasSubItems?: boolean;
  subItems?: string[];
  notes?: string;
}

// Complete OASIS-E1 Item List based on CMS specification
const OASIS_E1_SPECIFICATION: OASISItemSpec[] = [
  // ===========================================
  // SECTION A: ADMINISTRATIVE INFORMATION
  // ===========================================
  { code: 'M0010', name: 'CMS Certification Number', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'M0014', name: 'Branch State', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'M0016', name: 'Branch ID Number', section: 'A', sectionName: 'Administrative Information', required: false },
  { code: 'M0018', name: 'National Provider Identifier (NPI)', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'M0020', name: 'Patient ID Number', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'M0030', name: 'Start of Care Date', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'M0032', name: 'Resumption of Care Date', section: 'A', sectionName: 'Administrative Information', required: false },
  { code: 'M0040', name: 'Patient Name', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'M0050', name: 'Patient State of Residence', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'M0060', name: 'Patient ZIP Code', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'M0063', name: 'Medicare Number', section: 'A', sectionName: 'Administrative Information', required: false },
  { code: 'M0064', name: 'Social Security Number', section: 'A', sectionName: 'Administrative Information', required: false },
  { code: 'M0065', name: 'Medicaid Number', section: 'A', sectionName: 'Administrative Information', required: false },
  { code: 'M0066', name: 'Birth Date', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'M0069', name: 'Gender', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'M0080', name: 'Discipline of Person Completing Assessment', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'M0090', name: 'Date Assessment Completed', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'M0100', name: 'Reason for Assessment', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'M0110', name: 'Episode Timing', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'A0050', name: 'Type of Record', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'A0100', name: 'Facility NPI', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'A0200', name: 'Type of Provider', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'A0250', name: 'Reason for Assessment', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'A0270', name: 'Discharge Date', section: 'A', sectionName: 'Administrative Information', required: false },
  { code: 'A1005', name: 'Ethnicity', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'A1010', name: 'Race', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'A1110A', name: 'Language - Need Interpreter', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'A1110B', name: 'Language - Preferred Language', section: 'A', sectionName: 'Administrative Information', required: true },
  { code: 'A1250', name: 'Transportation', section: 'A', sectionName: 'Administrative Information', required: false },
  { code: 'A2120', name: 'Marital Status', section: 'A', sectionName: 'Administrative Information', required: false },

  // ===========================================
  // SECTION B: HEARING, SPEECH, AND VISION
  // ===========================================
  { code: 'B0200', name: 'Hearing', section: 'B', sectionName: 'Hearing, Speech, and Vision', required: true },
  { code: 'B1000', name: 'Vision', section: 'B', sectionName: 'Hearing, Speech, and Vision', required: true },
  { code: 'B1300', name: 'Health Literacy', section: 'B', sectionName: 'Hearing, Speech, and Vision', required: false },

  // ===========================================
  // SECTION C: COGNITIVE PATTERNS
  // ===========================================
  { code: 'C0100', name: 'Should BIMS Be Conducted?', section: 'C', sectionName: 'Cognitive Patterns', required: true },
  { code: 'C0200', name: 'Repetition of Three Words', section: 'C', sectionName: 'Cognitive Patterns', required: false },
  { code: 'C0300A', name: 'Temporal Orientation - Year', section: 'C', sectionName: 'Cognitive Patterns', required: false },
  { code: 'C0300B', name: 'Temporal Orientation - Month', section: 'C', sectionName: 'Cognitive Patterns', required: false },
  { code: 'C0300C', name: 'Temporal Orientation - Day', section: 'C', sectionName: 'Cognitive Patterns', required: false },
  { code: 'C0400A', name: 'Recall - Sock', section: 'C', sectionName: 'Cognitive Patterns', required: false },
  { code: 'C0400B', name: 'Recall - Blue', section: 'C', sectionName: 'Cognitive Patterns', required: false },
  { code: 'C0400C', name: 'Recall - Bed', section: 'C', sectionName: 'Cognitive Patterns', required: false },
  { code: 'C0500', name: 'BIMS Summary Score', section: 'C', sectionName: 'Cognitive Patterns', required: false },
  { code: 'C0700', name: 'Short-term Memory OK', section: 'C', sectionName: 'Cognitive Patterns', required: false },
  { code: 'C0800', name: 'Long-term Memory OK', section: 'C', sectionName: 'Cognitive Patterns', required: false },
  { code: 'C0900', name: 'Memory/Recall Ability', section: 'C', sectionName: 'Cognitive Patterns', required: false },
  { code: 'C1310A', name: 'Delirium - Inattention', section: 'C', sectionName: 'Cognitive Patterns', required: true },
  { code: 'C1310B', name: 'Delirium - Disorganized Thinking', section: 'C', sectionName: 'Cognitive Patterns', required: true },
  { code: 'C1310C', name: 'Delirium - Altered Consciousness', section: 'C', sectionName: 'Cognitive Patterns', required: true },
  { code: 'C1310D', name: 'Delirium - Psychomotor Retardation', section: 'C', sectionName: 'Cognitive Patterns', required: true },

  // ===========================================
  // SECTION D: MOOD
  // ===========================================
  { code: 'D0150A1', name: 'PHQ-2 Little Interest - Frequency', section: 'D', sectionName: 'Mood', required: true },
  { code: 'D0150B1', name: 'PHQ-2 Feeling Down - Frequency', section: 'D', sectionName: 'Mood', required: true },
  { code: 'D0160', name: 'Total Severity Score', section: 'D', sectionName: 'Mood', required: true },

  // ===========================================
  // SECTION E: BEHAVIOR
  // ===========================================
  { code: 'E0100A', name: 'Psychosis - Hallucinations', section: 'E', sectionName: 'Behavior', required: true },
  { code: 'E0100B', name: 'Psychosis - Delusions', section: 'E', sectionName: 'Behavior', required: true },
  { code: 'E0200A', name: 'Behavioral Symptoms - Physical', section: 'E', sectionName: 'Behavior', required: true },
  { code: 'E0200B', name: 'Behavioral Symptoms - Verbal', section: 'E', sectionName: 'Behavior', required: true },
  { code: 'E0200C', name: 'Behavioral Symptoms - Other', section: 'E', sectionName: 'Behavior', required: true },

  // ===========================================
  // SECTION F: PREFERENCES FOR CUSTOMARY ROUTINE
  // ===========================================
  { code: 'F2000', name: 'Prior Functioning - Self Care', section: 'F', sectionName: 'Preferences', required: true },
  { code: 'F2100', name: 'Prior Functioning - Indoor Mobility', section: 'F', sectionName: 'Preferences', required: true },
  { code: 'F2200', name: 'Prior Functioning - Stairs', section: 'F', sectionName: 'Preferences', required: true },
  { code: 'F2300', name: 'Prior Functioning - Functional Cognition', section: 'F', sectionName: 'Preferences', required: true },

  // ===========================================
  // SECTION GG: FUNCTIONAL ABILITIES AND GOALS
  // ===========================================
  // Self-Care items
  { code: 'GG0130A', name: 'Self-Care: Eating', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0130B', name: 'Self-Care: Oral Hygiene', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0130C', name: 'Self-Care: Toileting Hygiene', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0130D', name: 'Self-Care: Wash Upper Body', section: 'GG', sectionName: 'Functional Abilities', required: false },
  { code: 'GG0130E', name: 'Self-Care: Shower/Bathe Self', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0130F', name: 'Self-Care: Upper Body Dressing', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0130G', name: 'Self-Care: Lower Body Dressing', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0130H', name: 'Self-Care: Putting On/Taking Off Footwear', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0130I', name: 'Self-Care: Sit to Stand', section: 'GG', sectionName: 'Functional Abilities', required: false },
  { code: 'GG0130J', name: 'Self-Care: Bed Mobility', section: 'GG', sectionName: 'Functional Abilities', required: false },

  // Mobility items
  { code: 'GG0170A', name: 'Mobility: Roll Left and Right', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0170B', name: 'Mobility: Sit to Lying', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0170C', name: 'Mobility: Lying to Sitting', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0170D', name: 'Mobility: Sit to Stand', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0170E', name: 'Mobility: Chair/Bed-to-Chair Transfer', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0170F', name: 'Mobility: Toilet Transfer', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0170G', name: 'Mobility: Car Transfer', section: 'GG', sectionName: 'Functional Abilities', required: false },
  { code: 'GG0170H', name: 'Mobility: Walk 10 Feet on Uneven Surfaces', section: 'GG', sectionName: 'Functional Abilities', required: false },
  { code: 'GG0170I', name: 'Mobility: Walk 10 Feet', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0170J', name: 'Mobility: Walk 50 Feet with Two Turns', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0170K', name: 'Mobility: Walk 150 Feet', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0170L', name: 'Mobility: Walking 10 Feet on Uneven Surfaces', section: 'GG', sectionName: 'Functional Abilities', required: false },
  { code: 'GG0170M', name: 'Mobility: 1 Step (Curb)', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0170N', name: 'Mobility: 4 Steps', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0170O', name: 'Mobility: 12 Steps', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0170P', name: 'Mobility: Picking Up Object', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0170Q', name: 'Mobility: Does Patient Use Wheelchair?', section: 'GG', sectionName: 'Functional Abilities', required: true },
  { code: 'GG0170R', name: 'Mobility: Wheel 50 Feet with Two Turns', section: 'GG', sectionName: 'Functional Abilities', required: false },
  { code: 'GG0170RR', name: 'Mobility: Wheel 150 Feet', section: 'GG', sectionName: 'Functional Abilities', required: false },
  { code: 'GG0170S', name: 'Mobility: Does Patient Use Walker?', section: 'GG', sectionName: 'Functional Abilities', required: false },
  { code: 'GG0170SS', name: 'Mobility: Does Patient Use Cane/Crutch?', section: 'GG', sectionName: 'Functional Abilities', required: false },

  // ===========================================
  // SECTION H: BLADDER AND BOWEL
  // ===========================================
  { code: 'M1600', name: 'Urinary Tract Infection', section: 'H', sectionName: 'Bladder and Bowel', required: true },
  { code: 'M1610', name: 'Urinary Incontinence or Catheter', section: 'H', sectionName: 'Bladder and Bowel', required: true },
  { code: 'M1620', name: 'Bowel Incontinence Frequency', section: 'H', sectionName: 'Bladder and Bowel', required: true },
  { code: 'M1630', name: 'Ostomy for Bowel Elimination', section: 'H', sectionName: 'Bladder and Bowel', required: true },

  // ===========================================
  // SECTION I: ACTIVE DIAGNOSES
  // ===========================================
  { code: 'M1000', name: 'Primary Diagnosis', section: 'I', sectionName: 'Active Diagnoses', required: true },
  { code: 'M1005', name: 'Other Diagnoses', section: 'I', sectionName: 'Active Diagnoses', required: false },
  { code: 'M1021', name: 'Primary Diagnosis Severity', section: 'I', sectionName: 'Active Diagnoses', required: true },
  { code: 'M1028', name: 'Active Diagnoses - PVD/PAD', section: 'I', sectionName: 'Active Diagnoses', required: true },

  // ===========================================
  // SECTION J: HEALTH CONDITIONS
  // ===========================================
  { code: 'M1033', name: 'Risk for Hospitalization', section: 'J', sectionName: 'Health Conditions', required: true },
  { code: 'J0510', name: 'Pain Effect on Sleep', section: 'J', sectionName: 'Health Conditions', required: true },
  { code: 'J0520', name: 'Pain Effect on Therapy Activities', section: 'J', sectionName: 'Health Conditions', required: true },
  { code: 'J0530', name: 'Pain Interference with Activities', section: 'J', sectionName: 'Health Conditions', required: true },
  { code: 'J1100', name: 'Shortness of Breath', section: 'J', sectionName: 'Health Conditions', required: true },
  { code: 'J1800', name: 'Any Falls Since SOC/ROC', section: 'J', sectionName: 'Health Conditions', required: true },
  { code: 'J1900A', name: 'Number of Falls - No Injury', section: 'J', sectionName: 'Health Conditions', required: false },
  { code: 'J1900B', name: 'Number of Falls - Minor Injury', section: 'J', sectionName: 'Health Conditions', required: false },
  { code: 'J1900C', name: 'Number of Falls - Major Injury', section: 'J', sectionName: 'Health Conditions', required: false },
  { code: 'J2000', name: 'Prior Falls', section: 'J', sectionName: 'Health Conditions', required: true },
  { code: 'J2030', name: 'Fall Risk Assessment', section: 'J', sectionName: 'Health Conditions', required: true },

  // ===========================================
  // SECTION K: SWALLOWING/NUTRITIONAL STATUS
  // ===========================================
  { code: 'K0100', name: 'Swallowing Disorder', section: 'K', sectionName: 'Swallowing/Nutritional Status', required: true },
  { code: 'K0200', name: 'Height and Weight', section: 'K', sectionName: 'Swallowing/Nutritional Status', required: true },
  { code: 'K0300', name: 'Weight Loss', section: 'K', sectionName: 'Swallowing/Nutritional Status', required: true },
  { code: 'K0520A1', name: 'Nutritional Approaches - Parenteral/IV', section: 'K', sectionName: 'Swallowing/Nutritional Status', required: true },
  { code: 'K0520A2', name: 'Nutritional Approaches - Feeding Tube', section: 'K', sectionName: 'Swallowing/Nutritional Status', required: true },
  { code: 'K0520A3', name: 'Nutritional Approaches - Mechanically Altered', section: 'K', sectionName: 'Swallowing/Nutritional Status', required: true },
  { code: 'K0520A4', name: 'Nutritional Approaches - Therapeutic Diet', section: 'K', sectionName: 'Swallowing/Nutritional Status', required: true },

  // ===========================================
  // SECTION M: SKIN CONDITIONS
  // ===========================================
  { code: 'M1200', name: 'Vision', section: 'M', sectionName: 'Skin Conditions (Legacy)', required: false },
  { code: 'M1210', name: 'Hearing and Ability to Understand', section: 'M', sectionName: 'Skin Conditions (Legacy)', required: false },
  { code: 'M1220', name: 'Understanding of Verbal Content', section: 'M', sectionName: 'Skin Conditions (Legacy)', required: false },
  { code: 'M1230', name: 'Speech and Oral Expression', section: 'M', sectionName: 'Skin Conditions (Legacy)', required: false },
  { code: 'M1240', name: 'Pain Assessment', section: 'M', sectionName: 'Skin Conditions (Legacy)', required: true },
  { code: 'M1242', name: 'Frequency of Pain Interfering', section: 'M', sectionName: 'Skin Conditions (Legacy)', required: true },
  { code: 'M1300', name: 'Pressure Ulcer Risk Assessment', section: 'M', sectionName: 'Skin Conditions', required: true },
  { code: 'M1306', name: 'Unhealed Pressure Ulcers Present', section: 'M', sectionName: 'Skin Conditions', required: true },
  { code: 'M1307', name: 'Oldest Stage 2 Pressure Ulcer', section: 'M', sectionName: 'Skin Conditions', required: false },
  { code: 'M1311', name: 'Current Number of Unhealed Pressure Ulcers', section: 'M', sectionName: 'Skin Conditions', required: false },
  { code: 'M1322', name: 'Current Number of Stasis Ulcers', section: 'M', sectionName: 'Skin Conditions', required: true },
  { code: 'M1324', name: 'Stage of Most Problematic Stasis Ulcer', section: 'M', sectionName: 'Skin Conditions', required: false },
  { code: 'M1330', name: 'Surgical Wound Present', section: 'M', sectionName: 'Skin Conditions', required: true },
  { code: 'M1340', name: 'Surgical Wound Status', section: 'M', sectionName: 'Skin Conditions', required: false },
  { code: 'M1030', name: 'Therapies Patient Receives', section: 'M', sectionName: 'Skin Conditions', required: true },
  { code: 'M1051', name: 'COVID-19 Vaccine', section: 'M', sectionName: 'Skin Conditions', required: true },
  { code: 'M1060', name: 'Height and Weight', section: 'M', sectionName: 'Skin Conditions', required: true },

  // ===========================================
  // SECTION N: MEDICATIONS
  // ===========================================
  { code: 'N0415', name: 'High-Risk Drug Classes', section: 'N', sectionName: 'Medications', required: true },
  { code: 'N2001', name: 'Drug Regimen Review', section: 'N', sectionName: 'Medications', required: true },
  { code: 'N2003', name: 'Medication Follow-up', section: 'N', sectionName: 'Medications', required: true },
  { code: 'N2005', name: 'Medication Intervention', section: 'N', sectionName: 'Medications', required: true },
  { code: 'N2021', name: 'Opioid Medication - Bowel Regimen', section: 'N', sectionName: 'Medications', required: true },
  { code: 'M1041', name: 'Influenza Vaccine Received', section: 'N', sectionName: 'Medications', required: true },
  { code: 'M1056', name: 'High-Risk Drug Education', section: 'N', sectionName: 'Medications', required: true },

  // ===========================================
  // SECTION O: SPECIAL TREATMENTS, PROCEDURES
  // ===========================================
  { code: 'O0110A1', name: 'Special Treatments - Chemotherapy', section: 'O', sectionName: 'Special Treatments', required: true },
  { code: 'O0110A2', name: 'Special Treatments - Radiation', section: 'O', sectionName: 'Special Treatments', required: true },
  { code: 'O0110B1', name: 'Special Treatments - Oxygen Therapy', section: 'O', sectionName: 'Special Treatments', required: true },
  { code: 'O0110B2', name: 'Special Treatments - BiPAP/CPAP', section: 'O', sectionName: 'Special Treatments', required: true },
  { code: 'O0110B3', name: 'Special Treatments - Tracheostomy', section: 'O', sectionName: 'Special Treatments', required: true },
  { code: 'O0110B4', name: 'Special Treatments - Invasive Ventilator', section: 'O', sectionName: 'Special Treatments', required: true },
  { code: 'O0110C1', name: 'Special Treatments - IV Medications', section: 'O', sectionName: 'Special Treatments', required: true },
  { code: 'O0110C2', name: 'Special Treatments - Transfusions', section: 'O', sectionName: 'Special Treatments', required: true },
  { code: 'O0110D1', name: 'Special Treatments - Dialysis', section: 'O', sectionName: 'Special Treatments', required: true },
  { code: 'O0110E1', name: 'Special Treatments - IV Access', section: 'O', sectionName: 'Special Treatments', required: true },
  { code: 'O0350', name: 'Patient Specific Order for Influenza', section: 'O', sectionName: 'Special Treatments', required: false },
  { code: 'O5000', name: 'Influenza Vaccine Received', section: 'O', sectionName: 'Special Treatments', required: true },

  // ===========================================
  // SECTION Q: PARTICIPATION IN ASSESSMENT
  // ===========================================
  { code: 'Q0380', name: 'Participation in Assessment and Goal Setting', section: 'Q', sectionName: 'Participation', required: true },
  { code: 'Q0490', name: 'Advance Care Plan', section: 'Q', sectionName: 'Participation', required: true },
  { code: 'Q0500A', name: 'Discharge Goals - Self-Care', section: 'Q', sectionName: 'Participation', required: true },
  { code: 'Q0500B', name: 'Discharge Goals - Mobility', section: 'Q', sectionName: 'Participation', required: true },

  // ===========================================
  // ADDITIONAL LEGACY M-ITEMS
  // ===========================================
  { code: 'M1400', name: 'Dyspnea', section: 'J', sectionName: 'Health Conditions', required: true },
  { code: 'M1500', name: 'Symptoms in Heart Failure Patients', section: 'J', sectionName: 'Health Conditions', required: false },
  { code: 'M1700', name: 'Cognitive Functioning', section: 'C', sectionName: 'Cognitive Patterns', required: true },
  { code: 'M1710', name: 'When Confused', section: 'C', sectionName: 'Cognitive Patterns', required: true },
  { code: 'M1720', name: 'When Anxious', section: 'C', sectionName: 'Cognitive Patterns', required: true },
  { code: 'M1730', name: 'PHQ-2 Depression Screening', section: 'D', sectionName: 'Mood', required: true },
  { code: 'M1740', name: 'PHQ-9 Total Severity Score', section: 'D', sectionName: 'Mood', required: false },
  { code: 'M1745', name: 'Frequency of Disruptive Behavior Symptoms', section: 'E', sectionName: 'Behavior', required: true },
];

// =============================================================================
// AUDIT FUNCTIONS
// =============================================================================

interface AuditResult {
  totalSpecified: number;
  totalInDatabase: number;
  present: OASISItemSpec[];
  missing: OASISItemSpec[];
  extra: { itemCode: string; itemName: string; section: string }[];
  incomplete: { itemCode: string; itemName: string; issues: string[] }[];
  sectionBreakdown: Map<string, { specified: number; present: number; missing: number }>;
}

async function runAudit(prisma: PrismaClient): Promise<AuditResult> {
  console.log(`\n${colors.cyan}${colors.bold}=== OASIS-E1 Questions Audit ===${colors.reset}\n`);
  console.log(`${colors.dim}Querying database...${colors.reset}`);

  // Get all questions from database
  const dbQuestions = await prisma.oasisQuestion.findMany({
    orderBy: { itemCode: 'asc' },
  });

  console.log(`${colors.dim}Found ${dbQuestions.length} questions in database${colors.reset}\n`);

  // Create lookup maps
  const dbCodeMap = new Map(dbQuestions.map(q => [q.itemCode, q]));
  const specCodeSet = new Set(OASIS_E1_SPECIFICATION.map(s => s.code));

  // Initialize result
  const result: AuditResult = {
    totalSpecified: OASIS_E1_SPECIFICATION.length,
    totalInDatabase: dbQuestions.length,
    present: [],
    missing: [],
    extra: [],
    incomplete: [],
    sectionBreakdown: new Map(),
  };

  // Check each specified item
  for (const spec of OASIS_E1_SPECIFICATION) {
    const dbQuestion = dbCodeMap.get(spec.code);

    // Initialize section breakdown
    if (!result.sectionBreakdown.has(spec.section)) {
      result.sectionBreakdown.set(spec.section, { specified: 0, present: 0, missing: 0 });
    }
    const sectionStats = result.sectionBreakdown.get(spec.section)!;
    sectionStats.specified++;

    if (dbQuestion) {
      result.present.push(spec);
      sectionStats.present++;

      // Check for incomplete data
      const issues: string[] = [];
      if (!dbQuestion.questionText || dbQuestion.questionText.trim() === '') {
        issues.push('Missing question text');
      }
      if (dbQuestion.responseType === 'single_select' || dbQuestion.responseType === 'multi_select') {
        if (!dbQuestion.responses || (Array.isArray(dbQuestion.responses) && dbQuestion.responses.length === 0)) {
          issues.push('Missing response options');
        }
      }
      if (spec.required && (!dbQuestion.validationRules ||
          !(dbQuestion.validationRules as any[])?.some((r: any) => r.ruleType === 'required'))) {
        issues.push('Required item missing validation rule');
      }

      if (issues.length > 0) {
        result.incomplete.push({
          itemCode: spec.code,
          itemName: spec.name,
          issues,
        });
      }
    } else {
      result.missing.push(spec);
      sectionStats.missing++;
    }
  }

  // Check for extra items in database not in spec
  for (const dbQ of dbQuestions) {
    if (!specCodeSet.has(dbQ.itemCode)) {
      result.extra.push({
        itemCode: dbQ.itemCode,
        itemName: dbQ.itemName,
        section: dbQ.section,
      });
    }
  }

  return result;
}

// =============================================================================
// CONSOLE REPORT
// =============================================================================

function printConsoleReport(result: AuditResult): void {
  const completionPct = ((result.present.length / result.totalSpecified) * 100).toFixed(1);

  console.log(`${colors.bold}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}║              OASIS-E1 AUDIT REPORT                         ║${colors.reset}`);
  console.log(`${colors.bold}╠════════════════════════════════════════════════════════════╣${colors.reset}`);
  console.log(`${colors.bold}║${colors.reset}  Total Specified Items:     ${colors.cyan}${result.totalSpecified.toString().padStart(3)}${colors.reset}                          ${colors.bold}║${colors.reset}`);
  console.log(`${colors.bold}║${colors.reset}  Items in Database:         ${colors.cyan}${result.totalInDatabase.toString().padStart(3)}${colors.reset}                          ${colors.bold}║${colors.reset}`);
  console.log(`${colors.bold}║${colors.reset}  ${colors.green}✓ Present:${colors.reset}                  ${colors.green}${result.present.length.toString().padStart(3)}${colors.reset}                          ${colors.bold}║${colors.reset}`);
  console.log(`${colors.bold}║${colors.reset}  ${colors.red}✗ Missing:${colors.reset}                  ${colors.red}${result.missing.length.toString().padStart(3)}${colors.reset}                          ${colors.bold}║${colors.reset}`);
  console.log(`${colors.bold}║${colors.reset}  ${colors.yellow}⚠ Incomplete:${colors.reset}               ${colors.yellow}${result.incomplete.length.toString().padStart(3)}${colors.reset}                          ${colors.bold}║${colors.reset}`);
  console.log(`${colors.bold}║${colors.reset}  ${colors.blue}+ Extra (not in spec):${colors.reset}       ${colors.blue}${result.extra.length.toString().padStart(3)}${colors.reset}                          ${colors.bold}║${colors.reset}`);
  console.log(`${colors.bold}║${colors.reset}  Completion:                ${completionPct}%                        ${colors.bold}║${colors.reset}`);
  console.log(`${colors.bold}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  // Section breakdown
  console.log(`${colors.bold}SECTION BREAKDOWN:${colors.reset}`);
  console.log(`${'─'.repeat(60)}`);

  const sections = Array.from(result.sectionBreakdown.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [section, stats] of sections) {
    const sectionSpec = OASIS_E1_SPECIFICATION.find(s => s.section === section);
    const sectionName = sectionSpec?.sectionName || section;
    const pct = stats.specified > 0 ? ((stats.present / stats.specified) * 100).toFixed(0) : '100';
    const status = stats.missing === 0 ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
    console.log(`${status} Section ${section} (${sectionName}): ${stats.present}/${stats.specified} (${pct}%)`);
  }

  // Missing items
  if (result.missing.length > 0) {
    console.log(`\n${colors.red}${colors.bold}MISSING ITEMS (${result.missing.length}):${colors.reset}`);
    console.log(`${'─'.repeat(60)}`);
    for (const item of result.missing) {
      console.log(`  ${colors.red}✗${colors.reset} ${item.code}: ${item.name} [Section ${item.section}]${item.required ? ` ${colors.yellow}(REQUIRED)${colors.reset}` : ''}`);
    }
  }

  // Incomplete items
  if (result.incomplete.length > 0) {
    console.log(`\n${colors.yellow}${colors.bold}INCOMPLETE ITEMS (${result.incomplete.length}):${colors.reset}`);
    console.log(`${'─'.repeat(60)}`);
    for (const item of result.incomplete) {
      console.log(`  ${colors.yellow}⚠${colors.reset} ${item.itemCode}: ${item.itemName}`);
      for (const issue of item.issues) {
        console.log(`      - ${issue}`);
      }
    }
  }

  // Extra items
  if (result.extra.length > 0) {
    console.log(`\n${colors.blue}${colors.bold}EXTRA ITEMS NOT IN SPEC (${result.extra.length}):${colors.reset}`);
    console.log(`${'─'.repeat(60)}`);
    for (const item of result.extra) {
      console.log(`  ${colors.blue}+${colors.reset} ${item.itemCode}: ${item.itemName} [${item.section}]`);
    }
  }
}

// =============================================================================
// HTML REPORT
// =============================================================================

function generateHtmlReport(result: AuditResult): string {
  const completionPct = ((result.present.length / result.totalSpecified) * 100).toFixed(1);
  const now = new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OASIS-E1 Audit Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #1a365d; margin-bottom: 10px; }
    h2 { color: #2d3748; margin: 30px 0 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
    h3 { color: #4a5568; margin: 20px 0 10px; }
    .timestamp { color: #718096; font-size: 14px; margin-bottom: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
    .summary-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .summary-card.green { border-left: 4px solid #48bb78; }
    .summary-card.red { border-left: 4px solid #f56565; }
    .summary-card.yellow { border-left: 4px solid #ed8936; }
    .summary-card.blue { border-left: 4px solid #4299e1; }
    .summary-card h3 { margin: 0 0 10px; font-size: 14px; color: #718096; text-transform: uppercase; }
    .summary-card .value { font-size: 36px; font-weight: 700; }
    .summary-card.green .value { color: #48bb78; }
    .summary-card.red .value { color: #f56565; }
    .summary-card.yellow .value { color: #ed8936; }
    .summary-card.blue .value { color: #4299e1; }
    .progress-bar { background: #e2e8f0; border-radius: 999px; height: 20px; overflow: hidden; margin: 20px 0; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #48bb78, #38a169); transition: width 0.3s; }
    .progress-label { text-align: center; font-weight: 600; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin: 20px 0; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f7fafc; font-weight: 600; color: #4a5568; }
    tr:hover { background: #f7fafc; }
    .status-present { color: #48bb78; }
    .status-missing { color: #f56565; }
    .status-incomplete { color: #ed8936; }
    .status-extra { color: #4299e1; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 500; }
    .badge-required { background: #fed7d7; color: #c53030; }
    .badge-section { background: #e2e8f0; color: #4a5568; }
    .section-card { background: white; border-radius: 8px; padding: 15px 20px; margin: 10px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; }
    .section-card.complete { border-left: 4px solid #48bb78; }
    .section-card.incomplete { border-left: 4px solid #f56565; }
    .section-name { font-weight: 600; }
    .section-stats { color: #718096; }
    .issue-list { list-style: none; margin: 5px 0 0 20px; }
    .issue-list li { color: #718096; font-size: 14px; }
    .issue-list li::before { content: "• "; color: #ed8936; }
    .recommendations { background: #ebf8ff; border: 1px solid #90cdf4; border-radius: 8px; padding: 20px; margin: 30px 0; }
    .recommendations h3 { color: #2b6cb0; margin-bottom: 15px; }
    .recommendations ul { margin-left: 20px; }
    .recommendations li { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>OASIS-E1 Questions Audit Report</h1>
    <p class="timestamp">Generated: ${now}</p>

    <div class="summary-grid">
      <div class="summary-card blue">
        <h3>Total Specified</h3>
        <div class="value">${result.totalSpecified}</div>
      </div>
      <div class="summary-card green">
        <h3>Present in DB</h3>
        <div class="value">${result.present.length}</div>
      </div>
      <div class="summary-card red">
        <h3>Missing</h3>
        <div class="value">${result.missing.length}</div>
      </div>
      <div class="summary-card yellow">
        <h3>Incomplete</h3>
        <div class="value">${result.incomplete.length}</div>
      </div>
    </div>

    <div class="progress-bar">
      <div class="progress-fill" style="width: ${completionPct}%"></div>
    </div>
    <p class="progress-label">${completionPct}% Complete (${result.present.length}/${result.totalSpecified} items)</p>

    <h2>Section Breakdown</h2>
    ${Array.from(result.sectionBreakdown.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([section, stats]) => {
        const sectionSpec = OASIS_E1_SPECIFICATION.find(s => s.section === section);
        const sectionName = sectionSpec?.sectionName || section;
        const pct = stats.specified > 0 ? ((stats.present / stats.specified) * 100).toFixed(0) : '100';
        const isComplete = stats.missing === 0;
        return `
          <div class="section-card ${isComplete ? 'complete' : 'incomplete'}">
            <div>
              <span class="section-name">Section ${section}: ${sectionName}</span>
            </div>
            <div class="section-stats">
              ${stats.present}/${stats.specified} items (${pct}%)
            </div>
          </div>
        `;
      }).join('')}

    ${result.missing.length > 0 ? `
      <h2>Missing Items (${result.missing.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Section</th>
            <th>Required</th>
          </tr>
        </thead>
        <tbody>
          ${result.missing.map(item => `
            <tr>
              <td class="status-missing">${item.code}</td>
              <td>${item.name}</td>
              <td><span class="badge badge-section">${item.section} - ${item.sectionName}</span></td>
              <td>${item.required ? '<span class="badge badge-required">REQUIRED</span>' : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    ${result.incomplete.length > 0 ? `
      <h2>Incomplete Items (${result.incomplete.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Issues</th>
          </tr>
        </thead>
        <tbody>
          ${result.incomplete.map(item => `
            <tr>
              <td class="status-incomplete">${item.itemCode}</td>
              <td>${item.itemName}</td>
              <td>
                <ul class="issue-list">
                  ${item.issues.map(issue => `<li>${issue}</li>`).join('')}
                </ul>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    ${result.extra.length > 0 ? `
      <h2>Extra Items Not in OASIS-E1 Spec (${result.extra.length})</h2>
      <p style="color: #718096; margin-bottom: 15px;">These items exist in the database but are not part of the official OASIS-E1 specification. They may be legacy items or custom additions.</p>
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Section</th>
          </tr>
        </thead>
        <tbody>
          ${result.extra.map(item => `
            <tr>
              <td class="status-extra">${item.itemCode}</td>
              <td>${item.itemName}</td>
              <td>${item.section}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    <div class="recommendations">
      <h3>Recommendations</h3>
      <ul>
        ${result.missing.length > 0 ? `<li><strong>Add missing items:</strong> ${result.missing.length} OASIS-E1 items are missing from the database. Run the seed script to add them.</li>` : ''}
        ${result.incomplete.length > 0 ? `<li><strong>Complete item data:</strong> ${result.incomplete.length} items have incomplete data (missing response options or validation rules).</li>` : ''}
        ${result.missing.filter(m => m.required).length > 0 ? `<li><strong>Priority:</strong> ${result.missing.filter(m => m.required).length} missing items are marked as REQUIRED by CMS.</li>` : ''}
        ${result.missing.length === 0 && result.incomplete.length === 0 ? `<li><strong>Status: Complete!</strong> All OASIS-E1 items are present in the database with complete data.</li>` : ''}
      </ul>
    </div>

    <h2>Present Items (${result.present.length})</h2>
    <table>
      <thead>
        <tr>
          <th>Code</th>
          <th>Name</th>
          <th>Section</th>
        </tr>
      </thead>
      <tbody>
        ${result.present.map(item => `
          <tr>
            <td class="status-present">✓ ${item.code}</td>
            <td>${item.name}</td>
            <td><span class="badge badge-section">${item.section}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const prisma = new PrismaClient({ adapter });

  try {
    const result = await runAudit(prisma);

    // Print console report
    printConsoleReport(result);

    // Generate HTML report
    const htmlReport = generateHtmlReport(result);
    const reportPath = path.join(process.cwd(), 'oasis-audit-report.html');
    fs.writeFileSync(reportPath, htmlReport);
    console.log(`\n${colors.green}${colors.bold}HTML Report saved to:${colors.reset} ${reportPath}\n`);

    // Summary
    const requiredMissing = result.missing.filter(m => m.required);
    if (result.missing.length === 0) {
      console.log(`${colors.green}${colors.bold}✓ All OASIS-E1 items are present in the database!${colors.reset}\n`);
    } else {
      console.log(`${colors.yellow}${colors.bold}Action Required:${colors.reset}`);
      console.log(`  - ${result.missing.length} items need to be added to the database`);
      if (requiredMissing.length > 0) {
        console.log(`  - ${colors.red}${requiredMissing.length} of these are REQUIRED items${colors.reset}`);
      }
      console.log(`  - Run: ${colors.cyan}npx prisma db seed${colors.reset} to add missing items\n`);
    }

  } catch (error) {
    console.error(`${colors.red}Error running audit:${colors.reset}`, error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
