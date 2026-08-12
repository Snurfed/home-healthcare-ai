/**
 * Every route module that touches patient data must declare its own
 * authentication.
 *
 * Regression origin: visitNotes, formEngine and emrExport declared none. They
 * appeared protected because proposals.routes.ts used router.use(authenticate)
 * and was mounted at a bare /api ahead of them, so its blanket middleware ran
 * for requests belonging to other routers. Reordering the mounts — or deleting
 * that one router — would have made three modules public, and nothing would
 * have failed.
 *
 * This reads the source rather than the running app on purpose: it is the
 * declaration that must be present, not merely the observable behaviour, which
 * is what made the gap invisible.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROUTES_DIR = join(__dirname, '../../src/routes');

/**
 * Modules that legitimately serve unauthenticated traffic. Each needs a reason.
 */
const PUBLIC: Record<string, string> = {
  'auth.ts': 'login and token refresh are the routes that issue authentication',
};

function routeFiles(): string[] {
  return readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.ts'));
}

describe('route authentication', () => {
  it('every non-public route module references authenticate', () => {
    const undeclared = routeFiles()
      .filter((f) => !(f in PUBLIC))
      .filter((f) => !readFileSync(join(ROUTES_DIR, f), 'utf8').includes('authenticate'));

    expect(undeclared).toEqual([]);
  });

  it('the public list has not gone stale', () => {
    const files = new Set(routeFiles());
    expect(Object.keys(PUBLIC).filter((f) => !files.has(f))).toEqual([]);
  });

  it('no router mounted at a bare /api applies a blanket authenticate', () => {
    // A blanket in one such router runs for requests destined for routers
    // mounted after it, which is how the gap above was hidden. Per-route
    // middleware keeps each module responsible for itself.
    const index = readFileSync(join(__dirname, '../../src/index.ts'), 'utf8');

    const bareApiRouters = [...index.matchAll(/app\.use\('\/api',\s*(\w+)\)/g)].map((m) => m[1]);
    expect(bareApiRouters.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const importName of bareApiRouters) {
      const importLine = index.match(
        new RegExp(`import\\s+${importName}\\s+from\\s+'\\./routes/([\\w.-]+)'`)
      );
      if (!importLine) continue;

      const file = `${importLine[1]}.ts`;
      let source: string;
      try {
        source = readFileSync(join(ROUTES_DIR, file), 'utf8');
      } catch {
        continue;
      }
      if (/^router\.use\(authenticate\)/m.test(source)) offenders.push(file);
    }

    expect(offenders).toEqual([]);
  });
});
