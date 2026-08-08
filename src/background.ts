import { mergeDetectedPhones, parsePhoneInput } from "./core/phone";
import {
  ensureDefaultSettings,
  getEnabledOrigins,
  getSettings,
  setEnabledOrigins
} from "./core/settings";
import type {
  ActiveContext,
  DetectedPhone,
  RuntimeMessage,
  ScanPayload
} from "./core/types";

const MENU_CALL = "dialbridge.call-selection";
const MENU_MESSAGE = "dialbridge.message-selection";
const MENU_COPY = "dialbridge.copy-selection";
const MENU_PANEL = "dialbridge.open-panel";
const SESSION_PREFIX = "dialbridge.results.";

function localMessage(key: string, fallback: string): string {
  return chrome.i18n.getMessage(key) || fallback;
}

async function createMenus(): Promise<void> {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU_CALL,
    title: localMessage("menuCall", "Call %s with DialGlide"),
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: MENU_MESSAGE,
    title: localMessage("menuMessage", "Message %s with DialGlide"),
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: MENU_COPY,
    title: localMessage("menuCopy", "Copy formatted phone number"),
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: MENU_PANEL,
    title: localMessage("menuOpen", "Open DialGlide"),
    contexts: ["page"]
  });
}

async function configureSidePanel(): Promise<void> {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
}

chrome.runtime.onInstalled.addListener((details) => {
  void ensureDefaultSettings();
  void createMenus();
  void configureSidePanel();

  if (details.reason === "install") {
    void chrome.tabs.create({ url: chrome.runtime.getURL("onboarding/index.html") });
  }
});

chrome.runtime.onStartup.addListener(() => {
  void ensureDefaultSettings();
  void createMenus();
  void configureSidePanel();
});

void configureSidePanel();

function originPatternFromUrl(rawUrl: string): string | undefined {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return `${url.origin}/*`;
  } catch {
    return undefined;
  }
}

function isValidOriginPattern(value: string): boolean {
  if (!value.endsWith("/*") || value.length > 2_048) return false;
  try {
    const url = new URL(value.slice(0, -2));
    return (url.protocol === "http:" || url.protocol === "https:")
      && value === `${url.origin}/*`;
  } catch {
    return false;
  }
}

function scriptIdForOrigin(originPattern: string): string {
  let hash = 2166136261;
  for (const character of originPattern) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `dialbridge-${(hash >>> 0).toString(36)}`;
}

async function registerOrigin(originPattern: string): Promise<void> {
  const id = scriptIdForOrigin(originPattern);
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [id] });

  await chrome.scripting.registerContentScripts([{
    id,
    matches: [originPattern],
    js: ["content.js"],
    css: ["content/content.css"],
    runAt: "document_idle",
    allFrames: true,
    persistAcrossSessions: true
  }]);

  const origins = await getEnabledOrigins();
  if (!origins.includes(originPattern)) {
    await setEnabledOrigins([...origins, originPattern]);
  }
}

async function unregisterOrigin(originPattern: string): Promise<void> {
  const id = scriptIdForOrigin(originPattern);
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [id] });
  await setEnabledOrigins((await getEnabledOrigins()).filter((origin) => origin !== originPattern));
}

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

async function resolveTabUrl(tab: chrome.tabs.Tab): Promise<string | undefined> {
  const reportedUrl = tab.url ?? tab.pendingUrl;
  if (reportedUrl) return reportedUrl;
  if (!tab.id) return undefined;

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => globalThis.location.href
    });
    return typeof result?.result === "string" ? result.result : undefined;
  } catch {
    return undefined;
  }
}

