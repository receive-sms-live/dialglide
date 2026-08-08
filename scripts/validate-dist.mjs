import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const manifest = JSON.parse(await readFile(join(dist, "manifest.json"), "utf8"));
const backgroundSource = await readFile(join(dist, manifest.background.service_worker), "utf8");

assert.equal(manifest.manifest_version, 3, "Manifest V3 is required");
assert.equal(manifest.background?.type, "module", "Background worker must be an ES module");
assert.match(backgroundSource, /chrome\.action\.onClicked\.addListener/, "Toolbar action must explicitly handle the user gesture");
assert.match(backgroundSource, /openPanelOnActionClick:\s*false/, "Automatic side-panel action behavior must stay disabled");
assert.ok(!manifest.host_permissions, "Required host permissions are not allowed in this privacy-first build");

const forbiddenPermissions = new Set(["cookies", "history", "tabs", "webRequest", "offscreen", "clipboardWrite"]);
for (const permission of manifest.permissions ?? []) {
  assert.ok(!forbiddenPermissions.has(permission), `Forbidden permission present: ${permission}`);
}

assert.deepEqual(
  [...(manifest.permissions ?? [])].sort(),
  ["activeTab", "contextMenus", "scripting", "sidePanel", "storage"].sort(),
  "Unexpected required permission set"
);
assert.deepEqual(
  [...(manifest.optional_host_permissions ?? [])].sort(),
  ["http://*/*", "https://*/*"].sort(),
  "Unexpected optional website access"
);

const requiredFiles = [
  manifest.background.service_worker,
  manifest.side_panel.default_path,
  manifest.options_page,
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon)
];

for (const relative of new Set(requiredFiles)) {
  assert.ok((await stat(join(dist, relative))).isFile(), `Manifest file is missing: ${relative}`);
}

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path));
    else files.push(path);
  }
  return files;
}

const files = await filesUnder(dist);
let totalBytes = 0;
for (const file of files) {
  totalBytes += (await stat(file)).size;
  const relative = file.slice(dist.length + 1);
  assert.ok(!/(^|\/)\.DS_Store$|\.map$|\.tsx?$|(^|\/)node_modules\//.test(relative), `Development file leaked into package: ${relative}`);
  const extension = extname(file);
  if (extension !== ".js" && extension !== ".html") continue;
  const source = await readFile(file, "utf8");
  assert.ok(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(source), `Executable string API found in ${file}`);
  assert.ok(!/<script\b(?![^>]*\bsrc=)[^>]*>/i.test(source), `Inline script found in ${file}`);
  assert.ok(!/<script[^>]+src=["']https?:\/\//i.test(source), `Remote script found in ${file}`);
  assert.ok(!/\bimport\s*\(\s*["']https?:\/\//i.test(source), `Remote import found in ${file}`);
  assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b|navigator\.sendBeacon/.test(source), `Unexpected network API found in ${file}`);
  assert.ok(!/\/Users\/|BEGIN [A-Z ]*PRIVATE KEY|\bAKIA[0-9A-Z]{16}\b|\bAIza[0-9A-Za-z_-]{30,}\b|mahmoud/i.test(source), `Sensitive local data found in ${file}`);
}

assert.ok(totalBytes < 1_500_000, `Extension package is unexpectedly large: ${totalBytes} bytes`);
console.log(`Validated ${files.length} files (${Math.round(totalBytes / 1024)} KiB) with minimal permissions and no remote code.`);
