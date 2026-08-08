const previewSettings = {
  locale: new URLSearchParams(location.search).get("lang") === "ar" ? "ar" : "en",
  defaultCountry: "GB",
  activationMode: "preview",
  highlightNumbers: true,
  callHandler: { type: "tel", customTemplate: "" },
  messageHandler: { type: "sms", customTemplate: "" },
  blockedNumbers: [],
  onboardingComplete: true
};

const previewPhones = [
  {
    id: "+442079460958",
    raw: "٠٢٠ ٧٩٤٦ ٠٩٥٨",
    e164: "+442079460958",
    international: "+44 20 7946 0958",
    national: "020 7946 0958",
    country: "GB",
    count: 3,
    contexts: ["للحجز والاستفسار اتصل على ٠٢٠ ٧٩٤٦ ٠٩٥٨ طوال أيام الأسبوع"]
  },
  {
    id: "+12025550147",
    raw: "+1 (202) 555-0147",
    e164: "+12025550147",
    international: "+1 202 555 0147",
    national: "(202) 555-0147",
    country: "US",
    count: 1,
    contexts: ["US office: +1 (202) 555-0147"]
  },
  {
    id: "+14165550136",
    raw: "+1 (416) 555-0136",
    e164: "+14165550136",
    international: "+1 416 555 0136",
    national: "(416) 555-0136",
    country: "CA",
    count: 2,
    contexts: ["Canada support +1 (416) 555-0136"]
  }
];

const previewContext = {
  supported: true,
  tabId: 7,
  origin: "https://example.com",
  originPattern: "https://example.com/*",
  persistentAccess: false
};

const listeners = [];

window.chrome = window.chrome || {};
Object.assign(window.chrome, {
  storage: {
    local: {
      async get(key) {
        if (key === "dialbridge.settings") return { "dialbridge.settings": previewSettings };
        if (key === "dialbridge.enabledOrigins") return { "dialbridge.enabledOrigins": ["https://crm.example.com/*"] };
        return {};
      },
      async set() {}
    }
  },
  runtime: {
    async sendMessage(message) {
      if (message.type === "DB_GET_ACTIVE_CONTEXT" || message.type === "DB_INJECT_ACTIVE" || message.type === "DB_RESCAN") return previewContext;
      if (message.type === "DB_GET_RESULTS") {
        return { tabId: 7, phones: previewPhones };
      }
      return { ok: true };
    },
    onMessage: { addListener(listener) { listeners.push(listener); } },
    openOptionsPage() {},
    getURL(path) { return `../dist/${path}`; }
  },
  permissions: {
    async request() { return true; },
    async remove() { return true; }
  },
  tabs: {
    async create() {},
    onActivated: { addListener() {} },
    onUpdated: { addListener() {} }
  }
});
