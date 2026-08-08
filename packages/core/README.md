# DialGlide Core

Privacy-first phone-number detection and normalization for JavaScript and TypeScript.

## Install

```sh
npm install dialglide
```

## Usage

```ts
import {
  aggregatePhones,
  findPhoneMatches,
  normalizeDigits,
  parsePhoneInput
} from "dialglide";

normalizeDigits("٢٠٢ ٥٥٥ ٠١٤٧");
// "202 555 0147"

const phone = parsePhoneInput("٢٠٢ ٥٥٥ ٠١٤٧", "US");
console.log(phone?.e164);
// "+12025550147"

const matches = findPhoneMatches(
  "Call +1 202 555 0147 or اتصل على ٠٢٠ ٧٩٤٦ ٠٩٥٨",
  "GB"
);

const uniquePhones = aggregatePhones(matches);
```

## Exports

- `normalizeDigits(input)`
- `compactPhoneDigits(input)`
- `buildTextWindows(parts, windowSize?, maxLength?)`
- `findPhoneMatches(text, defaultCountry)`
- `parsePhoneInput(input, defaultCountry)`
- `aggregatePhones(matches)`
- `mergeDetectedPhones(phones)`
- TypeScript types: `CountryCode`, `PhoneMatch`, and `DetectedPhone`

The package recognizes Latin, Arabic, Persian, and full-width digits. It uses `libphonenumber-js` metadata locally and includes conservative filters for common dates, identifiers, and URL-like false positives.

No data is transmitted by this package. The calling application is responsible for deciding what to do with returned values.

All phone numbers in the documentation are reserved fictional examples.

## License

Mozilla Public License 2.0. The DialGlide name and logo remain subject to the repository's trademark policy.
