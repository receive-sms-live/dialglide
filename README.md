# DialGlide

[![CI](https://github.com/receive-sms-live/dialglide/actions/workflows/ci.yml/badge.svg)](https://github.com/receive-sms-live/dialglide/actions/workflows/ci.yml)
[![MPL-2.0](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](LICENSE)

DialGlide is a privacy-first, provider-neutral Click-to-Call Chrome extension. It finds phone numbers on regular webpages and lets the user call, message, copy, or open them in a configured dialer.

The repository also contains **DialGlide Core**, a reusable JavaScript and TypeScript package for phone-number discovery, normalization, formatting, and deduplication.

- Product: [receive-smss.live/tools/dialglide](https://receive-smss.live/tools/dialglide/)
- Privacy policy: [receive-smss.live/tools/dialglide/privacy](https://receive-smss.live/tools/dialglide/privacy/)
- Support: [receive-smss.live/tools/dialglide/support](https://receive-smss.live/tools/dialglide/support/)

## Privacy and security

- Phone-number detection and formatting happen locally.
- No account system, analytics, advertising, telemetry, or remote code.
- Temporary `activeTab` access is used after a user action.
- Optional website access is requested one origin at a time only when the user enables automatic detection for that site.
- Current-tab results use Chrome session storage; settings and explicitly enabled origins use Chrome local storage.
- Custom URL templates allow only HTTPS or supported dialer schemes.

See [the privacy policy](docs/PRIVACY_POLICY.md), [permission explanations](docs/PERMISSIONS.md), and [security policy](SECURITY.md).

## Extension features

- Click-to-call, click-to-message, and copy actions.
- Chrome side panel with deduplicated results and short page context.
- English and Arabic interfaces with RTL support.
- Latin, Arabic, Persian, and full-width digit normalization.
- Local and international phone-number recognition.
- System phone, SMS, SIP, copy-only, and secure custom handlers.
- Right-click actions, per-site automatic activation, and a local blocklist.

## Development

Requirements: Node.js 22 or newer and npm.

```sh
npm ci
npm run verify
```

The unpacked extension is generated in `dist/`. Load that directory from `chrome://extensions` using **Load unpacked**.

## DialGlide Core

The package source is in [`packages/core`](packages/core). After publication it can be installed with:

```sh
npm install dialglide
```

```ts
import { findPhoneMatches, normalizeDigits, parsePhoneInput } from "dialglide";

normalizeDigits("٢٠٢ ٥٥٥ ٠١٤٧");
// "202 555 0147"

parsePhoneInput("٢٠٢ ٥٥٥ ٠١٤٧", "US")?.e164;
// "+12025550147"

findPhoneMatches("Call +1 202 555 0147", "US");
```

All phone numbers used in public tests and documentation are reserved fictional examples.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Do not include real phone numbers, webpage content, access tokens, credentials, or personal data in issues, tests, screenshots, or logs.

## العربية

DialGlide إضافة مفتوحة المصدر لمتصفح Chrome تكتشف أرقام الهاتف محليًا داخل صفحات الويب، ثم تتيح الاتصال أو إرسال رسالة أو نسخ الرقم باستخدام التطبيق الذي يختاره المستخدم. لا تحتوي الإضافة على حسابات أو إعلانات أو تحليلات أو تتبع أو كود بعيد.

توجد داخل المستودع أيضًا مكتبة **DialGlide Core** لاكتشاف أرقام الهاتف وتوحيد الأرقام العربية والفارسية واللاتينية وتنسيق الأرقام المحلية والدولية.

## License and trademarks

Source code is available under the [Mozilla Public License 2.0](LICENSE). The DialGlide name and logo are not licensed for use as the identity of modified or redistributed products; see [TRADEMARKS.md](TRADEMARKS.md).
