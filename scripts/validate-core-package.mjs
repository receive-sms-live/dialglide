import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(root, "packages", "core");
const dist = join(packageRoot, "dist");
const packageJson = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));

assert.equal(packageJson.name, "dialglide");
assert.equal(packageJson.private, undefined);
assert.equal(packageJson.license, "MPL-2.0");
assert.deepEqual(packageJson.files, ["dist", "README.md", "LICENSE"]);

for (const filename of ["index.js", "index.cjs", "index.d.ts"]) {
  const details = await stat(join(dist, filename));
  assert.ok(details.isFile() && details.size > 0, `${filename} was not built`);
}

const esm = await import(`${pathToFileURL(join(dist, "index.js")).href}?t=${Date.now()}`);
const require = createRequire(import.meta.url);
const cjs = require(join(dist, "index.cjs"));

assert.equal(esm.normalizeDigits("٢٠٢ ٥٥٥ ٠١٤٧"), "202 555 0147");
assert.equal(esm.parsePhoneInput("٢٠٢ ٥٥٥ ٠١٤٧", "US")?.e164, "+12025550147");
assert.equal(cjs.parsePhoneInput("+1 202 555 0147", "US")?.e164, "+12025550147");

console.log("Validated DialGlide Core ESM, CommonJS, types, and package metadata.");
