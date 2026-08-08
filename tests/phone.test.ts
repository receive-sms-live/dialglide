import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregatePhones,
  buildTextWindows,
  buildActionUri,
  findPhoneMatches,
  mergeDetectedPhones,
  normalizeDigits,
  parsePhoneInput,
  validateCustomTemplate
} from "../src/core/phone";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import { mergeSettings } from "../src/core/settings";

describe("phone normalization", () => {
  it("normalizes Arabic, Persian, and full-width digits", () => {
    assert.equal(normalizeDigits("٠١٢٣ ۴۵۶ ７８９"), "0123 456 789");
  });

  it("parses Arabic-script digits using the selected region", () => {
    const phone = parsePhoneInput("٠٢٠ ٧٩٤٦ ٠٩٥٨", "GB");
    assert.equal(phone?.e164, "+442079460958");
    assert.equal(phone?.country, "GB");
  });

  it("parses international numbers", () => {
    const phone = parsePhoneInput("+1 (202) 555-0147", "GB");
    assert.equal(phone?.e164, "+12025550147");
    assert.equal(phone?.country, "US");
  });
});

describe("phone discovery", () => {
  it("finds English and Arabic-script numbers", () => {
    const text = "Call +1 202 555 0147 or اتصل على ٠٢٠ ٧٩٤٦ ٠٩٥٨";
    const matches = findPhoneMatches(text, "GB");
    assert.deepEqual(matches.map((match) => match.e164), ["+12025550147", "+442079460958"]);
  });

  it("rejects common dates and identifiers", () => {
    const text = "Order ID 202608041234 and date 2026-08-04";
    assert.equal(findPhoneMatches(text, "EG").length, 0);
  });

  it("aggregates duplicates without losing useful context", () => {
    const matches = findPhoneMatches("Phone +1 202 555 0147. Call +1 202 555 0147.", "US");
    const phones = aggregatePhones(matches);
    assert.equal(phones.length, 1);
    assert.equal(phones[0]?.count, 2);
  });

  it("detects numbers extracted from links, attributes, and split text", () => {
    const sources = [
      "+1 202 555 0147",
      "tel:+442079460958",
      "+1 416 555 0136"
    ];
    const matches = sources.flatMap((source) => findPhoneMatches(source, "US"));
    assert.deepEqual(matches.map((match) => match.e164), [
      "+12025550147",
      "+442079460958",
      "+14165550136"
    ]);
  });

  it("isolates a phone number from counters and timestamps in a complex link", () => {
    const windows = buildTextWindows([
      "+1 202 555 0147",
      "3443 رسالة",
      "·",
      "منذ 6 دقائق",
      "عرض الرسائل"
    ]);
    const phones = aggregatePhones(windows.flatMap((text) => findPhoneMatches(text, "US")));
    assert.equal(phones.some((phone) => phone.e164 === "+12025550147"), true);
  });

  it("merges results reported by multiple frames", () => {
    const first = parsePhoneInput("+1 202 555 0147", "US");
    const duplicate = parsePhoneInput("+1 (202) 555-0147", "US");
    const second = parsePhoneInput("+442079460958", "US");
    assert.ok(first && duplicate && second);
    first.contexts = ["main frame"];
    duplicate.contexts = ["embedded frame"];

    const merged = mergeDetectedPhones([first, duplicate, second]);
    assert.equal(merged.length, 2);
    assert.equal(merged[0]?.e164, "+12025550147");
    assert.equal(merged[0]?.count, 2);
    assert.deepEqual(merged[0]?.contexts, ["main frame", "embedded frame"]);
  });
});

describe("actions", () => {
  const phone = parsePhoneInput("+12025550147", "US");
  assert.ok(phone);

  it("builds safe native handlers", () => {
    assert.equal(buildActionUri("call", phone, DEFAULT_SETTINGS), "tel:+12025550147");
    assert.equal(buildActionUri("message", phone, DEFAULT_SETTINGS), "sms:+12025550147");
  });

  it("validates custom templates and blocks executable schemes", () => {
    assert.equal(validateCustomTemplate("https://dialer.example/call?number={e164}"), true);
    assert.equal(validateCustomTemplate("http://dialer.example/call?number={e164}"), false);
    assert.equal(validateCustomTemplate("javascript:alert({e164})"), false);
    assert.equal(validateCustomTemplate("https://dialer.example/static"), false);
  });
});

describe("settings hardening", () => {
  it("falls back safely when stored settings are corrupted", () => {
    const settings = mergeSettings({
      locale: "unsupported",
      defaultCountry: "ZZ",
      activationMode: "surprise",
      callHandler: { type: "javascript", customTemplate: 42 },
      messageHandler: { type: "email", customTemplate: null },
      blockedNumbers: ["+12025550147", 42]
    });
    assert.equal(settings.locale, "auto");
    assert.equal(settings.defaultCountry, "EG");
    assert.equal(settings.activationMode, "preview");
    assert.equal(settings.callHandler.type, "tel");
    assert.equal(settings.messageHandler.type, "sms");
    assert.deepEqual(settings.blockedNumbers, ["+12025550147"]);
  });
});
