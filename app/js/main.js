import { loadData } from "./csv.js";
import { derive, currentSeriesKey, tzOffset, EPISODES } from "./league.js";
import { metaFor } from "./meta.js";
import { houseSVG, epState } from "./house.js";
import { startSky } from "./gl.js";
import { burst, burstAt } from "./fx.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/** Escaped text that keeps the CSV's <strong> markup. */
const rich = (s) => esc(s).replace(/&lt;(\/?)strong&gt;/g, "<$1strong>");
const ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const listing = (a) => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a.at(-1)}`;
const enc = encodeURIComponent;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const YT = "https://www.youtube.com/@Taskmaster";
const TYPE = { P: "Prize", F: "Filmed", T: "Team", L: "Live" };

const fmt = (opts, tz) => new Intl.DateTimeFormat(undefined, tz ? { ...opts, timeZone: tz } : opts);
const fmtLocal = fmt({ weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const fmtDay = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }, "Europe/London");
const fmtShortDay = fmt({ weekday: "short", day: "numeric", month: "short" }, "Europe/London");
const zoneHour = (date, tz) => fmt({ hour: "numeric", minute: "2-digit", hour12: true }, tz).format(date).replace(":00", "").replace(/\s/g, "").toLowerCase();

const avatar = (c, cls = "") => `<span class="ava ${cls}" style="--c:${c.color};--img:url('${c.img}')" aria-hidden="true"></span>`;
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

let SERIES = {}, CURRENT = null, sky = null;
const state = { key: null, d: null, view: "standings", arg: null, sort: "show", me: store.get("fm-me", null) };
const VIEWS = ["standings", "player", "episodes", "cast"];

function parseHash() {
  const [, key, view, arg] = location.hash.replace(/^#/, "").split("/");
  return {
    key: SERIES[key] ? key : CURRENT,
    view: VIEWS.includes(view) ? view : "standings",
    arg: arg ? decodeURIComponent(arg) : null,
  };
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
  renderTop();
  renderHero();
}

// ── Top bar & series switcher ────────────────────────────────────────────────

function renderTop() {
  const keys = Object.keys(SERIES).sort((a, b) => b - a);
  $("#series-num").textContent = state.key;
  $("#series-btn").setAttribute("aria-label", `Series ${state.key}. Switch series`);
  $("#series-menu").innerHTML = `
    <p class="menu-title">Switch series</p>
    ${keys.map((k) => {
      const m = metaFor(k);
      return `
      <a href="#/${k}/${state.view}" class="menu-item ${k === state.key ? "on" : ""}">
        <span class="mini-seal">${k}</span>
        <span><b>Series ${k}</b><small>${esc(m.themeName)}${m.location ? ` · ${esc(m.location)}` : ""}${k === CURRENT ? " · <em>now showing</em>" : ""}</small></span>
      </a>`;
    }).join("")}`;
}

// ── Hero: house, task card, and "you" ────────────────────────────────────────

function renderHero() {
  const d = state.d;
  $("#house").innerHTML = houseSVG(d, state.key, metaFor(state.key).theme);
  $("#taskcard").innerHTML = taskCard(d);
  renderMe();
  tick();
  placeChimney();
}

function leaders(d, key) {
  const top = Math.max(...d.players.map((p) => p[key]));
  return d.players.filter((p) => p[key] === top);
}

function taskCard(d) {
  const pending = d.weeksAired > d.weeksScored
    ? `<p class="tc-ribbon">Episode ${d.weeksAired} aired · results coming soon</p>` : "";

  if (!d.nextEp) {
    const champ = [...d.contestants].sort((a, b) => a.rank - b.rank)[0];
    const showW = leaders(d, "show"), leagueW = leaders(d, "league");
    return `
      <span class="tc-stamp">Complete</span>
      <p class="tc-kicker">Series ${state.key} · final table</p>
      ${showW.length ? `
      <h1 class="tc-title">${showW.length > 1 ? "Joint league champions" : "League champion"}<br><em>${esc(listing(showW.map((p) => p.name)))}</em></h1>
      <ul class="tc-champs">
        <li><small>Show</small><b>${esc(listing(showW.map((p) => p.name)))}</b><span>${showW[0].show} pts</span></li>
        <li><small>League</small><b>${esc(listing(leagueW.map((p) => p.name)))}</b><span>${leagueW[0].league} pts</span></li>
      </ul>` : `<h1 class="tc-title">Series ${state.key} is complete</h1>`}
      <div class="tc-head">${goldenHead()}<p>The golden head went to <b style="--c:${champ.color}">${esc(champ.full)}</b> on ${champ.total}.</p></div>
      ${state.key !== CURRENT ? `<a class="tc-link" href="#/${CURRENT}/standings">Back to Series ${CURRENT} →</a>` : ""}
      ${pending}`;
  }

  const e = d.nextEp;
  const title = e.title ? `“${esc(e.title)}”` : `Episode ${e.ep}`;
  const ny = zoneHour(e.air, "America/New_York"), la = zoneHour(e.air, "America/Los_Angeles");
  const gap = (tzOffset(e.air, "Europe/London") - tzOffset(e.air, "America/New_York")) / 60;
  const warn = gap !== 5
    ? `<p class="tc-warn"><b>Heads-up:</b> UK and US clocks change on different weekends, so this poll closes at <b>${ny} Eastern</b> / <b>${la} Pacific</b>.</p>` : "";
  return `
    <span class="tc-stamp">Task</span>
    <div class="tc-top">
      <div>
        <p class="tc-kicker">Episode ${e.ep} of ${EPISODES} · poll closes in</p>
        <time class="cd" id="cd"></time>
      </div>
      <svg class="stopwatch" viewBox="0 0 120 120" aria-hidden="true">
        <rect x="52" y="0" width="16" height="10" rx="3" class="sw-crown"/>
        <circle cx="60" cy="64" r="50" class="sw-track"/>
        <circle cx="60" cy="64" r="50" class="sw-arc" pathLength="100"/>
        <g class="sw-ticks">${Array.from({ length: 12 }, (_, i) => `<line x1="60" y1="20" x2="60" y2="26" transform="rotate(${i * 30} 60 64)"/>`).join("")}</g>
        <line class="sw-hand" x1="60" y1="64" x2="60" y2="24"/>
        <circle cx="60" cy="64" r="4" class="sw-pin"/>
      </svg>
    </div>
    <h1 class="tc-title">Pick the winner of <em>${title}</em></h1>
    <p class="tc-local"><b>${esc(fmtLocal.format(e.air))}</b> your time</p>
    <ul class="tc-zones" aria-label="Deadline around the world">
      <li><small>London</small>10pm</li><li><small>Eastern</small>${ny}</li><li><small>Pacific</small>${la}</li>
    </ul>
    ${warn}${pending}
    <a class="tc-yt" href="${YT}" target="_blank" rel="noopener">Watch live on YouTube ↗</a>`;
}

function goldenHead() {
  return `<svg class="golden" viewBox="0 0 100 110" width="64" height="70" aria-hidden="true">
    <defs><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b3"/><stop offset=".45" stop-color="#e2b43f"/><stop offset="1" stop-color="#8a5f12"/></linearGradient></defs>
    <path d="M50 8c19 0 31 14 31 33 0 9-2 15-5 20l3 8-6 2c-1 8-6 13-14 14l-2 8H43l-1-8C28 82 19 70 19 50 19 24 31 8 50 8Z" fill="url(#gold)"/>
    <path d="M26 96h48l6 12H20Z" fill="url(#gold)"/>
    <path d="M58 44c3-1 6-1 8 1M36 45c3-2 6-2 8-1M44 66c4 2 9 2 13 0" stroke="#7a5210" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>`;
}

function rankSeal(rank, cls = "") {
  return `<span class="seal ${rank <= 3 ? `seal-${rank}` : "seal-ink"} ${cls}"><span>${rank}</span></span>`;
}
const deltaTag = (n) => n > 0 ? `<span class="delta up">▲${n}</span>` : n < 0 ? `<span class="delta down">▼${-n}</span>` : `<span class="delta">–</span>`;

function renderMe() {
  const d = state.d, box = $("#me");
  if (!d || !box) return;
  const me = meIn(d);
  const p = me && d.byName[me];
  if (!me) {
    box.innerHTML = `
      <label class="me-pick">
        <span>Which player are you?</span>
        <select data-me-select>
          <option value="">Choose your name…</option>
          ${[...d.allPlayers].sort().map((n) => `<option>${esc(n)}</option>`).join("")}
        </select>
      </label>`;
    return;
  }
  if (!p) {
    box.innerHTML = `
      <div class="me-card quiet"><span class="me-label">You</span><b class="me-name">${esc(me)}</b>
      <span class="me-line">No votes recorded for you in Series ${state.key} yet. Vote in the WhatsApp poll before it closes.</span></div>
      <button class="linkish me-switch" data-me-clear type="button">Not ${esc(me)}?</button>`;
    return;
  }
  const next = d.nextEp ? p.weeks[d.nextEp.ep - 1] : null;
  const lastW = d.weeksScored ? p.weeks[d.weeksScored - 1] : null;
  box.innerHTML = `
    <a class="me-card" href="${link("player", me)}">
      <span class="me-label">You</span>
      <b class="me-name">${esc(me)}</b>
      <span class="me-boards">
        <span>${rankSeal(p.showRank)}<b>${p.show}</b><small>Show ${deltaTag(p.showDelta)}</small></span>
        <span>${rankSeal(p.leagueRank)}<b>${p.league}</b><small>League ${deltaTag(p.leagueDelta)}</small></span>
      </span>
      <span class="me-line">${lastW ? (lastW.show != null ? `Episode ${d.weeksScored}: ${esc(lastW.pick)} got you <b>${lastW.show}</b> (${ord(lastW.place)}).` : `No vote in Episode ${d.weeksScored}.`) : ""}${next?.pick ? ` Episode ${next.ep} pick in: ${esc(next.pick)}.` : ""}</span>
      ${p.status ? statusLine(p.status) : ""}
      <span class="me-go" aria-hidden="true">→</span>
    </a>
    <button class="linkish me-switch" data-me-clear type="button">Not ${esc(me)}?</button>`;
}

function tick() {
  const d = state.d;
  if (!d?.nextEp) return;
  const ms = d.nextEp.air - Date.now();
  if (ms <= 0) {
    loadSeries(state.key);
    renderView(false);
    burstAt($("#taskcard"), { count: 120 });
    return;
  }
  const t = splitTime(ms);
  const cd = $("#cd");
  if (cd) cd.innerHTML = `${t.d ? `<span>${t.d}<small>d</small></span>` : ""}<span>${pad(t.h)}<small>h</small></span><span>${pad(t.m)}<small>m</small></span><span>${pad(t.s)}<small>s</small></span>`;
  const prev = d.episodes[d.nextEp.ep - 2]?.air;
  const span = prev ? d.nextEp.air - prev : 7 * 864e5;
  const frac = Math.min(1, Math.max(0, 1 - ms / span));
  const arc = $(".sw-arc");
  if (arc) arc.style.strokeDasharray = `${(frac * 100).toFixed(2)} 100`;
  const hand = $(".sw-hand");
  if (hand) hand.style.transform = `rotate(${-Math.floor(ms / 1000) * 6}deg)`;
  for (const el of $$("[data-countdown]")) el.textContent = t.d ? `${t.d}d ${t.h}h` : `${t.h}h ${pad(t.m)}m`;
}

// ── Views ────────────────────────────────────────────────────────────────────

function renderView(animate = true) {
  const main = $("#view");
  const html = { standings: viewStandings, player: viewPlayer, episodes: viewEpisodes, cast: viewCast }[state.view]();
  const swap = () => {
    main.innerHTML = html;
    main.dataset.view = state.view;
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

function statusLine(s) {
  const list = s.needed.map(esc).join(", ");
  if (s.kind === "must") return `<span class="must">Must pick: ${list}</span>`;
  if (s.kind === "cannot") return `<span class="must">Can't fit: ${list}</span>`;
  return `<span class="must">Never picked: ${list}</span>`;
}

