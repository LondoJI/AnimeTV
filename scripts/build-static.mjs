import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const files = [
  "index.html",
  "offline.html",
  "styles.css",
  "update-manager.js",
  "manifest.webmanifest",
  "sources.json",
  "icon.svg",
  "service-worker.js"
];

const outDirs = ["dist", "public"];
const sourceDir = existsSync("vercel-static") ? "vercel-static" : ".";

for (const outDir of outDirs) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  for (const file of files) {
    copyFileSync(join(sourceDir, file), join(outDir, file));
  }

  copyFileSync(join(sourceDir, "client.js"), join(outDir, "client.js"));
}

console.log(`AnimeTV static build ready in ${outDirs.join(" and ")}`);
