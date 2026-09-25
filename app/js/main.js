import { SERIES } from "./data.js";
import { derive, currentSeriesKey, scorePicks, tzOffset, EPISODES } from "./league.js";
import { houseSVG, epState } from "./house.js";
import { startSky } from "./gl.js";
import { burst, burstAt } from "./fx.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const YT = "https://www.youtube.com/@Taskmaster";
const TYPE = { P: "Prize", F: "Filmed", T: "Team", L: "Live" };

const fmt = (opts, tz) => new Intl.DateTimeFormat(undefined, tz ? { ...opts, timeZone: tz } : opts);
const fmtLocal = fmt({ weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const fmtDay = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }, "Europe/London");
const fmtShortDay = fmt({ weekday: "short", day: "numeric", month: "short" }, "Europe/London");
const zoneHour = (date, tz) => fmt({ hour: "numeric", minute: "2-digit", hour12: true }, tz).format(date).replace(":00", "").replace(/\s/g, "").toLowerCase();

function avatar(c, cls = "") {
  return `<span class="ava ${cls}" style="--c:${c.color};--img:url('${c.img}')" aria-hidden="true"></span>`;
}

function splitTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const pad = (n) => String(n).padStart(2, "0");

const store = {
  get(k, f) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ── State ────────────────────────────────────────────────────────────────────

const CURRENT = currentSeriesKey(SERIES, new Date());
const state = { key: null, d: null, view: "standings", arg: null, sort: "show", dir: 1, open: new Set() };
let sky = null;

function parseHash() {
  const [, key, view, arg] = location.hash.replace(/^#/, "").split("/");
  return {
    key: SERIES[key] ? key : CURRENT,
    view: ["standings", "episodes", "cast", "lab"].includes(view) ? view : "standings",
    arg: arg ? decodeURIComponent(arg) : null,
  };
}

function loadSeries(key) {
  state.key = key;
  state.d = derive(SERIES[key], new Date());
  const theme = SERIES[key].theme;
  document.body.dataset.theme = theme;
  document.body.classList.toggle("past", key !== CURRENT);
  sky?.setTheme(theme);
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
    ${keys.map((k) => `
      <a href="#/${k}/${state.view}" class="menu-item ${k === state.key ? "on" : ""}" data-theme-name="${SERIES[k].theme}">
        <span class="mini-seal">${k}</span>
        <span><b>Series ${k}</b><small>${esc(SERIES[k].themeName)} · ${esc(SERIES[k].location)}${k === CURRENT ? " · <em>now showing</em>" : ""}</small></span>
      </a>`).join("")}`;
}

// ── Hero: the house and the task card ────────────────────────────────────────

function renderHero() {
  const d = state.d;
  $("#house").innerHTML = houseSVG(d, state.key, SERIES[state.key].theme);
  $("#taskcard").innerHTML = taskCard(d);
  $("#taskcard").dataset.mode = d.nextEp ? "next" : "done";
  tick();
  placeChimney();
}

function taskCard(d) {
  const s = SERIES[state.key];
  const pending = d.weeksAired > d.weeksScored
    ? `<p class="tc-ribbon">Episode ${d.weeksAired} aired · results coming soon</p>` : "";
  if (!d.nextEp) {
    const champ = s.champion ? d.cast[s.champion] : d.cast[[...d.contestants].sort((a, b) => a.rank - b.rank)[0].key];
    const top = [...d.contestants].sort((a, b) => a.rank - b.rank);
    return `
      <span class="tc-stamp">Complete</span>
      <p class="tc-kicker">Series ${state.key} · ${esc(s.themeName)}</p>
      <h1 class="tc-title">The golden head goes to <em style="--c:${champ.color}">${esc(champ.full)}</em></h1>
      <div class="golden-head" aria-hidden="true">${goldenHead()}</div>
      <ol class="tc-podium">${top.map((c) => `<li>${avatar(c)}<span>${esc(c.key)}</span><b>${c.total}</b></li>`).join("")}</ol>
      ${state.key !== CURRENT ? `<a class="tc-link" href="#/${CURRENT}/${state.view}">Back to Series ${CURRENT} →</a>` : ""}
      ${pending}`;
  }
  const e = d.nextEp;
  const title = e.title ? `<em>“${esc(e.title)}”</em>` : `<em>Episode ${e.ep}</em>`;
  const ny = zoneHour(e.air, "America/New_York"), la = zoneHour(e.air, "America/Los_Angeles");
  const off = (tzOffset(e.air, "Europe/London") - tzOffset(e.air, "America/New_York")) / 60;
  const warn = off !== 5
    ? `<p class="tc-warn"><b>Heads-up:</b> UK and US clocks change on different weekends, so this week the poll closes at <b>${ny} Eastern</b> and <b>${la} Pacific</b>.</p>` : "";
  return `
    <span class="tc-stamp">Task</span>
    <p class="tc-kicker">Series ${state.key} · Episode ${e.ep} of ${EPISODES}</p>
    <h1 class="tc-title">Pick the winner of ${title}</h1>
    <div class="stopwatch" role="timer" aria-label="Time until the poll closes">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="52" class="sw-track"/>
        <circle cx="60" cy="60" r="52" class="sw-arc" pathLength="100"/>
        <g class="sw-ticks">${Array.from({ length: 60 }, (_, i) => `<line x1="60" y1="${i % 5 ? 11 : 8}" x2="60" y2="14" transform="rotate(${i * 6} 60 60)"/>`).join("")}</g>
        <line class="sw-hand" x1="60" y1="60" x2="60" y2="16"/>
        <circle cx="60" cy="60" r="3.5" class="sw-pin"/>
      </svg>
      <time class="cd" id="cd"></time>
    </div>
    <p class="tc-local">Poll closes when the livestream starts:<br><b>${esc(fmtLocal.format(e.air))}</b> your time</p>
    <ul class="tc-zones" aria-label="Deadline around the world">
      <li><small>London</small>10pm</li><li><small>Eastern</small>${ny}</li><li><small>Pacific</small>${la}</li>
    </ul>
    ${warn}
    ${pending}
    <a class="tc-yt" href="${YT}" target="_blank" rel="noopener">Watch live on YouTube ↗</a>`;
}

function goldenHead() {
  return `<svg viewBox="0 0 100 110" width="84" height="92">
    <defs><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b3"/><stop offset=".45" stop-color="#e2b43f"/><stop offset="1" stop-color="#8a5f12"/></linearGradient></defs>
    <path d="M50 8c19 0 31 14 31 33 0 9-2 15-5 20l3 8-6 2c-1 8-6 13-14 14l-2 8H43l-1-8C28 82 19 70 19 50 19 24 31 8 50 8Z" fill="url(#gold)"/>
    <path d="M26 96h48l6 12H20Z" fill="url(#gold)"/>
    <path d="M58 44c3-1 6-1 8 1M36 45c3-2 6-2 8-1" stroke="#7a5210" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M44 66c4 2 9 2 13 0" stroke="#7a5210" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>`;
}

function tick() {
  const d = state.d;
  const cd = $("#cd");
  if (!d?.nextEp) return;
  const ms = d.nextEp.air - Date.now();
  if (ms <= 0) {
    loadSeries(state.key);
    renderView(false);
    burstAt($("#taskcard"), { count: 120 });
    return;
  }
  const t = splitTime(ms);
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
  const html = { standings: viewStandings, episodes: viewEpisodes, cast: viewCast, lab: viewLab }[state.view]();
  const swap = () => {
    main.innerHTML = html;
    main.dataset.view = state.view;
    for (const t of $$(".tabs a")) t.setAttribute("aria-current", t.dataset.view === state.view ? "page" : "false");
    for (const t of $$(".tabs a")) t.href = `#/${state.key}/${t.dataset.view}`;
    moveTabInk();
    afterRender();
  };
  if (animate && document.startViewTransition && !reducedMotion) document.startViewTransition(swap);
  else swap();
}

// Standings ------------------------------------------------------------------

function viewStandings() {
  const d = state.d;
  const key = state.sort;
  const P = [...d.players].sort((a, b) =>
    state.dir * ((a[key + "Rank"] - b[key + "Rank"]) || (b[key === "show" ? "league" : "show"] - a[key === "show" ? "league" : "show"])));
  const worst = Math.max(...P.map((p) => p[key + "Rank"]));
  const after = d.weeksScored ? `After Episode ${d.weeksScored} of ${EPISODES}` : "No episodes scored yet";

  if (!P.length) {
    return `
    <section class="board paper">
      <header class="board-head"><div><p class="kicker">Series ${state.key} · ${after}</p><h2>The Scoreboard</h2></div></header>
      <div class="empty">
        <p class="hand">No league picks have been entered for Series ${state.key} yet.</p>
        <p>The contestants' scores are all here: see <a href="#/${state.key}/episodes">Episodes</a> and <a href="#/${state.key}/cast">Cast</a>, or try your own picks in <a href="#/${state.key}/lab">the Lab</a>.</p>
        ${d.inactive.length ? `<p class="yet">Yet to vote: ${d.inactive.map(esc).join(", ")}</p>` : ""}
      </div>
    </section>`;
  }

  const sortBtn = (k, label, hint) => `
    <button class="sort ${state.sort === k ? "on" : ""}" data-sort="${k}" aria-pressed="${state.sort === k}">
      ${label}<small>${hint}</small><span class="dir" aria-hidden="true">${state.sort === k ? (state.dir === 1 ? "▼" : "▲") : ""}</span>
    </button>`;

  const rows = P.map((p, i) => {
    const rank = p[key + "Rank"], delta = p[key + "Delta"];
    const seal = rank <= 3 ? `seal-${rank}` : "seal-ink";
    const open = state.open.has(p.name);
    const status = p.status ? statusLine(p.status) : "";
    const tiles = p.weeks.map((w) => {
      const c = w.pick ? d.cast[w.pick] : null;
      if (!c) return `<li class="wk none"><span class="wk-ep">Ep ${w.ep}</span><span class="wk-dash">—</span><small>${w.ep <= d.weeksAired ? "No vote" : "Open"}</small></li>`;
      if (!w.scored) return `<li class="wk soon" style="--c:${c.color}">${avatar(c)}<span class="wk-ep">Ep ${w.ep}</span><b>…</b><small>${esc(c.key)}</small></li>`;
      return `<li class="wk" style="--c:${c.color}">${avatar(c)}<span class="wk-ep">Ep ${w.ep}</span><b>${key === "show" ? w.show : w.league}</b><small>${esc(c.key)} · ${ord(w.place)}</small></li>`;
    }).join("");
    return `
    <li class="row ${rank === worst && P.length > 2 ? "crooked" : ""} ${open ? "open" : ""}" style="--i:${i}">
      <button class="row-main" data-player="${esc(p.name)}" aria-expanded="${open}">
        <span class="seal ${seal}" aria-label="Rank ${rank}"><span>${rank}</span></span>
        <span class="who"><span class="pname">${esc(p.name)}</span>${status}</span>
        <span class="pts ${key === "show" ? "lead" : ""}"><b data-count="${p.show}">${p.show}</b><small>Show</small></span>
        <span class="pts ${key === "league" ? "lead" : ""}"><b data-count="${p.league}">${p.league}</b><small>League</small></span>
        <span class="delta ${delta > 0 ? "up" : delta < 0 ? "down" : ""}" aria-label="${delta ? `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta)} since last week` : "No change"}">${delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : "·"}</span>
      </button>
      <div class="weeks" ${open ? "" : "hidden"}>
        <ol class="wk-list">${tiles}</ol>
      </div>
    </li>`;
  }).join("");

  const leader = [...d.players].sort((a, b) => a.showRank - b.showRank)[0];
  const lastEp = d.weeksScored;
  const hot = lastEp ? [...d.players].filter((p) => p.weeks[lastEp - 1].show != null).sort((a, b) => b.weeks[lastEp - 1].show - a.weeks[lastEp - 1].show)[0] : null;
  const pickCount = {};
  for (const p of d.players) for (const w of p.weeks) if (w.pick && w.ep <= d.weeksScored) pickCount[w.pick] = (pickCount[w.pick] || 0) + 1;
  const fav = Object.entries(pickCount).sort((a, b) => b[1] - a[1])[0];

  return `
  <section class="board paper">
    <header class="board-head">
      <div><p class="kicker">Series ${state.key} · ${after}</p><h2>The Scoreboard</h2></div>
      <div class="sorts" role="group" aria-label="Rank by">
        ${sortBtn("show", "Show", "points scored")}
        ${sortBtn("league", "League", "5-4-3-2-1")}
      </div>
    </header>
    <ol class="rows">${rows}</ol>
    <p class="board-foot">Tap a name to see every pick. ${d.inactive.length ? `<span class="yet">Yet to vote: ${d.inactive.map(esc).join(", ")}</span>` : ""}</p>
  </section>
  <aside class="glance">
    ${leader ? `<div class="note" style="--r:-1.5deg"><small>Leading the Show table</small><b>${esc(leader.name)}</b><span>${leader.show} pts</span></div>` : ""}
    ${hot ? `<div class="note" style="--r:1deg"><small>Best pick of Episode ${lastEp}</small><b>${esc(hot.name)}</b><span>${esc(hot.weeks[lastEp - 1].pick)} · ${hot.weeks[lastEp - 1].show} pts</span></div>` : ""}
    ${fav ? `<div class="note" style="--r:-.5deg"><small>Most backed contestant</small><b>${esc(d.cast[fav[0]].full)}</b><span>${plural(fav[1], "pick")}</span></div>` : ""}
  </aside>`;
}