// Standings ------------------------------------------------------------------

function viewStandings() {
  const d = state.d;
  const key = state.sort, other = key === "show" ? "league" : "show";
  const me = meIn(d);
  const P = [...d.players].sort((a, b) => a[key + "Rank"] - b[key + "Rank"] || b[other] - a[other] || a.name.localeCompare(b.name));
  const worst = Math.max(...P.map((p) => p[key + "Rank"]));
  const after = d.weeksScored ? `after Episode ${d.weeksScored} of ${EPISODES}` : "no episodes scored yet";

  const seg = `
    <div class="seg" role="group" aria-label="Rank by">
      <button data-sort="show" aria-pressed="${key === "show"}">Show<small>points scored</small></button>
      <button data-sort="league" aria-pressed="${key === "league"}">League<small>5·4·3·2·1</small></button>
    </div>`;

  if (!P.length) {
    return `
    <section class="board paper">
      <header class="board-head"><div><p class="kicker">Series ${state.key} · ${after}</p><h2>The Table</h2></div></header>
      <p class="empty hand">Nobody has voted in Series ${state.key} yet.</p>
    </section>`;
  }

  const rows = P.map((p, i) => {
    const rank = p[key + "Rank"];
    return `
    <li class="row ${p.name === me ? "me" : ""} ${rank === worst && P.length > 2 ? "crooked" : ""}" style="--i:${i}" ${p.name === me ? 'id="me-row"' : ""}>
      <a class="row-main" href="${link("player", p.name)}">
        ${rankSeal(rank)}
        <span class="who"><span class="pname">${esc(p.name)}${p.name === me ? '<em class="you-tag">you</em>' : ""}</span>${p.status ? statusLine(p.status) : ""}</span>
        <span class="pts"><b data-count="${p[key]}">${p[key]}</b><small>${key}</small></span>
        <span class="pts minor"><b>${p[other]}</b><small>${other}</small></span>
        ${deltaTag(p[key + "Delta"])}
      </a>
    </li>`;
  }).join("");

  const mp = me && d.byName[me];
  return `
  <section class="board paper">
    <header class="board-head">
      <div><p class="kicker">Series ${state.key} · ${after}</p><h2>The Table</h2></div>
      ${seg}
    </header>
    ${d.weeksScored ? weekStrip(d.weeksScored) : ""}
    <ol class="rows">${rows}</ol>
    <p class="board-foot">Tap a name for their week-by-week picks.${d.inactive.length ? ` <span class="yet">Yet to vote: ${d.inactive.map(esc).join(", ")}</span>` : ""}</p>
  </section>
  ${mp ? `<button class="me-float" id="me-float" type="button" data-jump-me hidden>${rankSeal(mp[key + "Rank"])}<b>${esc(me)}</b><span>${mp[key]} ${key}</span><em>find me</em></button>` : ""}`;
}

