// Shared helpers, state and UI primitives used by main.js and every view.

// ── Helpers ──────────────────────────────────────────────────────────────────

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/** Escaped text that keeps the CSV's <strong> markup. */
export const rich = (s) => esc(s).replace(/&lt;(\/?)strong&gt;/g, "<$1strong>");
export const ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
export const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
export const listing = (a) => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a.at(-1)}`;
export const enc = encodeURIComponent;
export const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const YT = "https://www.youtube.com/@Taskmaster";
export const TYPE = { P: "Prize", F: "Filmed", T: "Team", L: "Live" };

export const fmt = (opts, tz) => new Intl.DateTimeFormat(undefined, tz ? { ...opts, timeZone: tz } : opts);
export const fmtLocal = fmt({ weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
export const fmtShortDay = fmt({ weekday: "short", day: "numeric", month: "short" }, "Europe/London");
export const zoneHour = (date, tz) => fmt({ hour: "numeric", minute: "2-digit", hour12: true }, tz).format(date).replace(":00", "").replace(/\s/g, "").toLowerCase();

/** The contestant's full gold-framed portrait. */
export const framed = (c, cls = "") => `<img class="fp ${cls}" src="${c.img}" alt="" width="225" height="266" loading="lazy" decoding="async" style="--c:${c.color}">`;
export const pad = (n) => String(n).padStart(2, "0");
export function splitTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
export const store = {
  get(k, f) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};


// ── Shared state ─────────────────────────────────────────────────────────────

export const state = {
  key: null, d: null, view: "standings", arg: null, sort: "show",
  me: store.get("fm-me", null), epSub: "league", plSub: 0,
};
export const meIn = (d) => (state.me && d.allPlayers.includes(state.me) ? state.me : null);
export const link = (view, arg) => `#/${state.key}/${view}${arg != null ? `/${enc(arg)}` : ""}`;

// ── Badges ──────────────────────────────────────────────────────────────────

export function rankSeal(rank) { return `<span class="seal ${rank <= 3 ? `seal-${rank}` : "seal-ink"}">${rank}</span>`; }
export const deltaTag = (n) => n > 0 ? `<span class="delta up">▲${n}</span>` : n < 0 ? `<span class="delta down">▼${-n}</span>` : `<span class="delta">–</span>`;
export function statusLine(s) {
  const list = s.needed.map(esc).join(", ");
  return `<span class="must">${s.kind === "must" ? "Must pick" : s.kind === "cannot" ? "Can't fit" : "Never picked"}: ${list}</span>`;
}


// ── Swipeable sections ───────────────────────────────────────────────────────

export function swiperHTML(id, slides, attrs = "") {
  return `<div class="swiper" id="${id}" ${attrs}>${slides.map((s, i) => `<section class="slide" data-i="${i}">${s}</section>`).join("")}</div>`;
}
export const stepOf = (el) => (el.children[1] ? el.children[1].offsetLeft - el.children[0].offsetLeft : el.clientWidth);
export function fitHeight(el) {
  const i = Math.round(el.scrollLeft / stepOf(el));
  const s = el.children[i];
  if (s) el.style.height = `${s.offsetHeight}px`;
}
export function bindSwiper(id, index, onSettle) {
  const el = $(`#${id}`);
  if (!el) return;
  el.scrollLeft = index * stepOf(el);
  fitHeight(el);
  let t = 0, last = index;
  el.addEventListener("scroll", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const i = Math.round(el.scrollLeft / stepOf(el));
      fitHeight(el);
      if (i !== last) { last = i; onSettle(i); }
    }, 80);
  }, { passive: true });
  new ResizeObserver(() => fitHeight(el)).observe(el.children[0]);
}
/** Hero shots drift against the swipe, like a camera pan across the set. */
export function heroParallax(el) {
  if (!el || reducedMotion) return;
  let raf = 0;
  const apply = () => {
    raf = 0;
    const w = el.clientWidth;
    for (const s of el.children) {
      const img = s.querySelector(".cc-bg img");
      if (!img) continue;
      const off = (s.offsetLeft - el.scrollLeft) / w;
      if (Math.abs(off) > 1.2) continue;
      img.style.transform = `translateX(${(off * -22).toFixed(1)}%) scale(1.12)`;
    }
  };
  el.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(apply); }, { passive: true });
  apply();
}
export function goSlide(id, i) {
  const el = $(`#${id}`);
  el?.scrollTo({ left: i * stepOf(el), behavior: reducedMotion ? "auto" : "smooth" });
}
export const quietHash = (h) => history.replaceState(null, "", h);