function statusLine(s) {
  const list = s.needed.map(esc).join(", ");
  if (s.kind === "must") return `<span class="must">Must pick: ${list}</span>`;
  if (s.kind === "cannot") return `<span class="must">Can't fit: ${list}</span>`;
  return `<span class="must">Never picked: ${list}</span>`;
}

// Episodes -------------------------------------------------------------------

function viewEpisodes() {
  const d = state.d;
  const sel = state.arg ? +state.arg : null;
  const env = d.raw.episodes.map((e, i) => {
    const st = epState(d, e.ep);
    const w = d.winners[e.ep];
    const c = w ? d.cast[w.winner] : null;
    const meta = st === "scored" ? `Won by ${esc(c.key)}${w.tiebreak ? " (tiebreak)" : ""}`
      : st === "pending" ? "Aired · results soon"
      : st === "next" ? `Poll closes in <b data-countdown></b>`
      : esc(fmtShortDay.format(d.episodes[i].air));
    return `
    <li style="--i:${i}">
      <a class="env ${st} ${sel === e.ep ? "sel" : ""}" href="#/${state.key}/episodes/${e.ep}" style="--c:${c ? c.color : "var(--wax)"}" aria-label="Episode ${e.ep}${e.title ? `: ${esc(e.title)}` : ""}. ${st === "scored" ? `Won by ${esc(c.full)}` : st}">
        <span class="env-body">
          <span class="env-letter">${c ? avatar(c) : ""}</span>
          <span class="env-flap"></span>
          <span class="env-seal"><span>${e.ep}</span></span>
          ${st === "pending" ? `<span class="env-stamp">Results soon</span>` : ""}
        </span>
        <span class="env-caption"><b>${e.title ? esc(e.title) : `Episode ${e.ep}`}</b><small>${meta}</small></span>
      </a>
    </li>`;
  }).join("");

  return `
  <section class="envelopes">
    <header class="section-head"><p class="kicker">Series ${state.key} · ${plural(d.weeksScored, "episode")} scored</p><h2>The Envelopes</h2>
      <p class="sub">Every episode is a sealed task. Break a seal to replay the scoreboard.</p></header>
    <ol class="env-grid">${env}</ol>
  </section>
  ${sel ? episodeDetail(sel) : ""}`;
}