/** One-line social summary of how the league did in episode `e`. */
function weekStrip(e) {
  const d = state.d, w = d.winners[e], wk = d.weekly[e];
  const c = d.cast[w.winner];
  const me = meIn(d);
  const hits = wk.hits.map((n) => n === me ? "<b>you</b>" : esc(n));
  return `
    <a class="week-strip" href="${link("episodes", e)}" style="--c:${c.color}">
      ${avatar(c)}
      <span><small>Episode ${e}</small>
        <b>${esc(c.key)} won${w.tiebreak ? " on a tiebreak" : ""}.</b>
        ${wk.hits.length ? `${wk.hits.length} of ${wk.voters} backed ${esc(c.key)}: ${listing(hits)}.` : `Nobody backed ${esc(c.key)}.`}
        League average ${wk.avgShow.toFixed(1)} Show pts.
      </span>
    </a>`;
}

// Player -----------------------------------------------------------------------

function viewPlayer() {
  const d = state.d;
  const me = meIn(d);
  const name = state.arg && d.allPlayers.includes(state.arg) ? state.arg : me;
  const options = [...d.allPlayers].sort().map((n) => `<option ${n === name ? "selected" : ""}>${esc(n)}</option>`).join("");
  const switcher = `
    <label class="pl-switch"><span>Player</span>
      <select data-player-select>${name ? "" : '<option value="" selected>Choose a player…</option>'}${options}</select>
    </label>`;

  if (!name) {
    return `<section class="player paper"><header class="pl-top">${switcher}</header>
      <p class="empty hand">Choose a name to see their season. Pick yourself and the app will remember you on this device.</p></section>`;
  }
  const p = d.byName[name];
  const meBtn = name === me ? `<span class="you-tag big">you</span>` : `<button class="btn ghost btn-sm" data-me-set="${esc(name)}" type="button">This is me</button>`;
  if (!p) {
    return `<section class="player paper"><header class="pl-top">${switcher}${meBtn}</header>
      <h2 class="pl-name">${esc(name)}</h2>
      <p class="empty hand">No votes recorded in Series ${state.key} yet.</p>
      ${name === me && d.nextEp ? planner(name) : ""}</section>`;
  }

  const active = d.players.length;
  const boardCard = (key, label) => {
    const rank = p[key + "Rank"];
    const sorted = [...d.players].sort((a, b) => b[key] - a[key]);
    const ahead = sorted.filter((q) => q[key] > p[key]).at(-1);
    const behind = sorted.find((q) => q[key] < p[key]);
    const gap = !ahead
      ? (behind ? `${plural(p[key] - behind[key], "pt")} clear of ${esc(behind.name)}` : "Top of the table")
      : `${plural(ahead[key] - p[key], "pt")} behind ${esc(ahead.name)}`;
    return `
      <button class="pl-board ${state.sort === key ? "on" : ""}" data-sort="${key}" type="button" aria-pressed="${state.sort === key}">
        ${rankSeal(rank)}
        <span class="pl-board-txt"><small>${label}</small><b>${p[key]}</b><span>${ord(rank)} of ${active} ${deltaTag(p[key + "Delta"])}</span><em>${gap}</em></span>
      </button>`;
  };

  const leagueAvg = d.weeksScored ? Object.values(d.weekly).reduce((a, w) => a + w.avgShow, 0) / d.weeksScored : 0;
  const avg = p.played ? p.show / p.played : 0;

  const counts = Object.fromEntries(d.names.map((n) => [n, 0]));
  for (const w of p.weeks) if (w.pick && counts[w.pick] !== undefined) counts[w.pick]++;
  const left = EPISODES - d.weeksScored;
  const needed = d.names.filter((n) => !p.weeks.slice(0, d.weeksScored).some((w) => w.pick === n));
  const ruleMsg = p.status ? statusLine(p.status)
    : needed.length ? `<span class="rule-msg">Still to pick: ${needed.map(esc).join(", ")} · ${plural(left, "poll")} left</span>`
    : `<span class="rule-msg ok">✓ Picked everyone at least once</span>`;

  const lastShown = d.nextEp ? Math.max(d.nextEp.ep, d.weeksAired) : EPISODES;
  const weeks = p.weeks.slice(0, lastShown).map((w, i) => {
    const e = i + 1, st = epState(d, e);
    const title = d.raw.episodes[i].title;
    const c = w.pick ? d.cast[w.pick] : null;
    let res, note = "";
    if (w.show != null) {
      const win = d.winners[e];
      res = `<b>${w.show}</b><small>${ord(w.place)} · +${w.league}</small>`;
      note = w.won ? `<span class="hit">★ picked the winner</span>` : `<span class="miss">${esc(win.winner)} won with ${win.top}</span>`;
    } else res = `<small>${st === "scored" ? "0" : st === "pending" ? "Results soon" : w.pick ? "Pick in" : st === "next" ? "Poll open" : "—"}</small>`;
    return `
      <li class="pw ${st} ${w.won ? "won" : ""}" style="--c:${c ? c.color : "transparent"}">
        <a href="${link("episodes", e)}">
          <span class="pw-ep">${e}</span>
          ${c ? avatar(c) : `<span class="ava empty"></span>`}
          <span class="pw-mid"><b>${c ? esc(c.key) : st === "scored" ? "No vote" : "—"}</b><small>${title ? esc(title) : esc(fmtShortDay.format(d.episodes[i].air))}</small>${note}</span>
          <span class="pw-res">${res}</span>
        </a>
      </li>`;
  }).join("");

  return `
  <section class="player paper">
    <header class="pl-top">${switcher}${meBtn}</header>
    <h2 class="pl-name">${esc(name)}</h2>
    <p class="kicker">Series ${state.key} · after Episode ${d.weeksScored}</p>
    <div class="pl-boards">${boardCard("show", "Show")}${boardCard("league", "League")}</div>

    ${d.weeksScored > 0 ? bumpChart(name) : ""}

    <dl class="pl-stats">
      <div><dt>Picked the winner</dt><dd>${p.hits}<small>/${p.played}</small></dd></div>
      <div><dt>Avg per pick</dt><dd>${avg.toFixed(1)}<small> vs ${leagueAvg.toFixed(1)}</small></dd></div>
      <div><dt>Best week</dt><dd>${p.best ? `${p.best.show}<small> · Ep ${p.best.ep}</small>` : "–"}</dd></div>
      <div><dt>Left on the table</dt><dd>${p.missed}<small> pts</small></dd></div>
    </dl>

    <section class="rule-track" aria-label="Pick every contestant at least once">
      <h3>Everyone at least once</h3>
      <ul>${d.names.map((n) => `<li class="${counts[n] ? "got" : ""}" style="--c:${d.cast[n].color}">${avatar(d.cast[n])}<span>${esc(n)}</span><b>${counts[n] ? `×${counts[n]}` : "0"}</b></li>`).join("")}</ul>
      ${ruleMsg}
    </section>

    <h3>Week by week</h3>
    <ol class="pl-weeks">${weeks}</ol>
    ${name === me && d.nextEp ? planner(name) : ""}
  </section>`;
}

