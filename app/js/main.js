// Wiring: loads the CSV, renders all three pages up front (so switching tabs
// is instant), and handles the tabs, swipers, sorting, series toggle and the
// countdown. Routes look like #/22/episodes/4 and #/22/cast/Nina.
import { loadText, parseCSV, buildSeries } from "./csv.js";
import { initEdit } from "./edit.js";
import { derive, currentSeriesKey } from "./league.js";
import { $, $$, esc, reducedMotion, state, fmtWhen, until, perEpisodeStats, footer } from "./ui.js";
import { standingsHead, standingsRows, standingsHero, stWeek, weekTabs, rowMore } from "./views/table.js";
import { epTabs, epSlides } from "./views/episodes.js";
import { castOrder, castTabs, castSlides } from "./views/cast.js";
import { mountPodiumFx } from "./podium-fx.js";
import { loadStats, allTimePerEpisode } from "./alltime.js";

const PAGES = ["standings", "episodes", "cast"];
let SERIES = {}, CURRENT = null;

// ── Routing ──────────────────────────────────────────────────────────────────

function readHash() {
  const [, key, page, arg] = location.hash.replace(/^#/, "").split("/");
  return { key: SERIES[key] ? key : CURRENT, page: PAGES.includes(page) ? page : "standings", arg: arg ? decodeURIComponent(arg) : null };
}
function writeHash() {
  const arg = state.page === "standings" ? stWeek(state.d) : state.page === "episodes" ? state.ep : state.page === "cast" ? castOrder(state.d)[state.cast]?.key : null;
  history.replaceState(null, "", `#/${state.key}/${state.page}${arg != null ? `/${encodeURIComponent(arg)}` : ""}`);
}
function applyArg(page, arg) {
  if (arg == null) return;
  if (page === "standings" && +arg >= 1 && +arg <= state.d.episodes.length) state.wk = +arg;
  if (page === "episodes" && +arg >= 1 && +arg <= state.d.episodes.length) state.ep = +arg;
  if (page === "cast") state.cast = Math.max(0, castOrder(state.d).findIndex((c) => c.key === arg));
}

// ── Rendering ────────────────────────────────────────────────────────────────

function loadSeries(key) {
  const d = state.d = derive(SERIES[key], new Date());
  state.key = key;
  state.ep = Math.max(1, d.weeksScored);
  state.wk = d.weeksScored;
  state.cast = 0;
  const btn = $("#series");
  $("#series-num").textContent = key;
  btn.classList.toggle("multi", Object.keys(SERIES).length > 1);
  btn.classList.toggle("past", key !== CURRENT);
  btn.setAttribute("aria-label", `Series ${key}. Tap to switch series`);
  $("#p-standings").innerHTML = standingsHead(d);
  renderRows();
  markWeek(false);
  renderSlides(d);
  if (!$("#foot").children.length) $("#foot").innerHTML = footer();
  countdown();
}

function renderSlides(d) {
  $("#ep-tabs").innerHTML = epTabs(d);
  $("#ep-body").innerHTML = epSlides(d);
  mountPodiumFx($("#ep-body"));
  $("#cast-tabs").innerHTML = castTabs(d);
  $("#cast-body").innerHTML = castSlides(d);
  mountPodiumFx($("#cast-body"));
  for (const id of ["#ep-body", "#cast-body"]) for (const s of $(id).children) sizes.observe(s);
}

/**
 * Edit mode (edit.js): re-render from the data file's new text, in place. The
 * Standings rows are patched (they slide if the order changes); the Episodes
 * and Cast slides are rebuilt on the same slide.
 */
function refresh(text) {
  // Edit mode may redraw while a box has focus: put focus back on its new copy.
  const fk = document.activeElement?.dataset?.fk;
  SERIES = buildSeries(parseCSV(text));
  const d = state.d = derive(SERIES[state.key], new Date());
  patchRows(() => {
    $("#st-tabs").innerHTML = weekTabs(d);
    $(".st-hero").innerHTML = standingsHero(d);
    markWeek(false);
  });
  renderSlides(d);
  for (const sw of [EP, CAST]) if ($(sw.body).offsetParent) jump(sw, sw.get());
  else mark(sw, sw.get(), false);
  if (fk) $(`[data-fk="${CSS.escape(fk)}"]`)?.focus({ preventScroll: true });
}

function renderRows() {
  $("#rows").innerHTML = standingsRows(state.d);
  $(".card.board")?.classList.remove("focus");
  queueParallax();
}

function show(page) {
  state.page = page;
  const i = PAGES.indexOf(page);
  $(".tabs").style.setProperty("--i", i);
  $$(".tab").forEach((t, j) => t.setAttribute("aria-selected", j === i));
  $$(".page").forEach((p, j) => p.classList.toggle("active", j === i));
  scrollTo(0, 0);
  if (page === "standings") { markWeek(false); queueParallax(); }
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
  // Leave room for the footer, so a short slide ends with it at the bottom of the screen.
  const toBottom = innerHeight - (body.getBoundingClientRect().top + scrollY) - pad - ($("#foot")?.offsetHeight || 0);
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
    if (e.target.closest(".strip")) { x0 = null; return; } // a tab strip scrolls sideways itself
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
  // "How scoring works": open both explanations; tap again to close. It stays
  // open as the week changes (state.how).
  const how = e.target.closest(".st-how");
  if (how) {
    state.how = !state.how;
    how.closest(".st-hero").classList.toggle("explain", state.how);
    how.setAttribute("aria-expanded", state.how);
    queueParallax();
    return;
  }
  // An opened half's card title flips it between Points per episode and The
  // race so far; the choice holds for every row opened after it.
  const swap = e.target.closest(".xp-swap");
  if (swap) {
    state.xpView = swap.dataset.xp;
    for (const row of $$("#rows .pc.open")) openRow(row, row.dataset.open);
    return;
  }
  // A half of a row opens that player's picks under the row; tapping the
  // same half closes it, and the other half switches to their player.
  const sd = e.target.closest(".pc .sd");
  if (sd) {
    const row = sd.closest(".pc"), side = sd.dataset.side;
    openRow(row, row.classList.contains("open") && row.dataset.open === side ? null : side);
    // Rows below slide as this one opens; keep their parallax in step.
    followParallax(settled([row.querySelector(".pc-more")]));
  }
});

