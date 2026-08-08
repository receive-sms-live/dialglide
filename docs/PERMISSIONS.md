# Chrome Web Store privacy and permission answers

Keep these answers synchronized with version 1.0.4 and the public privacy policy.

## Single purpose

DialGlide detects phone numbers in the visible content of a webpage selected by the user and lets the user call, message, copy, or open those numbers in a configured dialer through inline controls or the Chrome side panel. Phone-number detection and formatting are performed locally on the user's device. Automatic detection can be enabled for a specific website only after the user explicitly grants access to that origin.

## Permission justifications

### `activeTab`

Used only after the user invokes DialGlide by clicking the extension icon, using its keyboard shortcut, or selecting a context-menu command. It provides temporary access to the current tab so DialGlide can read visible page content, detect phone numbers, add click-to-call controls, and display the results in the side panel. It does not provide background access to unrelated tabs.

### `scripting`

Required to inject DialGlide's packaged content script and stylesheet into the user-selected tab, scan phone-related page content for phone numbers, highlight detected numbers, and refresh detection. It also registers the same packaged script for a specific website only after the user grants optional access for automatic activation. No remote code is injected or executed.

### `storage`

Used with chrome.storage.local to keep user-controlled settings, the local blocklist, custom handler templates, and website origins explicitly enabled by the user. chrome.storage.session temporarily stores detected phone numbers and short surrounding text snippets from the current tab so the side panel can display them. This data remains on the user's device and is not sent to the publisher.

### `contextMenus`

Adds user-initiated right-click commands for selected phone-number text: Call, Message, Copy formatted phone number, and Open DialGlide. Selected text is parsed locally only when the user chooses one of these commands.

### `sidePanel`

Used to display phone numbers detected in the current tab and provide Call, Message, Copy, scan, and settings controls beside the webpage. The panel is opened after a user action and is the primary interface for viewing scan results.

### Optional host permissions

Optional host access is declared only so users can enable automatic phone-number detection for an individual website. DialGlide requests access to one website origin at a time after the user explicitly enables it from the side panel. No website access is granted by default, and the user can revoke access at any time.

## Remote code

Select: **No, I am not using remote code.**

DialGlide does not use remote code. All JavaScript, phone-number parsing libraries, and application logic are included in the extension package. The extension does not load external JavaScript or WebAssembly, use eval() or new Function(), or execute code fetched from a remote server.

## Data handled

Disclose the following categories if the dashboard presents them:

- Personally identifiable information: phone numbers present in the webpage content selected by the user.
- Website content: phone-related page content and short surrounding snippets processed for the user-facing detection feature.

State that all processing and storage are local to the user's device and that no data is transmitted to the publisher. Do not select Web history or categories for authentication information, personal communications, user activity, financial information, health information, or location.

## Limited Use certifications

Certify, because these statements match the shipped code:

- Data is used only for DialGlide's disclosed click-to-call purpose.
- Data is not sold or transferred to unrelated third parties.
- Data is not used for advertising, creditworthiness, or lending.
- Human access to handled user data is not allowed.

## Privacy policy URL

`https://receive-smss.live/tools/dialglide/privacy/`
