import { loadData } from "./csv.js";
import { derive, currentSeriesKey, tzOffset, EPISODES } from "./league.js";
import { metaFor } from "./meta.js";
import { createStage, epState } from "./stage.js";
import { startSky } from "./gl.js";
import { burstAt } from "./fx.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/** Escaped text that keeps the CSV's <strong> markup. */
const rich = (s) => esc(s).replace(/&lt;(\/?)strong&gt;/g, "<$1strong>");
const ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const listing = (a) => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a.at(-1)}`;
const enc = encodeURIComponent;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const YT = "https://www.youtube.com/@Taskmaster";
const TYPE = { P: "Prize", F: "Filmed", T: "Team", L: "Live" };

const fmt = (opts, tz) => new Intl.DateTimeFormat(undefined, tz ? { ...opts, timeZone: tz } : opts);
const fmtLocal = fmt({ weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const fmtShortDay = fmt({ weekday: "short", day: "numeric", month: "short" }, "Europe/London");
const zoneHour = (date, tz) => fmt({ hour: "numeric", minute: "2-digit", hour12: true }, tz).format(date).replace(":00", "").replace(/\s/g, "").toLowerCase();

/** The contestant's full gold-framed portrait. */
const framed = (c, cls = "") => `<img class="fp ${cls}" src="${c.img}" alt="" width="225" height="266" loading="lazy" decoding="async" style="--c:${c.color}">`;
const pad = (n) => String(n).padStart(2, "0");
function splitTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const store = {
  get(k, f) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ── State ────────────────────────────────────────────────────────────────────

let SERIES = {}, CURRENT = null, sky = null, stage = null;
const state = {
  key: null, d: null, view: "standings", arg: null, sort: "show",
  me: store.get("fm-me", null), epSub: "league", plSub: 0,
};
const VIEWS = ["standings", "player", "episodes", "cast"];

function parseHash() {
  const [, key, view, arg] = location.hash.replace(/^#/, "").split("/");
  return { key: SERIES[key] ? key : CURRENT, view: VIEWS.includes(view) ? view : "standings", arg: arg ? decodeURIComponent(arg) : null };
}
const meIn = (d) => (state.me && d.allPlayers.includes(state.me) ? state.me : null);
const link = (view, arg) => `#/${state.key}/${view}${arg != null ? `/${enc(arg)}` : ""}`;

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

