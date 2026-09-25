// The stage: an HD-2D style diorama of the Taskmaster house. Original pixel
// art is drawn at 480×144 onto layered canvases (far scenery, the house,
// foreground, light bloom, particles) set at different depths in a CSS 3D
// scene, so the camera's sway gives real parallax. The far and near layers
// are blurred for a tilt-shift depth of field; lights bloom through a
// blurred glow layer. The ten windows are the ten episodes.

export const W = 480, H = 144;
const CX = 240;

const PALETTES = {
  greek: {
    hill: "#1a2233", hill2: "#141b29", far: "#232b3d", farLit: "#f0c26a",
    wall: "#6a4536", wall2: "#5a392d", mortar: "#7a5242", trim: "#e6dac0",
    roof: "#29323f", roof2: "#333e4e", door: "#1d4966", glass: "#0e1626", glassHi: "#2b3c5c",
    grass: "#10201a", grass2: "#173022", path: "#39382f", leaf: "#13251c", leaf2: "#1d3a2a", trunk: "#2a1c14",
    lamp: "#ffd27a", accent: "#d9a62e", moon: "#f3e8c8", moon2: "#d9ceb0", fence: "#b7ab8f", fence2: "#8c8169",
    flower: ["#d9a62e", "#e6dac0", "#b5562f"], neon: null,
  },
  diner: {
    hill: "#24162c", hill2: "#1b1022", far: "#2c1d34", farLit: "#ffb3d1",
    wall: "#4b3251", wall2: "#3d2843", mortar: "#5a3d60", trim: "#ece0c8",
    roof: "#1c1a2a", roof2: "#262338", door: "#b3243a", glass: "#120d1c", glassHi: "#2d2442",
    grass: "#0f1a18", grass2: "#152622", path: "#37303a", leaf: "#122420", leaf2: "#1a332c", trunk: "#261a1a",
    lamp: "#ffd27a", accent: "#ff4f7a", moon: "#f6e6f0", moon2: "#dccbd6", fence: "#c9bcc4", fence2: "#978a93",
    flower: ["#ff4f7a", "#37d6c8", "#ffd27a"], neon: "#ff5fa2",
  },
};

// Episode windows: ground floor 1–4, first floor 5–9, attic oculus 10.
const WIN = [
  ...[204, 222, 258, 276].map((cx) => ({ x: cx - 5, y: 94, w: 10, h: 13 })),
  ...[204, 222, 240, 258, 276].map((cx) => ({ x: cx - 5, y: 64, w: 10, h: 13 })),
  { x: CX - 6, y: 36, w: 13, h: 13, round: true },
];
const CHIMNEY = { x: 270, y: 27 };
const CARAVAN = { x: 306, y: 103, w: 42, h: 19 };

// ── Pixel helpers ────────────────────────────────────────────────────────────

const rect = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, w | 0, h | 0); };
function disc(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy) + 0.3);
    c.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
  }
}
function dither(c, x, y, w, h, col, phase = 0) {
  c.fillStyle = col;
  for (let j = 0; j < h; j++) for (let i = (j + phase) & 1; i < w; i += 2) c.fillRect(x + i, y + j, 1, 1);
}
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// ── Layers ───────────────────────────────────────────────────────────────────

