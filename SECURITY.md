# Security policy

## Supported versions

Security fixes are provided for the latest published DialGlide extension and DialGlide Core versions.

## Report a vulnerability privately

Do not disclose a suspected vulnerability in a public issue, discussion, review, or pull request.

Use one of these private channels:

- GitHub private vulnerability report: `https://github.com/receive-sms-live/dialglide/security/advisories/new`
- Email: `support@receive-smss.live`

Include the affected version, reproduction steps, expected impact, and the minimum proof-of-concept material necessary. Do not include real users' page content, phone numbers, credentials, browser profiles, or customer data.

## Security design

- No developer-operated backend, remote code, analytics, advertising, telemetry, or account cookies.
- No required host permissions.
- Optional access is requested one origin at a time after a user action.
- Custom dialer templates reject executable and unencrypted remote URL schemes.
- User-controlled template values are URL encoded.
- Stored settings and message senders are validated before use.
- Webpage UI is isolated in a closed Shadow DOM.
