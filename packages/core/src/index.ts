import {
  parsePhoneNumberFromString,
  searchPhoneNumbersInText,
  type CountryCode
} from "libphonenumber-js/min";

export type { CountryCode } from "libphonenumber-js";

export interface PhoneMatch {
  id: string;
  raw: string;
  e164: string;
  international: string;
  national: string;
  country?: CountryCode;
  extension?: string;
  startsAt: number;
  endsAt: number;
  context: string;
}

export interface DetectedPhone {
  id: string;
  raw: string;
  e164: string;
  international: string;
  national: string;
  country?: CountryCode;
  extension?: string;
  count: number;
  contexts: string[];
}

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC = "۰۱۲۳۴۵۶۷۸۹";
const FULLWIDTH = "０１２３４５６７８９";
const SUSPICIOUS_LABEL = /\b(?:order|invoice|tracking|reference|ref|account|customer|product|sku|serial|ticket|case|isbn|zip|postal|id)\b|(?:طلب|فاتورة|مرجع|حساب|منتج|تذكرة|رقم\s*تعريف)/iu;
const PHONE_LABEL = /\b(?:tel|telephone|phone|mobile|cell|call|contact|fax|whatsapp|sms|sip|message)\b|(?:هاتف|تليفون|تلفون|جوال|موبايل|اتصل|اتصال|رسالة|واتساب|فاكس)/iu;
const DATE_LIKE = /^(?:\d{1,4}[./-]){2}\d{1,4}$/;
const TIME_LIKE = /^\d{1,2}:\d{2}(?::\d{2})?$/;
const REPEATED_DIGIT = /^(\d)\1{6,}$/;

export function normalizeDigits(input: string): string {
  return [...input]
    .map((character) => {
      const arabicIndex = ARABIC_INDIC.indexOf(character);
      if (arabicIndex >= 0) return String(arabicIndex);
      const easternIndex = EASTERN_ARABIC.indexOf(character);
      if (easternIndex >= 0) return String(easternIndex);
      const fullwidthIndex = FULLWIDTH.indexOf(character);
      if (fullwidthIndex >= 0) return String(fullwidthIndex);
      if (character === "＋") return "+";
      return character;
    })
    .join("");
}

export function compactPhoneDigits(input: string): string {
  return normalizeDigits(input).replace(/\D/g, "");
}

export function buildTextWindows(parts: string[], windowSize = 4, maxLength = 400): string[] {
  const normalized = parts
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const windows: string[] = [];

  for (let start = 0; start < normalized.length; start += 1) {
    let combined = "";
    for (let end = start; end < Math.min(normalized.length, start + windowSize); end += 1) {
      combined = `${combined} ${normalized[end]}`.trim();
      if (combined.length > maxLength) break;
      windows.push(combined);
    }
  }

  return windows;
}

function makeId(e164: string, extension?: string): string {
  return extension ? `${e164}x${extension}` : e164;
}

function contextAround(text: string, startsAt: number, endsAt: number): string {
  const start = Math.max(0, startsAt - 44);
  const end = Math.min(text.length, endsAt + 44);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function looksLikeFalsePositive(raw: string, context: string): boolean {
  const normalized = normalizeDigits(raw).trim();
  const digits = compactPhoneDigits(normalized);
  if (digits.length < 7 || digits.length > 15) return true;
  if (DATE_LIKE.test(normalized) || TIME_LIKE.test(normalized)) return true;
  if (REPEATED_DIGIT.test(digits)) return true;
  if (/^\d{4}[\s./-]\d{1,2}[\s./-]\d{1,2}$/.test(normalized)) return true;

  const hasPhoneLabel = PHONE_LABEL.test(context);
  if (!hasPhoneLabel && SUSPICIOUS_LABEL.test(context)) return true;
  if (!hasPhoneLabel && /(?:https?:\/\/|www\.)\S*\d{7,}/iu.test(context)) return true;
  return false;
}

export function findPhoneMatches(text: string, defaultCountry: CountryCode): PhoneMatch[] {
  if (!text || compactPhoneDigits(text).length < 7) return [];
  const normalized = normalizeDigits(text);
  const matches: PhoneMatch[] = [];

  for (const match of searchPhoneNumbersInText(normalized, defaultCountry)) {
    const raw = text.slice(match.startsAt, match.endsAt);
    const context = contextAround(text, match.startsAt, match.endsAt);
    const number = match.number;

    if (!number.isPossible() || looksLikeFalsePositive(raw, context)) continue;

    const extension = number.ext;
    matches.push({
      id: makeId(number.number, extension),
      raw,
      e164: number.number,
      international: number.formatInternational(),
      national: number.formatNational(),
      ...(number.country ? { country: number.country } : {}),
      ...(extension ? { extension } : {}),
      startsAt: match.startsAt,
      endsAt: match.endsAt,
      context
    });
  }

  return matches;
}

export function parsePhoneInput(input: string, defaultCountry: CountryCode): DetectedPhone | undefined {
  const normalized = normalizeDigits(input);
  const number = parsePhoneNumberFromString(normalized, defaultCountry);
  if (!number || !number.isPossible()) return undefined;
  const extension = number.ext;
  return {
    id: makeId(number.number, extension),
    raw: input.trim(),
    e164: number.number,
    international: number.formatInternational(),
    national: number.formatNational(),
    ...(number.country ? { country: number.country } : {}),
    ...(extension ? { extension } : {}),
    count: 1,
    contexts: []
  };
}

export function aggregatePhones(matches: PhoneMatch[]): DetectedPhone[] {
  const grouped = new Map<string, DetectedPhone>();

  for (const match of matches) {
    const existing = grouped.get(match.id);
    if (existing) {
      existing.count += 1;
      if (match.context && !existing.contexts.includes(match.context) && existing.contexts.length < 3) {
        existing.contexts.push(match.context);
      }
      continue;
    }

    grouped.set(match.id, {
      id: match.id,
      raw: match.raw,
      e164: match.e164,
      international: match.international,
      national: match.national,
      ...(match.country ? { country: match.country } : {}),
      ...(match.extension ? { extension: match.extension } : {}),
      count: 1,
      contexts: match.context ? [match.context] : []
    });
  }

  return [...grouped.values()].sort((a, b) => b.count - a.count || a.international.localeCompare(b.international));
}

export function mergeDetectedPhones(phones: DetectedPhone[]): DetectedPhone[] {
  const grouped = new Map<string, DetectedPhone>();

  for (const phone of phones) {
    const existing = grouped.get(phone.id);
    if (!existing) {
      grouped.set(phone.id, {
        ...phone,
        contexts: [...phone.contexts].slice(0, 3)
      });
      continue;
    }

    existing.count += Math.max(1, phone.count);
    for (const context of phone.contexts) {
      if (context && !existing.contexts.includes(context) && existing.contexts.length < 3) {
        existing.contexts.push(context);
      }
    }
  }

  return [...grouped.values()].sort((a, b) => b.count - a.count || a.international.localeCompare(b.international));
}
