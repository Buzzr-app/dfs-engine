import { runGradeFromFiles } from './index';

type ParsedArgs = {
  entryPath: string | null;
  gameLogsPath: string | null;
  showHelp: boolean;
};

function parseArgs(argv: readonly string[]): ParsedArgs {
  const out: ParsedArgs = { entryPath: null, gameLogsPath: null, showHelp: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      out.showHelp = true;
    } else if (arg === '--gamelogs' || arg === '-g') {
      out.gameLogsPath = argv[i + 1] ?? null;
      i += 1;
    } else if (!arg.startsWith('-') && !out.entryPath) {
      out.entryPath = arg;
    }
  }
  return out;
}

const HELP = `dfs-grade <entry.json> --gamelogs <gamelogs.json>

  Grades a DFS entry using @buzzr/dfs-engine and prints the settlement as JSON.

  <entry.json>           Path to a DfsEntryInput JSON file.
  --gamelogs, -g <path>  Path to a JSON map of legId -> PlayerGameLogEntryShape[].
  -h, --help             Show this help.`;

export async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv);
  if (args.showHelp || !args.entryPath || !args.gameLogsPath) {
    process.stdout.write(`${HELP}\n`);
    return args.showHelp ? 0 : 1;
  }
  try {
    const result = await runGradeFromFiles({
      entryPath: args.entryPath,
      gameLogsPath: args.gameLogsPath,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`dfs-grade: ${message}\n`);
    return 1;
  }
}

const isDirectInvocation =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (isDirectInvocation) {
  const code = await main(process.argv.slice(2));
  process.exit(code);
}
