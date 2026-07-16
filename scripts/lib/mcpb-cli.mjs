import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const allowedCommands = new Set(['info', 'pack', 'unpack', 'validate']);

export const MCPB_CLI_PACKAGE = '@anthropic-ai/mcpb@2.1.2';

export async function runMcpb(args, options = {}) {
  assert(Array.isArray(args) && args.length > 0, 'MCPB arguments are required');
  assert(allowedCommands.has(args[0]), `Unsupported MCPB command: ${args[0]}`);
  assert(
    args.every((argument) => typeof argument === 'string'),
    'MCPB arguments must be strings',
  );

  const npmArgs = ['exec', '--yes', '--package', MCPB_CLI_PACKAGE, '--', 'mcpb', ...args];
  const command = process.env.npm_execpath
    ? { executable: process.execPath, args: [process.env.npm_execpath, ...npmArgs] }
    : { executable: process.platform === 'win32' ? 'npm.cmd' : 'npm', args: npmArgs };

  return execFileAsync(command.executable, command.args, {
    cwd: options.cwd,
    maxBuffer: options.maxBuffer ?? 20 * 1024 * 1024,
    env: {
      ...process.env,
      NO_COLOR: '1',
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      npm_config_ignore_scripts: 'true',
      npm_config_update_notifier: 'false',
      ...options.env,
    },
  });
}