/** Rank-over-time for every player; the viewed player drawn on top. */
function bumpChart(name) {
  const d = state.d, key = state.sort;
  const n = d.players.length, W = d.weeksScored;
  const w = 640, h = Math.max(150, Math.min(20 * n, 300)), px = 44, py = 14;
  const x = (i) => (W === 1 ? w / 2 : px + (i * (w - px - 18)) / (W - 1));
  const y = (r) => py + ((r - 1) * (h - 2 * py)) / Math.max(1, n - 1);
  const pts = (p) => p.history.map((hh, i) => [x(i), y(hh[key + "Rank"])]);
  const line = (p) => pts(p).map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)} ${b.toFixed(1)}`).join("");
  const others = d.players.filter((p) => p.name !== name).map((p) => `<path d="${line(p)}" class="bump-o"/>`).join("");
  const me = d.byName[name];
  const dots = pts(me).map(([a, b], i) => `<circle cx="${a}" cy="${b}" r="11" class="bump-dot"/><text x="${a}" y="${b + 4.5}" class="bump-n">${me.history[i][key + "Rank"]}</text>`).join("");
  const xl = Array.from({ length: W }, (_, i) => `<text x="${x(i)}" y="${h + 16}" class="bump-x">${i + 1}</text>`).join("");
  return `
    <figure class="bump">
      <figcaption>${key === "show" ? "Show" : "League"} rank after each episode <button class="linkish" data-sort="${key === "show" ? "league" : "show"}" type="button">show ${key === "show" ? "League" : "Show"}</button></figcaption>
      <svg viewBox="0 0 ${w} ${h + 22}" role="img" aria-label="${esc(name)}'s ${key} rank after each episode: ${me.history.map((hh) => hh[key + "Rank"]).join(", ")}">
        <text x="0" y="${y(1) + 4}" class="bump-y">1st</text><text x="0" y="${y(n) + 4}" class="bump-y">${ord(n)}</text>
        ${others}<path d="${line(me)}" class="bump-me"/>${dots}${xl}
      </svg>
    </figure>`;
}

// Planner: plan remaining picks around the pick-everyone rule (saved locally).
const planKey = (name) => `fm-plan-${state.key}-${name}`;
function planner(name) {
  const d = state.d;
  const p = d.byName[name];
  const plan = store.get(planKey(name), {});
  const openEps = d.episodes.filter((e) => e.ep > d.weeksAired).map((e) => e.ep);
  const chosen = (e) => p?.weeks[e - 1].pick || plan[e] || null;
  const have = new Set();
  for (let e = 1; e <= EPISODES; e++) { const c = e <= d.weeksAired ? p?.weeks[e - 1].pick : chosen(e); if (c) have.add(c); }
  const needed = d.names.filter((n) => !have.has(n));
  const free = openEps.filter((e) => !chosen(e)).length;
  const msg = !needed.length ? `<p class="plan ok">✓ This plan picks everyone at least once.</p>`
    : needed.length > free ? `<p class="plan bad">Can't fit ${needed.map(esc).join(", ")}: only ${plural(free, "unplanned poll")} left.</p>`
    : needed.length === free ? `<p class="plan bad">Every remaining poll is spoken for: ${needed.map(esc).join(", ")}.</p>`
    : `<p class="plan">Still to fit in: ${needed.map(esc).join(", ")} · ${plural(free, "unplanned poll")}.</p>`;
  const rows = openEps.map((e) => {
    const entered = p?.weeks[e - 1].pick;
    const title = d.raw.episodes[e - 1].title;
    return `
      <li class="plan-row">
        <span class="lab-ep"><b>Ep ${e}</b><small>${title ? esc(title) : esc(fmtShortDay.format(d.episodes[e - 1].air))}</small></span>
        <div class="choices" role="radiogroup" aria-label="Episode ${e} plan">
          ${d.names.map((n) => {
            const on = (entered || plan[e]) === n;
            return `<button type="button" role="radio" aria-checked="${on}" aria-label="${esc(n)}" class="choice ${on ? "on" : ""}" ${entered ? "disabled" : ""} data-plan="${e}" data-name="${n}" style="--c:${d.cast[n].color}">${avatar(d.cast[n])}<span>${esc(n)}</span></button>`;
          }).join("")}
        </div>
      </li>`;
  }).join("");
  return `
    <section class="planner">
      <h3>Plan your remaining picks</h3>
      <p class="sub">Saved on this device only. Your real vote is still the WhatsApp poll.</p>
      ${msg}
      <ol class="plan-rows">${rows}</ol>
      <div class="lab-actions"><button class="btn" data-plan-copy type="button">Copy plan</button><button class="btn ghost" data-plan-clear type="button">Clear</button></div>
    </section>`;
}

