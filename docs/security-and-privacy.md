# Security, privacy, and threat model

This document defines the public package and local MCP security boundary. It is not a claim that every application embedding these libraries is secure.

## Assets

- Correct settlement, payout, odds, and ranking results.
- Integrity of the policy/table version and source metadata used for a decision.
- Availability of the local MCP process.
- Confidentiality of entries, bet history, identifiers, provider rows, and host environment data.
- Integrity and provenance of published npm and GitHub release artifacts.

## Trust boundaries

| Boundary | Trusted responsibility | Untrusted or caller-controlled data |
| --- | --- | --- |
| Application → core engine | Package code and selected configuration | Entry JSON, odds, bankroll values, stat rows, custom policies/providers |
| Data loader → `StatProvider` | Provider contract and runtime validator | Network/vendor response mapped by the caller |
| MCP client → stdio server | Packed server artifact and MCP SDK | JSON-RPC frames, strings, arrays, IDs, odds, entries, game/history data |
| npm/GitHub → local install | Reviewed release workflow, digest, `gitHead`, provenance | Registry/network delivery until verified |
| Engine result → user decision | Deterministic output for the supplied profile and data | Operator rules, displayed terms, and real-world rulings outside the engine |

The core engines trust neither caller input nor operator-named compatibility data as proof of a real operator outcome. Validate at system boundaries and retain the result's verification and provenance fields.

## Threats and controls

### Untrusted input and resource exhaustion

Runtime schemas reject non-finite numbers, invalid American odds, oversized strings and arrays, duplicate IDs where prohibited, and malformed DFS entries. The MCP stdio path rejects newline-delimited frames over 2 MiB, limits the process to 32 in-flight calls, caps serialized tool results at 1 MiB, and bounds validation detail.

These controls reduce accidental and opportunistic resource abuse; they are not a substitute for OS-level process isolation when accepting hostile multi-tenant traffic. The shipped transport is local stdio, not an authenticated network service.

### Error and protocol leakage

MCP protocol output is written to stdout and diagnostics are written to stderr. Public execution failures use generic error codes/messages; internal exception names, stack traces, paths, and raw error messages are not returned to tool callers. Invalid tool arguments return the same bounded `invalid_input` detail through real MCP transports and direct handlers, preventing SDK-generated validation text from bypassing response limits.

Do not add ordinary logs to stdout. They corrupt the stdio protocol and can expose host information.

### Data and privacy

The MCP server does not fetch live odds, box scores, operator accounts, or private user data. It requires no API key and has no application telemetry or persistence code. Inputs and results travel through the caller's local MCP host.

That does not make supplied data anonymous:

- DFS results can include provider provenance and raw supplied rows.
- History tools receive bet IDs, timestamps, stakes, payouts, and odds.
- The MCP host, terminal, crash reporter, or surrounding application may retain stdin, stdout, or stderr.

Use synthetic or minimized identifiers when possible. Do not send credentials, access tokens, account cookies, health data, or unrelated personal data. If an embedding application persists results, its privacy policy and access controls govern that copy.

### Prompt injection and command execution

The 11 tools expose fixed schemas and deterministic calculations. User strings are treated as data and are not executed as shell commands, file paths, URLs to fetch, or prompts for a model. The server itself has no filesystem or network tool.

An MCP host can expose other capabilities in the same session. Treat text echoed from entries or history as untrusted display content and do not pass it into a separate command/tool without that tool's own validation.

### Supply chain

Release proof must bind an npm artifact to the reviewed exact version, SHA-512 integrity, registry tarball origin, Git `gitHead`, and provenance attestation. CI uses packed-artifact real-client tests before publication, and the published proof runs in isolated temporary npm/home state with lifecycle scripts disabled.

Run `npm run audit:high` and `npm run verify` before release. An audit result is one signal, not proof that dependencies or the registry are uncompromised.

### Operator and financial risk

PrizePicks and Underdog are independent compatibility profiles, not official rules engines. PrizePicks is experimental/partial; Underdog is experimental/unverified; draft fixtures are non-executable. Displayed entry terms and explicit operator rulings are authoritative.

Odds, expected-value, Kelly, and settlement outputs are calculations from supplied assumptions. They are not financial, gambling, or legal advice and do not guarantee a payout.

## Deployment guidance

- Keep MCP on local stdio unless an embedding application adds its own authentication, authorization, rate limiting, TLS, request isolation, and audit policy.
- Pin `@buzzr/mcp@<published-version>` when repeatability matters.
- Run the server as a non-privileged user with the smallest environment and filesystem access the host permits.
- Do not place secrets in MCP configuration because Buzzr needs none.
- Review custom policy and provider code as trusted executable application code.

## Reporting

Report vulnerabilities and settlement-correctness issues through [`SECURITY.md`](../SECURITY.md). Avoid placing secrets, private slips, or exploit details in public issues.
