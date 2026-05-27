# @buzzr/dfs-react

Framework-agnostic display helpers for rendering settlements from
[`@buzzr/dfs-engine`](https://www.npmjs.com/package/@buzzr/dfs-engine).

`@buzzr/dfs-engine` is headless — it gives you a `DfsSettlementResult` but no
opinion on how to display it. This package turns that result into a tidy
view-model your UI layer can render in React, Vue, Svelte, or vanilla HTML,
without bringing a framework runtime as a dependency.

## Install

```bash
npm install @buzzr/dfs-react @buzzr/dfs-engine
```

## Usage

```tsx
import { getSlipDisplayModel } from '@buzzr/dfs-react';

function SlipCard({ result }) {
  const model = getSlipDisplayModel(result);
  return (
    <div data-tone={model.tone}>
      <header>{model.statusLabel} · {model.multiplierLabel} · {model.payoutLabel}</header>
      <ul>
        {model.legs.map((leg) => (
          <li key={leg.legId} data-tone={leg.tone}>
            {leg.label} {leg.line}
            {leg.actual !== null && <span> · actual {leg.actual}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Exports

| Function                  | Purpose                                                       |
| ------------------------- | ------------------------------------------------------------- |
| `getSlipDisplayModel()`   | Project a `DfsSettlementResult` into a view-model             |
| `getStatusTone()`         | Map an engine status string to a display tone                 |
| `formatLegLabel()`        | Render `"{Player} — {PropType}"`                              |
| `formatLegLine()`         | Render `"o24.5"` / `"u24.5"`                                  |

Despite the name, this package has no React runtime dependency. The name
signals its primary consumer audience.

## License

MIT
