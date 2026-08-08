import { getCountries, type CountryCode } from "libphonenumber-js/min";
import { applyTranslations, resolveLocale, translate, type UiLocale } from "../core/i18n";
import { validateCustomTemplate } from "../core/phone";
import {
  DEFAULT_SETTINGS,
  getEnabledOrigins,
  getSettings,
  saveSettings,
  setEnabledOrigins
} from "../core/settings";
import type { DialBridgeSettings, RuntimeMessage } from "../core/types";

const form = document.querySelector<HTMLFormElement>("#settings-form")!;
const localeSelect = document.querySelector<HTMLSelectElement>("#locale")!;
const countrySelect = document.querySelector<HTMLSelectElement>("#country")!;
const callHandler = document.querySelector<HTMLSelectElement>("#call-handler")!;
const messageHandler = document.querySelector<HTMLSelectElement>("#message-handler")!;
const callTemplate = document.querySelector<HTMLInputElement>("#call-template")!;
const messageTemplate = document.querySelector<HTMLInputElement>("#message-template")!;
const callTemplateField = document.querySelector<HTMLElement>("#call-template-field")!;
const messageTemplateField = document.querySelector<HTMLElement>("#message-template-field")!;
const callTemplateError = document.querySelector<HTMLElement>("#call-template-error")!;
const messageTemplateError = document.querySelector<HTMLElement>("#message-template-error")!;
const highlight = document.querySelector<HTMLInputElement>("#highlight")!;
const blocklist = document.querySelector<HTMLTextAreaElement>("#blocklist")!;
const siteList = document.querySelector<HTMLElement>("#site-list")!;
const noSites = document.querySelector<HTMLElement>("#no-sites")!;
const resetButton = document.querySelector<HTMLButtonElement>("#reset-button")!;
const saveStatus = document.querySelector<HTMLElement>("#save-status")!;

let settings: DialBridgeSettings;
let uiLocale: UiLocale = "en";

function populateCountries(selected: CountryCode): void {
  const displayNames = new Intl.DisplayNames([uiLocale], { type: "region" });
  const countries = getCountries().map((code) => ({ code, name: displayNames.of(code) ?? code }));
  countries.sort((a, b) => a.name.localeCompare(b.name, uiLocale));
  countrySelect.replaceChildren(...countries.map(({ code, name }) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = `${name} (${code})`;
    option.selected = code === selected;
    return option;
  }));
}

function updateTemplateVisibility(): void {
  callTemplateField.hidden = callHandler.value !== "custom";
  messageTemplateField.hidden = messageHandler.value !== "custom";
}

function readSettings(): DialBridgeSettings {
  const activation = form.querySelector<HTMLInputElement>("input[name='activation']:checked")?.value === "instant"
    ? "instant"
    : "preview";
  return {
    ...settings,
    locale: localeSelect.value as DialBridgeSettings["locale"],
    defaultCountry: countrySelect.value as CountryCode,
    activationMode: activation,
    highlightNumbers: highlight.checked,
    callHandler: {
      type: callHandler.value as DialBridgeSettings["callHandler"]["type"],
      customTemplate: callTemplate.value.trim()
    },
    messageHandler: {
      type: messageHandler.value as DialBridgeSettings["messageHandler"]["type"],
      customTemplate: messageTemplate.value.trim()
    },
    blockedNumbers: blocklist.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    onboardingComplete: true
  };
}

function validate(): boolean {
  const callOk = callHandler.value !== "custom" || validateCustomTemplate(callTemplate.value.trim());
  const messageOk = messageHandler.value !== "custom" || validateCustomTemplate(messageTemplate.value.trim());
  callTemplateError.hidden = callOk;
  messageTemplateError.hidden = messageOk;
  return callOk && messageOk;
}

function fillForm(value: DialBridgeSettings): void {
  settings = value;
  localeSelect.value = value.locale;
  populateCountries(value.defaultCountry);
  callHandler.value = value.callHandler.type;
  messageHandler.value = value.messageHandler.type;
  callTemplate.value = value.callHandler.customTemplate;
  messageTemplate.value = value.messageHandler.customTemplate;
  highlight.checked = value.highlightNumbers;
  blocklist.value = value.blockedNumbers.join("\n");
  const activation = form.querySelector<HTMLInputElement>(`input[name='activation'][value='${value.activationMode}']`);
  if (activation) activation.checked = true;
  updateTemplateVisibility();
}

async function renderSites(): Promise<void> {
  const origins = await getEnabledOrigins();
  noSites.hidden = origins.length > 0;
  siteList.replaceChildren();
  for (const origin of origins) {
    const row = document.createElement("div");
    row.className = "site-item";
    const code = document.createElement("code");
    code.textContent = origin;
    code.title = origin;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button small danger";
    remove.textContent = translate("remove", uiLocale);
    remove.addEventListener("click", async () => {
      remove.disabled = true;
      await chrome.runtime.sendMessage({ type: "DB_UNREGISTER_ORIGIN", originPattern: origin } satisfies RuntimeMessage);
      await chrome.permissions.remove({ origins: [origin] });
      await setEnabledOrigins((await getEnabledOrigins()).filter((item) => item !== origin));
      await renderSites();
    });
    row.append(code, remove);
    siteList.append(row);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validate()) return;
  settings = readSettings();
  await saveSettings(settings);
  await chrome.runtime.sendMessage({ type: "DB_SETTINGS_UPDATED" } satisfies RuntimeMessage);
  saveStatus.hidden = false;
  window.setTimeout(() => { saveStatus.hidden = true; }, 2_200);
});

callHandler.addEventListener("change", updateTemplateVisibility);
messageHandler.addEventListener("change", updateTemplateVisibility);
callTemplate.addEventListener("input", validate);
messageTemplate.addEventListener("input", validate);

localeSelect.addEventListener("change", () => {
  const selected = localeSelect.value;
  uiLocale = selected === "ar" || selected === "en" ? selected : resolveLocale();
  applyTranslations(uiLocale);
  populateCountries(countrySelect.value as CountryCode);
  void renderSites();
});

resetButton.addEventListener("click", async () => {
  if (!window.confirm(translate("resetConfirm", uiLocale))) return;
  const reset = structuredClone(DEFAULT_SETTINGS);
  await saveSettings(reset);
  settings = reset;
  uiLocale = resolveLocale(reset);
  applyTranslations(uiLocale);
  fillForm(reset);
  await chrome.runtime.sendMessage({ type: "DB_SETTINGS_UPDATED" } satisfies RuntimeMessage);
});

void (async () => {
  settings = await getSettings();
  uiLocale = resolveLocale(settings);
  applyTranslations(uiLocale);
  fillForm(settings);
  await renderSites();
})();