// Episodes -------------------------------------------------------------------

function selectedEp() {
  const d = state.d;
  return state.arg ? +state.arg : d.weeksScored || d.nextEp?.ep || 1;
}

function viewEpisodes() {
  const d = state.d;
  const sel = selectedEp();
  const env = d.raw.episodes.map((e, i) => {
    const st = epState(d, e.ep);
    const w = d.winners[e.ep];
    const c = w ? d.cast[w.winner] : null;
    const meta = st === "scored" ? `${esc(c.key)}${w.tiebreak ? " (tiebreak)" : ""}`
      : st === "pending" ? "Results soon"
      : st === "next" ? `Closes in <b data-countdown></b>`
      : esc(fmtShortDay.format(d.episodes[i].air));
    return `
    <li>
      <a class="env ${st} ${sel === e.ep ? "sel" : ""}" href="${link("episodes", e.ep)}" style="--c:${c ? c.color : "var(--wax)"}" aria-label="Episode ${e.ep}${e.title ? `: ${esc(e.title)}` : ""}${st === "scored" ? `. Won by ${esc(c.full)}` : ""}" ${sel === e.ep ? 'aria-current="true"' : ""}>
        <span class="env-body">
          <span class="env-letter">${c ? avatar(c) : ""}</span>
          <span class="env-flap"></span>
          <span class="env-seal"><span>${e.ep}</span></span>
          ${st === "pending" ? `<span class="env-stamp">Results soon</span>` : ""}
        </span>
        <span class="env-caption"><b><span class="env-no">${e.ep}</span>${e.title ? esc(e.title) : `Episode ${e.ep}`}</b><small>${meta}</small></span>
      </a>
    </li>`;
  }).join("");

  return `
  <section class="envelopes">
    <header class="section-head"><p class="kicker">Series ${state.key} · ${plural(d.weeksScored, "episode")} scored</p><h2>The Envelopes</h2></header>
    <ol class="env-grid" id="env-grid">${env}</ol>
  </section>
  ${episodeDetail(sel)}`;
}

