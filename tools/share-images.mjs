// The link preview and home-screen icons, drawn with the app's own fonts,
// colours and portraits so they match the site:
//   img/share.jpg                 1200 × 630, the og:image WhatsApp & co. show
//   img/icon-180.png              apple-touch-icon (iOS home screen)
//   img/icon-192.png, icon-512.png  manifest.webmanifest (Android home screen)
//   img/icon-32.png, icon-48.png    the browser-tab favicon
// Re-run when a new series starts (the preview shows its cast):
//   node tools/share-images.mjs [series]        (default: the latest in the CSV)
// FM_CURL_IMAGES=1 fetches Google Fonts through curl, as in screenshots.mjs.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { parseCSV } from "../js/csv.js";

const ROOT = new URL("..", import.meta.url).pathname;
const TYPES = { ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg" };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  try { const body = await readFile(join(ROOT, path)); res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const BASE = `http://127.0.0.1:${server.address().port}/`;

const rows = parseCSV(await readFile(join(ROOT, "data/fantasky_master_data.csv"), "utf8"));
const series = process.argv[2] || String(Math.max(...rows.filter((r) => r.record === "contestant").map((r) => +r.series)));
const cast = rows.filter((r) => r.record === "contestant" && r.series === series);
if (cast.length !== 5) throw new Error(`Series ${series} has ${cast.length} contestants, not 5`);

const FONTS = "https://fonts.googleapis.com/css2?family=Bungee&family=DM+Mono:wght@500&display=block";
const page = (body, css) => `<!doctype html><html><head><meta charset="utf-8"><base href="${BASE}">
<link rel="stylesheet" href="${FONTS}"><link rel="stylesheet" href="styles.css">
<style>
  html, body { margin: 0; background: var(--bg); }
  .stage { position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: radial-gradient(ellipse 70% 85% at 50% 0%, rgba(150, 18, 18, .55), rgba(80, 8, 8, .25) 55%, transparent 80%), var(--bg); }
  .stage::before { content: ""; position: absolute; inset: 0; background: var(--grain); opacity: .9; }
  .stage > * { position: relative; }
  .brand { font-size: inherit; transform: none; transition: none; }
  ${css}
</style></head><body>${body}</body></html>`;

const SHARE = page(`
  <div class="stage share">
    <div class="kicker">A Taskmaster fantasy league</div>
    <div class="brand"><span><span class="g">FAN</span>TASK<span class="g">Y</span> MASTER</span></div>
    <div class="cast">${cast.map((c) => `<img src="${c.portrait_url}" alt="">`).join("")}</div>
    <div class="rule"></div>
  </div>`, `
  .share { width: 1200px; height: 630px; gap: 0; }
  .share .kicker { font: 500 22px var(--fm); letter-spacing: .3em; text-transform: uppercase; color: var(--t3); text-shadow: 0 1px 8px rgba(0, 0, 0, .7); }
  .share .brand { font-size: 88px; margin-top: 14px; }
  .share .cast { display: flex; gap: 22px; margin-top: 44px; }
  .share .cast img { width: 168px; height: auto; aspect-ratio: 225 / 266; filter: drop-shadow(0 6px 14px rgba(0, 0, 0, .7)); }
  .share .rule { position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--gold2) 30%, var(--gold2) 70%, transparent); opacity: .7; }`);

// Full bleed, no border: iOS rounds the corners and Android may crop to a circle,
// so everything that matters sits in the middle.
const ICON = page(`<div class="stage icon"><div class="brand"><span><span class="g">F</span><span class="g">M</span></span></div></div>`, `
  .icon { width: 512px; height: 512px; }
  .icon .brand { font-size: 236px; letter-spacing: -.02em; margin-top: 18px; }
  .icon .brand .g { text-shadow: 0 0 40px var(--gold-glow), 0 4px 0 rgba(0, 0, 0, .6); }`);

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const browser = await chromium.launch({ args: ["--disable-lcd-text"] }); // grey antialiasing: no colour fringes on small icons
async function shoot(html, w, h, scale, path, type) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  const p = await ctx.newPage();
  if (process.env.FM_CURL_IMAGES) await p.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, async (r) => {
    const u = r.request().url();
    await r.fulfill({ body: execFileSync("curl", ["-s", "--retry", "3", "-A", UA, u], { maxBuffer: 1 << 26 }), headers: { "content-type": u.includes("googleapis") ? "text/css" : "font/woff2", "access-control-allow-origin": "*" } });
  });
  await p.setContent(html, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  if (!(await p.evaluate(() => document.fonts.check("16px Bungee")))) throw new Error("Bungee didn't load (in the sandbox, set FM_CURL_IMAGES=1)");
  await p.screenshot({ path: join(ROOT, path), type, ...(type === "jpeg" ? { quality: 86 } : {}) });
  await ctx.close();
  console.log("✓", path);
}
await shoot(SHARE, 1200, 630, 1, "img/share.jpg", "jpeg");
for (const [n, s] of [[512, 1], [192, 192 / 512], [180, 180 / 512], [48, 48 / 512], [32, 32 / 512]]) await shoot(ICON, 512, 512, s, `img/icon-${n}.png`, "png");
await browser.close();
server.close();
