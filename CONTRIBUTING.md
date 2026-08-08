# Contributing to DialGlide

Thank you for helping improve DialGlide.

## Before opening an issue

- Search existing issues first.
- Use a current Chrome release on a regular webpage.
- Remove all personal or confidential information from examples.
- Never post credentials, tokens, browser profiles, real phone numbers, private webpage content, or customer data.
- Report security problems privately according to [SECURITY.md](SECURITY.md).

Use reserved fictional numbers in public examples. Suitable ranges include North American `+1 202 555 0100` through `+1 202 555 0199` and UK `+44 20 7946 0000` through `+44 20 7946 0999`.

## Development workflow

1. Fork the repository and create a focused branch.
2. Install dependencies with `npm ci`.
3. Make a small, documented change.
4. Add or update tests.
5. Run `npm run verify` and `npm run pack:core`.
6. Open a pull request describing the behavior and privacy impact.

## Extension requirements

- Keep the extension's single purpose narrow and clear.
- Do not add analytics, advertising, telemetry, accounts, remote code, or publisher-operated APIs.
- Do not broaden required permissions without a documented functional need and a privacy review.
- Keep website access optional and user-controlled per origin.
- Ensure English and Arabic behavior remain equivalent.

## Code style

- Use TypeScript with strict checks.
- Prefer small pure functions for reusable logic.
- Avoid unrelated formatting changes.
- Document externally visible behavior and privacy changes.

By contributing, you agree that your contributions are licensed under the Mozilla Public License 2.0.