async function getActiveContext(): Promise<ActiveContext> {
  const tab = await activeTab();
  if (!tab?.id) return { supported: false, persistentAccess: false, reason: "missing-tab" };

  const tabUrl = await resolveTabUrl(tab);
  const originPattern = tabUrl ? originPatternFromUrl(tabUrl) : undefined;
  if (!originPattern || !tabUrl) {
    return {
      supported: false,
      tabId: tab.id,
      persistentAccess: false,
      reason: "restricted"
    };
  }

  const url = new URL(tabUrl);
  const persistentAccess = await chrome.permissions.contains({ origins: [originPattern] });
  return {
    supported: true,
    tabId: tab.id,
    origin: url.origin,
    originPattern,
    persistentAccess
  };
}

async function sendToTab<T = unknown>(tabId: number, message: RuntimeMessage): Promise<T | undefined> {
  try {
    return await chrome.tabs.sendMessage(tabId, message) as T;
  } catch {
    return undefined;
  }
}

async function sendToFrame<T = unknown>(tabId: number, frameId: number, message: RuntimeMessage): Promise<T | undefined> {
  try {
    return await chrome.tabs.sendMessage(tabId, message, { frameId }) as T;
  } catch {
    return undefined;
  }
}

async function ensureInjected(tabId: number): Promise<void> {
  const ping = await sendToFrame<{ ok: boolean }>(tabId, 0, { type: "DB_PING" });
  if (!ping?.ok) {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["content/content.css"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  }

  try {
    await chrome.scripting.insertCSS({
      target: { tabId, allFrames: true },
      files: ["content/content.css"]
    });
  } catch {
    // Some cross-origin frames can remain inaccessible without their own host grant.
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["content.js"]
    });
  } catch {
    // The main frame is already ready; inaccessible child frames are ignored safely.
  }
}

function openPanelAndScanFromUserGesture(tabId: number): void {
  void chrome.sidePanel.open({ tabId }).catch((error: unknown) => {
    console.error("DialGlide could not open the side panel", error);
  });

  void (async () => {
    try {
      await ensureInjected(tabId);
      await sendToTab(tabId, { type: "DB_RESCAN" });
    } catch (error) {
      console.error("DialGlide could not scan the active tab", error);
    }
  })();
}

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) openPanelAndScanFromUserGesture(tab.id);
});

async function injectAndScanActive(): Promise<ActiveContext> {
  const context = await getActiveContext();
  if (!context.supported || !context.tabId) return context;
  await ensureInjected(context.tabId);
  await sendToTab(context.tabId, { type: "DB_RESCAN" });
  return context;
}

async function performOnActive(action: "call" | "message" | "copy", phone: DetectedPhone): Promise<void> {
  const context = await getActiveContext();
  if (!context.supported || !context.tabId) return;
  await ensureInjected(context.tabId);
  await sendToFrame(context.tabId, 0, { type: "DB_PERFORM_ACTION", action, phone });
}

function tabResultPrefix(tabId: number): string {
  return `${SESSION_PREFIX}${tabId}.`;
}

async function getResults(tabId: number): Promise<ScanPayload | undefined> {
  const stored = await chrome.storage.session.get(null);
  const prefix = tabResultPrefix(tabId);
  const legacyKey = `${SESSION_PREFIX}${tabId}`;
  const payloads = Object.entries(stored)
    .filter(([key]) => key === legacyKey || key.startsWith(prefix))
    .flatMap(([, value]) => {
      const payload = value as Partial<ScanPayload> | undefined;
      return Array.isArray(payload?.phones) ? [payload as ScanPayload] : [];
    });

  if (!payloads.length) return undefined;
  return {
    tabId,
    phones: mergeDetectedPhones(payloads.flatMap((payload) => payload.phones))
  };
}

async function clearResults(tabId: number): Promise<void> {
  const stored = await chrome.storage.session.get(null);
  const prefix = tabResultPrefix(tabId);
  const legacyKey = `${SESSION_PREFIX}${tabId}`;
  const keys = Object.keys(stored).filter((key) => key === legacyKey || key.startsWith(prefix));
  if (keys.length) await chrome.storage.session.remove(keys);
}

