import { build } from "esbuild";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const dist = join(root, "dist");
const buildDist = await mkdtemp(join(tmpdir(), "dialglide-build-"));

await rm(dist, { recursive: true, force: true });

const common = {
  bundle: true,
  sourcemap: false,
  minify: false,
  legalComments: "eof",
  target: "chrome116",
  logLevel: "info"
};

await Promise.all([
  build({
    ...common,
    entryPoints: [join(src, "background.ts")],
    outfile: join(buildDist, "background.js"),
    format: "esm",
    platform: "browser"
  }),
  build({
    ...common,
    entryPoints: [join(src, "content", "content.ts")],
    outfile: join(buildDist, "content.js"),
    format: "iife",
    platform: "browser"
  }),
  build({
    ...common,
    entryPoints: [join(src, "sidepanel", "index.ts")],
    outfile: join(buildDist, "sidepanel", "index.js"),
    format: "iife",
    platform: "browser"
  }),
  build({
    ...common,
    entryPoints: [join(src, "options", "index.ts")],
    outfile: join(buildDist, "options", "index.js"),
    format: "iife",
    platform: "browser"
  }),
  build({
    ...common,
    entryPoints: [join(src, "onboarding", "index.ts")],
    outfile: join(buildDist, "onboarding", "index.js"),
    format: "iife",
    platform: "browser"
  }),
  build({
    ...common,
    entryPoints: [join(src, "privacy", "index.ts")],
    outfile: join(buildDist, "privacy", "index.js"),
    format: "iife",
    platform: "browser"
  })
]);

const staticFiles = [
  "manifest.json",
  "content/content.css",
  "sidepanel/index.html",
  "sidepanel/index.css",
  "options/index.html",
  "options/index.css",
  "onboarding/index.html",
  "onboarding/index.css",
  "privacy/index.html",
  "privacy/index.css",
  "shared/ui.css",
  "assets",
  "_locales"
];

for (const relative of staticFiles) {
  await cp(join(src, relative), join(buildDist, relative), { recursive: true });
}

const manifestPath = join(buildDist, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.version = JSON.parse(await readFile(join(root, "package.json"), "utf8")).version;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

await cp(buildDist, dist, { recursive: true });
await rm(buildDist, { recursive: true, force: true });

console.log(`Built DialGlide in ${dist}`);
