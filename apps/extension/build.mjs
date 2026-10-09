// builds the extension into dist: the side panel, the background worker and the page script
import { rmSync } from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
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
console.log("Extension built to apps/extension/dist. Load that folder from chrome://extensions with Developer mode on.");
