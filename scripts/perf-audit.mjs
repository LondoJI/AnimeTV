import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { gzipSync, brotliCompressSync } from "node:zlib";

const root = process.cwd();
const staticExts = new Set([".js", ".css", ".html", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".woff", ".woff2"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (staticExts.has(extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

function sizeInfo(file) {
  const raw = readFileSync(file);
  return {
    file: relative(root, file).replaceAll("\\", "/"),
    bytes: raw.length,
    gzip: gzipSync(raw).length,
    brotli: brotliCompressSync(raw).length
  };
}

function format(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

const index = readFileSync(join(root, "index.html"), "utf8");
const scripts = [...index.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((m) => m[1]);
const styles = [...index.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi)].map((m) => m[1]);
const preloads = [...index.matchAll(/<link\b[^>]*rel=["']preload["'][^>]*>/gi)].map((m) => m[0]);
const firstLoadFiles = [...scripts, ...styles]
  .map((url) => url.replace(/^\.\//, "").split("?")[0])
  .map((file) => join(root, file))
  .filter((file) => {
    try { return statSync(file).isFile(); } catch { return false; }
  })
  .map(sizeInfo);

const allStatic = walk(root)
  .filter((file) => !relative(root, file).startsWith("dist") && !relative(root, file).startsWith("public"))
  .map(sizeInfo)
  .sort((a, b) => b.bytes - a.bytes);

const firstLoadBytes = firstLoadFiles.reduce((sum, item) => sum + item.bytes, 0);
const firstLoadGzip = firstLoadFiles.reduce((sum, item) => sum + item.gzip, 0);
const firstLoadBrotli = firstLoadFiles.reduce((sum, item) => sum + item.brotli, 0);

console.log("ZenkaiTV performance inventory");
console.log(`First-load scripts/styles: ${firstLoadFiles.length}`);
console.log(`First-load transfer estimate: raw ${format(firstLoadBytes)} | gzip ${format(firstLoadGzip)} | brotli ${format(firstLoadBrotli)}`);
console.log(`Preloads in index.html: ${preloads.length}`);
console.log("");
console.log("Largest first-load assets:");
firstLoadFiles
  .sort((a, b) => b.bytes - a.bytes)
  .slice(0, 12)
  .forEach((item) => console.log(`  ${format(item.bytes).padStart(9)} raw | ${format(item.gzip).padStart(9)} gzip | ${item.file}`));
console.log("");
console.log("Largest static assets in repo:");
allStatic.slice(0, 15)
  .forEach((item) => console.log(`  ${format(item.bytes).padStart(9)} raw | ${format(item.gzip).padStart(9)} gzip | ${item.file}`));
