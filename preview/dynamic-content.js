window.setTimeout(() => {
  const paragraph = document.createElement("p");
  const isArabic = new URLSearchParams(location.search).get("lang") === "ar";
  paragraph.textContent = isArabic
    ? "رقم تجريبي مضاف مباشرة: +1 202 555 0188"
    : "Dynamically added fictional number: +1 202 555 0188";
  document.querySelector("#dynamic-section")?.append(paragraph);
}, 120);
