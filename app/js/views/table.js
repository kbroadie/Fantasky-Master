// Standings: a strip of weeks (Ep 1–10), a "Week 4 Standings" headline and the
// leaders, then one sortable table (Show or League) as it stood after that week.
// A week not yet scored is "Episode 5 Picks": the table as it stands now, each row
// behind that week's pick. Tapping a row opens that player's ten weekly picks.
import { esc, listing, tier, framed, fmtDay, fmtWhen, state } from "../ui.js";
import { GROUP, faceFor, NO_PICK } from "../heroes.js";
import { pickChooser } from "../edit.js";

/** The week on show: state.wk, or the latest scored week. */
export const stWeek = (d) => Math.min(Math.max(1, state.wk || d.weeksScored), d.episodes.length);

/**
 * Each player as the table stood after week w: totals, ranks and movement
 * since the week before (from league.js's per-week history).
 */
export function atWeek(d, w) {
  // Weeks not yet scored: the table as it stands now, with no movement.
  if (w > d.weeksScored) return d.weeksScored ? atWeek(d, d.weeksScored).map((p) => ({ ...p, showDelta: 0, leagueDelta: 0 })) : d.players;
  return d.players.map((p) => {
    const h = p.history[w - 1], was = p.history[w - 2] || h;
    return {
      ...p, show: h.show, league: h.league, showRank: h.showRank, leagueRank: h.leagueRank,
      showDelta: was.showRank - h.showRank, leagueDelta: was.leagueRank - h.leagueRank,
    };
  });
}

/** Everyone on the top score of a board (ties share the lead). */
function leaders(rows, key) {
  const top = Math.max(...rows.map((p) => p[key]));
  return rows.filter((p) => p[key] === top).map((p) => p.name);
}

/** "How scoring works", under the leaders line, opens both of these. */
// The league's words, unchanged, in their order: the title, the rule, the
// range. The crown and trophy are drawn in the same gold line style as the
// task icons (16px grid), not emoji.
const HOW_ICONS = {
  crown: "M3.5 11 2.5 5l3 3L8 3l2.5 5 3-3-1 6z M3.5 13.5h9",
  trophy: "M5 2.5h6v4a3 3 0 0 1-6 0z M5 3.75H3.25a1.9 1.9 0 0 0 2.1 3.1 M11 3.75h1.75a1.9 1.9 0 0 1-2.1 3.1 M8 9.5V12 M5.5 13.5h5 M6.5 12h3",
};
/** The table's head: a tab per sort (a player, the crown for Show, the trophy for League), like the week strip. */
const PLAYER_ICON = "M8 2.5a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 1 1 0-5.2z M2.75 13.5c.3-2.8 2.5-4.4 5.25-4.4s4.95 1.6 5.25 4.4";
const sortTab = (key, path, label, arr = "") => `<button class="st-tab" type="button" data-sort="${key}"><span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="${path}"/></svg>${label}${arr}</span></button>`;
const TERMS = [
  { icon: "crown", name: "Show", rule: ["The player with the ", "most points", " at the end of the series wins, regardless of episode placements."], range: "0–25", unit: "pts per episode" },
  { icon: "trophy", name: "League", rule: ["The player with the ", "best episode placements", " throughout the series wins, regardless of points."], range: "1–5", unit: "pts per episode" },
];
const howCard = (t) => `<div class="card how-card ${t.name.toLowerCase()}">
    <div class="how-head">
      <span class="how-icon" aria-hidden="true"><svg class="how-ico" viewBox="0 0 16 16"><path d="${HOW_ICONS[t.icon]}"/></svg><i class="how-glint"></i></span>
      <h3 class="how-title"><span class="how-the">The</span><span class="how-name">${esc(t.name)}</span></h3>
    </div>
    <p class="how-rule">${esc(t.rule[0])}<strong>${esc(t.rule[1])}</strong>${esc(t.rule[2])}</p>
    <p class="how-range"><b>${esc(t.range)}</b><span>${esc(t.unit)}</span></p>
  </div>`;

/** "Riley leads The Show   Jamie leads The League" ("wins" once the series is over). */
function leaderLine(d, rows, w) {
  const show = leaders(rows, "show"), league = leaders(rows, "league"), final = d.complete && w === d.episodes.length;
  const verb = (names) => (final ? (names.length > 1 ? "win" : "wins") : (names.length > 1 ? "lead" : "leads"));
  const who = (names) => `<b>${esc(listing(names))}</b>`;
  const S = `<span class="st-show">The Show</span>`, L = `<span class="st-league">The League</span>`;
  if (listing(show) === listing(league)) return `<span>${who(show)} ${verb(show)} ${S} and ${L}</span>`;
  return `<span>${who(show)} ${verb(show)} ${S}</span><span>${who(league)} ${verb(league)} ${L}</span>`;
}

/**
 * The hero: "Week 4 Standings" and who leads each board ("Episode 5 Picks" for a
 * week not yet scored), or when the series starts.
 */
