// Wiring: loads the CSV, renders all three pages up front (so switching tabs
// is instant), and handles the tabs, swipers, sorting, series toggle and the
// countdown. Routes look like #/22/episodes/4 and #/22/cast/Nina.
import { loadData } from "./csv.js";
import { derive, currentSeriesKey } from "./league.js";
import { $, $$, esc, reducedMotion, state, fmtWhen, until, perEpisodeStats } from "./ui.js";
import { standingsHead, standingsRows } from "./views/table.js";
import { epTabs, epSlides } from "./views/episodes.js";
import { castOrder, castTabs, castSlides } from "./views/cast.js";
import { mountPodiumFx } from "./podium-fx.js";

const PAGES = ["standings", "episodes", "cast"];
let SERIES = {}, CURRENT = null;

// ── Routing ──────────────────────────────────────────────────────────────────

function readHash() {
  const [, key, page, arg] = location.hash.replace(/^#/, "").split("/");
  return { key: SERIES[key] ? key : CURRENT, page: PAGES.includes(page) ? page : "standings", arg: arg ? decodeURIComponent(arg) : null };
}
function writeHash() {
  const arg = state.page === "episodes" ? state.ep : state.page === "cast" ? castOrder(state.d)[state.cast]?.key : null;
  history.replaceState(null, "", `#/${state.key}/${state.page}${arg != null ? `/${encodeURIComponent(arg)}` : ""}`);
}
function applyArg(page, arg) {
  if (arg == null) return;
  if (page === "episodes" && +arg >= 1 && +arg <= state.d.episodes.length) state.ep = +arg;
  if (page === "cast") state.cast = Math.max(0, castOrder(state.d).findIndex((c) => c.key === arg));
}

// ── Rendering ────────────────────────────────────────────────────────────────

function loadSeries(key) {
  const d = state.d = derive(SERIES[key], new Date());
  state.key = key;
  state.ep = Math.max(1, d.weeksScored);
  state.cast = 0;
  const btn = $("#series");
  $("#series-num").textContent = key;
  btn.classList.toggle("multi", Object.keys(SERIES).length > 1);
  btn.classList.toggle("past", key !== CURRENT);
  btn.setAttribute("aria-label", `Series ${key}. Tap to switch series`);
  $("#p-standings").innerHTML = standingsHead(d);
  renderRows();
  $("#ep-tabs").innerHTML = epTabs(d);
  $("#ep-body").innerHTML = epSlides(d);
  mountPodiumFx($("#ep-body"));
  $("#cast-tabs").innerHTML = castTabs(d);
  $("#cast-body").innerHTML = castSlides(d);
  for (const id of ["#ep-body", "#cast-body"]) for (const s of $(id).children) sizes.observe(s);
  countdown();
}

function renderRows() {
  $("#rows").innerHTML = standingsRows(state.d);
  for (const b of $$(".st-num")) {
    const on = b.dataset.sort === state.sort;
    b.classList.toggle("on", on);
    b.querySelector(".arr").textContent = state.dir < 0 ? "▼" : "▲";
    b.setAttribute("aria-label", `Sort by ${b.dataset.sort}${on ? `, now ${state.dir < 0 ? "highest" : "lowest"} first` : ""}`);
  }
}

function show(page) {
  state.page = page;
  const i = PAGES.indexOf(page);
  $(".tabs").style.setProperty("--i", i);
  $$(".tab").forEach((t, j) => t.setAttribute("aria-selected", j === i));
  $$(".page").forEach((p, j) => p.classList.toggle("active", j === i));
  scrollTo(0, 0);
  if (page === "episodes") jump(EP, state.ep - 1);
  if (page === "cast") jump(CAST, state.cast);
  writeHash();
}

// ── Swipers: a tab strip over a row of scroll-snapped slides ─────────────────

const EP = { body: "#ep-body", tabs: "#ep-tabs", get: () => state.ep - 1, set: (i) => { state.ep = i + 1; } };
const CAST = { body: "#cast-body", tabs: "#cast-tabs", get: () => state.cast, set: (i) => { state.cast = i; } };

const idxOf = (body) => Math.round(body.scrollLeft / body.clientWidth);
/**
 * The row is as tall as the slide on screen, but never stops short of the
 * bottom of the screen, so you can swipe anywhere below a short slide.
 */
function fit(body) {
  const s = body.children[idxOf(body)];
  if (!s) return;
  const pad = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
  const toBottom = innerHeight - (body.getBoundingClientRect().top + scrollY) - pad;
  body.style.height = `${Math.max(s.offsetHeight, toBottom)}px`;
}
const sizes = new ResizeObserver((entries) => {
  for (const b of new Set(entries.map((e) => e.target.parentElement))) if (b?.isConnected) fit(b);
});

function mark(sw, i, smooth = true) {
  const tabs = $(sw.tabs), t = tabs.children[i];
  [...tabs.children].forEach((b, j) => b.classList.toggle("on", j === i));
  if (t) tabs.scrollTo({ left: t.offsetLeft - (tabs.clientWidth - t.offsetWidth) / 2, behavior: smooth && !reducedMotion ? "smooth" : "auto" });
}
function jump(sw, i) {
  const body = $(sw.body);
  body.scrollLeft = i * body.clientWidth;
  mark(sw, i, false);
  fit(body);
}

// ── Swiping on into the neighbouring tab ─────────────────────────────────────
// A sideways swipe where a page can't scroll any further switches to the
// neighbouring tab. There's no visual hint while you pull.

function edgeNav(el, can, onEdge) {
  let x0 = null, y0 = 0, prev = false, next = false;
  el.addEventListener("touchstart", (e) => {
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    prev = can.prev(); next = can.next();
  }, { passive: true });
  el.addEventListener("touchcancel", () => { x0 = null; }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (prev && dx > 0) onEdge(-1);
    if (next && dx < 0) onEdge(1);
  }, { passive: true });
}

