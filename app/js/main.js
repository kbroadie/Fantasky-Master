// Wiring: loads the CSV, renders all three pages up front (so switching tabs
// is instant), and handles the tabs, swipers, sorting, series toggle and the
// countdown. Routes look like #/22/episodes/4 and #/22/cast/Nina.
import { loadData } from "./csv.js";
import { derive, currentSeriesKey } from "./league.js";
import { $, $$, esc, reducedMotion, state } from "./ui.js";
import { standingsHead, standingsRows } from "./views/table.js";
import { epTabs, epSlides } from "./views/episodes.js";
import { castOrder, castTabs, castSlides } from "./views/cast.js";

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
  btn.textContent = key;
  btn.classList.toggle("past", key !== CURRENT);
  btn.setAttribute("aria-label", `Series ${key}. Tap to switch series`);
  $("#p-standings").innerHTML = standingsHead(d);
  renderRows();
  $("#ep-tabs").innerHTML = epTabs(d);
  $("#ep-body").innerHTML = epSlides(d);
  $("#cast-tabs").innerHTML = castTabs(d);
  $("#cast-body").innerHTML = castSlides(d);
  for (const id of ["#ep-body", "#cast-body"]) for (const s of $(id).children) sizes.observe(s);
  countdown();
}

function renderRows() {
  $("#rows").innerHTML = standingsRows(state.d);
  $$(".st-num").forEach((b) => b.classList.toggle("on", b.dataset.sort === state.sort));
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
/** The row is only as tall as the slide on screen. */
function fit(body) {
  const s = body.children[idxOf(body)];
  if (s) body.style.height = `${s.offsetHeight}px`;
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

function bindSwiper(sw, onEdge) {
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
  // Swiping past either end carries on into the neighbouring tab.
  let x0 = null, y0 = 0, atStart = false, atEnd = false;
  body.addEventListener("touchstart", (e) => {
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    atStart = body.scrollLeft <= 2;
    atEnd = body.scrollLeft >= body.scrollWidth - body.clientWidth - 2;
  }, { passive: true });
  body.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (atStart && dx > 0) onEdge(-1);
    if (atEnd && dx < 0) onEdge(1);
  }, { passive: true });
}

// ── Countdown: a red seven-segment clock to the next episode ─────────────────

const SEGS = { 0: "abcdef", 1: "bc", 2: "abged", 3: "abgcd", 4: "fgbc", 5: "afgcd", 6: "afgecd", 7: "abc", 8: "abcdefg", 9: "abcdfg" };
const digit = (ch) => `<span class="seg">${[..."abcdefg"].map((s) => `<i class="s${s}${SEGS[ch].includes(s) ? " on" : ""}"></i>`).join("")}</span>`;
const two = (n) => [...String(Math.min(n, 99)).padStart(2, "0")].map(digit).join("");
let timer = 0;

function countdown() {
  clearInterval(timer);
  const el = $("#cd"), e = state.d.nextEp;
  if (!e) { el.innerHTML = `<span class="cd-label">Series complete</span>`; return; }
  const unit = (id, l) => `<span class="cd-unit"><span class="cd-nums" id="cd-${id}"></span><small>${l}</small></span>`;
  const colon = `<span class="cd-colon"><i></i><i></i></span>`;
  el.innerHTML = `<span class="cd-label">Episode ${e.ep}</span><span class="cd-digits">${unit("d", "Days")}${colon}${unit("h", "Hrs")}${colon}${unit("m", "Mins")}</span>`;
  el.setAttribute("aria-label", `Episode ${e.ep} airs ${e.air.toLocaleString()}`);
  let last = "";
  const tick = () => {
    const m = Math.max(0, Math.floor((e.air - Date.now()) / 60000));
    const s = `${Math.floor(m / 1440)}|${Math.floor(m / 60) % 24}|${m % 60}`;
    if (s === last) return;
    last = s;
    const [dd, hh, mm] = s.split("|").map(Number);
    $("#cd-d").innerHTML = two(dd); $("#cd-h").innerHTML = two(hh); $("#cd-m").innerHTML = two(mm);
    if (!m) clearInterval(timer);
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
  const head = e.target.closest(".pc-head");
  if (head) head.setAttribute("aria-expanded", head.parentElement.classList.toggle("open"));
});

bindSwiper(EP, (dir) => {
  if (dir < 0) show("standings");
  else { state.cast = 0; show("cast"); }
});
bindSwiper(CAST, (dir) => {
  if (dir < 0) { state.ep = state.d.episodes.length; show("episodes"); }
});

const hdr = $(".hdr");
let hraf = 0;
addEventListener("scroll", () => {
  if (!hraf) hraf = requestAnimationFrame(() => { hraf = 0; hdr.classList.toggle("compact", scrollY > 8); });
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
  const h = readHash();
  loadSeries(h.key);
  applyArg(h.page, h.arg);
  show(h.page);
} catch (err) {
  console.error(err);
  $("#p-standings").innerHTML = `<p class="err">Couldn't load the league data. ${esc(err.message)}</p>`;
}
document.body.classList.remove("loading");