function episodeDetail(ep) {
  const d = state.d;
  const e = d.raw.episodes[ep - 1];
  const air = d.episodes[ep - 1].air;
  const st = epState(d, ep);
  const nav = `
    <nav class="ep-nav">
      ${ep > 1 ? `<a href="${link("episodes", ep - 1)}">← Ep ${ep - 1}</a>` : "<span></span>"}
      ${ep < EPISODES ? `<a href="${link("episodes", ep + 1)}">Ep ${ep + 1} →</a>` : "<span></span>"}
    </nav>`;
  const head = `<p class="kicker">Episode ${ep} · ${esc(fmtDay.format(air))}</p><h2>${e.title ? esc(e.title) : `Episode ${ep}`}</h2>`;

  if (st !== "scored") {
    const msg = st === "pending"
      ? "This one has aired. Scores and everyone's picks will be in soon."
      : st === "next"
        ? `Sealed until the livestream: ${esc(fmtLocal.format(air))} your time. The poll closes in <b data-countdown></b>.`
        : `Sealed until ${esc(fmtLocal.format(air))} your time.`;
    return `<article class="ep-detail paper sealed" id="detail" tabindex="-1">${head}<p class="sealed-msg hand">${msg}</p>${nav}</article>`;
  }

  const w = d.winners[ep];
  const c = d.cast[w.winner];
  const tasks = d.epTasks(ep);
  const me = meIn(d);
  const verdict = w.tiebreak
    ? `<b style="--c:${c.color}">${esc(c.full)}</b> won a ${w.tied.length}-way tie on ${w.top} after the tiebreak`
    : `<b style="--c:${c.color}">${esc(c.full)}</b> won with ${w.top} points`;

  // The league this week, contestants in finishing order.
  const wk = d.weekly[ep];
  const order = [...d.names].sort((a, b) => d.placing[ep][a] - d.placing[ep][b] || d.EPS[b][ep] - d.EPS[a][ep]);
  const league = order.map((n) => {
    const cc = d.cast[n], who = wk.by[n];
    return `
      <li style="--c:${cc.color}" class="${n === w.winner ? "win" : ""}">
        <div class="lw-head">${avatar(cc)}<b>${esc(n)}</b><span class="lw-place">${ord(d.placing[ep][n])}</span><span class="lw-pts">${d.EPS[n][ep]}<small> Show</small> +${d.rankPts[ep][n]}<small> League</small></span></div>
        <div class="lw-who">${who.length ? who.map((pn) => `<a href="${link("player", pn)}" class="chip ${pn === me ? "me" : ""}">${esc(pn)}</a>`).join("") : `<span class="nobody">nobody</span>`}</div>
      </li>`;
  }).join("");
  const mine = me && d.byName[me]?.weeks[ep - 1];
  const myLine = mine ? (mine.show != null
    ? `<p class="my-week">You backed <b>${esc(mine.pick)}</b>: ${mine.show} Show, +${mine.league} League${mine.won ? " ★" : ""}.</p>`
    : `<p class="my-week">You didn't vote this week.</p>`) : "";

  const race = d.names.map((n) => {
    const cc = d.cast[n];
    return `
      <li class="race-row" data-name="${n}" style="--c:${cc.color}">
        ${avatar(cc)}<span class="race-name">${esc(cc.key)}</span>
        <span class="race-track"><span class="race-bar"></span></span>
        <b class="race-total">0</b>
      </li>`;
  }).join("");

  const taskCards = tasks.map((t) => {
    const max = Math.max(...t.s), min = Math.min(...t.s);
    const cells = d.names.map((n, j) => {
      const cc = d.cast[n], v = t.s[j];
      const flag = max !== min && v === max ? "top" : max !== min && v === min ? "low" : "";
      return `<li class="sc ${flag}" style="--c:${cc.color}" title="${esc(cc.key)}: ${v}">${avatar(cc)}<b>${v}</b><span class="vh">${esc(cc.key)}</span></li>`;
    }).join("");
    return `<li class="task t-${t.t}"><span class="stamp">${TYPE[t.t]}</span><h4>${esc(t.n)}</h4><ol class="scores">${cells}</ol></li>`;
  }).join("");

  return `
  <article class="ep-detail paper" id="detail" tabindex="-1" style="--c:${c.color}">
    ${head}
    <p class="verdict">${verdict}.</p>
    ${myLine}
    <section class="league-week">
      <h3>The league this week</h3>
      <p class="sub">${wk.voters} voted · ${wk.hits.length ? `${plural(wk.hits.length, "player")} backed the winner` : "nobody backed the winner"} · average ${wk.avgShow.toFixed(1)} Show pts</p>
      <ol>${league}</ol>
    </section>
    <section class="race" aria-label="Scoreboard replay">
      <div class="race-head"><h3>The scoreboard</h3><span class="race-step" aria-live="polite"></span><button class="btn btn-sm replay" type="button">▶ Replay</button></div>
      <ol class="race-rows">${race}</ol>
    </section>
    <section class="notes"><h3>The write-up</h3>${e.analysis ? `<p>${rich(e.analysis)}</p>` : `<ul>${episodeNotes(ep).map((x) => `<li>${x}</li>`).join("")}</ul>`}</section>
    <details class="tasks-wrap"><summary>All ${tasks.length} tasks and scores</summary><ol class="tasks">${taskCards}</ol></details>
    ${nav}
  </article>`;
}

/** Fallback write-up, generated from the scores, for episodes without one. */
function episodeNotes(ep) {
  const d = state.d;
  const tasks = d.epTasks(ep);
  const tot = Object.fromEntries(d.names.map((n) => [n, d.EPS[n][ep]]));
  const sorted = [...d.names].sort((a, b) => tot[b] - tot[a]);
  const w = d.winners[ep];
  const name = (n) => `<b>${esc(n)}</b>`;
  const notes = [];
  if (w.tiebreak) notes.push(`${listing(w.tied.map(name))} tied on ${w.top}; ${name(w.winner)} won the tiebreak.`);
  else notes.push(`${name(w.winner)} won by ${plural(tot[sorted[0]] - tot[sorted[1]], "point")} from ${name(sorted[1])}.`);
  const prize = tasks.find((t) => t.t === "P");
  if (prize) {
    const top = Math.max(...prize.s);
    notes.push(`${listing(d.names.filter((_, i) => prize.s[i] === top).map(name))} took the prize task: “${esc(lc(prize.n))}”.`);
  }
  return notes;
}

let raceTimer = 0;
function playRace(instant = false) {
  const root = $(".race");
  if (!root) return;
  clearTimeout(raceTimer);
  const d = state.d, ep = selectedEp();
  const tasks = d.epTasks(ep);
  const rows = Object.fromEntries($$(".race-row", root).map((r) => [r.dataset.name, r]));
  const max = Math.max(...d.names.map((n) => d.EPS[n][ep]), 1);
  const label = $(".race-step", root);
  const rowH = rows[d.names[0]].offsetHeight + 6;
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
    label.textContent = k === 0 ? "" : k === tasks.length ? "Final" : `After task ${k}: ${TYPE[tasks[k - 1].t].toLowerCase()}`;
    if (k === tasks.length && !instant) {
      setTimeout(() => burstAt($(".ava", rows[d.winners[ep].winner]), { colors: [d.cast[d.winners[ep].winner].color, "#f4d67a", "#f1e6cc"], count: 60 }), 300);
    }
  };
  if (instant || reducedMotion) { show(tasks.length); return; }
  let k = 0;
  const step = () => { show(k); if (k++ < tasks.length) raceTimer = setTimeout(step, k === 1 ? 400 : 750); };
  step();
}

