import { applyTranslations, resolveLocale } from "../core/i18n";
import { getSettings } from "../core/settings";

document.querySelector<HTMLButtonElement>("#settings-button")?.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});

void (async () => {
  const settings = await getSettings();
  applyTranslations(resolveLocale(settings));
})();
