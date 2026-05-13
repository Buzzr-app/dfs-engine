import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const root = new URL('..', import.meta.url).pathname;

const packages = [
  {
    name: '@buzzr/dfs-engine',
    path: 'packages/dfs-engine',
    exports: ['gradeLegFromActual', 'createDfsEngine', 'defineBookPolicy'],
  },
  {
    name: '@buzzr/bets-core',
    path: 'packages/bets-core',
    exports: ['normalizeSportsbookSlug', 'calculateNoVigFairLine', 'betRecordToDfsEntryInput'],
  },
  {
    name: '@buzzr/dfs-provider-espn',
    path: 'packages/dfs-provider-espn',
    exports: ['createEspnStatProvider'],
  },
  {
    name: '@buzzr/dfs-testkit',
    path: 'packages/dfs-testkit',
    exports: ['makeDfsEntry', 'createMockStatProvider'],
  },
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const pkg of packages) {
  const esm = await import(join(root, pkg.path, 'dist/index.js'));
  const cjs = require(join(root, pkg.path, 'dist/index.cjs'));

  for (const exportName of pkg.exports) {
    assert(typeof esm[exportName] !== 'undefined', `${pkg.name} ESM export missing: ${exportName}`);
    assert(typeof cjs[exportName] !== 'undefined', `${pkg.name} CJS export missing: ${exportName}`);
  }

  console.log(`${pkg.name}: ESM/CJS export smoke passed`);
}
