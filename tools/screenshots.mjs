// Screenshots of every view at phone and desktop size, for reviewing changes
// without opening a browser. Serves the repo itself, so run from anywhere:
//   npm ci && npx playwright install chromium   (once)
//   node tools/screenshots.mjs [outDir]         (default: shots/)
// FM_CURL_IMAGES=1 fetches Imgur images through curl (for sandboxes whose
// headless browser can't reach it directly).

import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = process.argv[2] || join(ROOT, "shots");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".csv": "text/csv", ".woff2": "font/woff2", ".txt": "text/plain", ".svg": "image/svg+xml" };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  try {
    const body = await readFile(join(ROOT, path.endsWith("/") ? path + "index.html" : path));
    res.writeHead(200, { "content-type": TYPES[extname(path)] || (path.endsWith("/") ? "text/html" : "application/octet-stream") });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const BASE = `http://127.0.0.1:${server.address().port}/app/`;

// [name, width, height, hash, action?]
const SHOTS = [
  ["phone-table", 390, 844, "#/"],
  ["phone-table-rows", 390, 844, "#/", (p) => p.evaluate(() => scrollTo(0, 600))],
  ["phone-you", 390, 844, "#/{S}/player/{ME}"],
  ["phone-episode", 390, 844, "#/{S}/episodes"],
  ["phone-episode-scoreboard", 390, 844, "#/{S}/episodes", async (p) => { await p.click('[data-epsub="score"]'); await p.waitForTimeout(4500); }],
  ["phone-cast", 390, 844, "#/{S}/cast"],
  ["desktop-table", 1440, 900, "#/"],
  ["desktop-cast", 1440, 900, "#/{S}/cast"],
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const cache = new Map();
let series = null, me = null;

for (const [name, w, h, hash, action] of SHOTS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 600 ? 2 : 1, hasTouch: w < 600 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (process.env.FM_CURL_IMAGES) {
    await page.route(/i\.imgur\.com/, async (r) => {
      const u = r.request().url();
      if (!cache.has(u)) cache.set(u, execFileSync("curl", ["-s", "--retry", "3", u]));
      await r.fulfill({ body: cache.get(u), headers: { "content-type": "image/webp" } });
    });
  }
  if (me) await ctx.addInitScript((m) => localStorage.setItem("fm-me", JSON.stringify(m)), me);
  await page.goto(BASE + hash.replace("{S}", series).replace("{ME}", encodeURIComponent(me || "")));
  await page.waitForTimeout(2500);
  if (!series) {
    // Learn the current series and pick the table leader as "you" for later shots.
    series = await page.evaluate(() => location.hash.split("/")[1]);
    me = await page.evaluate(() => document.querySelector(".rows .pname")?.textContent || null);
  }
  if (action) { await action(page); await page.waitForTimeout(600); }
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`${errors.length ? "✗" : "✓"} ${name}${errors.length ? `: ${errors.join("; ")}` : ""}`);
  if (errors.length) process.exitCode = 1;
  await ctx.close();
}

await browser.close();
server.close();
console.log(`Saved to ${OUT}`);