function episodeDetail(ep) {
  const d = state.d;
  const e = d.raw.episodes[ep - 1];
  const air = d.episodes[ep - 1].air;
  const st = epState(d, ep);
  const nav = `
    <nav class="ep-nav">
      ${ep > 1 ? `<a href="#/${state.key}/episodes/${ep - 1}">← Episode ${ep - 1}</a>` : "<span></span>"}
      ${ep < EPISODES ? `<a href="#/${state.key}/episodes/${ep + 1}">Episode ${ep + 1} →</a>` : "<span></span>"}
    </nav>`;
  const head = `
    <p class="kicker">Episode ${ep} · ${esc(fmtDay.format(air))}</p>
    <h2>${e.title ? esc(e.title) : `Episode ${ep}`}</h2>`;

  if (st !== "scored") {
    const msg = st === "pending"
      ? "This one has aired. The host will enter the scores and everyone's picks soon."
      : st === "next"
        ? `This envelope stays sealed until the livestream: ${esc(fmtLocal.format(air))} your time. Poll closes in <b data-countdown></b>.`
        : `Sealed until ${esc(fmtLocal.format(air))} your time.`;
    return `<article class="ep-detail paper sealed" id="detail" tabindex="-1">${head}<p class="sealed-msg hand">${msg}</p>${nav}</article>`;
  }

  const w = d.winners[ep];
  const c = d.cast[w.winner];
  const tasks = d.epTasks(ep);
  const verdict = w.tiebreak
    ? `<b style="--c:${c.color}">${esc(c.full)}</b> won on a tiebreak after ${w.tied.length === 2 ? "a two-way" : `a ${w.tied.length}-way`} tie on ${w.top}`
    : `<b style="--c:${c.color}">${esc(c.full)}</b> won with ${w.top} points`;

    const race = d.names.map((n) => {
    const cc = d.cast[n];
    return `
      <li class="race-row" data-name="${n}" style="--c:${cc.color}">
        ${avatar(cc)}<span class="race-name">${esc(cc.key)}</span>
        <span class="race-track"><span class="race-bar"></span></span>
        <b class="race-total">0</b>
        <span class="race-place"></span>
      </li>`;
  }).join("");

  const taskCards = tasks.map((t, i) => {
    const max = Math.max(...t.s), min = Math.min(...t.s);
    const cells = d.names.map((n, j) => {
      const cc = d.cast[n], v = t.s[j];
      const flag = max !== min && v === max ? "top" : max !== min && v === min ? "low" : "";
      return `<li class="sc ${flag}" style="--c:${cc.color};--v:${Math.min(v, 6)}" title="${esc(cc.key)}: ${v}">
        ${avatar(cc)}<span class="sc-pips" aria-hidden="true">${"<i></i>".repeat(Math.min(v, 6))}</span><b>${v}</b><span class="vh">${esc(cc.key)}</span></li>`;
    }).join("");
    return `
      <li class="task t-${t.t}" style="--i:${i}">
        <span class="stamp">${TYPE[t.t]}${t.solo ? " · solo" : ""}</span>
        <h4>${esc(t.n)}</h4>
        ${t.d && t.d.replace(/\.$/, "") !== t.n ? `<details><summary>Read the task</summary><p class="task-text">${esc(t.d)}</p></details>` : ""}
        <ol class="scores">${cells}</ol>
      </li>`;
  }).join("");

  const picks = d.players.filter((p) => p.weeks[ep - 1].pick).map((p) => {
    const wk = p.weeks[ep - 1], cc = d.cast[wk.pick];
    return `<li style="--c:${cc.color}">${avatar(cc)}<span><b>${esc(p.name)}</b> backed ${esc(cc.key)}</span><em>${wk.show} Show · ${wk.league} League</em></li>`;
  }).join("");

  return `
  <article class="ep-detail paper" id="detail" tabindex="-1" style="--c:${c.color}">
    ${head}
    <p class="verdict">${verdict}.</p>
    <section class="race" aria-label="Scoreboard replay">
      <div class="race-head">
        <h3>The scoreboard</h3>
        <span class="race-step" aria-live="polite"></span>
        <button class="btn replay" type="button">▶ Replay</button>
      </div>
      <ol class="race-rows">${race}</ol>
      <p class="race-key">Placement points for the League table: 1st 5 · 2nd 4 · 3rd 3 · 4th 2 · 5th 1</p>
    </section>
    <section class="notes"><h3>Alex's notes</h3><ul class="hand">${episodeNotes(ep).map((n) => `<li>${n}</li>`).join("")}</ul></section>
    <section class="tasks-sec"><h3>The tasks</h3><ol class="tasks">${taskCards}</ol></section>
    ${picks ? `<section class="ep-picks"><h3>Who picked whom</h3><ul>${picks}</ul></section>` : ""}
    ${nav}
  </article>`;
}