// ── Standings weeks ──────────────────────────────────────────────────────────
// The Ep 1–10 strip and sideways swipes change the week on show. The table
// stays put: each row keeps its element (and whether it's open), its numbers
// update, and the rows slide from their old places to their new ones (FLIP).
// A left swipe on the last week goes on to Episodes.

function markWeek(smooth = true) {
  const tabs = $("#st-tabs"), w = stWeek(state.d);
  if (!tabs) return;
  for (const b of tabs.children) b.classList.toggle("on", +b.dataset.week === w);
  const t = tabs.children[w - 1];
  if (t) tabs.scrollTo({ left: t.offsetLeft - (tabs.clientWidth - t.offsetWidth) / 2, behavior: smooth && !reducedMotion ? "smooth" : "auto" });
}

function setWeek(w) {
  const d = state.d;
  w = Math.max(1, Math.min(d.episodes.length, w));
  if (w === stWeek(d)) return;
  state.wk = w;
  patchRows(() => {
    $(".st-hero").innerHTML = standingsHero(d);
    markWeek();
    writeHash();
  });
}

/** Open a row on one side (its player's picks), or close it (side null). */
function openRow(row, side) {
  if (side) {
    const name = row.querySelector(`.sd[data-side="${side}"]`)?.dataset.p;
    row.querySelector(".pc-more > div").innerHTML = rowMore(state.d, name, side);
    sizeOpen(row);
    row.dataset.open = side;
  } else delete row.dataset.open;
  row.classList.toggle("open", !!side);
  for (const b of row.querySelectorAll(".sd")) b.setAttribute("aria-expanded", b.dataset.side === side);
  sharpen(row, side);
  // While anything is open, every other cell steps back.
  $(".card.board")?.classList.toggle("focus", !!$("#rows .pc.open"));
}

/**
 * The opened half's L comes into focus: a sharp copy of the row's backdrop
 * (.pc-bg.sharp) fades in over the frosted one, clipped to that half and the
 * picks below, so the other half stays frosted. It holds only the opened
 * player's pick. It exists only while the row is open. When its photo
 * changes (the other half opened, or a week change), a new copy fades in over
 * the old one, which fades out.
 */
