import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const execFileAsync = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(root, "packages", "core");
const dist = join(packageRoot, "dist");
const entry = join(packageRoot, "src", "index.ts");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await Promise.all([
  build({
    entryPoints: [entry],
    outfile: join(dist, "index.js"),
    bundle: false,
    platform: "neutral",
    format: "esm",
    target: "es2022",
    sourcemap: false,
    legalComments: "eof"
  }),
  build({
    entryPoints: [entry],
    outfile: join(dist, "index.cjs"),
    bundle: false,
    platform: "node",
    format: "cjs",
    target: "node18",
    sourcemap: false,
    legalComments: "eof"
  }),
  execFileAsync(process.execPath, [
    join(root, "node_modules", "typescript", "bin", "tsc"),
    "-p",
    join(packageRoot, "tsconfig.json")
  ])
]);

console.log(`Built DialGlide Core in ${dist}`);