function episodeNotes(ep) {
  const d = state.d;
  const tasks = d.epTasks(ep);
  const tot = Object.fromEntries(d.names.map((n) => [n, d.EPS[n][ep]]));
  const sorted = [...d.names].sort((a, b) => tot[b] - tot[a]);
  const w = d.winners[ep];
  const name = (n) => `<b style="--c:${d.cast[n].color}">${esc(n)}</b>`;
  const list = (arr) => arr.length === 1 ? name(arr[0]) : arr.slice(0, -1).map(name).join(", ") + " and " + name(arr.at(-1));
  const notes = [];

  if (w.tiebreak) {
    const e = d.raw.episodes[ep - 1];
    notes.push(`${list(w.tied)} tied on ${w.top}. ${name(w.winner)} won the tiebreak${e.tbTask ? ` (${esc(lc(e.tbTask))})` : ""}.`);
  } else {
    const margin = tot[sorted[0]] - tot[sorted[1]];
    notes.push(`${name(w.winner)} won by ${plural(margin, "point")} from ${name(sorted[1])}.`);
  }

  const prize = tasks.find((t) => t.t === "P");
  if (prize) {
    const top = Math.max(...prize.s);
    const winners = d.names.filter((_, i) => prize.s[i] === top);
    notes.push(`${list(winners)} took the prize task: “${esc(lc(prize.n))}”.`);
  }

  // Leader going into the final task vs final result
  if (tasks.length > 1) {
    const before = Object.fromEntries(d.names.map((n, i) => [n, tasks.slice(0, -1).reduce((a, t) => a + t.s[i], 0)]));
    const pre = [...d.names].sort((a, b) => before[b] - before[a]);
    const preRank = pre.indexOf(w.winner) + 1;
    if (preRank > 1) notes.push(`${name(w.winner)} was ${ord(preRank)} going into the last task, and came through.`);
    else notes.push(`${name(w.winner)} led going into the last task and held on.`);
  }

  const zeros = [];
  tasks.forEach((t) => d.names.forEach((n, i) => { if (t.s[i] === 0 && !t.s.every((x) => x === 0)) zeros.push([n, t]); }));
  if (zeros.length) {
    const by = {};
    for (const [n, t] of zeros) (by[t.n] ||= []).push(n);
    const [tn, ns] = Object.entries(by).sort((a, b) => b[1].length - a[1].length)[0];
    notes.push(`Nothing for ${list(ns)} on “${esc(lc(tn))}”.`);
  }

  const fives = d.names.map((n, i) => [n, tasks.filter((t) => t.s[i] >= 5).length]).sort((a, b) => b[1] - a[1]);
  if (fives[0][1] >= 2) notes.push(`${name(fives[0][0])} got full marks ${fives[0][1] === 2 ? "twice" : `${fives[0][1]} times`}.`);

  const cum = Object.fromEntries(d.names.map((n) => [n, d.EPS[n].slice(1, ep + 1).reduce((a, b) => a + b, 0)]));
  const lead = [...d.names].sort((a, b) => cum[b] - cum[a]);
  notes.push(ep === EPISODES
    ? `Final series totals: ${lead.map((n) => `${name(n)} ${cum[n]}`).join(" · ")}.`
    : `Series standings after this episode: ${name(lead[0])} leads on ${cum[lead[0]]}${cum[lead[1]] === cum[lead[0]] ? `, level with ${name(lead[1])}` : `, ${plural(cum[lead[0]] - cum[lead[1]], "point")} clear of ${name(lead[1])}`}.`);
  return notes;
}

