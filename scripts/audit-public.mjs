import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const ignoredDirectories = new Set([".git", "node_modules", "dist"]);
const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico"]);
const forbiddenFile = /(^|\/)(?:\.env(?:\..+)?|\.npmrc|\.DS_Store|id_(?:rsa|dsa|ecdsa|ed25519)|Cookies|Login Data)$|\.(?:zip|tgz|pem|key|p12|pfx)$/i;
const sensitivePatterns = [
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["GitHub token", /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ["npm token", /npm_[A-Za-z0-9]{20,}/],
  ["OpenAI key", /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/],
  ["AWS access key", /AKIA[0-9A-Z]{16}/],
  ["authorization bearer", /authorization\s*:\s*bearer\s+[A-Za-z0-9._-]{12,}/i],
  ["assigned credential", /(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*["']?[A-Za-z0-9._/-]{12,}/i],
  ["macOS home path", /\/Users\/[A-Za-z0-9._-]+\//],
  ["Linux home path", /\/home\/[A-Za-z0-9._-]+\//],
  ["Windows home path", /[A-Za-z]:\\Users\\[^\\\s]+\\/i]
];
const allowedEmails = new Set([
  "support@receive-smss.live",
  "catamphetamine@yandex.ru"
]);

const files = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile()) files.push(path);
  }
}

await walk(root);

const findings = [];
for (const path of files) {
  const publicPath = relative(root, path).replaceAll("\\", "/");
  if (forbiddenFile.test(publicPath)) {
    findings.push(`${publicPath}: forbidden file type or name`);
    continue;
  }
  if (binaryExtensions.has(extname(path).toLowerCase())) continue;

  const contents = await readFile(path, "utf8");
  for (const [label, pattern] of sensitivePatterns) {
    if (pattern.test(contents)) findings.push(`${publicPath}: ${label}`);
  }

  const emails = contents.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  for (const email of new Set(emails.map((value) => value.toLowerCase()))) {
    if (!allowedEmails.has(email)) findings.push(`${publicPath}: unreviewed email address`);
  }
}

if (findings.length > 0) {
  console.error("Public-source audit failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`Public-source audit passed for ${files.length} files; no forbidden secrets, credentials, home paths, archives, or unreviewed email addresses found.`);
}