function drawFar(c, p, theme) {
  c.clearRect(0, 0, W, H);
  // Moon.
  disc(c, 330, 20, 8, p.moon);
  rect(c, 327, 17, 2, 2, p.moon2); rect(c, 332, 22, 3, 2, p.moon2); rect(c, 329, 24, 1, 1, p.moon2);

  // Rolling hills and tree lines.
  for (let x = 0; x < W; x++) {
    const h1 = 92 + Math.round(5 * Math.sin(x * 0.03) + 3 * Math.sin(x * 0.11 + 1));
    rect(c, x, h1, 1, H - h1, p.hill);
    const h2 = 104 + Math.round(4 * Math.sin(x * 0.05 + 2) + 2 * Math.sin(x * 0.17));
    rect(c, x, h2, 1, H - h2, p.hill2);
  }
  const r = rng(7);
  for (let x = 4; x < W; x += 9 + ((r() * 8) | 0)) {
    if (x > 180 && x < 300) continue;
    disc(c, x, 96 + ((r() * 6) | 0), 3 + ((r() * 3) | 0), p.hill2);
  }

  if (theme === "diner") {
    // Hampton Court: long Tudor range, crenellations, twisted chimneys.
    const x0 = 366, x1 = 470, top = 80;
    rect(c, x0, top, x1 - x0, 22, p.far);
    for (let x = x0; x < x1; x += 4) rect(c, x, top - 2, 2, 2, p.far);
    for (const x of [372, 390, 412, 436, 458]) { rect(c, x, top - 9, 3, 7, p.far); rect(c, x - 1, top - 10, 5, 1, p.far); }
    rect(c, 410, top - 6, 16, 28, p.far); rect(c, 408, top - 8, 20, 2, p.far);
    for (let x = x0 + 4; x < x1 - 2; x += 7) if (r() > 0.45) rect(c, x, top + 8, 1, 2, p.farLit);
    // A distant roadside diner with a neon roofline.
    rect(c, 40, 92, 44, 12, p.far); rect(c, 36, 90, 52, 2, p.farLit);
    for (let x = 44; x < 82; x += 6) rect(c, x, 96, 3, 3, p.farLit);
  } else {
    // The Museum of Water & Steam: the Italianate standpipe tower and engine house.
    rect(c, 64, 34, 11, 66, p.far);
    for (let y = 34; y > 26; y--) rect(c, 64 + (34 - y) * 0.7, y, 11 - (34 - y) * 1.4, 1, p.far);
    rect(c, 62, 46, 15, 2, p.far); rect(c, 62, 70, 15, 2, p.far);
    for (const y of [38, 52, 60, 76]) rect(c, 68, y, 3, 3, p.farLit);
    rect(c, 40, 78, 60, 24, p.far);
    for (let x = 40; x < 100; x++) { const d = Math.abs(x - 70); rect(c, x, 78 - Math.max(0, 8 - d * 0.28), 1, 8, p.far); }
    for (let x = 46; x < 96; x += 8) rect(c, x, 86, 3, 5, p.farLit);
    rect(c, 404, 30, 6, 70, p.far); rect(c, 402, 28, 10, 3, p.far);
    rect(c, 380, 82, 50, 20, p.far);
    for (let x = 386; x < 426; x += 8) rect(c, x, 88, 2, 4, p.farLit);
  }
}

