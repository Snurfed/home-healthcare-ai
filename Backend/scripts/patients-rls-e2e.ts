/**
 * Proves the patients endpoints are genuinely tenant-scoped, with the whole
 * application connected as the restricted role.
 *
 * Seeds two agencies, then checks that a clinician in one can list and read
 * their own patients and cannot reach the other's — over real HTTP, through the
 * real auth middleware.
 *
 * Requires the server running with DATABASE_URL pointed at hha_app.
 */
import * as dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient, UserRole, UserStatus } from '../src/generated/prisma';

dotenv.config();

const BASE = `http://localhost:${process.env['PORT'] ?? 3000}`;
const OWNER = process.env['OWNER_DATABASE_URL'];
const A = 'e2e-patients-a';
const B = 'e2e-patients-b';

const pool = new Pool({ connectionString: OWNER });
const admin = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  if (!OWNER) throw new Error('OWNER_DATABASE_URL must point at the owner connection for seeding');
  const secret = process.env['JWT_ACCESS_SECRET'];
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not set');

  // Seed as the owner, which is not policy-bound.
  const clinician = await admin.user.upsert({
    where: { email: 'e2e-pt-a@example.test' },
    update: { agencyId: A, status: UserStatus.ACTIVE, role: UserRole.ADMIN },
    create: {
      email: 'e2e-pt-a@example.test', passwordHash: 'x', firstName: 'Ana', lastName: 'Reyes',
      role: UserRole.ADMIN, status: UserStatus.ACTIVE, agencyId: A,
    },
  });

  const mine = await admin.patient.create({
    data: { agencyId: A, mrn: `E2E-A-${Date.now()}`, firstName: 'Own', lastName: 'Patient',
            dateOfBirth: new Date('1950-01-01'), gender: 'FEMALE',
            addressStreet1: '1 Test Way', addressCity: 'Honolulu', addressState: 'HI',
            addressZipCode: '96815', phoneMobile: '808-555-0100' },
  });
  const theirs = await admin.patient.create({
    data: { agencyId: B, mrn: `E2E-B-${Date.now()}`, firstName: 'Other', lastName: 'Agency',
            dateOfBirth: new Date('1950-01-01'), gender: 'FEMALE',
            addressStreet1: '1 Test Way', addressCity: 'Honolulu', addressState: 'HI',
            addressZipCode: '96815', phoneMobile: '808-555-0100' },
  });

  const token = jwt.sign(
    { userId: clinician.id, email: clinician.email, role: clinician.role, type: 'access' },
    secret,
    { expiresIn: '15m', issuer: 'home-health-care-ai-assistant', audience: 'home-health-care-api' }
  );

  const api = async (path: string) => {
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* ignore */ }
    return { status: res.status, json, text };
  };

  let failures = 0;
  const check = (label: string, ok: boolean, detail = '') => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `\n        ${detail}` : ''}`);
    if (!ok) failures++;
  };

  console.log('patients endpoints, app running as hha_app');
  console.log('─'.repeat(72));

  const list = await api('/api/patients?limit=100');
  const ids: string[] = (list.json?.data ?? list.json?.patients ?? []).map((p: any) => p.id);
  check('list returns 200', list.status === 200, `got ${list.status} ${list.text.slice(0, 120)}`);
  check('own patient appears in the list', ids.includes(mine.id));
  check("other agency's patient does not", !ids.includes(theirs.id),
        ids.includes(theirs.id) ? 'LEAK: cross-tenant row returned' : '');

  const own = await api(`/api/patients/${mine.id}`);
  check('own patient readable by id', own.status === 200, `got ${own.status}`);

  const other = await api(`/api/patients/${theirs.id}`);
  check("other agency's patient is 404, not 200", other.status === 404,
        other.status === 200 ? 'LEAK: cross-tenant read succeeded' : `got ${other.status}`);

  console.log('\n' + (failures ? `${failures} FAILED` : 'ALL PASSED'));
  if (failures) process.exitCode = 1;
}

main()
  .catch((e) => { console.error('\nFAILED:', e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(async () => {
    await admin.patient.deleteMany({ where: { agencyId: { in: [A, B] } } });
    await admin.user.deleteMany({ where: { email: 'e2e-pt-a@example.test' } });
    await admin.$disconnect();
    await pool.end();
  });
