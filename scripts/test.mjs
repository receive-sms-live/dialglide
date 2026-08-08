import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(join(tmpdir(), "dialglide-tests-"));

await build({
  entryPoints: [join(root, "tests", "phone.test.ts")],
  outfile: join(temp, "phone.test.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  logLevel: "silent"
});

try {
  await import(`${pathToFileURL(join(temp, "phone.test.mjs")).href}?t=${Date.now()}`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
