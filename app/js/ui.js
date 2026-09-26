// Shared helpers and state used by main.js and every view.

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/** Escaped text that keeps the CSV's <strong> markup. */
export const rich = (s) => esc(s).replace(/&lt;(\/?)strong&gt;/g, "<$1strong>");
export const ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
export const listing = (a) => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a.at(-1)}`;
export const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

export const ICON = { P: "🏆", F: "🎬", T: "👥", L: "⚡" };
/** Gold, silver and bronze for the top three; nothing for the rest. */
export const tier = (rank) => rank <= 3 ? ` t${rank}` : "";
// Dates and deadlines are shown in the device's own time zone and locale.
export const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
export const fmtWhen = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const soonFull = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
const soonHour = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric" });
/** "Thu 9 PM", or "Thu 9:30 PM" when it isn't on the hour locally. */
export const fmtSoon = { format: (d) => (d.getMinutes() ? soonFull : soonHour).format(d) };
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

export const state = { key: null, d: null, page: "standings", sort: "show", dir: -1, ep: 1, cast: 0 };