const bgKey = (bg) => [...bg.querySelectorAll(".pf")].map((f) => f.getAttribute("style") + f.querySelector("img").getAttribute("src")).join("|");
function sharpen(row, side) {
  const bg = row.querySelector(".pc-bg:not(.sharp):not(.pc-ghost)");
  let sh = row.querySelector(".pc-bg.sharp:not(.gone)");
  if (sh && (!side || !bg || sh.dataset.key !== bgKey(bg) + side)) { unsharpen(sh); sh = null; }
  if (!side || !bg) return;
  if (!sh) {
    sh = bg.cloneNode(true);
    sh.classList.add("sharp");
    sh.querySelector(side === "show" ? ".pf.r" : ".pf.l")?.remove(); // only the opened player's pick
    sh.dataset.key = bgKey(bg) + side;
    sh.dataset.side = side;
    [...row.querySelectorAll(".pc-bg")].pop().after(sh); // over the frosted one (and any fading copies)
    sh.getBoundingClientRect(); // start from transparent, so the fade always runs
    sh.classList.add("on");
  }
  sh.dataset.side = side;
}
function unsharpen(sh) {
  sh.classList.add("gone");
  sh.classList.remove("on");
  setTimeout(() => sh.remove(), reducedMotion ? 0 : 400);
}

/**
 * Brings the rows up to date without rebuilding the table. Rows are places,
 * so they stay put; each row's halves, backdrop and picks are patched, and
 * each player's half slides from their old place to their new one on its
 * board (FLIP), the Show's and the League's independently. An opened half
 * follows its player to their new place. before() runs once the old places
 * are measured (it may change the hero).
 */
function patchRows(before) {
  const d = state.d, rows = $("#rows");
  const first = new Map([...rows.querySelectorAll(".sd")].map((b) => [`${b.dataset.side}|${b.dataset.p}`, b.getBoundingClientRect().top]));
  const opened = [...rows.children].filter((r) => r.classList.contains("open"))
    .map((r) => ({ side: r.dataset.open, p: r.querySelector(`.sd[data-side="${r.dataset.open}"]`)?.dataset.p }));
  before?.();
  const fresh = document.createElement("div");
  fresh.innerHTML = standingsRows(d);
  [...fresh.children].forEach((n, i) => {
    const old = rows.children[i];
    if (!old) return rows.append(n.cloneNode(true));
    old.classList.toggle("lead", n.classList.contains("lead"));
    old.querySelector(".pc-head").innerHTML = n.querySelector(".pc-head").innerHTML;
    patchBackdrop(old, n);
  });
  while (rows.children.length > fresh.children.length) rows.lastElementChild.remove();
  // Opened halves follow their players.
  const want = new Map();
  for (const o of opened) {
    const b = [...rows.querySelectorAll(`.sd[data-side="${o.side}"]`)].find((x) => x.dataset.p === o.p);
    if (b && !want.has(b.closest(".pc"))) want.set(b.closest(".pc"), o.side);
  }
  for (const r of rows.children) if (want.has(r) || r.classList.contains("open")) openRow(r, want.get(r) || null);
  queueParallax();
  if (reducedMotion) return;
  const moving = [];
  for (const b of rows.querySelectorAll(".sd")) {
    const was = first.get(`${b.dataset.side}|${b.dataset.p}`);
    const dy = was == null ? 0 : was - b.getBoundingClientRect().top;
    if (!dy) continue;
    b.style.transition = "none";
    b.style.transform = `translateY(${dy}px)`;
    moving.push(b);
  }
  rows.getBoundingClientRect(); // commit the inverted positions before playing
  for (const b of moving) {
    b.style.transition = "transform 1s cubic-bezier(.65, 0, .35, 1)"; // slow and even, so each player can be followed
    b.style.transform = "";
    b.addEventListener("transitionend", () => { b.style.transition = ""; }, { once: true });
  }
  followParallax(settled([...rows.querySelectorAll(".pc-more")]));
}

/**
 * A row's backdrop, patched rather than replaced: each photo's crop (its
 * inline vars) and src are updated in place, so a new crop of the same photo
 * (every S22 face) just moves, with no reload or blank frame. A copy of the
 * old backdrop stays on top and fades out, so the photos blend (fadeGhost).
 */
