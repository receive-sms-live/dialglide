import {
  aggregatePhones,
  buildTextWindows,
  buildActionUri,
  compactPhoneDigits,
  findPhoneMatches,
  isBlocked,
  mergeDetectedPhones
} from "../core/phone";
import { getSettings } from "../core/settings";
import type {
  DetectedPhone,
  DialBridgeSettings,
  PhoneAction,
  PhoneMatch,
  RuntimeMessage
} from "../core/types";

const RUNTIME_KEY = "__dialBridgeRuntime";
const WRAPPER_CLASS = "dialbridge-phone";
const SKIP_SELECTOR = [
  "script",
  "style",
  "noscript",
  "template",
  "textarea",
  "input",
  "select",
  "option",
  "button",
  "a",
  "code",
  "pre",
  "kbd",
  "samp",
  "[contenteditable='true']",
  "[aria-hidden='true']",
  `[data-dialbridge-ui]`,
  `.${WRAPPER_CLASS}`
].join(",");
const NEVER_SCAN_SELECTOR = [
  "script",
  "style",
  "noscript",
  "template",
  "[aria-hidden='true']",
  `[data-dialbridge-ui]`,
  `.${WRAPPER_CLASS}`
].join(",");
const PASSIVE_SELECTOR = [
  "a",
  "button",
  "[role='button']",
  "[role='link']",
  "input[type='tel']",
  "input[inputmode='tel']",
  "textarea",
  "code",
  "pre",
  "kbd",
  "samp",
  "[aria-label]",
  "[title]",
  "[itemprop='telephone']",
  "meta[itemprop='telephone']",
  "script[type='application/ld+json']",
  "[data-phone]",
  "[data-tel]",
  "[data-telephone]"
].join(",");
const SPLIT_TEXT_SELECTOR = "address,p,li,td,th,div,span";
const PHONE_ATTRIBUTES = [
  "aria-label",
  "title",
  "href",
  "content",
  "data-phone",
  "data-tel",
  "data-telephone"
] as const;

interface DialBridgeRuntime {
  rescan(): Promise<void>;
  perform(action: PhoneAction, phone: DetectedPhone): Promise<void>;
  refreshSettings(): Promise<void>;
  destroy(): void;
}

const runtimeGlobal = globalThis as typeof globalThis & {
  [RUNTIME_KEY]?: DialBridgeRuntime;
};

function preferredLocale(settings: DialBridgeSettings): "ar" | "en" {
  if (settings.locale === "ar" || settings.locale === "en") return settings.locale;
  return navigator.language.toLowerCase().startsWith("ar") ? "ar" : "en";
}

const STRINGS = {
  en: {
    call: "Call",
    message: "Message",
    copy: "Copy",
    cancel: "Cancel",
    previewTitle: "Ready to connect?",
    blocked: "This number is in your local blocklist.",
    copied: "Number copied",
    invalidHandler: "The selected handler is unavailable. Number copied instead.",
    detected: "Detected phone number"
  },
  ar: {
    call: "اتصال",
    message: "رسالة",
    copy: "نسخ",
    cancel: "إلغاء",
    previewTitle: "جاهز للتواصل؟",
    blocked: "هذا الرقم موجود في قائمة الحظر المحلية.",
    copied: "تم نسخ الرقم",
    invalidHandler: "طريقة الفتح المختارة غير متاحة، فتم نسخ الرقم بدلًا منها.",
    detected: "رقم هاتف مكتشف"
  }
} as const;

class PageDialBridge implements DialBridgeRuntime {
  private settings!: DialBridgeSettings;
  private readonly elementMatches = new WeakMap<HTMLElement, PhoneMatch>();
  private readonly wrappers = new Set<HTMLElement>();
  private readonly passiveMatches = new Map<string, PhoneMatch>();
  private readonly observedShadowRoots = new WeakSet<ShadowRoot>();
  private observer?: MutationObserver;
  private scanTimer?: number;
  private reportTimer?: number;
  private activeElement?: HTMLElement;
  private hideTimer?: number;
  private host!: HTMLDivElement;
  private shadow!: ShadowRoot;
  private toolbar!: HTMLDivElement;
  private dialog!: HTMLDivElement;
  private toast!: HTMLDivElement;

  async start(): Promise<void> {
    this.settings = await getSettings();
    this.createInterface();
    this.observe();
    await this.rescan();
    window.setTimeout(() => void this.rescan(), 1_000);
  }

