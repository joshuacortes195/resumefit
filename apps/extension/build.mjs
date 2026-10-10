// builds the extension into dist: the side panel, the background worker and the page script, plus a zip of it for the web app
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { zipSync } from "fflate";
import { build } from "vite";

const root = import.meta.dirname;
const outDir = path.join(root, "dist");
rmSync(outDir, { recursive: true, force: true });

// the side panel is a small react page, built the normal way. this pass also copies the manifest and icon
await build({ root, plugins: [react()], base: "./", build: { outDir, emptyOutDir: true, rollupOptions: { input: path.join(root, "sidepanel.html") } }, logLevel: "warn" });

// the page script and the background worker each have to be one file with nothing to load at run time
for (const [name, format] of [
  ["content", "iife"],
  ["background", "es"],
]) {
  await build({
    root,
    publicDir: false,
    build: { outDir, emptyOutDir: false, lib: { entry: path.join(root, "src", `${name}.ts`), formats: [format], name: "resumefit", fileName: () => `${name}.js` }, minify: false },
    logLevel: "warn",
  });
}
// zip it up for the download button on the web app's Chrome Extension page.
// everything sits in one folder inside the zip, so unzipping gives a folder that Chrome can load as is
const files = {};
for (const entry of readdirSync(outDir, { recursive: true, withFileTypes: true }).sort((a, b) => path.join(a.parentPath, a.name).localeCompare(path.join(b.parentPath, b.name)))) {
  if (!entry.isFile()) continue;
  const full = path.join(entry.parentPath, entry.name);
  // a fixed date keeps the zip byte for byte the same when nothing in it changed
  files[`resumefit-extension/${path.relative(outDir, full).split(path.sep).join("/")}`] = [readFileSync(full), { mtime: new Date("2026-01-01T00:00:00Z") }];
}
const publicDir = path.join(root, "../web/public");
mkdirSync(publicDir, { recursive: true });
writeFileSync(path.join(publicDir, "resumefit-extension.zip"), zipSync(files, { level: 9 }));

console.log("Extension built to apps/extension/dist. Load that folder from chrome://extensions with Developer mode on.");