function drawMid(c, p, theme, d, faces) {
  c.clearRect(0, 0, W, H);

  // Ground and the path to the door.
  rect(c, 0, 122, W, H - 122, p.grass);
  dither(c, 0, 122, W, 2, p.grass2);
  for (let y = 122; y < H; y++) { const half = 6 + (y - 122) * 0.8; rect(c, CX - half, y, half * 2, 1, p.path); }

  // Tree.
  rect(c, 146, 96, 4, 26, p.trunk);
  disc(c, 148, 86, 13, p.leaf); disc(c, 138, 94, 8, p.leaf); disc(c, 158, 93, 9, p.leaf); disc(c, 148, 74, 8, p.leaf);
  dither(c, 140, 72, 14, 10, p.leaf2); dither(c, 134, 88, 10, 6, p.leaf2, 1);

  // Theme prop.
  if (theme === "diner") {
    rect(c, 176, 96, 2, 26, "#1a1414");
    rect(c, 164, 84, 26, 12, "#140d15"); rect(c, 165, 85, 24, 10, "#1f1422");
    drawPixelText(c, "EAT", 168, 87, p.neon);
  } else {
    rect(c, 170, 118, 14, 4, "#c9c0ad"); rect(c, 172, 115, 10, 3, "#ddd4c1");
    rect(c, 173, 94, 8, 21, "#d9d1bf"); for (let x = 174; x < 181; x += 2) rect(c, x, 95, 1, 20, "#b9b09c");
    rect(c, 171, 91, 12, 3, "#e8e0cd"); rect(c, 170, 89, 14, 2, "#cfc6b4"); rect(c, 180, 84, 3, 5, "#cfc6b4");
    rect(c, 187, 113, 6, 9, "#b5562f"); rect(c, 188, 111, 4, 2, "#b5562f"); rect(c, 186, 116, 8, 1, "#1d1410"); rect(c, 186, 119, 8, 1, "#1d1410");
  }

  // House walls with brick courses.
  const x0 = 192, x1 = 288, top = 56, bot = 122;
  rect(c, x0, top, x1 - x0, bot - top, p.wall);
  for (let y = top + 1; y < bot; y += 3) {
    rect(c, x0, y, x1 - x0, 1, p.wall2);
    for (let x = x0 + ((y / 3) & 1 ? 3 : 0); x < x1; x += 6) rect(c, x, y + 1, 1, 2, p.wall2);
  }
  rect(c, x0, 84, x1 - x0, 2, p.trim);
  rect(c, x0, top, 2, bot - top, p.wall2); rect(c, x1 - 2, top, 2, bot - top, p.wall2);

  // Chimney (behind roof), then roof.
  rect(c, 266, 30, 9, 24, p.wall); dither(c, 266, 30, 9, 24, p.wall2); rect(c, 265, 27, 11, 3, "#241a16");
  for (let y = 26; y <= top; y++) {
    const half = Math.round(((y - 26) / (top - 26)) * 54);
    rect(c, CX - half, y, half * 2 + 1, 1, (y - 26) % 4 === 3 ? p.roof2 : p.roof);
    rect(c, CX - half - 1, y, 2, 1, p.trim); rect(c, CX + half, y, 2, 1, p.trim);
  }
  rect(c, 184, top, 112, 2, p.trim);

  // Door with fanlight and step.
  rect(c, 233, 101, 15, 21, p.trim);
  rect(c, 234, 104, 13, 18, p.door);
  rect(c, 235, 102, 11, 2, p.lamp); rect(c, 236, 101, 9, 1, p.lamp);
  rect(c, 244, 112, 1, 1, "#e6c26b");
  rect(c, 230, 122, 21, 2, "#bdb29a");
  rect(c, 251, 99, 2, 3, p.lamp);

  // Windows.
  WIN.forEach((w, i) => drawWindow(c, p, w, i + 1, d, faces));

  // Caravan.
  const { x, y, w, h } = CARAVAN;
  rect(c, x - 6, y + 14, 7, 1, "#bdb29a");
  rect(c, x + 2, y, w - 4, h, "#ece1c7"); rect(c, x, y + 2, w, h - 4, "#ece1c7"); rect(c, x + 1, y + 1, w - 2, h - 2, "#ece1c7");
  rect(c, x, y + 10, w, 2, p.accent);
  rect(c, x + 4, y + 4, 7, 14, "#d8ccae"); rect(c, x + 9, y + 10, 1, 1, "#8a7f68");
  rect(c, x + 24, y + 4, 13, 5, p.lamp); rect(c, x + 30, y + 4, 1, 5, "#ece1c7");
  disc(c, x + 20, y + h, 3, "#1b1512"); rect(c, x + 20, y + h, 1, 1, "#8a7f68");
}