// Cast -----------------------------------------------------------------------

function viewCast() {
  const d = state.d;
  const byRank = [...d.contestants].sort((a, b) => a.rank - b.rank);
  const sel = d.contestants.find((c) => c.key === state.arg) || byRank[0];
  const worst = Math.max(...d.contestants.map((c) => c.rank));
  const m = metaFor(state.key);
  const frames = d.contestants.map((c) => `
    <li class="frame ${c.rank === worst && d.weeksScored ? "crooked" : ""} ${c.key === sel.key ? "sel" : ""}" style="--c:${c.color}">
      <a href="${link("cast", c.key)}" aria-label="${esc(c.full)}, ${ord(c.rank)} with ${c.total} points">
        <span class="nail" aria-hidden="true"></span><span class="wire" aria-hidden="true"></span>
        <img src="${c.img}" alt="" width="225" height="266" decoding="async" loading="lazy">
        <span class="plaque"><b>${esc(c.key)}</b><small>${d.weeksScored ? `${ord(c.rank)} · ${c.total}` : "—"}</small></span>
      </a>
    </li>`).join("");

  const cats = [["Prize", sel.prizeRank, sel.ty.P], ["Filmed", sel.filmedRank, sel.ty.F + sel.ty.T], ["Live", sel.liveRank, sel.ty.L]];
  const maxEp = Math.max(...d.contestants.flatMap((c) => c.eps), 1);
  const bars = sel.eps.map((v, i) => {
    const ep = i + 1, scored = ep <= d.weeksScored;
    return `<li class="${scored ? "" : "future"} ${d.winners[ep]?.winner === sel.key ? "won" : ""}" style="--h:${scored ? (v / maxEp) * 100 : 0}%"><b>${scored ? v : ""}</b><span class="bar"></span><small>${ep}</small></li>`;
  }).join("");

  return `
  <section class="gallery">
    <header class="section-head"><p class="kicker">Series ${state.key} · ${esc(m.themeName)}</p><h2>The Portrait Wall</h2></header>
    <ul class="wall">${frames}</ul>
  </section>
  <article class="profile paper" id="detail" tabindex="-1" style="--c:${sel.color}">
    <div class="p-portrait"><img src="${sel.img}" alt="Portrait of ${esc(sel.full)}" width="225" height="266" decoding="async"></div>
    <div class="p-body">
      <p class="kicker">${d.weeksScored ? `${ord(sel.rank)} in Series ${state.key}` : `Series ${state.key}`}</p>
      <h2>${esc(sel.full)}</h2>
      ${sel.bio ? `<p class="bio">${rich(sel.bio)}</p>` : ""}
      <dl class="stats">
        <div><dt>League picks</dt><dd>${sel.pickedBy}</dd></div>
        <div><dt>Pts to backers</dt><dd>${sel.deliveredTo}</dd></div>
        <div><dt>Total</dt><dd>${sel.total}</dd></div>
        <div><dt>Per episode</dt><dd>${sel.avg.toFixed(1)}</dd></div>
        <div><dt>Episode wins</dt><dd>${sel.wins}</dd></div>
        <div><dt>Full marks</dt><dd>${sel.fives}</dd></div>
      </dl>
      ${sel.stat ? `<p class="stat-note">${rich(sel.stat)}</p>` : ""}
      <ul class="cats">${cats.map(([k, r, v]) => `<li class="medal m-${r}"><span>${ord(r)}</span><small>${k}<br>${v} pts</small></li>`).join("")}</ul>
      <figure class="ep-chart"><figcaption>Points per episode · <span class="won-key">★ won</span></figcaption><ol>${bars}</ol></figure>
    </div>
  </article>`;
}

// ── After render ────────────────────────────────────────────────────────────

let meObserver = null;
function afterRender() {
  tick();
  meObserver?.disconnect();

  if (state.view === "standings") {
    const row = $("#me-row"), float = $("#me-float");
    if (row && float && "IntersectionObserver" in window) {
      meObserver = new IntersectionObserver(([en]) => { float.hidden = en.isIntersecting || scrollY < $(".hero").offsetHeight * 0.5; });
      meObserver.observe(row);
    }
  }

  if (state.view === "episodes") {
    const grid = $("#env-grid"), sel = $(".env.sel");
    if (grid && sel && grid.scrollWidth > grid.clientWidth) {
      grid.scrollLeft = sel.parentElement.offsetLeft - (grid.clientWidth - sel.parentElement.offsetWidth) / 2;
    }
    const detail = $("#detail");
    if (detail && !detail.classList.contains("sealed")) playRace(!pendingReveal);
    if (pendingReveal && state.arg) {
      const seal = $(".env.sel .env-seal");
      if (seal) burstAt(seal, { kind: "wax", colors: ["#8e1418", "#b3242a", "#6d0f12"], count: 22 });
      detail?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    }
  }
  if ((state.view === "cast" || state.view === "player") && pendingReveal && state.arg) {
    $("#view").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }
  pendingReveal = false;
  countUp();
}

function countUp() {
  if (reducedMotion) return;
  for (const el of $$("[data-count]")) {
    const to = +el.dataset.count, t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 700);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
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
  if (location.hash && !location.hash.startsWith("#/")) return; // in-page anchors
  const r = parseHash();
  const viewChanged = r.view !== state.view;
  pendingReveal = !!r.arg && (r.arg !== state.arg || viewChanged);
  state.view = r.view;
  state.arg = r.arg;
  if (r.key !== state.key) {
    const first = state.key === null;
    const go = () => { loadSeries(r.key); renderView(false); };
    if (!first && document.startViewTransition && !reducedMotion) {
      document.documentElement.classList.add("vt-series");
      document.startViewTransition(go).finished.finally(() => document.documentElement.classList.remove("vt-series"));
      burstAt($("#series-btn"), metaFor(r.key).theme === "diner"
        ? { kind: "spark", colors: ["#ff4f9a", "#37d6c8", "#fff"], count: 36 }
        : { kind: "steam", count: 16 });
    } else go();
    document.title = `Series ${r.key} · Fantasky Master`;
    return;
  }
  renderView(viewChanged);
}

