# Operator compatibility and safety

Buzzr is independent open-source software. Built-in operator-named policies are versioned compatibility profiles, not official rules engines and not evidence of affiliation or endorsement.

## Before grading

1. Record the entry's placed timestamp and displayed payout or multiplier.
2. Call `list_book_policies` and confirm the exact policy/play type is executable.
3. Inspect its status, version, effective date, verification metadata, and source references.
4. Prefer the entry's displayed terms when they differ from a built-in table.
5. Obtain explicit operator rulings for DNPs, reboots, ties, rescues, voids, and stat corrections. Do not infer them from a box score alone.
6. Treat draft fixtures as metadata only. They must never be graded through the public MCP server.

## Interpret confidence

- `high` describes deterministic execution under the selected profile; it does not certify current official operator behavior.
- A verification cap, experimental profile, missing source, or warning lowers the conclusion that can be stated.
- `pending` means the engine lacks required evidence or cannot safely apply a policy.
- A payout-table source proves what data the engine used, not what an operator will pay.

When money or a dispute is involved, tell the user to compare the result with the entry details and the operator's current terms. Present calculations as an audit aid, not legal or financial advice.
