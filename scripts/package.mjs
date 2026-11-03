import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

// Production build of dist/extension, zipped for the Chrome Web Store (manifest.json must sit at the zip root).
// The store rejects an upload whose version it has already seen: bump "version" in extension/manifest.json first.
execFileSync(process.execPath, ["scripts/build.mjs"], { stdio: "inherit" });
const { version } = JSON.parse(await readFile("dist/extension/manifest.json", "utf8"));
await mkdir("release", { recursive: true });
const out = resolve(`release/strike-pac-copilot-${version}.zip`);
await rm(out, { force: true });
if (process.platform === "win32") {
  execFileSync("powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -Path dist/extension/* -DestinationPath '${out}'`], { stdio: "inherit" });
} else {
  execFileSync("zip", ["-r", "-X", "-q", out, "."], { cwd: "dist/extension", stdio: "inherit" });
}
console.log(`Packaged ${out}`);