function rankSeal(rank) { return `<span class="seal ${rank <= 3 ? `seal-${rank}` : "seal-ink"}">${rank}</span>`; }
const deltaTag = (n) => n > 0 ? `<span class="delta up">▲${n}</span>` : n < 0 ? `<span class="delta down">▼${-n}</span>` : `<span class="delta">–</span>`;
function statusLine(s) {
  const list = s.needed.map(esc).join(", ");
  return `<span class="must">${s.kind === "must" ? "Must pick" : s.kind === "cannot" ? "Can't fit" : "Never picked"}: ${list}</span>`;
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

// ── Swipeable sections ───────────────────────────────────────────────────────

function swiperHTML(id, slides, attrs = "") {
  return `<div class="swiper" id="${id}" ${attrs}>${slides.map((s, i) => `<section class="slide" data-i="${i}">${s}</section>`).join("")}</div>`;
}
const stepOf = (el) => (el.children[1] ? el.children[1].offsetLeft - el.children[0].offsetLeft : el.clientWidth);
function fitHeight(el) {
  const i = Math.round(el.scrollLeft / stepOf(el));
  const s = el.children[i];
  if (s) el.style.height = `${s.offsetHeight}px`;
}
function bindSwiper(id, index, onSettle) {
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
function heroParallax(el) {
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
function goSlide(id, i) {
  const el = $(`#${id}`);
  el?.scrollTo({ left: i * stepOf(el), behavior: reducedMotion ? "auto" : "smooth" });
}
const quietHash = (h) => history.replaceState(null, "", h);

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

function viewStandings() {
  const d = state.d, key = state.sort, other = key === "show" ? "league" : "show";
  const me = meIn(d);
  const P = [...d.players].sort((a, b) => a[key + "Rank"] - b[key + "Rank"] || b[other] - a[other] || a.name.localeCompare(b.name));
  const worst = Math.max(...P.map((p) => p[key + "Rank"]));
  const head = `
    <header class="v-head">
      <div><p class="kicker">Series ${state.key} · Ep ${d.weeksScored}/${EPISODES}</p><h2>The Table</h2></div>
      <div class="seg" role="group" aria-label="Rank by">
        <button data-sort="show" aria-pressed="${key === "show"}">Show</button>
        <button data-sort="league" aria-pressed="${key === "league"}">League</button>
      </div>
    </header>`;
  if (!P.length) return `<section class="card">${head}<p class="empty">Nobody has voted in Series ${state.key} yet.</p></section>`;

  const rows = P.map((p) => {
    const rank = p[key + "Rank"];
    const strip = p.weeks.map((w) => {
      const c = w.pick && d.cast[w.pick];
      if (w.scored && c) return `<i class="${w.won ? "w" : ""}" style="--c:${c.color}" title="Ep ${w.ep}: ${esc(w.pick)}, ${w.show} Show, ${ord(w.place)}">${key === "show" ? w.show : w.league}</i>`;
      if (w.scored) return `<i class="x" title="Ep ${w.ep}: no vote">·</i>`;
      return c ? `<i class="soon" style="--c:${c.color}" title="Ep ${w.ep}: ${esc(w.pick)}"></i>` : `<i class="o"></i>`;
    }).join("");
    return `
    <li class="row ${p.name === me ? "me" : ""} ${rank === worst && P.length > 2 ? "crooked" : ""}" ${p.name === me ? 'id="me-row"' : ""}>
      <a href="${link("player", p.name)}">
        ${rankSeal(rank)}
        <span class="who"><b class="pname">${esc(p.name)}</b>${p.status ? statusLine(p.status) : ""}</span>
        <span class="strip" aria-hidden="true">${strip}</span>
        <span class="pts"><b data-count="${p[key]}">${p[key]}</b><small>${p[other]} ${other === "show" ? "S" : "L"}</small></span>
        ${deltaTag(p[key + "Delta"])}
      </a>
    </li>`;
  }).join("");

  const mp = me && d.byName[me];
  return `
  <section class="card table">
    ${head}
    ${d.weeksScored ? weekStrip(d.weeksScored) : ""}
    <div class="legend"><span>Rank</span><span>Player</span><span class="lg-strip">Ep 1–10 · ${key} pts</span><span>Total</span></div>
    <ol class="rows">${rows}</ol>
    ${d.inactive.length ? `<p class="foot">Yet to vote: ${d.inactive.map(esc).join(", ")}</p>` : ""}
  </section>
  ${mp ? `<button class="me-float" id="me-float" type="button" data-jump-me hidden>${rankSeal(mp[key + "Rank"])}<b>${esc(me)}</b><span>${mp[key]} ${key}</span><em>find me</em></button>` : ""}`;
}

function weekStrip(e) {
  const d = state.d, w = d.winners[e], wk = d.weekly[e], c = d.cast[w.winner], me = meIn(d);
  const hits = wk.hits.map((n) => (n === me ? "<b>you</b>" : esc(n)));
  return `
    <a class="week-strip" href="${link("episodes", e)}" style="--c:${c.color}">
      ${framed(c, "fp-s")}
      <span><small>Episode ${e}</small><b>${esc(c.key)} won${w.tiebreak ? " on a tiebreak" : ""}.</b>
      ${wk.hits.length ? `${wk.hits.length}/${wk.voters} backed ${esc(c.key)}: ${listing(hits)}.` : "Nobody backed the winner."} Avg ${wk.avgShow.toFixed(1)} pts.</span>
    </a>`;
}

// You ------------------------------------------------------------------------

function viewPlayer() {
  const d = state.d, me = meIn(d);
  const name = state.arg && d.allPlayers.includes(state.arg) ? state.arg : me;
  const options = [...d.allPlayers].sort().map((n) => `<option ${n === name ? "selected" : ""}>${esc(n)}</option>`).join("");
  const top = `
    <header class="pl-top">
      <select data-player-select aria-label="Player">${name ? "" : '<option value="" selected>Choose a player…</option>'}${options}</select>
      ${name && name !== me ? `<button class="btn" data-me-set="${esc(name)}" type="button">This is me</button>` : name ? `<span class="you-tag">you</span>` : ""}
    </header>`;
  if (!name) return `<section class="card">${top}<p class="empty">Choose a name to see their season.</p></section>`;
  const p = d.byName[name];
  if (!p) return `<section class="card">${top}<h2 class="pl-name">${esc(name)}</h2><p class="empty">No votes in Series ${state.key} yet.</p>${name === me && d.nextEp ? planner(name) : ""}</section>`;

  const n = d.players.length;
  const board = (key, label) => {
    const sorted = [...d.players].sort((a, b) => b[key] - a[key]);
    const ahead = sorted.filter((q) => q[key] > p[key]).at(-1), behind = sorted.find((q) => q[key] < p[key]);
    const gap = !ahead ? (behind ? `+${p[key] - behind[key]} on ${esc(behind.name)}` : "top") : `−${ahead[key] - p[key]} to ${esc(ahead.name)}`;
    return `<button class="pl-board ${state.sort === key ? "on" : ""}" data-sort="${key}" type="button">${rankSeal(p[key + "Rank"])}
      <span><small>${label} · ${ord(p[key + "Rank"])}/${n}</small><b>${p[key]}</b>${deltaTag(p[key + "Delta"])}<em>${gap}</em></span></button>`;
  };

  const leagueAvg = d.weeksScored ? Object.values(d.weekly).reduce((a, w) => a + w.avgShow, 0) / d.weeksScored : 0;
  const counts = Object.fromEntries(d.names.map((x) => [x, 0]));
  for (const w of p.weeks) if (w.pick && counts[w.pick] !== undefined) counts[w.pick]++;
  const needed = d.names.filter((x) => !p.weeks.slice(0, d.weeksScored).some((w) => w.pick === x));
  const ruleMsg = p.status ? statusLine(p.status)
    : needed.length ? `<span class="rule-msg">Still to pick: ${needed.map(esc).join(", ")} · ${plural(EPISODES - d.weeksScored, "poll")} left</span>`
    : `<span class="rule-msg ok">✓ Everyone picked at least once</span>`;

  const overview = `
    ${d.weeksScored ? bumpChart(name) : ""}
    <dl class="kv">
      <div><dt>Winner hit</dt><dd>${p.hits}<small>/${p.played}</small></dd></div>
      <div><dt>Avg pick</dt><dd>${(p.played ? p.show / p.played : 0).toFixed(1)}<small class="under">league ${leagueAvg.toFixed(1)}</small></dd></div>
      <div><dt>Best week</dt><dd>${p.best ? `${p.best.show}<small> E${p.best.ep}</small>` : "–"}</dd></div>
      <div><dt>Left on table</dt><dd>${p.missed}</dd></div>
    </dl>
    <div class="rule-track">
      <p class="kicker">Everyone at least once</p>
      <ul>${d.names.map((x) => `<li class="${counts[x] ? "got" : ""}">${framed(d.cast[x])}<b>${counts[x] ? `×${counts[x]}` : "–"}</b></li>`).join("")}</ul>
      ${ruleMsg}
    </div>`;

  const lastShown = d.nextEp ? Math.max(d.nextEp.ep, d.weeksAired) : EPISODES;
  const weeks = `<ol class="pl-weeks">${p.weeks.slice(0, lastShown).map((w, i) => {
    const e = i + 1, st = epState(d, e), c = w.pick ? d.cast[w.pick] : null, win = d.winners[e];
    const res = w.show != null ? `<b>${w.show}</b><small>${ord(w.place)} +${w.league}</small>` : `<small>${st === "scored" ? "no vote" : st === "pending" ? "soon" : w.pick ? "pick in" : "open"}</small>`;
    const note = w.show != null ? (w.won ? `<span class="hit">★ winner</span>` : `<span class="miss">${esc(win.winner)} won, ${win.top}</span>`) : `<span class="miss">${esc(d.raw.episodes[i].title || fmtShortDay.format(d.episodes[i].air))}</span>`;
    return `<li class="${st} ${w.won ? "won" : ""}"><a href="${link("episodes", e)}"><span class="pw-ep">${e}</span>${c ? framed(c, "fp-s") : `<span class="fp-empty"></span>`}<span class="pw-mid"><b>${c ? esc(c.key) : "—"}</b>${note}</span><span class="pw-res">${res}</span></a></li>`;
  }).join("")}</ol>`;

  const plan = name === me && d.nextEp ? planner(name) : `<p class="empty small">${name === me ? "The series is over." : `Only ${esc(name)} can plan their picks here.`}</p>`;
  const subs = ["Overview", "Weeks", "Plan"];
  return `
  <section class="card player">
    ${top}
    <div class="pl-head"><div class="pl-boards">${board("show", "Show")}${board("league", "League")}</div></div>
    <div class="subtabs" role="tablist">${subs.map((s, i) => `<button role="tab" data-go="${i}" data-swiper="pl-swiper" aria-selected="${state.plSub === i}">${s}</button>`).join("")}</div>
    ${swiperHTML("pl-swiper", [overview, weeks, plan])}
  </section>`;
}

function bumpChart(name) {
  const d = state.d, key = state.sort, n = d.players.length, W = d.weeksScored;
  const w = 640, h = 180, px = 34, py = 12;
  const x = (i) => (W === 1 ? w / 2 : px + (i * (w - px - 14)) / (W - 1));
  const y = (r) => py + ((r - 1) * (h - 2 * py)) / Math.max(1, n - 1);
  const line = (p) => p.history.map((hh, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(hh[key + "Rank"]).toFixed(1)}`).join("");
  const me = d.byName[name];
  const others = d.players.filter((p) => p.name !== name).map((p) => `<path d="${line(p)}" class="bump-o"/>`).join("");
  const dots = me.history.map((hh, i) => `<rect x="${x(i) - 9}" y="${y(hh[key + "Rank"]) - 9}" width="18" height="18" class="bump-dot"/><text x="${x(i)}" y="${y(hh[key + "Rank"]) + 4}" class="bump-n">${hh[key + "Rank"]}</text>`).join("");
  return `
    <figure class="bump">
      <figcaption>${key === "show" ? "Show" : "League"} rank by episode</figcaption>
      <svg viewBox="0 0 ${w} ${h + 16}" role="img" aria-label="${esc(name)}'s ${key} rank after each episode: ${me.history.map((hh) => hh[key + "Rank"]).join(", ")}">
        <text x="0" y="${y(1) + 4}" class="bump-y">1st</text><text x="0" y="${y(n) + 4}" class="bump-y">${ord(n)}</text>
        ${others}<path d="${line(me)}" class="bump-me"/>${dots}
        ${Array.from({ length: W }, (_, i) => `<text x="${x(i)}" y="${h + 14}" class="bump-x">${i + 1}</text>`).join("")}
      </svg>
    </figure>`;
}

const planKey = (name) => `fm-plan-${state.key}-${name}`;
function planner(name) {
  const d = state.d, p = d.byName[name], plan = store.get(planKey(name), {});
  const openEps = d.episodes.filter((e) => e.ep > d.weeksAired).map((e) => e.ep);
  const chosen = (e) => p?.weeks[e - 1].pick || plan[e] || null;
  const have = new Set();
  for (let e = 1; e <= EPISODES; e++) { const c = e <= d.weeksAired ? p?.weeks[e - 1].pick : chosen(e); if (c) have.add(c); }
  const needed = d.names.filter((x) => !have.has(x));
  const free = openEps.filter((e) => !chosen(e)).length;
  const msg = !needed.length ? `<p class="plan ok">✓ This plan picks everyone at least once.</p>`
    : needed.length > free ? `<p class="plan bad">Can't fit ${needed.map(esc).join(", ")}: only ${plural(free, "free poll")}.</p>`
    : needed.length === free ? `<p class="plan bad">Every free poll is spoken for: ${needed.map(esc).join(", ")}.</p>`
    : `<p class="plan">Still to fit in: ${needed.map(esc).join(", ")} · ${plural(free, "free poll")}.</p>`;
  return `
    <div class="planner">
      ${msg}
      <ol class="plan-rows">${openEps.map((e) => {
        const entered = p?.weeks[e - 1].pick;
        return `<li><span class="plan-ep">${e}</span><div class="choices" role="radiogroup" aria-label="Episode ${e} plan">${d.names.map((x) => {
          const on = (entered || plan[e]) === x;
          return `<button type="button" role="radio" aria-checked="${on}" aria-label="${esc(x)}" class="choice ${on ? "on" : ""}" ${entered ? "disabled" : ""} data-plan="${e}" data-name="${x}" style="--c:${d.cast[x].color}">${framed(d.cast[x])}</button>`;
        }).join("")}</div></li>`;
      }).join("")}</ol>
      <div class="actions"><button class="btn" data-plan-copy type="button">Copy plan</button><button class="btn ghost" data-plan-clear type="button">Clear</button></div>
      <p class="fine">Saved on this device only. Your real vote is the WhatsApp poll.</p>
    </div>`;
}

// Episodes -------------------------------------------------------------------

const selectedEp = () => (state.arg ? +state.arg : state.d.weeksScored || state.d.nextEp?.ep || 1);
const EP_SUBS = [["league", "League"], ["score", "Scoreboard"], ["tasks", "Tasks"], ["notes", "Write-up"]];

function viewEpisodes() {
  const d = state.d, sel = selectedEp();
  const pager = d.raw.episodes.map((e) => {
    const st = epState(d, e.ep), w = d.winners[e.ep], c = w && d.cast[w.winner];
    return `<button class="pg ${st} ${e.ep === sel ? "on" : ""}" data-go="${e.ep - 1}" data-swiper="ep-swiper" style="--c:${c ? c.color : "transparent"}" aria-label="Episode ${e.ep}">${e.ep}</button>`;
  }).join("");
  return `
  <div class="pager" aria-label="Episodes">${pager}</div>
  <div class="subtabs" role="tablist">${EP_SUBS.map(([k, l]) => `<button role="tab" data-epsub="${k}" aria-selected="${state.epSub === k}">${l}</button>`).join("")}</div>
  ${swiperHTML("ep-swiper", d.raw.episodes.map((e) => episodeCard(e.ep)), `data-sub="${state.epSub}"`)}`;
}

function episodeCard(ep) {
  const d = state.d, e = d.raw.episodes[ep - 1], air = d.episodes[ep - 1].air, st = epState(d, ep), me = meIn(d);
  const head = `<p class="kicker">Episode ${ep} · ${esc(fmtShortDay.format(air))}</p><h2>${e.title ? esc(e.title) : `Episode ${ep}`}</h2>`;
  if (st !== "scored") {
    const msg = st === "pending" ? "Aired. Scores and picks coming soon."
      : st === "next" ? `Sealed until ${esc(fmtLocal.format(air))}. Poll closes in <b data-countdown></b>.`
      : `Sealed until ${esc(fmtLocal.format(air))}.`;
    const mine = me && d.byName[me]?.weeks[ep - 1].pick;
    return `<article class="card ep sealed">${head}<div class="envelope" aria-hidden="true"><span class="env-seal">${ep}</span></div><p class="sealed-msg">${msg}</p>${mine ? `<p class="my-week">Your pick is in: <b>${esc(mine)}</b></p>` : ""}</article>`;
  }

  const w = d.winners[ep], c = d.cast[w.winner], tasks = d.epTasks(ep), wk = d.weekly[ep];
  const mine = me && d.byName[me]?.weeks[ep - 1];
  const order = [...d.names].sort((a, b) => d.placing[ep][a] - d.placing[ep][b] || d.EPS[b][ep] - d.EPS[a][ep]);

  const league = `<ol class="lw">${order.map((n) => {
    const cc = d.cast[n], who = wk.by[n];
    return `<li class="${n === w.winner ? "win" : ""}" style="--c:${cc.color}">
      ${framed(cc)}
      <div><div class="lw-head"><b>${esc(n)}</b><span class="lw-place">${ord(d.placing[ep][n])}</span><span class="lw-pts">${d.EPS[n][ep]}<small>S</small> +${d.rankPts[ep][n]}<small>L</small></span></div>
      <div class="lw-who">${who.length ? who.map((pn) => `<a href="${link("player", pn)}" class="chip ${pn === me ? "me" : ""}">${esc(pn)}</a>`).join("") : `<span class="nobody">nobody</span>`}</div></div>
    </li>`;
  }).join("")}</ol>`;

  const score = `
    <div class="race" data-ep="${ep}">
      <div class="race-head"><span class="race-step"></span><button class="btn btn-sm replay" data-ep="${ep}" type="button">▶ Replay</button></div>
      <ol class="race-rows">${d.names.map((n) => `<li class="race-row" data-name="${n}" style="--c:${d.cast[n].color}">${framed(d.cast[n])}<span class="race-name">${esc(n)}</span><span class="race-track"><span class="race-bar"></span></span><b class="race-total">${d.EPS[n][ep]}</b></li>`).join("")}</ol>
    </div>`;

  const taskList = `<ol class="tasks">${tasks.map((t) => {
    const max = Math.max(...t.s), min = Math.min(...t.s);
    return `<li class="task t-${t.t}"><div class="task-h"><span class="stamp">${TYPE[t.t]}</span><b>${esc(t.n)}</b></div>
      <ol class="scores">${d.names.map((n, j) => `<li class="${max !== min && t.s[j] === max ? "top" : max !== min && t.s[j] === min ? "low" : ""}" style="--c:${d.cast[n].color}" title="${esc(n)}">${framed(d.cast[n])}<b>${t.s[j]}</b></li>`).join("")}</ol></li>`;
  }).join("")}</ol>`;

  const notes = `<div class="notes">${e.analysis ? `<p>${rich(e.analysis)}</p>` : `<p>${esc(c.full)} won with ${w.top} points.</p>`}</div>`;

  return `
  <article class="card ep" style="--c:${c.color}">
    <div class="ep-top">${framed(c, "fp-m")}<div>${head}
      <p class="verdict"><b>${esc(c.key)}</b> ${w.tiebreak ? `won a ${w.tied.length}-way tie on ${w.top} after the tiebreak` : `won with ${w.top}`} · ${wk.hits.length}/${wk.voters} backed them · avg ${wk.avgShow.toFixed(1)}</p>
      ${mine ? (mine.show != null ? `<p class="my-week">You: <b>${esc(mine.pick)}</b> ${mine.show} Show +${mine.league} League${mine.won ? " ★" : ""}</p>` : `<p class="my-week">You didn't vote.</p>`) : ""}
    </div></div>
    <div class="panel" data-panel="league">${league}</div>
    <div class="panel" data-panel="score">${score}</div>
    <div class="panel" data-panel="tasks">${taskList}</div>
    <div class="panel" data-panel="notes">${notes}</div>
  </article>`;
}

const raceTimers = {};
function playRace(ep, instant = false) {
  const root = $(`.race[data-ep="${ep}"]`);
  if (!root) return;
  clearTimeout(raceTimers[ep]);
  const d = state.d, tasks = d.epTasks(ep);
  const rows = Object.fromEntries($$(".race-row", root).map((r) => [r.dataset.name, r]));
  const max = Math.max(...d.names.map((n) => d.EPS[n][ep]), 1);
  const rowH = 46;
  $(".race-rows", root).style.height = `${rowH * d.names.length}px`;
  const show = (k) => {
    const tot = Object.fromEntries(d.names.map((n, i) => [n, tasks.slice(0, k).reduce((a, t) => a + t.s[i], 0)]));
    const order = [...d.names].sort((a, b) => tot[b] - tot[a] || (k === tasks.length ? d.placing[ep][a] - d.placing[ep][b] : 0));
    order.forEach((n, i) => {
      const r = rows[n];
      r.style.transform = `translateY(${i * rowH}px)`;
      $(".race-bar", r).style.width = `${(tot[n] / max) * 100}%`;
      $(".race-total", r).textContent = tot[n];
      r.classList.toggle("winner", k === tasks.length && n === d.winners[ep].winner);
    });
    $(".race-step", root).textContent = k === 0 ? "Before task 1" : k === tasks.length ? "Final" : `After task ${k} · ${TYPE[tasks[k - 1].t]}`;
    if (k === tasks.length && !instant) setTimeout(() => burstAt($(".fp", rows[d.winners[ep].winner]), { colors: [d.cast[d.winners[ep].winner].color, "#f4d67a", "#f1e6cc"], count: 50 }), 250);
  };
  if (instant || reducedMotion) { show(tasks.length); return; }
  let k = 0;
  const step = () => { show(k); if (k++ < tasks.length) raceTimers[ep] = setTimeout(step, k === 1 ? 350 : 650); };
  step();
}

// Cast -----------------------------------------------------------------------

/** Contestants in standings order, last place on the left and first on the right. */
const castOrder = (d) => [...d.contestants].sort((a, b) => b.rank - a.rank || b.key.localeCompare(a.key));

function viewCast() {
  const d = state.d, m = metaFor(state.key);
  const order = castOrder(d);
  const idx = Math.max(0, order.findIndex((c) => c.key === (state.arg || order.at(-1).key)));
  const worst = Math.max(...d.contestants.map((c) => c.rank));
  const overlay = order.every((c) => m.heroes?.[c.key]);
  const wall = order.map((c, i) => `
    <button class="frame ${i === idx ? "on" : ""} ${c.rank === worst && d.weeksScored ? "crooked" : ""}" data-go="${i}" data-swiper="cast-swiper" style="--c:${c.color}" aria-label="${esc(c.full)}, ${ord(c.rank)} on ${c.total}">
      ${framed(c)}<b class="frame-score">${c.total}</b>
    </button>`).join("");

  const maxEp = Math.max(...d.contestants.flatMap((c) => c.eps), 1);
  const cards = order.map((c) => {
    const bars = c.eps.map((v, i) => {
      const ep = i + 1, scored = ep <= d.weeksScored;
      return `<li class="${scored ? "" : "future"} ${d.winners[ep]?.winner === c.key ? "won" : ""}" style="--h:${scored ? (v / maxEp) * 100 : 0}%"><b>${scored ? v : ""}</b><span class="bar"></span><small>${ep}</small></li>`;
    }).join("");
    const hero = m.heroes?.[c.key];
    const kv = `
          <dl class="kv tight">
            <div><dt>Total</dt><dd>${c.total}</dd></div>
            <div><dt>Per ep</dt><dd>${c.avg.toFixed(1)}</dd></div>
            <div><dt>Ep wins</dt><dd>${c.wins}</dd></div>
            <div><dt>5-pointers</dt><dd>${c.fives}</dd></div>
            <div><dt>Picked</dt><dd>${c.pickedBy}<small>×</small></dd></div>
            <div><dt>To backers</dt><dd>${c.deliveredTo}</dd></div>
          </dl>
          <p class="cats">Prize <b>${ord(c.prizeRank)}</b> · Filmed <b>${ord(c.filmedRank)}</b> · Live <b>${ord(c.liveRank)}</b></p>`;
    const rank = d.weeksScored ? `${ord(c.rank)} in Series ${state.key}` : `Series ${state.key}`;
    if (hero) {
      // The hero shot is the card's backdrop. The portrait wall floats over the
      // top of it, the photo is dropped just enough that heads start below the
      // wall, and faces (~19–45% of the photo's height) are kept clear by the
      // .cc-face spacer; the name and stats begin under the chin.
      return `
    <article class="card cast-card has-hero" style="--c:${c.color}">
      <div class="cc-bg" aria-hidden="true"><img src="${hero}" alt="" width="640" height="865" loading="lazy" decoding="async"></div>
      <div class="cc-face"></div>
      <header class="cc-name"><p class="kicker">${rank}</p><h2>${esc(c.full)}</h2></header>
      <div class="cc-body">
        ${kv}
        <figure class="ep-chart"><ol>${bars}</ol></figure>
        ${c.stat ? `<p class="stat-note">${rich(c.stat)}</p>` : ""}
        ${c.bio ? `<p class="bio">${rich(c.bio)}</p>` : ""}
      </div>
    </article>`;
    }
    return `
    <article class="card cast-card" style="--c:${c.color}">
      <div class="cc-top">
        ${framed(c, "fp-l")}
        <div class="cc-info"><p class="kicker">${rank}</p><h2>${esc(c.full)}</h2>${kv}</div>
      </div>
      <figure class="ep-chart"><ol>${bars}</ol></figure>
      ${c.stat ? `<p class="stat-note">${rich(c.stat)}</p>` : ""}
      ${c.bio ? `<p class="bio">${rich(c.bio)}</p>` : ""}
    </article>`;
  });
  return `
  <div class="cast-view ${overlay ? "overlay" : ""}">
    <div class="wall" aria-label="Contestants by standing, first place on the right">${wall}</div>
    ${swiperHTML("cast-swiper", cards)}
  </div>`;
}

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