let raceTimer = 0;
function playRace(instant = false) {
  const root = $(".race");
  if (!root) return;
  clearTimeout(raceTimer);
  const d = state.d;
  const ep = +state.arg;
  const tasks = d.epTasks(ep);
  const rows = Object.fromEntries($$(".race-row", root).map((r) => [r.dataset.name, r]));
  const max = Math.max(...d.names.map((n) => d.EPS[n][ep]), 1);
  const stepLabel = $(".race-step", root);
  const rowH = rows[d.names[0]].offsetHeight + 8;
  $(".race-rows", root).style.height = `${rowH * d.names.length}px`;

  const show = (k) => {
    const tot = Object.fromEntries(d.names.map((n, i) => [n, tasks.slice(0, k).reduce((a, t) => a + t.s[i], 0)]));
    const order = [...d.names].sort((a, b) => tot[b] - tot[a] || (k === tasks.length ? d.placing[ep][a] - d.placing[ep][b] : 0));
    order.forEach((n, i) => {
      const r = rows[n];
      r.style.transform = `translateY(${i * rowH}px)`;
      $(".race-bar", r).style.width = `${(tot[n] / max) * 100}%`;
      $(".race-total", r).textContent = tot[n];
      const done = k === tasks.length;
      $(".race-place", r).innerHTML = done ? `${ord(d.placing[ep][n])}<small>+${d.rankPts[ep][n]}</small>` : "";
      r.classList.toggle("winner", done && n === d.winners[ep].winner);
    });
    stepLabel.textContent = k === 0 ? "Before the first task" : k === tasks.length ? "Final scores" : `After task ${k} of ${tasks.length}: ${TYPE[tasks[k - 1].t].toLowerCase()}`;
    if (k === tasks.length && !instant) {
      const win = rows[d.winners[ep].winner];
      setTimeout(() => burstAt($(".ava", win), { colors: [d.cast[d.winners[ep].winner].color, "#f4d67a", "#f1e6cc"], count: 70 }), 350);
    }
  };

  if (instant || reducedMotion) { show(tasks.length); return; }
  let k = 0;
  const step = () => { show(k); if (k++ < tasks.length) raceTimer = setTimeout(step, k === 1 ? 500 : 900); };
  step();
}

