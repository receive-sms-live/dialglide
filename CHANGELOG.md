# Changelog

## 1.0.4 — 2026-08-08

- Improved English and Arabic Chrome Web Store metadata around Click-to-Call and Click-to-Dial intent without keyword stuffing.
- Updated the Arabic package title and both localized summaries.
- Aligned the built-in privacy notice and submission documentation with phone-related page content, session and local retention, per-origin permissions, and user-configured dialer transfers.
- Corrected automatic-site wording to reflect independent per-origin grants.

## 1.0.3 — 2026-08-07

- Fixed toolbar launches that opened the side panel before Chrome granted active-tab access.
- Handles the toolbar action explicitly, opens the panel, injects the scanner, and rescans within the same user gesture.
- Keeps the minimal `activeTab` model and does not add the broad `tabs` permission.

## 1.0.2 — 2026-08-07

- Detects phone numbers inside links, buttons, telephone fields, accessibility labels, metadata, and structured data without changing the page's original controls.
- Detects numbers split across nearby HTML elements and inside open Shadow DOM components.
- Scans accessible child frames and merges their results safely in the side panel.
- Keeps dynamic results fresh when text, relevant attributes, inputs, frames, or page navigation change.

## 1.0.1 — 2026-08-07

- Fixed active-tab detection when DialGlide is opened from Chrome's side panel.
- Kept sender validation strict while correctly allowing trusted extension pages.
- Added a safe active-tab URL fallback without requesting the broad `tabs` permission.

## 1.0.0 — 2026-08-04

- Initial public release.
- Local international phone detection using packaged metadata.
- Arabic, Persian, full-width, and Latin digit normalization.
- Click-to-call, click-to-message, copy, preview, and local blocklist.
- Provider-neutral handlers for system phone, SMS, SIP, and secure custom templates.
- Chrome side panel, settings, onboarding, privacy notice, and English/Arabic RTL UI.
- Temporary active-tab access and per-origin optional automatic activation.
- Dynamic-page detection, deduplication, false-positive filters, and contextual results.
