# Security Policy

## Reporting Settlement Or Security Issues

Please report security-sensitive issues privately before opening a public issue.

This includes:

- Incorrect settlement outcomes that could affect payouts.
- Book policy bugs that mis-grade ties, pushes, DNPs, rescues, or payout splits.
- Provider parsing bugs involving private user data.
- Any secret, credential, or token exposure in package code, examples, docs, or CI.

Email Sarvesh directly or use a private GitHub security advisory if one is available for the repository. Include:

- A minimal reproduction.
- Package version and Node version.
- Book policy, play type, and policy version.
- Redacted provider payloads or fixture data.
- Expected vs. actual settlement result.

Do not include real user identifiers, betting account credentials, API keys, or unredacted sportsbook payloads.

## Supported Versions

Security and settlement-correctness fixes target the latest major release first. Older major versions may receive fixes when the patch is low-risk and does not change public API contracts.