// Cast -----------------------------------------------------------------------

function viewCast() {
  const d = state.d;
  const byRank = [...d.contestants].sort((a, b) => a.rank - b.rank);
  const sel = d.contestants.find((c) => c.key === state.arg) || byRank[0];
  const worst = Math.max(...d.contestants.map((c) => c.rank));
  const s = SERIES[state.key];
  const frames = d.contestants.map((c, i) => `
    <li class="frame ${c.rank === worst && d.weeksScored ? "crooked" : ""} ${c.key === sel.key ? "sel" : ""}" style="--c:${c.color};--i:${i}">
      <a href="#/${state.key}/cast/${encodeURIComponent(c.key)}" aria-label="${esc(c.full)}, ${ord(c.rank)} with ${c.total} points">
        <span class="nail" aria-hidden="true"></span>
        <span class="wire" aria-hidden="true"></span>
        <img src="${c.img}" alt="" width="225" height="266" decoding="async">
        <span class="plaque"><b>${esc(c.key)}</b><small>${d.weeksScored ? `${ord(c.rank)} · ${c.total}` : "—"}</small></span>
        ${s.champion === c.key ? `<span class="laurel" title="Series champion">${goldenHead()}</span>` : ""}
      </a>
    </li>`).join("");

  const cats = [["Prize", sel.prizeRank, sel.ty.P], ["Filmed", sel.filmedRank, sel.ty.F + sel.ty.T], ["Live", sel.liveRank, sel.ty.L]];
  const maxEp = Math.max(...d.contestants.flatMap((c) => c.eps), 1);
  const bars = sel.eps.map((v, i) => {
    const ep = i + 1, scored = ep <= d.weeksScored;
    const won = d.winners[ep]?.winner === sel.key;
    const h = scored ? (v / maxEp) * 100 : 0;
    return `<li class="${scored ? "" : "future"} ${won ? "won" : ""}" style="--h:${h}%"><span class="bar"></span><b>${scored ? v : ""}</b><small>${ep}</small></li>`;
  }).join("");
  const team = s.teams.find((t) => t.includes(sel.key));
  const mates = team ? team.filter((n) => n !== sel.key) : [];

  return `
  <section class="gallery">
    <header class="section-head"><p class="kicker">Series ${state.key} · ${esc(s.themeName)}</p><h2>The Portrait Wall</h2></header>
    <ul class="wall">${frames}</ul>
  </section>
  <article class="profile paper" id="detail" tabindex="-1" style="--c:${sel.color}">
    <div class="p-portrait"><img src="${sel.img}" alt="Portrait of ${esc(sel.full)}" width="225" height="266" decoding="async"></div>
    <div class="p-body">
      <p class="kicker">${d.weeksScored ? `${ord(sel.rank)} in Series ${state.key}` : `Series ${state.key}`}${s.champion === sel.key ? " · Champion" : ""}</p>
      <h2>${esc(sel.full)}</h2>
      <p class="bio">${esc(sel.bio)}</p>
      ${mates.length ? `<p class="team">Team tasks with ${mates.map(esc).join(" & ")}</p>` : ""}
      <dl class="stats">
        <div><dt>Total</dt><dd>${sel.total}</dd></div>
        <div><dt>Per episode</dt><dd>${sel.avg.toFixed(1)}</dd></div>
        <div><dt>Episode wins</dt><dd>${sel.wins}</dd></div>
        <div><dt>Full marks</dt><dd>${sel.fives}</dd></div>
        <div><dt>Zeros</dt><dd>${sel.zeros}</dd></div>
        <div><dt>League picks</dt><dd>${sel.pickedBy}</dd></div>
      </dl>
      <ul class="cats">${cats.map(([k, r, v]) => `<li class="medal m-${r}"><span>${ord(r)}</span><small>${k}<br>${v} pts</small></li>`).join("")}</ul>
      <figure class="ep-chart">
        <figcaption>Points per episode${d.weeksScored ? ` · best ${sel.best}, worst ${sel.worst}` : ""} · <span class="won-key">★ won</span></figcaption>
        <ol>${bars}</ol>
      </figure>
    </div>
  </article>`;
}

// Lab ------------------------------------------------------------------------

const labKey = () => `fm-lab-${state.key}`;
function labPicks() {
  const p = store.get(labKey(), []);
  return Array.from({ length: EPISODES }, (_, i) => (state.d.names.includes(p[i]) ? p[i] : null));
}

