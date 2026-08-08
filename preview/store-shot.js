const lang = new URLSearchParams(location.search).get("lang") === "ar" ? "ar" : "en";
const suffix = `?lang=${lang}`;
const page = document.querySelector("#page-preview");
const panel = document.querySelector("#panel-preview");
const settings = document.querySelector("#settings-preview");
if (page) page.src = `test-page.html${suffix}`;
if (panel) panel.src = `sidepanel.html${suffix}`;
if (settings) settings.src = `options.html${suffix}`;

const address = document.querySelector(".address");
if (address && lang === "ar") {
  address.textContent = settings ? "إعدادات DialGlide" : "example.com/ar/contacts";
}
