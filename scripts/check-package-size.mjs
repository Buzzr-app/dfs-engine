import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const engineRuntimeLimitBytes = 100 * 1024;
const betsCoreRuntimeLimitBytes = 40 * 1024;

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function packagePath(...parts) {
  return join(root, ...parts);
}

const packages = [
  {
    name: '@buzzr/dfs-engine',
    path: packagePath('packages', 'dfs-engine'),
    allowedDependencies: [],
    runtimeFiles: ['dist/index.js', 'dist/index.cjs'],
    maxRuntimeBytes: engineRuntimeLimitBytes,
  },
  {
    name: '@buzzr/bets-core',
    path: packagePath('packages', 'bets-core'),
    allowedDependencies: [],
    runtimeFiles: ['dist/index.js', 'dist/index.cjs'],
    maxRuntimeBytes: betsCoreRuntimeLimitBytes,
  },
  {
    name: '@buzzr/dfs-provider-espn',
    path: packagePath('packages', 'dfs-provider-espn'),
    allowedDependencies: ['@buzzr/dfs-engine'],
    runtimeFiles: ['dist/index.js', 'dist/index.cjs'],
  },
  {
    name: '@buzzr/dfs-testkit',
    path: packagePath('packages', 'dfs-testkit'),
    allowedDependencies: ['@buzzr/dfs-engine'],
    runtimeFiles: ['dist/index.js', 'dist/index.cjs'],
  },
  {
    name: '@buzzr/dfs-cli',
    path: packagePath('packages', 'dfs-cli'),
    allowedDependencies: ['@buzzr/dfs-engine'],
    runtimeFiles: ['dist/index.js', 'dist/cli.js'],
  },
  {
    name: '@buzzr/dfs-provider-sportradar',
    path: packagePath('packages', 'dfs-provider-sportradar'),
    allowedDependencies: ['@buzzr/dfs-engine'],
    runtimeFiles: ['dist/index.js', 'dist/index.cjs'],
  },
  {
    name: '@buzzr/dfs-react',
    path: packagePath('packages', 'dfs-react'),
    allowedDependencies: ['@buzzr/dfs-engine'],
    runtimeFiles: ['dist/index.js', 'dist/index.cjs'],
  },
  {
    name: '@buzzr/dfs-engine-test-vectors',
    path: packagePath('packages', 'dfs-engine-test-vectors'),
    allowedDependencies: ['@buzzr/dfs-engine'],
    runtimeFiles: ['dist/index.js', 'dist/index.cjs'],
  },
];

for (const pkg of packages) {
  const manifest = readJson(join(pkg.path, 'package.json'));
  const dependencyNames = Object.keys(manifest.dependencies ?? {}).sort();
  const allowedDependencies = [...pkg.allowedDependencies].sort();

  assert(
    JSON.stringify(dependencyNames) === JSON.stringify(allowedDependencies),
    `${pkg.name} runtime dependencies drifted: expected ${allowedDependencies.join(', ') || 'none'}, got ${dependencyNames.join(', ') || 'none'}`,
  );

  for (const file of pkg.runtimeFiles) {
    const bytes = statSync(join(pkg.path, file)).size;
    if (pkg.maxRuntimeBytes) {
      assert(
        bytes <= pkg.maxRuntimeBytes,
        `${pkg.name} ${file} is ${bytes} bytes, over the ${pkg.maxRuntimeBytes} byte budget`,
      );
    }
    console.log(`${pkg.name} ${file}: ${bytes} bytes`);
  }
}

console.log('Package size and runtime dependency budgets passed.');