export function standingsHero(d) {
  const w = stWeek(d);
  const how = `<button type="button" class="st-how" aria-expanded="${state.how}" aria-controls="st-explain">How scoring works<i class="st-how-chev" aria-hidden="true"></i></button>
    <div class="st-explain" id="st-explain"><div><div class="how-grid">${TERMS.map(howCard).join("")}</div></div></div>`;
  // The kicker, like the episode head's: the series and that week's episode.
  const kicker = `<div class="kicker">Series ${esc(state.key)} · ${esc(fmtDay.format(d.episodes[w - 1].air))}</div>`;
  if (!d.weeksScored) return `${kicker}<h2 class="ep-title">Episode ${w} Picks</h2><div class="ep-sub">The series starts ${esc(fmtWhen.format(d.episodes[0].air))}</div>${how}`;
  return `${kicker}<h2 class="ep-title">${w > d.weeksScored ? `Episode ${w} Picks` : `Week ${w} Standings`}</h2><p class="st-leaders">${leaderLine(d, atWeek(d, w), w)}</p>${how}`;
}

/** Series with a group photo show the week's pick as each row's backdrop. */
const heroRows = () => !!GROUP[state.key]?.faces;

/** Ep 1–10, like the episode strip; weeks not yet scored are faint. */
export const weekTabs = (d) => d.episodes.map(({ ep }) =>
  `<button class="strip-tab${ep > d.weeksScored ? " tbd" : ""}" data-week="${ep}">Ep ${ep}</button>`).join("");

export function standingsHead(d) {
  return `
    <div class="strip scroll" id="st-tabs">${weekTabs(d)}</div>
    <div class="hero st-hero${state.how ? " explain" : ""}">${standingsHero(d)}</div>
    <div class="card board" data-board="${state.sort}">
      <div class="st-head" role="group" aria-label="Sort the standings">
        ${sortTab("name", PLAYER_ICON, "Player", `<i class="arr" aria-hidden="true"></i>`)}
        ${sortTab("show", HOW_ICONS.crown, "Show")}
        ${sortTab("league", HOW_ICONS.trophy, "League")}
        <i class="st-ind" aria-hidden="true"></i>
      </div>
      <div id="rows"></div>
    </div>`;
}

export function standingsRows(d) {
  // Sorted by name, the rank and movement are still the last board sorted by.
  const key = state.sort, board = key === "name" ? state.board : key, w = stWeek(d);
  const rows = atWeek(d, w).sort(key === "name" ? (a, b) => state.dir * a.name.localeCompare(b.name)
    : (a, b) => state.dir * (a[key] - b[key]) || a[`${key}Rank`] - b[`${key}Rank`] || a.name.localeCompare(b.name));
  return rows.map((p) => {
    const rank = p[`${board}Rank`], delta = p[`${board}Delta`];
    const now = p.weeks[w - 1];
    // No pick that week (or none in yet): Patatas stands in.
    const face = !heroRows() ? null : now?.pick ? faceFor(state.key, now.pick) : NO_PICK;
    const bg = face ? pickBackdrop(face) : "";
    return `
    <div class="pc${rank === 1 ? " lead" : ""}" data-p="${esc(p.name)}">
      ${bg}
      <button class="pc-head" aria-expanded="false">
        <span class="pc-rank"><b class="${tier(rank)}">${rank}</b>${deltaTag(delta)}</span>
        <span class="pc-name"><span class="nm">${esc(p.name)}</span></span>
        <span class="pc-num${p.showRank === 1 ? " t1" : ""}">${p.show}</span>
        <span class="pc-num${p.leagueRank === 1 ? " t1" : ""}">${p.league}</span>
        <span class="chev" aria-hidden="true"></span>
      </button>
      <div class="pc-more"><div>${state.edit ? pickChooser(d, p, w) : picks(d, p)}</div></div>
    </div>`;
  }).join("");
}

/**
 * The row's backdrop: the contestant the player picked this week (or
 * Patatas if they didn't pick), cropped from their photo, scaled so every head is the same size and
 * the photo spans the row edge to edge, with the eyes on the centre line of
 * the row's top line and in the gap between the name and the Show column.
 * It covers the whole row, so opening the row just uncovers more of the
 * photo below; nothing moves. Frosted (.pc-bg) until the row opens.
 */
function pickBackdrop(f) {
  const vars = `--ex:${f.ex};--ey:${f.ey};--size:${f.head};--ar:${f.ratio}${f.cap ? `;--cap:${f.cap}` : ""}`;
  return `<span class="pc-bg" aria-hidden="true" style="${vars}"><img src="${f.src}" alt="" decoding="async">${f.cap ? `<i class="edge"></i>` : ""}</span>`;
}

const deltaTag = (n) => n > 0 ? `<i class="up">↑${n}</i>` : n < 0 ? `<i class="dn">↓${-n}</i>` : `<i class="flat">–</i>`;

function picks(d, p) {
  const league = (state.sort === "name" ? state.board : state.sort) === "league";
  const cells = p.weeks.map((w) => {
    if (!w.pick) return `<div class="pk"><small>${w.ep}</small><span class="pk-blank">${w.ep <= d.weeksScored ? "–" : ""}</span><b></b></div>`;
    const pts = w.show == null ? "…" : league ? w.league : w.show;
    return `<div class="pk${w.won ? " won" : ""}"><small>${w.ep}</small>${framed(d.cast[w.pick])}<b>${pts}</b></div>`;
  }).join("");
  return `<div class="pk-grid">${cells}</div>`;
}
