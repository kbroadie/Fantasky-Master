// Shared helpers and state used by main.js and every view.

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/** Escaped text that keeps the CSV's <strong> markup. */
export const rich = (s) => esc(s).replace(/&lt;(\/?)strong&gt;/g, "<$1strong>");
export const ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
export const listing = (a) => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a.at(-1)}`;
export const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

export const ICON = { P: "🎁", F: "🎬", T: "👥", L: "⚡" }; // 🏆 is kept for the League leader
/** Gold, silver and bronze for the top three; nothing for the rest. */
export const tier = (rank) => rank <= 3 ? ` t${rank}` : "";
// Dates and deadlines are shown in the device's own time zone and locale.
export const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
export const fmtWhen = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
/** Time left as its two largest units: "5d 19h", "19h 25m", "25m 10s". */
export function until(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60;
  return d ? [[d, "d"], [h, "h"]] : h ? [[h, "h"], [m, "m"]] : [[m, "m"], [s % 60, "s"]];
}
export const untilText = (ms) => until(ms).map(([n, u]) => n + u).join(" ");

/** The contestant's full gold-framed portrait. */
export const framed = (c) => `<img class="fp" src="${c.img}" alt="${esc(c.key)}" width="225" height="266" loading="lazy" decoding="async" style="--c:${c.color}">`;
/** A contestant's first name in their accent colour. */
export const named = (c) => `<b class="cn" style="color:${c.color}">${esc(c.key)}</b>`;

export const state = { key: null, d: null, page: "standings", sort: "show", dir: -1, ep: 1, cast: 0, stats: null };

/**
 * Mean and standard deviation of points per episode, over every contestant
 * in every series with scored episodes, for each kind of task (P prize,
 * F filmed, L live). Per episode so a series in progress compares fairly
 * with a finished one. The Cast radar plots z-scores against these.
 */
export function perEpisodeStats(series) {
  const vals = { P: [], F: [], L: [] };
  for (const raw of Object.values(series)) {
    const scored = raw.tasks.reduce((m, t) => Math.max(m, t.ep), 0);
    if (!scored) continue;
    raw.cast.forEach((_, i) => {
      for (const k of Object.keys(vals)) vals[k].push(raw.tasks.filter((t) => t.t === k).reduce((a, t) => a + t.s[i], 0) / scored);
    });
  }
  return Object.fromEntries(Object.entries(vals).map(([k, v]) => {
    const mean = v.reduce((a, x) => a + x, 0) / (v.length || 1);
    const sd = Math.sqrt(v.reduce((a, x) => a + (x - mean) ** 2, 0) / (v.length || 1));
    return [k, { mean, sd }];
  }));
}
