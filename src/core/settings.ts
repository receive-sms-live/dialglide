import type { CountryCode } from "libphonenumber-js/min";
import type { DialBridgeSettings } from "./types";

export const SETTINGS_KEY = "dialbridge.settings";
export const ENABLED_ORIGINS_KEY = "dialbridge.enabledOrigins";

export const DEFAULT_SETTINGS: DialBridgeSettings = {
  locale: "auto",
  defaultCountry: "EG",
  activationMode: "preview",
  highlightNumbers: true,
  callHandler: {
    type: "tel",
    customTemplate: ""
  },
  messageHandler: {
    type: "sms",
    customTemplate: ""
  },
  blockedNumbers: [],
  onboardingComplete: false
};

const COUNTRY_CODES = new Set<string>("AC AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TA TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW".split(" "));
const LOCALES = new Set(["auto", "en", "ar"]);
const ACTIVATION_MODES = new Set(["preview", "instant"]);
const CALL_HANDLERS = new Set(["tel", "sip", "custom", "copy"]);
const MESSAGE_HANDLERS = new Set(["sms", "custom", "copy"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function mergeSettings(value: unknown): DialBridgeSettings {
  if (!isObject(value)) return structuredClone(DEFAULT_SETTINGS);

  const callHandler = isObject(value.callHandler) ? value.callHandler : {};
  const messageHandler = isObject(value.messageHandler) ? value.messageHandler : {};

  const locale = typeof value.locale === "string" && LOCALES.has(value.locale)
    ? value.locale as DialBridgeSettings["locale"]
    : DEFAULT_SETTINGS.locale;
  const defaultCountry = typeof value.defaultCountry === "string" && COUNTRY_CODES.has(value.defaultCountry)
    ? value.defaultCountry as CountryCode
    : DEFAULT_SETTINGS.defaultCountry;
  const activationMode = typeof value.activationMode === "string" && ACTIVATION_MODES.has(value.activationMode)
    ? value.activationMode as DialBridgeSettings["activationMode"]
    : DEFAULT_SETTINGS.activationMode;
  const callType = typeof callHandler.type === "string" && CALL_HANDLERS.has(callHandler.type)
    ? callHandler.type as DialBridgeSettings["callHandler"]["type"]
    : DEFAULT_SETTINGS.callHandler.type;
  const messageType = typeof messageHandler.type === "string" && MESSAGE_HANDLERS.has(messageHandler.type)
    ? messageHandler.type as DialBridgeSettings["messageHandler"]["type"]
    : DEFAULT_SETTINGS.messageHandler.type;

  const safeTemplate = (candidate: unknown): string => typeof candidate === "string"
    ? candidate.slice(0, 2_048)
    : "";

  return {
    locale,
    defaultCountry,
    activationMode,
    highlightNumbers: typeof value.highlightNumbers === "boolean"
      ? value.highlightNumbers
      : DEFAULT_SETTINGS.highlightNumbers,
    callHandler: {
      type: callType,
      customTemplate: safeTemplate(callHandler.customTemplate)
    },
    messageHandler: {
      type: messageType,
      customTemplate: safeTemplate(messageHandler.customTemplate)
    },
    blockedNumbers: Array.isArray(value.blockedNumbers)
      ? value.blockedNumbers
        .filter((item): item is string => typeof item === "string" && item.length <= 100)
        .slice(0, 500)
      : [],
    onboardingComplete: typeof value.onboardingComplete === "boolean"
      ? value.onboardingComplete
      : DEFAULT_SETTINGS.onboardingComplete
  };
}

export async function getSettings(): Promise<DialBridgeSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return mergeSettings(stored[SETTINGS_KEY]);
}

export async function saveSettings(settings: DialBridgeSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: mergeSettings(settings) });
}

export async function ensureDefaultSettings(): Promise<DialBridgeSettings> {
  const settings = await getSettings();
  await saveSettings(settings);
  return settings;
}

export async function getEnabledOrigins(): Promise<string[]> {
  const stored = await chrome.storage.local.get(ENABLED_ORIGINS_KEY);
  const origins = stored[ENABLED_ORIGINS_KEY];
  return Array.isArray(origins)
    ? origins.filter((item): item is string => typeof item === "string")
    : [];
}

export async function setEnabledOrigins(origins: string[]): Promise<void> {
  await chrome.storage.local.set({
    [ENABLED_ORIGINS_KEY]: [...new Set(origins)].sort()
  });
}