function drawWindow(c, p, w, ep, d, faces) {
  const st = epState(d, ep);
  const face = st === "scored" ? faces[d.winners[ep].winner] : null;
  const frame = (fx, fy, fw, fh) => {
    if (w.round) disc(c, w.x + 6, w.y + 6, 7, p.trim);
    else { rect(c, fx - 1, fy - 1, fw + 2, fh + 2, p.trim); rect(c, fx - 2, fy + fh + 1, fw + 4, 1, "#d6c9ab"); }
  };
  frame(w.x, w.y, w.w, w.h);
  const glass = st === "scored" ? "#ffd48a" : st === "pending" ? "#37598c" : st === "next" ? "#3a2710" : p.glass;
  if (w.round) disc(c, w.x + 6, w.y + 6, 6, glass); else rect(c, w.x, w.y, w.w, w.h, glass);

  if (face) {
    c.save();
    c.beginPath();
    if (w.round) c.arc(w.x + 6.5, w.y + 6.5, 6, 0, 6.3); else c.rect(w.x, w.y, w.w, w.h);
    c.clip();
    // Crop the face from the framed portrait, drawn tiny: instant pixel portrait.
    const img = face, iw = img.naturalWidth, ih = img.naturalHeight;
    c.drawImage(img, iw * 0.27, ih * 0.19, iw * 0.46, ih * 0.56, w.x, w.y, w.w, w.h);
    c.globalAlpha = 0.18; c.fillStyle = "#ffb347"; c.fillRect(w.x, w.y, w.w, w.h);
    c.restore();
  } else if (st === "future") {
    rect(c, w.x + w.w - 3, w.y + 1, 1, 3, p.glassHi); rect(c, w.x + w.w - 4, w.y + 2, 1, 3, p.glassHi);
  }
  if (!face) {
    if (w.round) { rect(c, w.x, w.y + 6, 13, 1, p.trim); rect(c, w.x + 6, w.y, 1, 13, p.trim); }
    else { rect(c, w.x + 4, w.y, 1, w.h, p.trim); rect(c, w.x, w.y + 5, w.w, 1, p.trim); }
  }
}

function drawNear(c, p) {
  c.clearRect(0, 0, W, H);
  const r = rng(3);
  // Picket fence with a gap for the path.
  rect(c, 0, 133, 214, 1, p.fence2); rect(c, 266, 133, W - 266, 1, p.fence2);
  for (let x = 2; x < W; x += 6) {
    if (x > 210 && x < 268) continue;
    rect(c, x, 128, 3, 16, p.fence); rect(c, x + 1, 127, 1, 1, p.fence); rect(c, x + 2, 129, 1, 15, p.fence2);
  }
  // Grass tufts and flowers.
  for (let i = 0; i < 90; i++) {
    const x = (r() * W) | 0, y = 136 + ((r() * 8) | 0);
    rect(c, x, y, 1, 3, p.grass2); rect(c, x + 1, y + 1, 1, 2, p.leaf);
    if (r() > 0.8) rect(c, x, y - 1, 1, 1, p.flower[(r() * 3) | 0]);
  }
  // Lamp post.
  rect(c, 118, 92, 2, 52, "#1c1612"); rect(c, 115, 88, 8, 5, "#1c1612"); rect(c, 116, 89, 6, 3, p.lamp);
}

function drawGlow(c, p, theme, d) {
  c.clearRect(0, 0, W, H);
  const blob = (x, y, r, col, a = 1) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)");
    c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.globalAlpha = 1;
  };
  blob(330, 20, 30, "rgba(243,232,200,.55)");
  WIN.forEach((w, i) => {
    if (epState(d, i + 1) !== "scored") return;
    const col = d.cast[d.winners[i + 1].winner].color;
    blob(w.x + w.w / 2, w.y + w.h / 2, 12, "rgba(255,200,110,.85)");
    blob(w.x + w.w / 2, w.y + w.h / 2, 18, hexA(col, 0.35));
  });
  blob(241, 104, 10, "rgba(255,210,122,.8)");
  blob(252, 100, 7, "rgba(255,210,122,.9)");
  blob(CARAVAN.x + 30, CARAVAN.y + 7, 12, "rgba(255,200,110,.7)");
  blob(119, 90, 14, "rgba(255,210,122,.9)");
  if (theme === "diner") { blob(177, 90, 20, "rgba(255,80,160,.9)"); blob(62, 91, 26, "rgba(255,120,190,.5)"); }
  else blob(69, 60, 20, "rgba(240,194,106,.35)");
}

