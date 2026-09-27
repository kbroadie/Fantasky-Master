// Standings: a strip of weeks (Wk 1–10), a "Week 4 Standings" headline and the
// leaders, then one sortable table (Show or League) as it stood after that week.
// A week not yet scored is "Week 5 Picks": the table as it stands now, each row
// behind that week's pick. Tapping a row opens that player's ten weekly picks.
import { esc, listing, tier, framed, fmtWhen, state } from "../ui.js";
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

/** Tap "Show" or "League" in the leaders line to open a line explaining it. */
const TERMS = {
  // A label, then two paragraphs. The ranges are held together (no-break
  // spaces, and word joiners around the dash, a break point otherwise), so
  // "(0–25 pts per episode)" is never split across lines.
  show: ["Show score", "The player with the most task points at the end of the series wins, regardless of episode placements.", "The broad scoring range (0\u2060–\u206025\u00a0pts\u00a0per\u00a0episode) rewards blowouts."],
  league: ["League score", "The player with the highest average episode placement wins, regardless of task points.", "The narrow scoring range (1\u2060–\u20605\u00a0pts\u00a0per\u00a0episode) rewards consistency."],
};
const term = (key, label) => `<button class="st-term" data-term="${key}" aria-expanded="false">${label}</button>`;

/** "Riley leads the Show   Jamie leads the League" ("wins" once the series is over). */
function leaderLine(d, rows, w) {
  const show = leaders(rows, "show"), league = leaders(rows, "league"), final = d.complete && w === d.episodes.length;
  const verb = (names) => (final ? (names.length > 1 ? "win" : "wins") : (names.length > 1 ? "lead" : "leads"));
  const who = (names) => `<b>${esc(listing(names))}</b>`;
  const S = term("show", "Show"), L = term("league", "League");
  if (listing(show) === listing(league)) return `<span>${who(show)} ${verb(show)} the ${S} and the ${L}</span>`;
  return `<span>${who(show)} ${verb(show)} the ${S}</span><span>${who(league)} ${verb(league)} the ${L}</span>`;
}

/**
 * The hero: "Week 4 Standings" and who leads each board ("Week 5 Picks" for a
 * week not yet scored), or when the series starts.
 */
export function standingsHero(d) {
  const w = stWeek(d);
  if (!d.weeksScored) return `<h2 class="ep-title">Week ${w} Picks</h2><div class="ep-sub">Series ${state.key} starts ${esc(fmtWhen.format(d.episodes[0].air))}</div>`;
  return `<h2 class="ep-title">Week ${w} ${w > d.weeksScored ? "Picks" : "Standings"}</h2><p class="st-leaders">${leaderLine(d, atWeek(d, w), w)}</p>
    <div class="st-explain"><div>${Object.entries(TERMS).map(([k, t]) => `<p data-for="${k}"><b>${esc(t[0])}</b><span>${esc(t[1])}</span><span>${esc(t[2])}</span></p>`).join("")}</div></div>`;
}

/** Series with a group photo show the week's pick as each row's backdrop. */
const heroRows = () => !!GROUP[state.key]?.faces;

/** Wk 1–10, like the episode strip; weeks not yet scored are faint. */
export const weekTabs = (d) => d.episodes.map(({ ep }) =>
  `<button class="strip-tab${ep > d.weeksScored ? " tbd" : ""}" data-week="${ep}">Wk ${ep}</button>`).join("");

export function standingsHead(d) {
  return `
    <div class="strip scroll" id="st-tabs">${weekTabs(d)}</div>
    <div class="hero st-hero">${standingsHero(d)}</div>
    <div class="card board">
      <div class="st-head">
        <span class="st-rank">Rank</span>
        <button class="st-name" data-sort="name"><span>Player<i class="arr"></i></span></button>
        <button class="st-num" data-sort="show"><span><i class="arr"></i>Show</span></button>
        <button class="st-num" data-sort="league"><span><i class="arr"></i>League</span></button>
        <span></span>
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
