import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const skillName = 'buzzr-sports-engine';
const sourceSkill = resolve(root, 'skills', skillName);
const officialValidator = resolve(root, 'scripts/vendor/openai-skill-creator/quick_validate.py');
const expectedValidatorHash = '6cc9dc3199c935916cf6f73fcbbbb0e3bb1b58c8f5109fefa499978908164f51';

function commandResult(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CI: '1', DO_NOT_TRACK: '1', NO_COLOR: '1' },
    ...options,
  });
}

function findPython() {
  const candidates = process.env.PYTHON
    ? [[process.env.PYTHON, []]]
    : process.platform === 'win32'
      ? [
          ['py', ['-3']],
          ['python', []],
          ['python3', []],
        ]
      : [
          ['python3', []],
          ['python', []],
        ];
  for (const [command, prefix] of candidates) {
    if (commandResult(command, [...prefix, '-c', 'import yaml']).status === 0) {
      return { command, prefix };
    }
  }
  throw new Error('Python with PyYAML is required to run the official skill validator.');
}

const validatorBytes = await readFile(officialValidator);
assert.equal(
  createHash('sha256').update(validatorBytes).digest('hex'),
  expectedValidatorHash,
  'Vendored quick_validate.py must match the pinned official OpenAI skill-creator validator.',
);

const python = findPython();
const validation = commandResult(python.command, [
  ...python.prefix,
  officialValidator,
  sourceSkill,
]);
assert.equal(
  validation.status,
  0,
  `Official quick_validate.py failed:\n${validation.stdout}${validation.stderr}`,
);
assert.match(validation.stdout, /Skill is valid!/);

const skillsManifest = JSON.parse(
  await readFile(resolve(root, 'node_modules/skills/package.json'), 'utf8'),
);
assert.equal(skillsManifest.version, '1.5.17');
const skillsCli = resolve(root, 'node_modules/skills', skillsManifest.bin.skills);
await access(skillsCli);

const temporaryProject = await mkdtemp(join(tmpdir(), 'buzzr-skill-proof-'));
try {
  await writeFile(
    join(temporaryProject, 'package.json'),
    `${JSON.stringify({ name: 'buzzr-skill-proof', private: true }, null, 2)}\n`,
  );
  const install = commandResult(
    process.execPath,
    [skillsCli, 'add', root, '--skill', skillName, '--agent', 'codex', '--yes', '--copy'],
    { cwd: temporaryProject },
  );
  assert.equal(
    install.status,
    0,
    `Isolated one-command skill install failed:\n${install.stdout}${install.stderr}`,
  );

  const installedSkill = resolve(temporaryProject, '.agents/skills', skillName);
  const files = [
    'SKILL.md',
    'agents/openai.yaml',
    'references/mcp-tools.md',
    'references/operator-safety.md',
  ];
  for (const path of files) {
    assert.equal(
      await readFile(resolve(installedSkill, path), 'utf8'),
      await readFile(resolve(sourceSkill, path), 'utf8'),
      `Installed ${path} must match the repository source byte-for-byte.`,
    );
    assert.equal((await lstat(resolve(installedSkill, path))).isSymbolicLink(), false);
  }

  const lock = JSON.parse(await readFile(resolve(temporaryProject, 'skills-lock.json'), 'utf8'));
  assert.equal(lock.version, 1);
  assert.equal(lock.skills?.[skillName]?.sourceType, 'local');
  assert.equal(resolve(lock.skills[skillName].source), resolve(root));
  assert.match(lock.skills[skillName].computedHash, /^[a-f0-9]{64}$/);
} finally {
  await rm(temporaryProject, { recursive: true, force: true });
}

process.stdout.write(
  'Buzzr skill passed the pinned official quick_validate.py and isolated skills@1.5.17 local install proof.\n',
);