function bindSwiper(sw, onEdge, ends) {
  const body = $(sw.body);
  let raf = 0, settle = 0;
  body.addEventListener("scroll", () => {
    if (!raf) raf = requestAnimationFrame(() => {
      raf = 0;
      const i = idxOf(body);
      if (i !== sw.get()) { sw.set(i); mark(sw, i); writeHash(); }
    });
    clearTimeout(settle);
    settle = setTimeout(() => fit(body), 120);
  }, { passive: true });
  $(sw.tabs).addEventListener("click", (e) => {
    const b = e.target.closest("[data-slide]");
    if (b) body.scrollTo({ left: b.dataset.slide * body.clientWidth, behavior: reducedMotion ? "auto" : "smooth" });
  });
  edgeNav(body, {
    prev: () => ends.prev && body.scrollLeft <= 2,
    next: () => ends.next && body.scrollLeft >= body.scrollWidth - body.clientWidth - 2,
  }, onEdge);
}

// ── Countdown: one line, "Ep 5 airs in 5d 18h" ──────────────────────────────

let timer = 0;

function countdown() {
  clearInterval(timer);
  const el = $("#cd"), e = state.d.nextEp;
  if (!e) {
    el.innerHTML = `<span class="cd-pill"><span class="cd-what">Series ${state.key}</span> <b>complete</b></span>`;
    el.removeAttribute("aria-label");
    return;
  }
  el.innerHTML = `<span class="cd-pill"><span class="cd-what" id="cd-what"></span> <span class="cd-left" id="cd-left"></span></span>`;
  el.setAttribute("aria-label", `Episode ${e.ep} airs ${fmtWhen.format(e.air)}`);
  let last = "";
  const tick = () => {
    const ms = e.air - Date.now();
    const html = ms > 0 ? until(ms).map(([n, u]) => `<b>${n}</b><small>${u}</small>`).join(" ") : "";
    if (html === last) return;
    last = html;
    $("#cd-what").textContent = ms > 0 ? `Ep ${e.ep} airs in` : `Ep ${e.ep} is on air`;
    $("#cd-left").innerHTML = html;
    if (ms <= 0) clearInterval(timer);
  };
  tick();
  timer = setInterval(tick, 1000);
}

// ── Events ───────────────────────────────────────────────────────────────────

$(".tabs").addEventListener("click", (e) => {
  const t = e.target.closest("[data-page]");
  if (t) show(t.dataset.page);
});

$("#series").addEventListener("click", () => {
  const keys = Object.keys(SERIES).sort((a, b) => a - b);
  loadSeries(keys[(keys.indexOf(state.key) + 1) % keys.length]);
  show(state.page);
});

$("#p-standings").addEventListener("click", (e) => {
  const s = e.target.closest("[data-sort]");
  if (s) {
    state.dir = state.sort === s.dataset.sort ? -state.dir : -1;
    state.sort = s.dataset.sort;
    return renderRows();
  }
  const last = e.target.closest("[data-ep]");
  if (last) { state.ep = +last.dataset.ep; return show("episodes"); }
  const head = e.target.closest(".pc-head");
  if (head) head.setAttribute("aria-expanded", head.parentElement.classList.toggle("open"));
});

// Standings has nothing to scroll sideways, so a left swipe goes to Episodes.
edgeNav($("#p-standings"), { prev: () => false, next: () => true }, () => show("episodes"));
bindSwiper(EP, (dir) => {
  if (dir < 0) show("standings");
  else { state.cast = 0; show("cast"); }
}, { prev: true, next: true });
bindSwiper(CAST, (dir) => {
  if (dir < 0) { state.ep = state.d.episodes.length; show("episodes"); }
}, { prev: true, next: false });

// Long task names are clamped to two lines; tap one to read it in full.
$("#ep-body").addEventListener("click", (e) => e.target.closest(".tname")?.classList.toggle("full"));

// The top bar compacts once you scroll. Its layout height stays the same
// (see .topbar.compact in the CSS), and the two thresholds differ so it
// can't flicker at the boundary.
const bar = $(".topbar");
let hraf = 0;
addEventListener("scroll", () => {
  if (!hraf) hraf = requestAnimationFrame(() => {
    hraf = 0;
    const on = bar.classList.contains("compact");
    bar.classList.toggle("compact", on ? scrollY > 4 : scrollY > 16);
  });
}, { passive: true });

addEventListener("resize", () => { for (const sw of [EP, CAST]) if ($(sw.body).offsetParent) jump(sw, sw.get()); });

addEventListener("hashchange", () => {
  const h = readHash();
  if (h.key !== state.key) loadSeries(h.key);
  applyArg(h.page, h.arg);
  show(h.page);
});

// ── Boot ─────────────────────────────────────────────────────────────────────

try {
  SERIES = await loadData();
  CURRENT = currentSeriesKey(SERIES, new Date());
  state.stats = perEpisodeStats(SERIES);
  const h = readHash();
  loadSeries(h.key);
  applyArg(h.page, h.arg);
  show(h.page);
} catch (err) {
  console.error(err);
  $("#p-standings").innerHTML = `<p class="err">Couldn't load the league data. ${esc(err.message)}</p>`;
}
document.body.classList.remove("loading");