function viewLab() {
  const d = state.d;
  const picks = labPicks();
  const res = scorePicks(d, picks);
  const rows = d.raw.episodes.map((e, i) => {
    const w = res.weeks[i];
    const st = epState(d, e.ep);
    const result = w.show != null ? `<b>${w.show}</b><small>${ord(w.place)} · +${w.league}</small>` : st === "scored" ? "<small>No pick</small>" : `<small>${st === "pending" ? "Awaiting results" : st === "next" ? "Next up" : "Upcoming"}</small>`;
    return `
    <li class="lab-row ${st}">
      <span class="lab-ep"><b>Ep ${e.ep}</b><small>${e.title ? esc(e.title) : esc(fmtShortDay.format(d.episodes[i].air))}</small></span>
      <div class="lab-choices" role="radiogroup" aria-label="Episode ${e.ep} pick">
        ${d.names.map((n) => {
          const c = d.cast[n], on = picks[i] === n;
          return `<button type="button" role="radio" aria-checked="${on}" class="choice ${on ? "on" : ""}" data-ep="${e.ep}" data-name="${n}" style="--c:${c.color}">${avatar(c)}<span>${esc(n)}</span></button>`;
        }).join("")}
      </div>
      <span class="lab-res">${result}</span>
    </li>`;
  }).join("");

  // Where would these picks rank?
  const rankIn = (key) => 1 + d.players.filter((p) => p[key] > res[key]).length;
  const field = picks.some(Boolean) ? d.players.length : 0;

  // Pick-everyone planner: open polls are episodes that haven't aired.
  const picked = new Set(picks.filter(Boolean));
  const needed = d.names.filter((n) => !picked.has(n));
  const open = picks.filter((p, i) => !p && i + 1 > d.weeksAired).length;
  const plan = !needed.length
    ? `<p class="plan ok">✓ Everyone picked at least once.</p>`
    : needed.length > open
      ? `<p class="plan bad">Can't fit everyone: ${needed.map(esc).join(", ")} but only ${plural(open, "open poll")}.</p>`
      : needed.length === open
        ? `<p class="plan bad">Must pick: ${needed.map(esc).join(", ")}. Every open poll is spoken for.</p>`
        : `<p class="plan">Still to pick: ${needed.map(esc).join(", ")} · ${plural(open, "open poll")} left.</p>`;

  return `
  <section class="lab paper">
    <header class="board-head">
      <div><p class="kicker">Series ${state.key} · just for you</p><h2>The Lab</h2>
      <p class="sub">Try a set of picks. Scored episodes count straight away; future ones help you plan around the pick-everyone rule. Saved on this device only.</p></div>
      <div class="lab-sum" aria-live="polite">
        <div><b>${res.show}</b><small>Show</small>${field ? `<em>${ord(rankIn("show"))} of ${field + 1}</em>` : ""}</div>
        <div><b>${res.league}</b><small>League</small>${field ? `<em>${ord(rankIn("league"))} of ${field + 1}</em>` : ""}</div>
      </div>
    </header>
    ${plan}
    <ol class="lab-rows">${rows}</ol>
    <div class="lab-actions">
      <button class="btn" data-lab="hindsight" type="button">Perfect hindsight</button>
      <button class="btn" data-lab="copy" type="button">Copy my picks</button>
      <button class="btn ghost" data-lab="clear" type="button">Clear</button>
    </div>
  </section>`;
}

// ── After render: wire up per-view behaviour ─────────────────────────────────

function afterRender() {
  tick();
  if (state.view === "episodes" && state.arg) {
    const detail = $("#detail");
    if (detail && !detail.classList.contains("sealed")) playRace(!pendingReveal);
    if (pendingReveal) {
      const seal = $(".env.sel .env-seal");
      if (seal) burstAt(seal, { kind: "wax", colors: ["#8e1418", "#b3242a", "#6d0f12"], count: 26 });
      detail?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      detail?.focus({ preventScroll: true });
    }
  }
  if (state.view === "cast" && pendingReveal) {
    $("#detail")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
  }
  pendingReveal = false;
  countUp();
}

