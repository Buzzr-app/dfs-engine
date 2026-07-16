# @buzzr/dfs-react

[![npm version](https://img.shields.io/npm/v/@buzzr/dfs-react)](https://www.npmjs.com/package/@buzzr/dfs-react)
[![npm downloads](https://img.shields.io/npm/dm/@buzzr/dfs-react)](https://www.npmjs.com/package/@buzzr/dfs-react)
[![CI](https://github.com/Buzzr-app/dfs-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/Buzzr-app/dfs-engine/actions/workflows/ci.yml)
[![types](https://img.shields.io/npm/types/@buzzr/dfs-react)](https://www.npmjs.com/package/@buzzr/dfs-react)
[![license](https://img.shields.io/npm/l/@buzzr/dfs-react)](https://github.com/Buzzr-app/dfs-engine/blob/main/LICENSE)

**Turn a raw settlement result into a render-ready view-model in one call.** [`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine) is headless — it hands you a `DfsSettlementResult` with no opinion on display. This package projects that result into pre-formatted labels, currency strings, and status tones your UI can map straight to markup — in React, Vue, Svelte, or vanilla HTML.

Despite the name, this package has **zero React runtime dependency**. The name signals its primary consumer audience; the code is pure TypeScript formatting functions.

## Install

```bash
npm install @buzzr/dfs-react @buzzr/dfs-engine
```

## 30-second quick start

```tsx
import { getSlipDisplayModel } from '@buzzr/dfs-react';
import type { DfsSettlementResult } from '@buzzr/dfs-engine';

function SlipCard({ result }: { result: DfsSettlementResult }) {
  const model = getSlipDisplayModel(result);
  // model.statusLabel  -> "won"
  // model.tone         -> "win"        (win | loss | push | pending | void)
  // model.multiplierLabel -> "3.00x"
  // model.payoutLabel  -> "$30.00"
  // model.stakeLabel   -> "$10.00"
  return (
    <div data-tone={model.tone}>
      <header>
        {model.statusLabel} · {model.multiplierLabel} · {model.payoutLabel}
      </header>
      <ul>
        {model.legs.map((leg) => (
          <li key={leg.legId} data-tone={leg.tone}>
            {leg.label} {leg.line}
            {leg.actual !== null && <span> · actual {leg.actual}</span>}
            {leg.pendingReason && <span> · {leg.pendingReason}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Each leg comes back as `"Jayson Tatum — Points"` (`label`) with an `"o26.5"` / `"u26.5"` line (`line`), its outcome status, a display tone, and the actual stat value if graded.

## API

| Export                  | Purpose                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| `getSlipDisplayModel()` | Project a `DfsSettlementResult` into a `SlipDisplayModel`                  |
| `getStatusTone()`       | Map an engine status string to a `SlipStatusTone`                          |
| `formatLegLabel()`      | Render `"{Player} — {PropType}"`                                           |
| `formatLegLine()`       | Render `"o26.5"` / `"u26.5"`                                               |
| `SlipDisplayModel`      | Type: slip-level labels, tone, and formatted stake/payout/multiplier       |
| `LegDisplayModel`       | Type: per-leg label, line, status, tone, actual value, and pending reason  |
| `SlipStatusTone`        | Type: `'win' \| 'loss' \| 'push' \| 'pending' \| 'void'`                   |

## When to use this vs siblings

| You want to…                                     | Reach for                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| Format settlement results for any UI layer       | **this package**                                                          |
| Produce the settlement results in the first place | [`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine)   |
| Grade entries from the command line              | [`@buzzr/dfs-cli`](https://www.npmjs.com/package/@buzzr/dfs-cli)         |
| Build settlement fixtures for tests              | [`@buzzr/dfs-testkit`](https://www.npmjs.com/package/@buzzr/dfs-testkit) |

## Links

- [All-package API index](../../docs/api-reference.md)
- [Generated root-export reference](https://buzzr-app.github.io/dfs-engine/modules/_buzzr_dfs-react.html)
- [Monorepo & full package family](https://github.com/Buzzr-app/dfs-engine)
- [Issues](https://github.com/Buzzr-app/dfs-engine/issues)

## Compatibility and support

Node.js >= 22 is supported. Import the supported API from `@buzzr/dfs-react`.
Deep `src/*` and `dist/*` imports are unsupported. This package has no React
runtime dependency, but it does depend on the compatible `@buzzr/dfs-engine`
range declared in its package manifest.

Report vulnerabilities privately through [SECURITY.md](../../SECURITY.md). The
[versioning and support policy](../../docs/versioning-and-support.md) defines the
supported runtime and SemVer contract.

## License

[MIT](../../LICENSE)
