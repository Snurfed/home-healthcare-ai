/**
 * Per-transaction tenant scoping.
 *
 * Row-level security policies read `app.current_agency_id`. This module is the
 * only place that setting is written, and it is written with SET LOCAL so it
 * expires with the transaction — a pooled connection can never carry one
 * agency's identity into the next request.
 *
 * The policies fail closed: with nothing set, every tenant-scoped query returns
 * zero rows and every insert is refused. That is the intended behaviour. Code
 * that forgets to scope gets an obvious empty result, not somebody else's chart.
 */
import { Prisma, PrismaClient } from '../generated/prisma';

/** A Prisma client bound to an open transaction. */
export type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantScopeError';
  }
}

/**
 * An agency id must be safe to interpolate. set_config is parameterised below,
 * so this is defence in depth rather than the only guard — but a tenant id
 * arriving from a request is exactly the value worth being strict about.
 */
const AGENCY_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Run `fn` with the tenant applied for the life of one transaction.
 *
 * Every read and write inside is filtered by Postgres, not by application
 * code — including any query a future contributor forgets to scope.
 */
export async function withTenant<T>(
  prisma: PrismaClient,
  agencyId: string,
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  if (!AGENCY_ID.test(agencyId)) {
    throw new TenantScopeError(`Invalid agency id: ${JSON.stringify(agencyId)}`);
  }

  return prisma.$transaction(async (tx) => {
    // set_config(..., true) is transaction-local: it unwinds on commit or
    // rollback, so it cannot leak across a pooled connection.
    await tx.$executeRaw`SELECT set_config('app.current_agency_id', ${agencyId}, true)`;
    return fn(tx);
  });
}

/**
 * The tenant currently in force, or null. Intended for assertions and tests —
 * application code should not branch on this.
 */
export async function currentTenant(tx: TxClient): Promise<string | null> {
  const rows = await tx.$queryRaw<Array<{ agency: string | null }>>(
    Prisma.sql`SELECT current_setting('app.current_agency_id', true) AS agency`
  );
  const value = rows[0]?.agency;
  return value === undefined || value === '' ? null : value;
}