function patchBackdrop(old, n) {
  const ob = old.querySelector(".pc-bg"), nb = n.querySelector(".pc-bg");
  if (!ob || !nb) { ob?.remove(); if (nb) old.prepend(nb.cloneNode(true)); return; }
  const ofs = ob.querySelectorAll(".pf"), nfs = nb.querySelectorAll(".pf");
  const same = [...ofs].every((f, k) => f.getAttribute("style") === nfs[k].getAttribute("style")
    && f.querySelector("img").getAttribute("src") === nfs[k].querySelector("img").getAttribute("src"));
  if (same) return;
  const ghost = reducedMotion ? null : ob.cloneNode(true);
  ofs.forEach((f, k) => {
    const nf = nfs[k];
    if (!f.querySelector(".edge") !== !nf.querySelector(".edge")) return f.replaceWith(nf.cloneNode(true));
    f.setAttribute("style", nf.getAttribute("style"));
    const oi = f.querySelector("img"), src = nf.querySelector("img").getAttribute("src");
    if (oi.getAttribute("src") !== src) oi.src = src;
  });
  if (ghost) fadeGhost(ghost, ob);
}

/** How tall a row's picks are when open, for its backdrop's clip (--open-h). */
function sizeOpen(row) {
  const more = row.querySelector(".pc-more > div");
  if (more) row.style.setProperty("--open-h", `${more.scrollHeight}px`);
}

/**
 * Blend a row's backdrop into its new photo: the old one (a copy, `ghost`)
 * sits on top of the new one and fades out over the same second as the row's
 * slide, once the new photo is decoded, so there's never a blank frame. The
 * backdrop is already its own compositing layer, so fading a copy is cheap.
 */
function fadeGhost(ghost, bg) {
  ghost.classList.add("pc-ghost");
  bg.after(ghost);
  const ready = Promise.all([...bg.querySelectorAll("img")].map((img) => img.decode ? img.decode().catch(() => {}) : null));
  // An explicit animation (not a CSS transition, which can miss its start if
  // the copy is inserted and changed in the same frame) that always finishes
  ready.then(() => ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1000, easing: "cubic-bezier(.65, 0, .35, 1)", fill: "forwards" })
    .finished.then(() => ghost.remove(), () => ghost.remove()));
  setTimeout(() => ghost.remove(), 3000); // in case it never runs (a hidden tab)
}

$("#p-standings").addEventListener("click", (e) => {
  const b = e.target.closest("#st-tabs [data-week]");
  if (b) setWeek(+b.dataset.week);
});

// Sideways swipes step through the weeks; past the last, on to Episodes.
edgeNav($("#p-standings"), { prev: () => stWeek(state.d) > 1, next: () => true }, (dir) => {
  if (dir > 0 && stWeek(state.d) >= state.d.episodes.length) return show("episodes");
  setWeek(stWeek(state.d) + dir);
});
bindSwiper(EP, (dir) => {
  if (dir < 0) show("standings");
  else { state.cast = 0; show("cast"); }
}, { prev: true, next: true });
bindSwiper(CAST, (dir) => {
  if (dir < 0) { state.ep = state.d.episodes.length; show("episodes"); }
}, { prev: true, next: false });

// Task heat strip (Cast): tap an episode's slot in a row to read its tasks;
// tap it again to deselect it.
const heatTap = (e) => {
  const slot = e.target.closest("button.hs-slot");
  if (!slot) return;
  const card = slot.closest(".heat"), was = slot.classList.contains("on");
  for (const x of card.querySelectorAll(".hs-slot.on")) x.classList.remove("on");
  slot.classList.toggle("on", !was);
  slot.setAttribute("aria-pressed", !was);
  card.querySelector(".hs-cap").textContent = was ? "" : slot.dataset.say;
};
$("#cast-body").addEventListener("click", heatTap);