// ── Events ──────────────────────────────────────────────────────────────────

document.addEventListener("click", (e) => {
  const t = e.target;
  const sortBtn = t.closest("[data-sort]");
  if (sortBtn) { const y = scrollY; state.sort = sortBtn.dataset.sort; renderView(false); scrollTo(0, y); return; }
  if (t.closest(".replay")) { playRace(); return; }
  if (t.closest("[data-jump-me]")) { $("#me-row")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" }); return; }
  if (t.closest("[data-me-clear]")) { setMe(null); return; }
  const meSet = t.closest("[data-me-set]");
  if (meSet) { burstAt(meSet, { count: 40 }); setMe(meSet.dataset.meSet); return; }

  const plan = t.closest("[data-plan]");
  if (plan && !plan.disabled) {
    const key = planKey(meIn(state.d)), p = store.get(key, {});
    const ep = plan.dataset.plan;
    p[ep] = p[ep] === plan.dataset.name ? null : plan.dataset.name;
    store.set(key, p);
    const y = scrollY; renderView(false); scrollTo(0, y);
    return;
  }
  if (t.closest("[data-plan-clear]")) { store.set(planKey(meIn(state.d)), {}); const y = scrollY; renderView(false); scrollTo(0, y); return; }
  const copy = t.closest("[data-plan-copy]");
  if (copy) {
    const d = state.d, name = meIn(d), p = d.byName[name], plan = store.get(planKey(name), {});
    const text = `${name}'s Series ${state.key} picks: ` + Array.from({ length: EPISODES }, (_, i) => `Ep${i + 1} ${p?.weeks[i].pick || plan[i + 1] || "–"}`).join(", ");
    navigator.clipboard?.writeText(text).then(() => { copy.textContent = "Copied ✓"; setTimeout(() => (copy.textContent = "Copy plan"), 1500); }, () => prompt("Copy your plan:", text));
    return;
  }
  const car = t.closest(".caravan");
  if (car) { knock(car); return; }
  if (t.closest(".menu-item")) $("#series-menu").hidePopover?.();
});

document.addEventListener("change", (e) => {
  if (e.target.matches("[data-me-select]") && e.target.value) {
    setMe(e.target.value);
    burstAt($("#me"), { count: 40 });
  }
  if (e.target.matches("[data-player-select]") && e.target.value) location.hash = link("player", e.target.value);
});

document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.closest?.(".caravan")) { e.preventDefault(); knock(e.target.closest(".caravan")); }
});

const QUIPS = [
  "All the information is on the task.", "Your time starts now.", "No vote, no points.",
  "Polls close the moment the livestream starts.", "You must pick every contestant at least once.",
  "Tiebreaks only matter for the League table.", "Please don't touch the caravan.",
];
let quipI = Math.floor(Math.random() * QUIPS.length);
function knock(car) {
  const bubble = $("#quip"), r = car.getBoundingClientRect(), hr = $(".hero").getBoundingClientRect();
  bubble.textContent = QUIPS[quipI++ % QUIPS.length];
  bubble.style.left = `${Math.min(Math.max(r.left - hr.left + r.width * 0.5, 120), hr.width - 120)}px`;
  bubble.style.top = `${r.top - hr.top}px`;
  bubble.classList.remove("show"); void bubble.offsetWidth; bubble.classList.add("show");
  car.classList.remove("knocked"); void car.getBoundingClientRect(); car.classList.add("knocked");
  burst(r.left + r.width * 0.72, r.top + r.height * 0.2, { kind: "steam", count: 8 });
}

// Pointer tilt (mouse only).
let tiltEl = null, tiltRaf = 0, tiltEv = null;
if (!reducedMotion && matchMedia("(hover: hover) and (pointer: fine)").matches) {
  document.addEventListener("pointermove", (e) => {
    tiltEv = e;
    if (tiltRaf) return;
    tiltRaf = requestAnimationFrame(() => {
      tiltRaf = 0;
      const el = tiltEv.target.closest?.("[data-tilt], .frame a, .env");
      if (tiltEl && tiltEl !== el) { tiltEl.style.removeProperty("--rx"); tiltEl.style.removeProperty("--ry"); }
      tiltEl = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (tiltEv.clientX - r.left) / r.width - 0.5, y = (tiltEv.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--rx", `${(-y * 8).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(x * 10).toFixed(2)}deg`);
      el.style.setProperty("--mx", `${((x + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${((y + 0.5) * 100).toFixed(1)}%`);
    });
  }, { passive: true });
}

function placeChimney() {
  const top = $(".chimney-top");
  if (!top || !sky) return;
  const r = top.getBoundingClientRect();
  sky.setChimney(r.left + r.width / 2, r.top);
}
let scrollRaf = 0;
addEventListener("scroll", () => {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    const h = $(".hero").offsetHeight;
    sky?.setScroll(Math.min(1, scrollY / h));
    placeChimney();
    document.body.classList.toggle("scrolled", scrollY > h * 0.6);
  });
}, { passive: true });
addEventListener("resize", () => { placeChimney(); moveTabInk(); }, { passive: true });

// ── Boot ────────────────────────────────────────────────────────────────────

try { sky = startSky($("#sky"), { reducedMotion }); } catch (err) { console.warn("Sky shader unavailable:", err); }
if (!sky) document.body.classList.add("no-gl");

try {
  SERIES = await loadData();
  CURRENT = currentSeriesKey(SERIES, new Date());
  if (!location.hash) history.replaceState(null, "", `#/${CURRENT}/standings`);
  addEventListener("hashchange", route);
  route();
  setInterval(tick, 1000);
  document.fonts?.ready.then(() => { moveTabInk(); placeChimney(); });
} catch (err) {
  console.error(err);
  $("#view").innerHTML = `<section class="board paper"><h2>Envelope jammed</h2><p>The league data couldn't be loaded. Check your connection and refresh.</p></section>`;
} finally {
  document.body.classList.remove("loading");
}
