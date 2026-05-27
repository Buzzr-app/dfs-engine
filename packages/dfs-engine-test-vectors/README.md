# @buzzr/dfs-engine-test-vectors

Canonical reference fixtures for [`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine).

Each vector is a `{ entry, gameLogsByLegId, expected }` triple that has been
verified against the engine in this package's own tests. External integrators
who wire their own stat providers or settlement pipelines can replay these
vectors to prove their setup grades identically to Buzzr's.

## Install

```bash
npm install --save-dev @buzzr/dfs-engine-test-vectors @buzzr/dfs-engine
```

## Usage

```ts
import { describe, expect, test } from 'vitest';
import { createDfsEngine, defineStatProvider } from '@buzzr/dfs-engine';
import { TEST_VECTORS } from '@buzzr/dfs-engine-test-vectors';

describe('my-integration', () => {
  test('grades canonical vectors identically to Buzzr', async () => {
    for (const v of TEST_VECTORS) {
      const provider = defineStatProvider({
        id: 'mine',
        getGameLog: ({ leg }) => v.gameLogsByLegId[leg.legId] ?? [],
      });
      const engine = createDfsEngine({ statProviders: [provider] });
      const result = await engine.settleEntry(v.entry, { statProviderId: 'mine' });
      expect(result.status).toBe(v.expected.status);
    }
  });
});
```

## License

MIT
