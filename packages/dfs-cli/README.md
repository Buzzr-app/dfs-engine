# @buzzr/dfs-cli

Command-line wrapper around [`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine).
Grade a DFS entry from JSON fixtures without writing any TypeScript.

## Install

```bash
npm install -g @buzzr/dfs-cli
```

## Usage

```bash
dfs-grade ./entry.json --gamelogs ./gamelogs.json
```

`entry.json` is a `DfsEntryInput`. `gamelogs.json` is a map of `legId` to an
array of `PlayerGameLogEntryShape` rows. The settlement result is printed to
stdout as pretty JSON; non-zero exit code on any error.

## Programmatic API

```ts
import { runGrade } from '@buzzr/dfs-cli';

const result = await runGrade({
  entry,
  gameLogsByLegId: { 'leg-1': [gameLogRow] },
});
```

## License

MIT
