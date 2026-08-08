# Release QA checklist

## Functional

- Click the pinned toolbar icon on a fresh regular tab and verify the panel opens and scans without first using a context-menu command.
- Detect valid international and local numbers in English and Arabic digits.
- Do not detect dates, order IDs, or obvious account/product identifiers.
- Verify Call, Message, and Copy in preview and instant modes.
- Verify `tel:`, `sms:`, `sip:`, copy-only, and custom HTTPS templates.
- Verify invalid custom URL schemes are rejected.
- Verify dynamic content added after page load is detected.
- Verify numbers inside existing links and buttons appear in the side panel without changing their original click behavior.
- Verify telephone fields, ARIA/title metadata, `tel:`/`sms:` links, structured data, and split inline text.
- Verify open Shadow DOM components and accessible child frames, including merged frame results.
- Verify selected-text context menu actions.
- Verify deduplication and occurrence counts in the side panel.
- Verify local blocklist behavior.

## Permissions and privacy

- Fresh install requests no website access.
- Opening DialGlide grants only temporary active-tab access.
- Automatic activation requests only the displayed current origin.
- Removing an enabled site unregisters the content script and revokes permission.
- No network request occurs during number detection or UI use.
- No remote scripts, inline scripts, `eval`, analytics, or tracking are present.

## Compatibility

- Chrome 116+ on macOS and Windows.
- English LTR and Arabic RTL browser locales.
- Static pages, dynamic SPAs, long tables, interactive cards, open Shadow DOM, accessible frames, and pages containing many numbers.
- Zoom levels 80%, 100%, 125%, and 150%.
- Keyboard navigation, visible focus, and screen-reader labels.
- Restricted Chrome pages display a clear explanation.

## Store submission

- Confirm `support@receive-smss.live` exists and is monitored.
- Host the privacy policy at a stable HTTPS URL.
- Provide a dedicated product/support page.
- Confirm dashboard data-use disclosures match the packaged build.
- Upload a ZIP whose root contains `manifest.json`.
- Provide screenshots that show real extension functionality.
- Confirm the product name does not conflict with a registered trademark in launch markets.
- Confirm the public test, support, privacy, and product URLs return HTTPS 200 responses.