function countUp() {
  if (reducedMotion) return;
  for (const el of $$("[data-count]")) {
    const to = +el.dataset.count;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 900);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

// ── Tabs ink ────────────────────────────────────────────────────────────────

function moveTabInk() {
  const a = $(`.tabs a[data-view="${state.view}"]`);
  const ink = $(".tab-ink");
  if (!a || !ink) return;
  ink.style.width = `${a.offsetWidth}px`;
  ink.style.transform = `translateX(${a.offsetLeft}px)`;
}

// ── Routing ─────────────────────────────────────────────────────────────────

let pendingReveal = false;
function route() {
  const r = parseHash();
  const seriesChanged = r.key !== state.key;
  const viewChanged = r.view !== state.view;
  pendingReveal = !!r.arg && (r.arg !== state.arg || viewChanged);
  state.view = r.view;
  state.arg = r.arg;
  if (seriesChanged) {
    const first = state.key === null;
    state.open.clear();
    const go = () => { loadSeries(r.key); renderView(false); };
    if (!first && document.startViewTransition && !reducedMotion) {
      document.documentElement.classList.add("vt-series");
      const t = document.startViewTransition(go);
      t.finished.finally(() => document.documentElement.classList.remove("vt-series"));
      const b = $("#series-btn");
      burstAt(b, SERIES[r.key].theme === "diner"
        ? { kind: "spark", colors: ["#ff4f9a", "#37d6c8", "#fff"], count: 40 }
        : { kind: "steam", count: 18 });
    } else go();
    document.title = `Series ${r.key} · Fantasky Master`;
    return;
  }
  renderView(viewChanged);
}

// ── Events ──────────────────────────────────────────────────────────────────

document.addEventListener("click", (e) => {
  const sortBtn = e.target.closest("[data-sort]");
  if (sortBtn) {
    const k = sortBtn.dataset.sort;
    state.dir = state.sort === k ? -state.dir : 1;
    state.sort = k;
    renderView();
    return;
  }
  const row = e.target.closest(".row-main");
  if (row) {
    const name = row.dataset.player;
    const li = row.parentElement;
    const open = !state.open.has(name);
    open ? state.open.add(name) : state.open.delete(name);
    li.classList.toggle("open", open);
    row.setAttribute("aria-expanded", open);
    $(".weeks", li).hidden = !open;
    return;
  }
  if (e.target.closest(".replay")) { playRace(); return; }

  const choice = e.target.closest(".choice");
  if (choice) {
    const picks = labPicks();
    const i = +choice.dataset.ep - 1;
    picks[i] = picks[i] === choice.dataset.name ? null : choice.dataset.name;
    store.set(labKey(), picks);
    const y = scrollY;
    renderView(false);
    scrollTo(0, y);
    if (picks[i]) burstAt($(`.choice[data-ep="${i + 1}"][data-name="${picks[i]}"] .ava`), { kind: "spark", colors: [state.d.cast[picks[i]].color, "#fff"], count: 14 });
    return;
  }
  const lab = e.target.closest("[data-lab]");
  if (lab) {
    const d = state.d;
    const picks = labPicks();
    if (lab.dataset.lab === "hindsight") {
      for (let ep = 1; ep <= d.weeksScored; ep++) picks[ep - 1] = d.winners[ep].winner;
      store.set(labKey(), picks);
      renderView(false);
      burstAt(lab, { count: 50 });
    } else if (lab.dataset.lab === "clear") {
      store.set(labKey(), []);
      renderView(false);
    } else {
      const text = `Series ${state.key} picks: ` + picks.map((p, i) => `Ep${i + 1} ${p || "–"}`).join(", ");
      navigator.clipboard?.writeText(text).then(() => { lab.textContent = "Copied ✓"; setTimeout(() => (lab.textContent = "Copy my picks"), 1600); },
        () => prompt("Copy your picks:", text));
    }
    return;
  }
  const car = e.target.closest(".caravan");
  if (car) { knock(car); return; }
  if (e.target.closest(".menu-item")) $("#series-menu").hidePopover?.();
});

document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.closest?.(".caravan")) { e.preventDefault(); knock(e.target.closest(".caravan")); }
});

const QUIPS = [
  "All the information is on the task.",
  "Your time starts now.",
  "No vote, no points.",
  "Polls close the moment the livestream starts.",
  "You must pick every contestant at least once.",
  "Fastest wins. Except when it doesn't.",
  "Tiebreaks only matter for the League table.",
  "Please don't touch the caravan.",
];
let quipI = Math.floor(Math.random() * QUIPS.length);
function knock(car) {
  const bubble = $("#quip");
  const r = car.getBoundingClientRect();
  const hr = $(".hero").getBoundingClientRect();
  bubble.textContent = QUIPS[quipI++ % QUIPS.length];
  bubble.style.left = `${Math.min(r.left - hr.left + r.width * 0.6, hr.width - 20)}px`;
  bubble.style.top = `${r.top - hr.top}px`;
  bubble.classList.remove("show");
  void bubble.offsetWidth;
  bubble.classList.add("show");
  car.classList.remove("knocked"); void car.getBoundingClientRect(); car.classList.add("knocked");
  burst(r.left + r.width * 0.72, r.top + r.height * 0.2, { kind: "steam", count: 8 });
}

// Pointer tilt for cards and frames (one delegated, rAF-throttled listener).
let tiltEl = null, tiltRaf = 0, tiltEv = null;
if (!reducedMotion && matchMedia("(hover: hover)").matches) {
  document.addEventListener("pointermove", (e) => {
    tiltEv = e;
    if (!tiltRaf) tiltRaf = requestAnimationFrame(() => {
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

// Scroll → sky dimming + chimney tracking.
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

try {
  sky = startSky($("#sky"), { reducedMotion });
} catch (err) {
  console.warn("Sky shader unavailable:", err);
}
if (!sky) document.body.classList.add("no-gl");

if (!location.hash) history.replaceState(null, "", `#/${CURRENT}/standings`);
addEventListener("hashchange", route);
route();
setInterval(tick, 1000);
document.fonts?.ready.then(() => { moveTabInk(); placeChimney(); });