// 3×5 pixel font for the few words drawn into the scene.
const GLYPHS = { E: "111100110100111", A: "010101111101101", T: "111010010010010" };
function drawPixelText(c, s, x, y, col) {
  c.fillStyle = col;
  [...s].forEach((ch, k) => {
    const g = GLYPHS[ch] || "";
    for (let i = 0; i < g.length; i++) if (g[i] === "1") c.fillRect(x + k * 6 + (i % 3) * 1.5, y + ((i / 3) | 0) * 1.5, 1.5, 1.5);
  });
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

export function epState(d, ep) {
  if (ep <= d.weeksScored) return "scored";
  if (ep <= d.weeksAired) return "pending";
  if (d.nextEp && d.nextEp.ep === ep) return "next";
  return "future";
}

// ── The stage ────────────────────────────────────────────────────────────────

export function createStage(root, { reducedMotion, onCaravan }) {
  root.innerHTML = `
    <div class="stage-cam">
      <canvas class="layer far" width="${W}" height="${H}"></canvas>
      <canvas class="layer mid" width="${W}" height="${H}"></canvas>
      <canvas class="layer glow" width="${W}" height="${H}"></canvas>
      <canvas class="layer fx" width="${W}" height="${H}"></canvas>
      <canvas class="layer near" width="${W}" height="${H}"></canvas>
      <div class="hits"></div>
    </div>`;
  const cam = root.querySelector(".stage-cam");
  const ctx = Object.fromEntries(["far", "mid", "glow", "fx", "near"].map((k) => {
    const c = root.querySelector(`.${k}`).getContext("2d");
    c.imageSmoothingEnabled = false;
    return [k, c];
  }));
  const hits = root.querySelector(".hits");
  const faces = {};
  let d = null, theme = "greek", pal = PALETTES.greek, linkFor = () => "#";

  function layout() {
    const sw = root.clientWidth, sh = root.clientHeight;
    const s = Math.max(sw / W, sh / H);
    const cw = W * s, ch = H * s;
    cam.style.width = `${cw}px`;
    cam.style.height = `${ch}px`;
    cam.style.left = `${(sw - cw) / 2}px`;
    cam.style.top = `${sh - ch}px`;
  }

  function drawAll() {
    if (!d) return;
    drawFar(ctx.far, pal, theme);
    drawMid(ctx.mid, pal, theme, d, faces);
    drawNear(ctx.near, pal);
    drawGlow(ctx.glow, pal, theme, d);
  }

  function renderHits() {
    const pct = (v, t) => `${(v / t) * 100}%`;
    hits.innerHTML = WIN.map((w, i) => {
      const ep = i + 1, st = epState(d, ep), meta = d.raw.episodes[i];
      const who = st === "scored" ? ` won by ${d.cast[d.winners[ep].winner].full}` : st === "pending" ? ", results soon" : ", not aired yet";
      return `<a class="hit win-hit ${st}" href="${linkFor(ep)}" style="left:${pct(w.x - 2, W)};top:${pct(w.y - 2, H)};width:${pct(w.w + 4, W)};height:${pct(w.h + 4, H)}" aria-label="Episode ${ep}${meta.title ? `: ${meta.title}` : ""}${who}"><span>${ep}</span></a>`;
    }).join("") + `<button class="hit car-hit" type="button" aria-label="Knock on the caravan" style="left:${pct(CARAVAN.x - 2, W)};top:${pct(CARAVAN.y - 2, H)};width:${pct(CARAVAN.w + 4, W)};height:${pct(CARAVAN.h + 6, H)}"></button>`;
    hits.querySelector(".car-hit").addEventListener("click", () => { onCaravan?.(); puff(12); });
  }

  // Particles and flickers, drawn at pixel resolution about 15 times a second.
  const parts = [];
  const flies = Array.from({ length: 7 }, (_, i) => ({ x: 20 + i * 67 + Math.random() * 30, y: 104 + Math.random() * 22, ph: Math.random() * 6 }));
  function puff(n = 1) { for (let i = 0; i < n; i++) parts.push({ x: CHIMNEY.x + Math.random() * 4 - 2, y: CHIMNEY.y, vx: 0.15 + Math.random() * 0.2, vy: -0.25 - Math.random() * 0.2, life: 60 + Math.random() * 40, s: 2 }); }
  let t = 0;
  function tickFx() {
    const c = ctx.fx;
    c.clearRect(0, 0, W, H);
    t++;
    if (t % 5 === 0) puff();
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.x += q.vx; q.y += q.vy; q.life--;
      if (q.life < 40 && q.s < 4 && t % 12 === 0) q.s++;
      if (q.life <= 0 || q.y < -6) { parts.splice(i, 1); continue; }
      c.globalAlpha = Math.min(0.55, q.life / 90);
      rect(c, q.x, q.y, q.s, q.s, "#b9b4ae");
    }
    c.globalAlpha = 1;
    for (const f of flies) {
      f.ph += 0.08;
      const a = Math.max(0, Math.sin(f.ph));
      if (a < 0.2) continue;
      c.globalAlpha = a;
      rect(c, f.x + Math.sin(f.ph * 0.7) * 3, f.y + Math.cos(f.ph * 0.5) * 2, 1, 1, "#f6e27a");
    }
    c.globalAlpha = 1;
    if (d) WIN.forEach((w, i) => {
      const st = epState(d, i + 1);
      if (st !== "pending" && st !== "next") return;
      const a = st === "pending" ? 0.35 + 0.35 * (Math.random() > 0.6) : 0.3 + 0.2 * Math.sin(t * 0.25 + i);
      c.globalAlpha = a;
      rect(c, w.x - 1, w.y - 1, w.w + 2, w.h + 2, st === "pending" ? "#8fb6ff" : "#ffb347");
      c.globalAlpha = 1;
    });
  }

  // Camera: pointer, scroll and an idle sway, eased.
  let px = 0, py = 0, cx = 0, cy = 0, visible = true, raf = 0, lastFx = 0;
  const onPointer = (e) => { px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; };
  addEventListener("pointermove", onPointer, { passive: true });
  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    const sway = Math.sin(now / 4000) * 0.35;
    const scrollK = Math.min(1, scrollY / Math.max(1, root.offsetHeight));
    cx += (px + sway - cx) * 0.06;
    cy += (py - cy) * 0.06;
    cam.style.transform = `rotateY(${(cx * 5).toFixed(3)}deg) rotateX(${(-cy * 3 + scrollK * 6).toFixed(3)}deg)`;
    if (now - lastFx > 66) { lastFx = now; tickFx(); }
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (!raf && !reducedMotion) raf = requestAnimationFrame(frame); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : (cancelAnimationFrame(raf), (raf = 0)); }).observe(root);
  document.addEventListener("visibilitychange", start);
  new ResizeObserver(layout).observe(root);

  return {
    update(data, themeName, link) {
      d = data; theme = themeName; pal = PALETTES[themeName] || PALETTES.greek; linkFor = link;
      root.dataset.theme = themeName;
      layout(); drawAll(); renderHits(); tickFx(); start();
      // Pixel faces for the lit windows.
      for (const c of Object.values(d.cast)) {
        if (faces[c.key]?.src === c.img) continue;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.referrerPolicy = "no-referrer";
        img.onload = () => { faces[c.key] = img; if (d.cast[c.key] === c) drawMid(ctx.mid, pal, theme, d, faces); };
        img.src = c.img;
      }
    },
    puff,
  };
}
