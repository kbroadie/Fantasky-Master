import { loadData } from "./csv.js";
import { derive, currentSeriesKey, tzOffset, EPISODES } from "./league.js";
import { metaFor } from "./meta.js";
import { createStage, epState } from "./stage.js";
import { startSky } from "./gl.js";
import { burstAt } from "./fx.js";
import { $$, $, esc, ord, listing, reducedMotion, YT, fmtLocal, zoneHour, pad, splitTime, store, state, meIn, link, rankSeal, deltaTag, statusLine, fitHeight, bindSwiper, heroParallax, goSlide, quietHash } from "./ui.js";
import { viewStandings } from "./views/table.js";
import { viewPlayer, planKey, planner } from "./views/player.js";
import { selectedEp, viewEpisodes, playRace } from "./views/episodes.js";
import { castOrder, viewCast } from "./views/cast.js";


// ── State ────────────────────────────────────────────────────────────────────

let SERIES = {}, CURRENT = null, sky = null, stage = null;
const VIEWS = ["standings", "player", "episodes", "cast"];

function parseHash() {
  const [, key, view, arg] = location.hash.replace(/^#/, "").split("/");
  return { key: SERIES[key] ? key : CURRENT, view: VIEWS.includes(view) ? view : "standings", arg: arg ? decodeURIComponent(arg) : null };
}


function setMe(name) {
  state.me = name;
  store.set("fm-me", name);
  renderMe();
  renderView(false);
}

function loadSeries(key) {
  state.key = key;
  state.d = derive(SERIES[key], new Date());
  const m = metaFor(key);
  document.body.dataset.theme = m.theme;
  document.body.classList.toggle("past", key !== CURRENT);
  sky?.setTheme(m.theme);
  stage?.update(state.d, m.theme, (ep) => link("episodes", ep));
  renderTop();
  renderDialog();
  renderMe();
}

// ── Top bar ──────────────────────────────────────────────────────────────────

function renderTop() {
  const keys = Object.keys(SERIES).sort((a, b) => b - a);
  $("#series-num").textContent = state.key;
  $("#series-btn").setAttribute("aria-label", `Series ${state.key}. Switch series`);
  $("#series-menu").innerHTML = `
    <p class="menu-title">Switch series</p>
    ${keys.map((k) => {
      const m = metaFor(k);
      return `<a href="#/${k}/${state.view}" class="menu-item ${k === state.key ? "on" : ""}">
        <span class="mini-seal">${k}</span>
        <span><b>Series ${k}</b><small>${esc(m.themeName)}${k === CURRENT ? " · <em>now showing</em>" : ""}</small></span></a>`;
    }).join("")}`;
}

// ── Home: dialog box and "you" ───────────────────────────────────────────────

function leaders(d, key) {
  const top = Math.max(...d.players.map((p) => p[key]));
  return d.players.filter((p) => p[key] === top);
}

function renderDialog() {
  const d = state.d, box = $("#dialog");
  const pending = d.weeksAired > d.weeksScored ? `<p class="dl-note">Episode ${d.weeksAired} has aired · results coming soon</p>` : "";
  if (!d.nextEp) {
    const champ = [...d.contestants].sort((a, b) => a.rank - b.rank)[0];
    const show = leaders(d, "show"), league = leaders(d, "league");
    box.innerHTML = `
      <p class="dl-who">Series ${state.key} · complete</p>
      <p class="dl-main" data-main>${show.length ? `League champion${show.length > 1 ? "s" : ""}: <b>${esc(listing(show.map((p) => p.name)))}</b> on ${show[0].show}` : `Series ${state.key} is complete`}</p>
      <p class="dl-sub">League table: ${esc(listing(league.map((p) => p.name)))} (${league[0]?.league ?? 0}) · Golden head: ${esc(champ.full)}</p>
      ${state.key !== CURRENT ? `<a class="dl-link" href="#/${CURRENT}/standings">▶ Back to Series ${CURRENT}</a>` : ""}${pending}`;
    return;
  }
  const e = d.nextEp;
  const ny = zoneHour(e.air, "America/New_York"), la = zoneHour(e.air, "America/Los_Angeles");
  const gap = (tzOffset(e.air, "Europe/London") - tzOffset(e.air, "America/New_York")) / 60;
  box.innerHTML = `
    <p class="dl-who">Task · Episode ${e.ep} of ${EPISODES}</p>
    <p class="dl-main" data-main>Pick the winner of <b>${e.title ? `“${esc(e.title)}”` : `Episode ${e.ep}`}</b></p>
    <p class="dl-cd"><span>Poll closes in</span> <time id="cd"></time></p>
    <p class="dl-sub">${esc(fmtLocal.format(e.air))} · London 10pm · ET ${ny} · PT ${la} · <a href="${YT}" target="_blank" rel="noopener">YouTube ↗</a></p>
    ${gap !== 5 ? `<p class="dl-note">Clocks change on different weekends: this week it's ${ny} Eastern / ${la} Pacific.</p>` : ""}${pending}`;
  tick();
}

const QUIPS = [
  "All the information is on the task.", "Your time starts now.", "No vote, no points.",
  "Polls close the moment the livestream starts.", "You must pick every contestant at least once.",
  "Tiebreaks only matter for the League table.", "Please don't touch the caravan.",
];
let quipI = Math.floor(Math.random() * QUIPS.length), quipTimer = 0;
function knock() {
  const main = $("#dialog [data-main]");
  if (!main) return;
  const text = QUIPS[quipI++ % QUIPS.length];
  clearTimeout(quipTimer);
  main.innerHTML = `<b>Alex:</b> <span class="typed"></span>`;
  const span = main.querySelector(".typed");
  let i = 0;
  const type = () => { span.textContent = text.slice(0, ++i); if (i < text.length) quipTimer = setTimeout(type, reducedMotion ? 0 : 28); else quipTimer = setTimeout(renderDialog, 3200); };
  type();
}

function renderMe() {
  const d = state.d, box = $("#me");
  if (!d || !box) return;
  const me = meIn(d), p = me && d.byName[me];
  if (!me) {
    box.innerHTML = `<label class="me-pick"><span>Which player are you?</span>
      <select data-me-select><option value="">Choose your name…</option>${[...d.allPlayers].sort().map((n) => `<option>${esc(n)}</option>`).join("")}</select></label>`;
    return;
  }
  if (!p) {
    box.innerHTML = `<div class="me-card quiet"><span class="me-label">You</span><b class="me-name">${esc(me)}</b><span class="me-line">No votes yet in Series ${state.key}.</span><button class="linkish" data-me-clear type="button">Not you?</button></div>`;
    return;
  }
  const lastW = d.weeksScored ? p.weeks[d.weeksScored - 1] : null;
  const next = d.nextEp ? p.weeks[d.nextEp.ep - 1] : null;
  box.innerHTML = `
    <div class="me-card">
      <a class="me-main" href="${link("player", me)}">
        <span class="me-label">You</span><b class="me-name">${esc(me)}</b>
        <span class="me-b">${rankSeal(p.showRank)}<b>${p.show}</b><small>Show</small>${deltaTag(p.showDelta)}</span>
        <span class="me-b">${rankSeal(p.leagueRank)}<b>${p.league}</b><small>League</small>${deltaTag(p.leagueDelta)}</span>
      </a>
      <p class="me-line">${lastW ? (lastW.show != null ? `Ep ${d.weeksScored}: ${esc(lastW.pick)} got you <b>${lastW.show}</b> (${ord(lastW.place)})` : `No vote in Ep ${d.weeksScored}`) : ""}${next?.pick ? ` · Ep ${next.ep} pick in: ${esc(next.pick)}` : ""}
        ${p.status ? ` · ${statusLine(p.status)}` : ""} <button class="linkish" data-me-clear type="button">Not you?</button></p>
    </div>`;
}

function tick() {
  const d = state.d;
  if (!d?.nextEp) return;
  const ms = d.nextEp.air - Date.now();
  if (ms <= 0) { loadSeries(state.key); renderView(false); return; }
  const t = splitTime(ms);
  const cd = $("#cd");
  if (cd) cd.textContent = `${t.d ? `${t.d}d ` : ""}${pad(t.h)}:${pad(t.m)}:${pad(t.s)}`;
  for (const el of $$("[data-countdown]")) el.textContent = t.d ? `${t.d}d ${t.h}h` : `${t.h}h ${pad(t.m)}m`;
}


// ── Views ────────────────────────────────────────────────────────────────────

function renderView(animate = true) {
  const main = $("#view");
  document.body.dataset.view = state.view;
  const html = { standings: viewStandings, player: viewPlayer, episodes: viewEpisodes, cast: viewCast }[state.view]();
  const swap = () => {
    main.innerHTML = html;
    for (const t of $$(".tabs a")) {
      const v = t.dataset.view;
      t.setAttribute("aria-current", v === state.view ? "page" : "false");
      t.href = v === "player" ? link("player", meIn(state.d) ?? undefined) : link(v);
    }
    moveTabInk();
    afterRender();
  };
  if (animate && document.startViewTransition && !reducedMotion) document.startViewTransition(swap);
  else swap();
}

// Table ----------------------------------------------------------------------

// ── After render ────────────────────────────────────────────────────────────

let meObserver = null;
function afterRender() {
  tick();
  meObserver?.disconnect();
  const d = state.d;

  if (state.view === "standings") {
    const row = $("#me-row"), float = $("#me-float");
    if (row && float) {
      meObserver = new IntersectionObserver(([en]) => { float.hidden = en.isIntersecting || scrollY < 200; });
      meObserver.observe(row);
    }
  }
  if (state.view === "episodes") {
    const sel = selectedEp();
    bindSwiper("ep-swiper", sel - 1, (i) => {
      state.arg = String(i + 1);
      quietHash(link("episodes", i + 1));
      $$(".pager .pg").forEach((b, j) => b.classList.toggle("on", j === i));
      $(".pager .pg.on")?.scrollIntoView({ block: "nearest", inline: "center", behavior: reducedMotion ? "auto" : "smooth" });
      if (state.epSub === "score") playRace(i + 1);
    });
    $(".pager .pg.on")?.scrollIntoView({ block: "nearest", inline: "center" });
    for (let e = 1; e <= d.weeksScored; e++) playRace(e, true);
    if (state.epSub === "score") playRace(sel);
  }
  if (state.view === "cast") {
    const idx = $$(".wall .frame").findIndex((f) => f.classList.contains("on"));
    heroParallax($("#cast-swiper"));
    bindSwiper("cast-swiper", idx, (i) => {
      state.arg = castOrder(d)[i].key;
      quietHash(link("cast", state.arg));
      $$(".wall .frame").forEach((f, j) => f.classList.toggle("on", j === i));
    });
  }
  if (state.view === "player") {
    bindSwiper("pl-swiper", state.plSub, (i) => {
      state.plSub = i;
      $$(".player .subtabs button").forEach((b, j) => b.setAttribute("aria-selected", j === i));
    });
  }
  if (pendingReveal) $("#view").scrollIntoView({ behavior: "auto", block: "start" });
  pendingReveal = false;
  countUp();
}

function countUp() {
  if (reducedMotion) return;
  for (const el of $$("[data-count]")) {
    const to = +el.dataset.count, t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / 600); el.textContent = Math.round(to * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
}

function moveTabInk() {
  const a = $(`.tabs a[data-view="${state.view}"]`), ink = $(".tab-ink");
  if (!a || !ink) return;
  ink.style.width = `${a.offsetWidth}px`;
  ink.style.transform = `translateX(${a.offsetLeft}px)`;
}

// ── Routing ─────────────────────────────────────────────────────────────────

let pendingReveal = false;
function route() {
  if (location.hash && !location.hash.startsWith("#/")) return;
  const r = parseHash();
  const viewChanged = r.view !== state.view;
  pendingReveal = viewChanged && r.view !== "standings" && scrollY > $("#view").offsetTop;
  state.view = r.view;
  state.arg = r.arg;
  if (r.key !== state.key) {
    const first = state.key === null;
    const go = () => { loadSeries(r.key); renderView(false); };
    if (!first && document.startViewTransition && !reducedMotion) {
      document.documentElement.classList.add("vt-series");
      document.startViewTransition(go).finished.finally(() => document.documentElement.classList.remove("vt-series"));
      burstAt($("#series-btn"), metaFor(r.key).theme === "diner" ? { kind: "spark", colors: ["#ff4f9a", "#37d6c8", "#fff"], count: 36 } : { kind: "steam", count: 16 });
    } else go();
    document.title = `Series ${r.key} · Fantasky Master`;
    return;
  }
  // Swipes rewrite the hash quietly; if the target is already on screen, just slide to it.
  if (!viewChanged && (r.view === "episodes" || r.view === "cast") && r.arg) {
    const i = r.view === "episodes" ? +r.arg - 1 : castOrder(state.d).findIndex((c) => c.key === r.arg);
    if (i >= 0) { goSlide(r.view === "episodes" ? "ep-swiper" : "cast-swiper", i); return; }
  }
  renderView(viewChanged);
}

// ── Events ──────────────────────────────────────────────────────────────────

document.addEventListener("click", (e) => {
  const t = e.target;
  const sortBtn = t.closest("[data-sort]");
  if (sortBtn) { const y = scrollY; state.sort = sortBtn.dataset.sort; renderView(false); scrollTo(0, y); return; }
  const go = t.closest("[data-go]");
  if (go) {
    const i = +go.dataset.go;
    goSlide(go.dataset.swiper, i);
    if (go.dataset.swiper === "pl-swiper") { state.plSub = i; $$(".player .subtabs button").forEach((b, j) => b.setAttribute("aria-selected", j === i)); }
    return;
  }
  const sub = t.closest("[data-epsub]");
  if (sub) {
    state.epSub = sub.dataset.epsub;
    const sw = $("#ep-swiper");
    sw.dataset.sub = state.epSub;
    $$("[data-epsub]").forEach((b) => b.setAttribute("aria-selected", b === sub));
    fitHeight(sw);
    if (state.epSub === "score") playRace(selectedEp());
    return;
  }
  const replay = t.closest(".replay");
  if (replay) { playRace(+replay.dataset.ep); return; }
  if (t.closest("[data-jump-me]")) { $("#me-row")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" }); return; }
  if (t.closest("[data-me-clear]")) { setMe(null); return; }
  const meSet = t.closest("[data-me-set]");
  if (meSet) { burstAt(meSet, { count: 40 }); setMe(meSet.dataset.meSet); return; }

  const plan = t.closest("[data-plan]");
  if (plan && !plan.disabled) {
    const key = planKey(meIn(state.d)), p = store.get(key, {}), ep = plan.dataset.plan;
    p[ep] = p[ep] === plan.dataset.name ? null : plan.dataset.name;
    store.set(key, p);
    rerenderPlanner();
    return;
  }
  if (t.closest("[data-plan-clear]")) { store.set(planKey(meIn(state.d)), {}); rerenderPlanner(); return; }
  const copy = t.closest("[data-plan-copy]");
  if (copy) {
    const d = state.d, name = meIn(d), p = d.byName[name], plan = store.get(planKey(name), {});
    const text = `${name}'s Series ${state.key} picks: ` + Array.from({ length: EPISODES }, (_, i) => `Ep${i + 1} ${p?.weeks[i].pick || plan[i + 1] || "–"}`).join(", ");
    navigator.clipboard?.writeText(text).then(() => { copy.textContent = "Copied ✓"; setTimeout(() => (copy.textContent = "Copy plan"), 1500); }, () => prompt("Copy your plan:", text));
    return;
  }
  if (t.closest(".menu-item")) $("#series-menu").hidePopover?.();
});

function rerenderPlanner() {
  const box = $(".planner");
  if (!box) return;
  const tmp = document.createElement("div");
  tmp.innerHTML = planner(meIn(state.d));
  box.replaceWith(tmp.firstElementChild);
  fitHeight($("#pl-swiper"));
}

document.addEventListener("change", (e) => {
  if (e.target.matches("[data-me-select]") && e.target.value) { setMe(e.target.value); burstAt($("#me"), { count: 40 }); }
  if (e.target.matches("[data-player-select]") && e.target.value) location.hash = link("player", e.target.value);
});

let scrollRaf = 0;
addEventListener("scroll", () => {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    const h = $(".home").offsetHeight || 1;
    sky?.setScroll(Math.min(1, scrollY / h));
  });
}, { passive: true });
addEventListener("resize", moveTabInk, { passive: true });

// ── Boot ────────────────────────────────────────────────────────────────────

try { sky = startSky($("#sky"), { reducedMotion }); } catch (err) { console.warn("Sky shader unavailable:", err); }
if (!sky) document.body.classList.add("no-gl");
stage = createStage($("#stage"), { reducedMotion, onCaravan: knock });

try {
  SERIES = await loadData();
  CURRENT = currentSeriesKey(SERIES, new Date());
  if (!location.hash) history.replaceState(null, "", `#/${CURRENT}/standings`);
  addEventListener("hashchange", route);
  route();
  setInterval(tick, 1000);
  document.fonts?.ready.then(moveTabInk);
} catch (err) {
  console.error(err);
  $("#view").innerHTML = `<section class="card"><h2>Envelope jammed</h2><p>The league data couldn't be loaded. Check your connection and refresh.</p></section>`;
} finally {
  document.body.classList.remove("loading");
}
