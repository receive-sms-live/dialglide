import { applyTranslations, resolveLocale, translate, type UiLocale } from "../core/i18n";
import { getSettings } from "../core/settings";
import type { ActiveContext, DetectedPhone, DialBridgeSettings, RuntimeMessage, ScanPayload } from "../core/types";

const elements = {
  siteCard: document.querySelector<HTMLElement>("#site-card")!,
  siteName: document.querySelector<HTMLElement>("#site-name")!,
  siteToggle: document.querySelector<HTMLInputElement>("#site-toggle")!,
  siteAccess: document.querySelector<HTMLElement>("#site-access")!,
  accessError: document.querySelector<HTMLElement>("#access-error")!,
  scanButton: document.querySelector<HTMLButtonElement>("#scan-button")!,
  restricted: document.querySelector<HTMLElement>("#restricted-state")!,
  results: document.querySelector<HTMLElement>("#results-section")!,
  count: document.querySelector<HTMLElement>("#result-count")!,
  list: document.querySelector<HTMLElement>("#number-list")!,
  search: document.querySelector<HTMLInputElement>("#search")!,
  empty: document.querySelector<HTMLElement>("#empty-state")!,
  loading: document.querySelector<HTMLElement>("#loading-state")!,
  settings: document.querySelector<HTMLButtonElement>("#settings-button")!,
  privacy: document.querySelector<HTMLButtonElement>("#privacy-button")!,
  toast: document.querySelector<HTMLElement>("#toast")!
};

let settings: DialBridgeSettings;
let locale: UiLocale = "en";
let context: ActiveContext = { supported: false, persistentAccess: false, reason: "missing-tab" };
let payload: ScanPayload | undefined;

async function send<T>(message: RuntimeMessage): Promise<T | undefined> {
  try {
    return await chrome.runtime.sendMessage(message) as T;
  } catch {
    return undefined;
  }
}

function showToast(message: string): void {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  window.setTimeout(() => elements.toast.classList.remove("visible"), 2_200);
}

function setState(state: "loading" | "restricted" | "empty" | "results"): void {
  elements.loading.hidden = state !== "loading";
  elements.restricted.hidden = state !== "restricted";
  elements.empty.hidden = state !== "empty";
  elements.results.hidden = state !== "results";
}

function countryName(country?: string): string {
  if (!country) return "";
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(country) ?? country;
  } catch {
    return country;
  }
}

function actionButton(label: string, action: "call" | "message" | "copy", phone: DetectedPhone, primary = false): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `button small${primary ? " primary" : ""}`;
  button.textContent = label;
  button.addEventListener("click", async () => {
    button.disabled = true;
    if (action === "copy") {
      await navigator.clipboard.writeText(phone.e164);
      showToast(translate("copied", locale));
    } else {
      await send({ type: "DB_PERFORM_ACTION", action, phone });
    }
    button.disabled = false;
  });
  return button;
}

