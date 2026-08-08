import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import {
  compactPhoneDigits,
  normalizeDigits,
  type DetectedPhone
} from "../../packages/core/src/index";
import type {
  DialBridgeSettings,
  HandlerSettings,
  PhoneAction
} from "./types";

export {
  aggregatePhones,
  buildTextWindows,
  compactPhoneDigits,
  findPhoneMatches,
  mergeDetectedPhones,
  normalizeDigits,
  parsePhoneInput
} from "../../packages/core/src/index";
export type { DetectedPhone, PhoneMatch } from "../../packages/core/src/index";

const ALLOWED_URI_SCHEMES = new Set(["https:", "tel:", "sms:", "sip:", "sips:"]);

export function isBlocked(phone: Pick<DetectedPhone, "e164">, settings: DialBridgeSettings): boolean {
  return settings.blockedNumbers.some((blocked) => {
    const normalized = parsePhoneNumberFromString(normalizeDigits(blocked), settings.defaultCountry);
    return normalized?.number === phone.e164;
  });
}

function fillTemplate(template: string, phone: DetectedPhone): string {
  return template.replace(/\{(e164|national|raw|digits)\}/g, (_match, token: string) => {
    const value = token === "e164"
      ? phone.e164
      : token === "national"
        ? phone.national
        : token === "digits"
          ? compactPhoneDigits(phone.e164)
          : phone.raw;
    return encodeURIComponent(value);
  });
}

export function validateCustomTemplate(template: string): boolean {
  if (!template.includes("{e164}") && !template.includes("{digits}") && !template.includes("{raw}")) {
    return false;
  }

  try {
    const sample = fillTemplate(template, {
      id: "+12025550147",
      raw: "202 555 0147",
      e164: "+12025550147",
      international: "+1 202 555 0147",
      national: "(202) 555-0147",
      country: "US",
      count: 1,
      contexts: []
    });
    return ALLOWED_URI_SCHEMES.has(new URL(sample).protocol);
  } catch {
    return false;
  }
}

function buildFromHandler(handler: HandlerSettings, phone: DetectedPhone, fallbackScheme: "tel" | "sms"): string | undefined {
  switch (handler.type) {
    case "tel":
      return `tel:${phone.e164}${phone.extension ? `;ext=${phone.extension}` : ""}`;
    case "sms":
      return `sms:${phone.e164}`;
    case "sip":
      return `sip:${compactPhoneDigits(phone.e164)}`;
    case "custom":
      return validateCustomTemplate(handler.customTemplate)
        ? fillTemplate(handler.customTemplate, phone)
        : `${fallbackScheme}:${phone.e164}`;
    case "copy":
      return undefined;
  }
}

export function buildActionUri(
  action: PhoneAction,
  phone: DetectedPhone,
  settings: DialBridgeSettings
): string | undefined {
  if (action === "copy") return undefined;
  return action === "call"
    ? buildFromHandler(settings.callHandler, phone, "tel")
    : buildFromHandler(settings.messageHandler, phone, "sms");
}
