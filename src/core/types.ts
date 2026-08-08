import type { CountryCode } from "libphonenumber-js";
import type { DetectedPhone, PhoneMatch } from "../../packages/core/src/index";

export type { DetectedPhone, PhoneMatch } from "../../packages/core/src/index";

export type LocalePreference = "auto" | "en" | "ar";
export type CallHandlerType = "tel" | "sip" | "custom" | "copy";
export type MessageHandlerType = "sms" | "custom" | "copy";
export type ActivationMode = "preview" | "instant";

export interface HandlerSettings {
  type: CallHandlerType | MessageHandlerType;
  customTemplate: string;
}

export interface DialBridgeSettings {
  locale: LocalePreference;
  defaultCountry: CountryCode;
  activationMode: ActivationMode;
  highlightNumbers: boolean;
  callHandler: HandlerSettings;
  messageHandler: HandlerSettings;
  blockedNumbers: string[];
  onboardingComplete: boolean;
}

export interface ScanPayload {
  tabId?: number;
  phones: DetectedPhone[];
}

export type PhoneAction = "call" | "message" | "copy";

export type RuntimeMessage =
  | { type: "DB_GET_ACTIVE_CONTEXT" }
  | { type: "DB_GET_RESULTS"; tabId: number }
  | { type: "DB_INJECT_ACTIVE" }
  | { type: "DB_RESCAN" }
  | { type: "DB_REGISTER_ORIGIN"; originPattern: string }
  | { type: "DB_UNREGISTER_ORIGIN"; originPattern: string }
  | { type: "DB_SCAN_RESULTS"; payload: ScanPayload }
  | { type: "DB_RESULTS_UPDATED"; payload: ScanPayload }
  | { type: "DB_PERFORM_ACTION"; action: PhoneAction; phone: DetectedPhone }
  | { type: "DB_SETTINGS_UPDATED" }
  | { type: "DB_PING" };

export interface ActiveContext {
  supported: boolean;
  tabId?: number;
  origin?: string;
  originPattern?: string;
  persistentAccess: boolean;
  reason?: "restricted" | "missing-tab";
}
