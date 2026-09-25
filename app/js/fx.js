// One-shot particle effects on a 2D overlay canvas: confetti, wax shards,
// sparks and steam puffs. The loop only runs while particles are alive.

let canvas, ctx, raf = 0, dpr = 1;
const parts = [];
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

function ensure() {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.className = "fx";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  ctx = canvas.getContext("2d");
  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  };
  size();
  addEventListener("resize", size, { passive: true });
}

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];

const KINDS = {
  confetti: (x, y, colors) => ({
    x, y, vx: rnd(-7, 7), vy: rnd(-13, -4), g: 0.32, drag: 0.985,
    w: rnd(5, 10), h: rnd(8, 15), rot: rnd(0, 6.28), vr: rnd(-0.25, 0.25),
    flip: rnd(0, 6.28), vf: rnd(0.08, 0.2), color: pick(colors), life: rnd(90, 150), shape: "rect",
  }),
  wax: (x, y, colors) => ({
    x, y, vx: rnd(-5, 5), vy: rnd(-7, -1), g: 0.4, drag: 0.98,
    w: rnd(3, 8), h: rnd(3, 8), rot: rnd(0, 6.28), vr: rnd(-0.3, 0.3),
    flip: 0, vf: 0, color: pick(colors), life: rnd(40, 70), shape: "shard",
  }),
  spark: (x, y, colors) => ({
    x, y, vx: rnd(-4, 4), vy: rnd(-5, 2), g: 0.05, drag: 0.94,
    w: rnd(1.5, 3.5), h: 0, rot: 0, vr: 0, flip: 0, vf: 0,
    color: pick(colors), life: rnd(30, 60), shape: "glow",
  }),
  steam: (x, y) => ({
    x: x + rnd(-20, 20), y, vx: rnd(-0.8, 0.8), vy: rnd(-2.2, -0.8), g: -0.01, drag: 0.99,
    w: rnd(14, 30), h: 0, rot: 0, vr: 0, flip: 0, vf: 0,
    color: "rgba(235,228,215,", life: rnd(50, 90), shape: "puff", grow: rnd(0.4, 0.9),
  }),
};

export function burst(x, y, { kind = "confetti", colors = ["#d9a62e", "#f1e6cc", "#a3161b"], count = 60 } = {}) {
  if (reduced.matches) return;
  ensure();
  const make = KINDS[kind];
  for (let i = 0; i < count; i++) {
    const p = make(x, y, colors);
    p.max = p.life;
    parts.push(p);
  }
  if (!raf) raf = requestAnimationFrame(tick);
}

/** Burst from the centre of an element. */
export function burstAt(el, opts) {
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, opts);
}

function tick() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
    p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.flip += p.vf;
    if (--p.life <= 0 || p.y > innerHeight + 40) { parts.splice(i, 1); continue; }
    const a = Math.min(1, p.life / (p.max * 0.35));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.shape === "rect") {
      ctx.scale(1, Math.cos(p.flip));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    } else if (p.shape === "shard") {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(-p.w, -p.h * 0.3); ctx.lineTo(p.w * 0.6, -p.h); ctx.lineTo(p.w, p.h * 0.7); ctx.lineTo(-p.w * 0.4, p.h);
      ctx.fill();
    } else if (p.shape === "glow") {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(0, 0, p.w, 0, 6.283); ctx.fill();
    } else {
      p.w += p.grow;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.w);
      g.addColorStop(0, p.color + 0.35 * a + ")");
      g.addColorStop(1, p.color + "0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, p.w, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }
  raf = parts.length ? requestAnimationFrame(tick) : (ctx.clearRect(0, 0, innerWidth, innerHeight), 0);
}
