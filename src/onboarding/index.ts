import { getCountries, type CountryCode } from "libphonenumber-js/min";
import { applyTranslations, resolveLocale, type UiLocale } from "../core/i18n";
import { getSettings, saveSettings } from "../core/settings";
import type { DialBridgeSettings } from "../core/types";

const form = document.querySelector<HTMLFormElement>("#onboarding-form")!;
const localeSelect = document.querySelector<HTMLSelectElement>("#locale")!;
const countrySelect = document.querySelector<HTMLSelectElement>("#country")!;
const handlerSelect = document.querySelector<HTMLSelectElement>("#handler")!;
const setupCard = document.querySelector<HTMLElement>("#setup-card")!;
const doneCard = document.querySelector<HTMLElement>("#done-card")!;
const closeButton = document.querySelector<HTMLButtonElement>("#close-button")!;

let settings: DialBridgeSettings;
let locale: UiLocale = "en";

function populateCountries(selected: CountryCode): void {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const options = getCountries()
    .map((code) => ({ code, name: names.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, locale))
    .map(({ code, name }) => {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = `${name} (${code})`;
      option.selected = code === selected;
      return option;
    });
  countrySelect.replaceChildren(...options);
}

localeSelect.addEventListener("change", () => {
  locale = localeSelect.value === "ar" || localeSelect.value === "en"
    ? localeSelect.value
    : resolveLocale();
  applyTranslations(locale);
  populateCountries(countrySelect.value as CountryCode);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  settings = {
    ...settings,
    locale: localeSelect.value as DialBridgeSettings["locale"],
    defaultCountry: countrySelect.value as CountryCode,
    callHandler: {
      ...settings.callHandler,
      type: handlerSelect.value as DialBridgeSettings["callHandler"]["type"]
    },
    onboardingComplete: true
  };
  await saveSettings(settings);
  setupCard.hidden = true;
  doneCard.hidden = false;
});

closeButton.addEventListener("click", () => window.close());

void (async () => {
  settings = await getSettings();
  locale = resolveLocale(settings);
  applyTranslations(locale);
  localeSelect.value = settings.locale;
  handlerSelect.value = settings.callHandler.type === "custom" ? "tel" : settings.callHandler.type;
  populateCountries(settings.defaultCountry);
})();
