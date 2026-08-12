/**
 * Verifies every model id in src/config/models.ts still exists, and that no
 * service has smuggled a literal back in.
 *
 * Wire into CI. A retired model should break a build, not a patient visit —
 * which is exactly how the previous ids went unnoticed.
 *
 * Run:  npx tsx scripts/check-models.ts
 */
import { execSync } from 'node:child_process';

import * as dotenv from 'dotenv';

import { MODELS, modelIdsInUse } from '../src/config/models';

dotenv.config();

async function main() {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set.');
    process.exit(1);
  }

  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
  });
  if (!res.ok) {
    console.error(`Could not list models: ${res.status}`);
    process.exit(1);
  }

  const available = new Set(
    ((await res.json()) as { data: Array<{ id: string }> }).data.map((m) => m.id)
  );

  let failed = false;

  console.log('Configured models');
  console.log('─'.repeat(60));
  for (const [role, id] of Object.entries(MODELS)) {
    const ok = available.has(id);
    if (!ok) failed = true;
    console.log(`  ${ok ? 'OK    ' : 'GONE  '} ${role.padEnd(12)} ${id}`);
  }

  // A literal in a service is how the last rot happened, so fail on it too.
  console.log('\nHard-coded model ids outside the config');
  console.log('─'.repeat(60));
  const hits = grepLiterals();
  if (hits.length === 0) {
    console.log('  none');
  } else {
    failed = true;
    for (const line of hits) console.log(`  ${line}`);
  }

  if (failed) {
    console.error('\nFAILED — fix src/config/models.ts or the offending literal.');
    process.exit(1);
  }
  console.log(`\nOK — ${modelIdsInUse().length} distinct models, all available.`);
}

function grepLiterals(): string[] {
  try {
    const out = execSync(
      `grep -rn "claude-[a-zA-Z0-9.-]*" src --include=*.ts ` +
        `| grep -v "src/generated/" | grep -v "src/config/models.ts"`,
      { encoding: 'utf8', shell: '/bin/bash' }
    );
    return out.trim().split('\n').filter(Boolean);
  } catch {
    // grep exits 1 when nothing matches, which is the good case.
    return [];
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