function renderNumbers(): void {
  const query = elements.search.value.trim().toLowerCase();
  const phones = (payload?.phones ?? []).filter((phone) => {
    if (!query) return true;
    return [phone.raw, phone.e164, phone.international, phone.national, phone.country, ...phone.contexts]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  elements.list.replaceChildren();
  for (const phone of phones) {
    const card = document.createElement("article");
    card.className = "number-card";

    const row = document.createElement("div");
    row.className = "number-row";
    const main = document.createElement("div");
    main.className = "phone-main";
    const number = document.createElement("b");
    number.className = "international";
    number.textContent = phone.international;
    const meta = document.createElement("div");
    meta.className = "phone-meta";
    if (phone.country) {
      const chip = document.createElement("span");
      chip.className = "country-chip";
      chip.textContent = `${phone.country} · ${countryName(phone.country)}`;
      meta.append(chip);
    }
    if (phone.count > 1) {
      const count = document.createElement("span");
      count.textContent = `${translate("appeared", locale)} ${phone.count} ${translate("times", locale)}`;
      meta.append(count);
    }
    main.append(number, meta);
    row.append(main);

    const actions = document.createElement("div");
    actions.className = "number-actions";
    actions.append(
      actionButton(`☎ ${translate("call", locale)}`, "call", phone, true),
      actionButton(`✉ ${translate("message", locale)}`, "message", phone),
      actionButton(`⧉ ${translate("copy", locale)}`, "copy", phone)
    );
    card.append(row, actions);

    if (phone.contexts[0]) {
      const contextLine = document.createElement("p");
      contextLine.className = "contexts";
      contextLine.textContent = phone.contexts[0];
      contextLine.title = phone.contexts[0];
      card.append(contextLine);
    }
    elements.list.append(card);
  }
}

function render(): void {
  elements.siteCard.hidden = !context.supported;
  if (!context.supported) {
    setState("restricted");
    return;
  }

  elements.siteName.textContent = context.origin ? new URL(context.origin).hostname : translate("pageUnavailable", locale);
  elements.siteToggle.checked = context.persistentAccess;
  elements.siteToggle.disabled = !context.originPattern;
  const total = payload?.phones.length ?? 0;
  if (!payload) {
    setState("loading");
    return;
  }
  if (!total) {
    setState("empty");
    return;
  }

  elements.count.textContent = total === 1
    ? translate("oneNumberFound", locale)
    : `${total} ${translate("numbersFound", locale)}`;
  renderNumbers();
  setState("results");
}

async function refresh(inject = false): Promise<void> {
  setState("loading");
  if (inject) await send({ type: "DB_INJECT_ACTIVE" });
  context = await send<ActiveContext>({ type: "DB_GET_ACTIVE_CONTEXT" })
    ?? { supported: false, persistentAccess: false, reason: "missing-tab" };
  payload = context.tabId
    ? await send<ScanPayload>({ type: "DB_GET_RESULTS", tabId: context.tabId })
    : undefined;
  render();
}

elements.scanButton.addEventListener("click", async () => {
  elements.scanButton.disabled = true;
  payload = undefined;
  render();
  await send({ type: "DB_RESCAN" });
  await new Promise((resolve) => window.setTimeout(resolve, 180));
  await refresh();
  elements.scanButton.disabled = false;
});

elements.siteToggle.addEventListener("change", async () => {
  if (!context.originPattern) return;
  elements.siteToggle.disabled = true;
  elements.accessError.hidden = true;

  if (elements.siteToggle.checked) {
    const granted = await chrome.permissions.request({ origins: [context.originPattern] });
    if (granted) {
      await send({ type: "DB_REGISTER_ORIGIN", originPattern: context.originPattern });
      context.persistentAccess = true;
    } else {
      elements.siteToggle.checked = false;
      elements.accessError.textContent = translate("accessDenied", locale);
      elements.accessError.hidden = false;
    }
  } else {
    await send({ type: "DB_UNREGISTER_ORIGIN", originPattern: context.originPattern });
    await chrome.permissions.remove({ origins: [context.originPattern] });
    context.persistentAccess = false;
  }
  elements.siteToggle.disabled = false;
});

elements.search.addEventListener("input", renderNumbers);
elements.settings.addEventListener("click", () => void chrome.runtime.openOptionsPage());
elements.privacy.addEventListener("click", () => void chrome.tabs.create({ url: chrome.runtime.getURL("privacy/index.html") }));

chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
  if (message.type !== "DB_RESULTS_UPDATED" || message.payload.tabId !== context.tabId) return;
  payload = message.payload;
  render();
});

chrome.tabs.onActivated.addListener(() => void refresh(true));
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (tabId === context.tabId && change.status === "complete") void refresh(true);
});

void (async () => {
  settings = await getSettings();
  locale = resolveLocale(settings);
  applyTranslations(locale);
  await refresh(true);
})();
