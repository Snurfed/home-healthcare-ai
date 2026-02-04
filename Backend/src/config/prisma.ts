import { PrismaClient } from '../generated/prisma';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// ===========================================
// DATABASE CONFIGURATION
// ===========================================

const connectionString = process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'home_health_care_db'}`;

// ===========================================
// PRISMA CLIENT SINGLETON
// ===========================================

let prisma: PrismaClient;

function createPrismaClient(): PrismaClient {
  // For development without a database, use a mock or skip adapter
  if (process.env.SKIP_DB === 'true') {
    console.warn('[Prisma] Running without database connection (SKIP_DB=true)');
    return new PrismaClient();
  }

  try {
    // Create PostgreSQL connection pool
    const pool = new Pool({
      connectionString,
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Create Prisma adapter
    const adapter = new PrismaPg(pool);

    // Create Prisma client with adapter
    return new PrismaClient({ adapter });
  } catch (error) {
    console.error('[Prisma] Failed to initialize with adapter, falling back to direct connection');
    console.error(error);

    // Fallback - may not work in Prisma 7 without proper setup
    return new PrismaClient();
  }
}

// Use singleton pattern to prevent multiple instances
if (process.env.NODE_ENV === 'production') {
  prisma = createPrismaClient();
} else {
  // In development, use global to preserve client across hot reloads
  const globalWithPrisma = global as typeof globalThis & {
    prisma: PrismaClient | undefined;
  };

  if (!globalWithPrisma.prisma) {
    globalWithPrisma.prisma = createPrismaClient();
  }
  prisma = globalWithPrisma.prisma;
}

// ===========================================
// EXPORTS
// ===========================================

export { prisma };
export default prisma;
