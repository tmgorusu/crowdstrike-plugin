import { build, context } from "esbuild";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

// Builds dist/extension (load this folder in chrome://extensions) and dist/server.mjs.
const watch = process.argv.includes("--watch");
const dev = watch || process.argv.includes("--dev");
await rm("dist", { recursive: true, force: true });
await mkdir("dist/extension/icons", { recursive: true });
await cp("extension/manifest.json", "dist/extension/manifest.json");
for (const size of [16, 48, 128]) await writeFile(`dist/extension/icons/icon${size}.png`, icon(size));

const ext = {
  entryPoints: { content: "extension/src/content/index.tsx", background: "extension/src/background.ts" },
  outdir: "dist/extension", bundle: true, format: "iife", target: "chrome114", jsx: "automatic",
  minify: !dev, legalComments: "none", define: { "process.env.NODE_ENV": dev ? '"development"' : '"production"' },
};
const server = { entryPoints: ["server/index.ts"], outfile: "dist/server.mjs", bundle: true, platform: "node", format: "esm", target: "node20", packages: "external" };

if (watch) {
  await Promise.all([(await context(ext)).watch(), (await context(server)).watch()]);
  console.log("Watching… reload the extension in chrome://extensions after changes.");
} else {
  await Promise.all([build(ext), build(server)]);
  console.log("Built dist/extension and dist/server.mjs");
}

// Navy disc with a gold star, rasterized directly so the repo needs no image assets.
function icon(n) {
  const star = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.2 : 0.42;
    return [0.5 + r * Math.cos(a), 0.53 + r * Math.sin(a)];
  });
  const inside = (x, y) => { let c = false; for (let i = 0, j = 9; i < 10; j = i++) { const [xi, yi] = star[i], [xj, yj] = star[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const rows = [];
  for (let py = 0; py < n; py++) {
    const row = [0];
    for (let px = 0; px < n; px++) {
      let r = 0, g = 0, b = 0, a = 0; const S = 4;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const x = (px + (sx + 0.5) / S) / n, y = (py + (sy + 0.5) / S) / n;
        if ((x - 0.5) ** 2 + (y - 0.5) ** 2 > 0.25) continue;
        const [cr, cg, cb] = inside(x, y) ? [244, 183, 64] : [19, 41, 75];
        r += cr; g += cg; b += cb; a++;
      }
      const k = S * S;
      row.push(a ? Math.round(r / a) : 0, a ? Math.round(g / a) : 0, a ? Math.round(b / a) : 0, Math.round((a / k) * 255));
    }
    rows.push(...row);
  }
  const crc = (buf) => { let c, t = []; for (let i = 0; i < 256; i++) { c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } let x = 0xffffffff; for (const v of buf) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.from(rows))), chunk("IEND", Buffer.alloc(0))]);
}