// The race chart (Episodes): tap a line, name or point to follow that
// contestant (their line comes forward, the rest fade); a point also reads out
// that week in the caption. Tap them again, or empty chart, to see everyone.
$("#ep-body").addEventListener("click", (e) => {
  const card = e.target.closest(".race");
  if (!card) return;
  const who = e.target.closest("g[data-who]"), hit = e.target.closest(".rc-hit");
  const cap = card.querySelector(".rc-cap"), svg = card.querySelector("svg");
  for (const x of card.querySelectorAll(".rc-hit.on")) x.classList.remove("on");
  const same = who && who.classList.contains("on") && !hit;
  for (const g of card.querySelectorAll("g[data-who].on")) g.classList.remove("on");
  if (!who || same) {
    card.classList.remove("focus");
    cap.textContent = "";
    return;
  }
  who.classList.add("on");
  svg.append(who); // draw it on top
  card.classList.add("focus");
  if (hit) { hit.classList.add("on"); cap.textContent = hit.dataset.say; }
  else cap.textContent = "";
});

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

// Standings backdrops: a slight vertical parallax. Each face drifts against
// the scroll, centred when its row's top line is mid-screen. Keyed to the top
// line, so opening a row doesn't move its own photo.
const PARALLAX = 0.06;
let praf = 0;
function parallax() {
  praf = 0;
  if (reducedMotion || state.page !== "standings") return;
  const mid = innerHeight / 2;
  for (const img of $$("#rows .pc-bg img")) {
    const r = img.closest(".pc").getBoundingClientRect();
    if (r.bottom < -100 || r.top > innerHeight + 100) continue;
    img.style.setProperty("--py", `${((mid - (r.top + 29)) * PARALLAX).toFixed(1)}px`);
  }
  // The scoring plaques' metal: its reflection moves as the plaque moves up the screen.
  for (const c of $$(".st-hero.explain .how-card")) {
    const r = c.getBoundingClientRect();
    c.style.setProperty("--lx", Math.max(-1, Math.min(1, (r.top + r.height / 2 - mid) / mid)).toFixed(3));
  }
}
const queueParallax = () => { if (!praf) praf = requestAnimationFrame(parallax); };
/**
 * Keep the parallax in step while rows move (a row opening, or rows sliding to
 * new places): every frame until `done` settles, then once more at rest.
 */
let following = 0;
function followParallax(done) {
  const step = () => { parallax(); if (following) requestAnimationFrame(step); };
  if (following++ === 0) requestAnimationFrame(step);
  Promise.race([done, new Promise((r) => setTimeout(r, 2500))]).finally(() => { following--; requestAnimationFrame(parallax); });
}
/** When the elements' current animations and transitions (their own, not their children's) have ended. */
const settled = (els) => Promise.all(els.flatMap((el) => el?.getAnimations?.() || []).map((a) => a.finished.catch(() => {})));
addEventListener("scroll", queueParallax, { passive: true });

addEventListener("resize", () => { for (const sw of [EP, CAST]) if ($(sw.body).offsetParent) jump(sw, sw.get()); queueParallax(); });

addEventListener("hashchange", () => {
  const h = readHash();
  if (h.key !== state.key) loadSeries(h.key);
  // A new week redraws the table (applyArg alone only sets it).
  if (h.page === "standings" && +h.arg >= 1) setWeek(+h.arg);
  else applyArg(h.page, h.arg);
  show(h.page);
});

// ── Boot ─────────────────────────────────────────────────────────────────────

try {
  const [text, allTime] = await Promise.all([loadText(), loadStats()]);
  SERIES = buildSeries(parseCSV(text));
  CURRENT = currentSeriesKey(SERIES, new Date());
  // The radar compares against every contestant in Taskmaster history when
  // the all-time stats are available, otherwise against the league's series.
  state.allTime = allTime;
  state.stats = allTime.length ? allTimePerEpisode(allTime) : { ...perEpisodeStats(SERIES), n: 0 };
  const h = readHash();
  loadSeries(h.key);
  applyArg(h.page, h.arg);
  // A link to another week: draw that week (loadSeries drew the latest).
  if (state.wk !== state.d.weeksScored) { $(".st-hero").innerHTML = standingsHero(state.d); renderRows(); }
  show(h.page);
  initEdit(text, refresh);
} catch (err) {
  console.error(err);
  $("#p-standings").innerHTML = `<p class="err">Couldn't load the league data. ${esc(err.message)}</p>`;
}
document.body.classList.remove("loading");