async function saveResults(payload: ScanPayload, tabId: number, frameId: number): Promise<ScanPayload> {
  await chrome.storage.session.set({
    [`${tabResultPrefix(tabId)}${frameId}`]: { ...payload, tabId }
  });
  return await getResults(tabId) ?? { tabId, phones: payload.phones };
}

chrome.tabs.onRemoved.addListener((tabId) => void clearResults(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") void clearResults(tabId);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === MENU_PANEL) {
    openPanelAndScanFromUserGesture(tab.id);
    return;
  }

  if (![MENU_CALL, MENU_MESSAGE, MENU_COPY].includes(String(info.menuItemId)) || !info.selectionText) return;

  void (async () => {
    const settings = await getSettings();
    const phone = parsePhoneInput(info.selectionText ?? "", settings.defaultCountry);
    if (!phone) return;
    const action = info.menuItemId === MENU_CALL
      ? "call"
      : info.menuItemId === MENU_MESSAGE
        ? "message"
        : "copy";
    await ensureInjected(tab.id!);
    await sendToFrame(tab.id!, 0, { type: "DB_PERFORM_ACTION", action, phone });
  })();
});

function isExtensionPageSender(sender: chrome.runtime.MessageSender): boolean {
  const extensionRoot = chrome.runtime.getURL("");
  return sender.id === chrome.runtime.id
    && typeof sender.url === "string"
    && sender.url.startsWith(extensionRoot);
}

function isWebContentScriptSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id || !sender.tab?.id) return false;
  return [sender.url, sender.origin, sender.tab.url]
    .some((sourceUrl) => typeof sourceUrl === "string" && originPatternFromUrl(sourceUrl) !== undefined);
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  if (!message || typeof message !== "object" || typeof message.type !== "string") return false;
  if (message.type === "DB_SCAN_RESULTS") {
    if (!isWebContentScriptSender(sender)) return false;
  } else if (!isExtensionPageSender(sender)) {
    return false;
  }

  const task = (async (): Promise<unknown> => {
    switch (message.type) {
      case "DB_GET_ACTIVE_CONTEXT":
        return getActiveContext();
      case "DB_INJECT_ACTIVE":
      case "DB_RESCAN":
        return injectAndScanActive();
      case "DB_GET_RESULTS":
        return getResults(message.tabId);
      case "DB_REGISTER_ORIGIN": {
        if (!isValidOriginPattern(message.originPattern)) throw new Error("Invalid website origin");
        const active = await getActiveContext();
        if (!active.supported || active.originPattern !== message.originPattern) {
          throw new Error("Website origin does not match the active tab");
        }
        const granted = await chrome.permissions.contains({ origins: [message.originPattern] });
        if (!granted) throw new Error("Website access has not been granted");
        await registerOrigin(message.originPattern);
        return { ok: true };
      }
      case "DB_UNREGISTER_ORIGIN":
        if (!isValidOriginPattern(message.originPattern)) throw new Error("Invalid website origin");
        await unregisterOrigin(message.originPattern);
        return { ok: true };
      case "DB_SCAN_RESULTS": {
        if (!sender.tab?.id) return { ok: false };
        const payload = await saveResults(message.payload, sender.tab.id, sender.frameId ?? 0);
        void chrome.runtime.sendMessage({ type: "DB_RESULTS_UPDATED", payload } satisfies RuntimeMessage)
          .catch(() => undefined);
        return { ok: true };
      }
      case "DB_PERFORM_ACTION":
        await performOnActive(message.action, message.phone);
        return { ok: true };
      case "DB_SETTINGS_UPDATED": {
        const tabs = await chrome.tabs.query({});
        await Promise.all(tabs.flatMap((tab) => tab.id
          ? [sendToTab(tab.id, { type: "DB_SETTINGS_UPDATED" })]
          : []));
        return { ok: true };
      }
      case "DB_RESULTS_UPDATED":
      case "DB_PING":
        return undefined;
    }
  })();

  void task.then(sendResponse).catch((error: unknown) => {
    console.error("DialGlide background error", error);
    sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unknown error" });
  });
  return true;
});