  async refreshSettings(): Promise<void> {
    this.settings = await getSettings();
    document.documentElement.classList.toggle("dialbridge-hide-highlights", !this.settings.highlightNumbers);
    this.renderToolbarLabels();
    await this.report();
  }

  async rescan(): Promise<void> {
    if (!document.body) return;
    this.passiveMatches.clear();
    this.scanTree(document.body);
    await this.report();
  }

  destroy(): void {
    this.observer?.disconnect();
    this.host?.remove();
    for (const wrapper of this.wrappers) {
      if (wrapper.isConnected) wrapper.replaceWith(document.createTextNode(wrapper.textContent ?? ""));
    }
    this.wrappers.clear();
  }

  private createInterface(): void {
    this.host = document.createElement("div");
    this.host.dataset.dialbridgeUi = "root";
    this.host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    this.shadow = this.host.attachShadow({ mode: "closed" });
    this.shadow.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; }
        .toolbar { position: fixed; display: none; gap: 4px; align-items: center; padding: 5px; border: 1px solid #dce3ee; border-radius: 12px; background: #fff; box-shadow: 0 12px 34px rgba(16, 24, 40, .22); pointer-events: auto; font: 600 12px/1.2 Inter, ui-sans-serif, system-ui, sans-serif; color: #172033; }
        .toolbar.visible { display: flex; }
        button { appearance: none; border: 0; border-radius: 8px; background: transparent; color: inherit; padding: 7px 9px; font: inherit; cursor: pointer; white-space: nowrap; }
        button:hover, button:focus-visible { background: #eef6ff; color: #0757c7; outline: none; }
        button.primary { background: #0969e8; color: white; }
        button.primary:hover, button.primary:focus-visible { background: #0757c7; color: white; }
        .backdrop { position: fixed; inset: 0; display: none; place-items: center; padding: 20px; background: rgba(10, 18, 32, .38); pointer-events: auto; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
        .backdrop.visible { display: grid; }
        .card { width: min(360px, calc(100vw - 32px)); padding: 22px; border: 1px solid rgba(255,255,255,.5); border-radius: 20px; background: #fff; box-shadow: 0 24px 70px rgba(10, 18, 32, .28); color: #172033; }
        .eyebrow { margin: 0 0 8px; color: #5d6b82; font-size: 12px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; }
        .number { margin: 0; font-size: 24px; font-weight: 760; direction: ltr; unicode-bidi: isolate; }
        .meta { min-height: 18px; margin: 5px 0 18px; color: #66758c; font-size: 13px; }
        .actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .toast { position: fixed; left: 50%; bottom: 24px; display: none; transform: translateX(-50%); max-width: min(420px, calc(100vw - 32px)); padding: 11px 15px; border-radius: 11px; background: #172033; box-shadow: 0 12px 30px rgba(0,0,0,.2); color: #fff; font: 600 13px/1.4 Inter, ui-sans-serif, system-ui, sans-serif; pointer-events: none; }
        .toast.visible { display: block; animation: in .18s ease-out; }
        @keyframes in { from { opacity: 0; transform: translate(-50%, 5px); } }
      </style>
      <div class="toolbar" role="toolbar" aria-label="DialGlide">
        <button type="button" data-action="call"></button>
        <button type="button" data-action="message"></button>
        <button type="button" data-action="copy"></button>
      </div>
      <div class="backdrop" role="presentation">
        <section class="card" role="dialog" aria-modal="true" aria-labelledby="dialbridge-dialog-title">
          <p class="eyebrow" id="dialbridge-dialog-title"></p>
          <p class="number"></p>
          <p class="meta"></p>
          <div class="actions">
            <button type="button" class="primary" data-dialog-action="call"></button>
            <button type="button" data-dialog-action="message"></button>
            <button type="button" data-dialog-action="copy"></button>
            <button type="button" data-dialog-action="cancel"></button>
          </div>
        </section>
      </div>
      <div class="toast" role="status" aria-live="polite"></div>
    `;
    document.documentElement.append(this.host);
    this.toolbar = this.shadow.querySelector(".toolbar")!;
    this.dialog = this.shadow.querySelector(".backdrop")!;
    this.toast = this.shadow.querySelector(".toast")!;
    this.renderToolbarLabels();

    this.toolbar.addEventListener("pointerenter", () => window.clearTimeout(this.hideTimer));
    this.toolbar.addEventListener("pointerleave", () => this.scheduleHide());
    this.toolbar.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
      if (!target || !this.activeElement) return;
      const match = this.elementMatches.get(this.activeElement);
      if (!match) return;
      void this.handleAction(target.dataset.action as PhoneAction, this.toDetected(match), true);
    });

    this.dialog.addEventListener("click", (event) => {
      if (event.target === this.dialog) this.closeDialog();
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-dialog-action]");
      if (!target) return;
      if (target.dataset.dialogAction === "cancel") {
        this.closeDialog();
        return;
      }
      const phone = (this.dialog as HTMLElement & { dialbridgePhone?: DetectedPhone }).dialbridgePhone;
      if (phone) void this.perform(target.dataset.dialogAction as PhoneAction, phone);
    });
  }

  private renderToolbarLabels(): void {
    if (!this.shadow || !this.settings) return;
    const strings = STRINGS[preferredLocale(this.settings)];
    this.shadow.querySelectorAll<HTMLElement>("[data-action='call'], [data-dialog-action='call']").forEach((node) => { node.textContent = `☎ ${strings.call}`; });
    this.shadow.querySelectorAll<HTMLElement>("[data-action='message'], [data-dialog-action='message']").forEach((node) => { node.textContent = `✉ ${strings.message}`; });
    this.shadow.querySelectorAll<HTMLElement>("[data-action='copy'], [data-dialog-action='copy']").forEach((node) => { node.textContent = `⧉ ${strings.copy}`; });
    const cancel = this.shadow.querySelector<HTMLElement>("[data-dialog-action='cancel']");
    if (cancel) cancel.textContent = strings.cancel;
    const title = this.shadow.querySelector<HTMLElement>("#dialbridge-dialog-title");
    if (title) title.textContent = strings.previewTitle;
  }

  private observe(): void {
    this.observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const mutation of mutations) {
        if ((mutation.target as Element).parentElement?.closest?.(`[data-dialbridge-ui], .${WRAPPER_CLASS}`)) continue;
        if (mutation.type === "characterData" || mutation.type === "attributes" || mutation.addedNodes.length) {
          shouldScan = true;
          break;
        }
      }
      if (!shouldScan) return;
      window.clearTimeout(this.scanTimer);
      this.scanTimer = window.setTimeout(() => void this.rescan(), 280);
    });
    this.observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...PHONE_ATTRIBUTES, "value", "placeholder"]
    });
    document.addEventListener("input", () => {
      window.clearTimeout(this.scanTimer);
      this.scanTimer = window.setTimeout(() => void this.rescan(), 180);
    }, true);
  }

  private scanTree(root: HTMLElement | ShadowRoot): void {
    if (root instanceof ShadowRoot && !this.observedShadowRoots.has(root)) {
      this.observer?.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...PHONE_ATTRIBUTES, "value", "placeholder"]
      });
      this.observedShadowRoots.add(root);
    }

    this.scanPassiveSources(root);
    this.scanWrappableText(root);

    for (const element of root.querySelectorAll("*")) {
      if (element.shadowRoot) this.scanTree(element.shadowRoot);
    }
  }

  private scanWrappableText(root: Node): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => this.acceptTextNode(node as Text)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT
    });
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) this.wrapMatches(node);
  }

  private isVisibleElement(element: Element): boolean {
    if (!element.isConnected || element.closest(NEVER_SCAN_SELECTOR)) return false;
    if (element.getClientRects().length === 0) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  private rememberPassiveMatches(source: string): void {
    const text = source.replace(/\s+/g, " ").trim();
    if (!text || text.length > 5_000 || compactPhoneDigits(text).length < 7) return;

    for (const match of findPhoneMatches(text, this.settings.defaultCountry)) {
      if (!this.passiveMatches.has(match.id)) this.passiveMatches.set(match.id, match);
    }
  }

  private scanPassiveTextWindows(element: Element): void {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    while (walker.nextNode() && parts.length < 80) {
      const node = walker.currentNode as Text;
      if (!node.parentElement || !this.isVisibleElement(node.parentElement)) continue;
      const text = node.data.replace(/\s+/g, " ").trim();
      if (text) parts.push(text);
    }

    for (const windowText of buildTextWindows(parts)) this.rememberPassiveMatches(windowText);
  }

  private scanPassiveSources(root: HTMLElement | ShadowRoot): void {
    for (const element of root.querySelectorAll<HTMLElement>(PASSIVE_SELECTOR)) {
      const metadataOnly = element.matches("meta[itemprop='telephone'], script[type='application/ld+json']");
      if (!metadataOnly && !this.isVisibleElement(element)) continue;

      if (metadataOnly || element.matches("a,button,[role='button'],[role='link'],code,pre,kbd,samp")) {
        this.rememberPassiveMatches(element.textContent ?? "");
        this.scanPassiveTextWindows(element);
      }

      for (const attribute of PHONE_ATTRIBUTES) {
        const value = element.getAttribute(attribute);
        if (!value) continue;
        if (attribute === "content" && !element.matches("[itemprop='telephone']")) continue;
        this.rememberPassiveMatches(`${attribute.replaceAll("-", " ")}: ${value}`);
      }

      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        this.rememberPassiveMatches(`phone: ${element.value}`);
        this.rememberPassiveMatches(`phone: ${element.getAttribute("placeholder") ?? ""}`);
      }
    }

    for (const element of root.querySelectorAll<HTMLElement>(SPLIT_TEXT_SELECTOR)) {
      if (!this.isVisibleElement(element)) continue;
      const text = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const digitCount = compactPhoneDigits(text).length;
      if (text.length > 1_200 || digitCount < 7 || digitCount > 120 || element.childNodes.length < 2) continue;
      this.rememberPassiveMatches(text);
      this.scanPassiveTextWindows(element);
    }
  }

  private acceptTextNode(node: Text): boolean {
    const text = node.data;
    if (!text || text.length > 5_000 || !/\d|[٠-٩۰-۹０-９]/u.test(text)) return false;
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP_SELECTOR)) return false;
    if (parent.getClientRects().length === 0) return false;
    const style = getComputedStyle(parent);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  private wrapMatches(node: Text): void {
    const matches = findPhoneMatches(node.data, this.settings.defaultCountry);
    if (!matches.length || !node.parentNode) return;
    const fragment = document.createDocumentFragment();
    let cursor = 0;

    for (const match of matches) {
      if (match.startsAt < cursor) continue;
      fragment.append(document.createTextNode(node.data.slice(cursor, match.startsAt)));
      const wrapper = document.createElement("span");
      wrapper.className = WRAPPER_CLASS;
      wrapper.dataset.dialbridgePhone = match.id;
      wrapper.tabIndex = 0;
      wrapper.setAttribute("role", "link");
      wrapper.setAttribute("aria-label", `${STRINGS[preferredLocale(this.settings)].detected}: ${match.international}`);
      wrapper.textContent = node.data.slice(match.startsAt, match.endsAt);
      wrapper.addEventListener("pointerenter", () => this.showToolbar(wrapper));
      wrapper.addEventListener("pointerleave", () => this.scheduleHide());
      wrapper.addEventListener("focus", () => this.showToolbar(wrapper));
      wrapper.addEventListener("blur", () => this.scheduleHide());
      wrapper.addEventListener("click", (event) => {
        if (window.getSelection()?.toString()) return;
        event.preventDefault();
        event.stopPropagation();
        void this.handleAction("call", this.toDetected(match));
      });
      wrapper.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        void this.handleAction("call", this.toDetected(match));
      });
      this.elementMatches.set(wrapper, match);
      this.wrappers.add(wrapper);
      fragment.append(wrapper);
      cursor = match.endsAt;
    }

    fragment.append(document.createTextNode(node.data.slice(cursor)));
    node.replaceWith(fragment);
  }

  private toDetected(match: PhoneMatch): DetectedPhone {
    return {
      id: match.id,
      raw: match.raw,
      e164: match.e164,
      international: match.international,
      national: match.national,
      ...(match.country ? { country: match.country } : {}),
      ...(match.extension ? { extension: match.extension } : {}),
      count: 1,
      contexts: match.context ? [match.context] : []
    };
  }

  private showToolbar(wrapper: HTMLElement): void {
    window.clearTimeout(this.hideTimer);
    this.activeElement = wrapper;
    const rect = wrapper.getBoundingClientRect();
    this.toolbar.classList.add("visible");
    const toolbarRect = this.toolbar.getBoundingClientRect();
    const left = Math.min(window.innerWidth - toolbarRect.width - 8, Math.max(8, rect.left));
    const preferredTop = rect.top - toolbarRect.height - 7;
    const top = preferredTop >= 8 ? preferredTop : Math.min(window.innerHeight - toolbarRect.height - 8, rect.bottom + 7);
    this.toolbar.style.left = `${left}px`;
    this.toolbar.style.top = `${top}px`;
  }

  private scheduleHide(): void {
    window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => this.toolbar.classList.remove("visible"), 160);
  }

  private async handleAction(action: PhoneAction, phone: DetectedPhone, fromToolbar = false): Promise<void> {
    if (action === "call" && this.settings.activationMode === "preview" && !fromToolbar) {
      this.openDialog(phone);
      return;
    }
    await this.perform(action, phone);
  }

  async perform(action: PhoneAction, phone: DetectedPhone): Promise<void> {
    if (isBlocked(phone, this.settings)) {
      this.showToast(STRINGS[preferredLocale(this.settings)].blocked);
      return;
    }

    if (action === "copy") {
      await this.copyText(phone.e164);
      this.showToast(STRINGS[preferredLocale(this.settings)].copied);
      this.closeDialog();
      return;
    }

    const uri = buildActionUri(action, phone, this.settings);
    if (!uri) {
      await this.copyText(phone.e164);
      this.showToast(STRINGS[preferredLocale(this.settings)].invalidHandler);
      this.closeDialog();
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = uri;
    if (/^https?:/i.test(uri)) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
    anchor.style.display = "none";
    this.host.append(anchor);
    anchor.click();
    anchor.remove();
    this.closeDialog();
  }

  private async copyText(value: string): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
      }
    } catch {
      // Fall back to the page's transient selection for non-secure origins.
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.readOnly = true;
    textarea.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0;";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("Copy is not available on this page");
  }

  private openDialog(phone: DetectedPhone): void {
    (this.dialog as HTMLElement & { dialbridgePhone?: DetectedPhone }).dialbridgePhone = phone;
    const number = this.shadow.querySelector<HTMLElement>(".number");
    const meta = this.shadow.querySelector<HTMLElement>(".meta");
    if (number) number.textContent = phone.international;
    if (meta) meta.textContent = [phone.country, phone.extension ? `Ext. ${phone.extension}` : ""].filter(Boolean).join(" · ");
    this.dialog.classList.add("visible");
    this.shadow.querySelector<HTMLButtonElement>("[data-dialog-action='call']")?.focus();
  }

  private closeDialog(): void {
    this.dialog.classList.remove("visible");
    delete (this.dialog as HTMLElement & { dialbridgePhone?: DetectedPhone }).dialbridgePhone;
  }

  private showToast(message: string): void {
    this.toast.textContent = message;
    this.toast.classList.add("visible");
    window.setTimeout(() => this.toast.classList.remove("visible"), 2_400);
  }

  private async report(): Promise<void> {
    window.clearTimeout(this.reportTimer);
    const wrappedMatches = [...this.wrappers]
      .filter((wrapper) => wrapper.isConnected)
      .flatMap((wrapper) => {
        const match = this.elementMatches.get(wrapper);
        return match ? [match] : [];
      });

    for (const wrapper of [...this.wrappers]) {
      if (!wrapper.isConnected) this.wrappers.delete(wrapper);
    }

    const wrappedPhones = aggregatePhones(wrappedMatches);
    const wrappedIds = new Set(wrappedPhones.map((phone) => phone.id));
    const passivePhones = aggregatePhones([...this.passiveMatches.values()])
      .filter((phone) => !wrappedIds.has(phone.id));

    await chrome.runtime.sendMessage({
      type: "DB_SCAN_RESULTS",
      payload: {
        phones: mergeDetectedPhones([...wrappedPhones, ...passivePhones])
      }
    } satisfies RuntimeMessage).catch(() => undefined);
  }
}

if (!runtimeGlobal[RUNTIME_KEY]) {
  const runtime = new PageDialBridge();
  runtimeGlobal[RUNTIME_KEY] = runtime;
  void runtime.start();
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  const runtime = runtimeGlobal[RUNTIME_KEY];
  if (!runtime) return false;

  if (message.type === "DB_PING") {
    sendResponse({ ok: true });
    return false;
  }

  const task = message.type === "DB_RESCAN"
    ? runtime.rescan()
    : message.type === "DB_SETTINGS_UPDATED"
      ? runtime.refreshSettings()
      : message.type === "DB_PERFORM_ACTION"
        ? runtime.perform(message.action, message.phone)
        : undefined;

  if (!task) return false;
  void task.then(() => sendResponse({ ok: true })).catch((error: unknown) => {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unknown error" });
  });
  return true;
});
