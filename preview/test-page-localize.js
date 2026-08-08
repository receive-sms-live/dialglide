const previewLang = new URLSearchParams(location.search).get("lang") === "ar" ? "ar" : "en";

const copy = {
  en: {
    title: "DialGlide contact detection demo",
    pageTitle: "Customer contacts",
    arabicDigits: "Arabic digits: ٠٢٠ ٧٩٤٦ ٠٩٥٨",
    london: "London support: +44 20 7946 0958",
    usOffice: "US office: +1 (202) 555-0147",
    ignored: "Ignored automatically: date 2026-08-04, order ID 202608041234, and time 12:45.",
    dynamic: "Live CRM contacts are detected as they appear."
  },
  ar: {
    title: "عرض اكتشاف جهات الاتصال في DialGlide",
    pageTitle: "جهات اتصال العملاء",
    arabicDigits: "أرقام عربية: ٠٢٠ ٧٩٤٦ ٠٩٥٨",
    london: "دعم لندن: +44 20 7946 0958",
    usOffice: "مكتب الولايات المتحدة: +1 (202) 555-0147",
    ignored: "يتم تجاهل غير الأرقام تلقائيًا: التاريخ 2026-08-04، رقم الطلب 202608041234، والوقت 12:45.",
    dynamic: "يتم اكتشاف جهات اتصال نظام CRM فور ظهورها."
  }
};

const localized = copy[previewLang];
document.documentElement.lang = previewLang;
document.documentElement.dir = previewLang === "ar" ? "rtl" : "ltr";
document.title = localized.title;
document.querySelector("#page-title").textContent = localized.pageTitle;
document.querySelector("#arabic-contact").textContent = localized.arabicDigits;
document.querySelector("#london-contact").textContent = localized.london;
document.querySelector("#us-contact").textContent = localized.usOffice;
document.querySelector("#non-phone-note").textContent = localized.ignored;
document.querySelector("#dynamic-note").textContent = localized.dynamic;
