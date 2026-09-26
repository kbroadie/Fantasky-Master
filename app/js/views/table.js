// Standings: a "Week 4 Standings" headline and the leaders, then one sortable table (Show or League).
// Tapping a row opens that player's ten weekly picks.
import { esc, listing, tier, framed, fmtWhen, state } from "../ui.js";
import { GROUP, faceFor, NO_PICK } from "../heroes.js";

/** The latest episode anyone has a pick for: the "this week" column. */
export const pickWeek = (d) => Math.max(d.weeksScored, ...d.players.map((p) => p.weeks.findLastIndex((w) => w.pick) + 1));

/** Everyone on the top score of a board (ties share the lead). */
function leaders(d, key) {
  const top = Math.max(...d.players.map((p) => p[key]));
  return d.players.filter((p) => p[key] === top).map((p) => p.name);
}

/** Tap "Show" or "League" in the leaders line to open a line explaining it. */
const TERMS = {
  show: "Show points: what your pick scored that episode.",
  league: "League points: 5 if your pick wins, down to 1 for last.",
};
const term = (key, label) => `<button class="st-term" data-term="${key}" aria-expanded="false">${label}</button>`;

/** "Riley leads the Show   Jamie leads the League" ("wins" once the series is over). */
function leaderLine(d) {
  const show = leaders(d, "show"), league = leaders(d, "league");
  const verb = (names) => (d.complete ? (names.length > 1 ? "win" : "wins") : (names.length > 1 ? "lead" : "leads"));
  const who = (names) => `<b>${esc(listing(names))}</b>`;
  const S = term("show", "Show"), L = term("league", "League");
  if (listing(show) === listing(league)) return `<span>${who(show)} ${verb(show)} the ${S} and the ${L}</span>`;
  return `<span>${who(show)} ${verb(show)} the ${S}</span><span>${who(league)} ${verb(league)} the ${L}</span>`;
}

/** The hero: "Week 4 Standings" and who leads each board, or when the series starts. */
function standingsHero(d) {
  const e = d.weeksScored;
  if (!e) return `<h2 class="ep-title">Series ${state.key} starts</h2><div class="ep-sub">${esc(fmtWhen.format(d.episodes[0].air))}</div>`;
  return `<h2 class="ep-title">Week ${e} Standings</h2><p class="st-leaders">${leaderLine(d)}</p>
    <div class="st-explain"><div>${Object.entries(TERMS).map(([k, t]) => `<p data-for="${k}">${t}</p>`).join("")}</div></div>`;
}

/** Series with a group photo show the week's pick as each row's backdrop. */
const heroRows = () => !!GROUP[state.key]?.faces;

export function standingsHead(d) {
  return `
    <div class="hero st-hero">${standingsHero(d)}</div>
    <div class="card board">
      <div class="st-head">
        <span class="st-rank">Rank</span>
        <span class="st-name">Player</span>
        <button class="st-num" data-sort="show"><span><i class="arr"></i>Show</span></button>
        <button class="st-num" data-sort="league"><span><i class="arr"></i>League</span></button>
        <span></span>
      </div>
      <div id="rows"></div>
    </div>`;
}

export function standingsRows(d) {
  const key = state.sort, wk = pickWeek(d);
  const rows = [...d.players].sort((a, b) => state.dir * (a[key] - b[key]) || a[`${key}Rank`] - b[`${key}Rank`] || a.name.localeCompare(b.name));
  return rows.map((p) => {
    const rank = p[`${key}Rank`], delta = p[`${key}Delta`];
    const now = p.weeks[wk - 1];
    // No pick that week: Patatas stands in.
    const face = !heroRows() ? null : now?.pick ? faceFor(state.key, now.pick) : NO_PICK;
    const bg = face ? pickBackdrop(face, frost(rank, d.players.length)) : "";
    return `
    <div class="pc${rank === 1 ? " lead" : ""}">
      ${bg}
      <button class="pc-head" aria-expanded="false">
        <span class="pc-rank"><b class="${tier(rank)}">${rank}</b>${deltaTag(delta)}</span>
        <span class="pc-name"><span class="nm">${esc(p.name)}</span></span>
        <span class="pc-num${tier(p.showRank)}">${p.show}</span>
        <span class="pc-num${tier(p.leagueRank)}">${p.league}</span>
        <span class="chev" aria-hidden="true"></span>
      </button>
      <div class="pc-more"><div>${picks(d, p)}</div></div>
    </div>`;
  }).join("");
}

/**
 * The backdrop's frosted glass, by rank on the active board: the leader's
 * photo is lightly frosted (3px blur) and each place down a little more, to
 * 9px for last. Colour is untouched. Opening the row clears it (.pc.open).
 */
function frost(rank, n) {
  const t = n > 1 ? (rank - 1) / (n - 1) : 0;
  return `${(3 + 6 * t).toFixed(1)}px`;
}

/**
 * The row's backdrop: the contestant the player picked this week (or
 * Patatas if they didn't pick), cropped from their photo, scaled so every head is the same size and
 * the photo spans the row edge to edge, with the eyes on the centre line of
 * the row's top line and in the gap between the name and the Show column.
 * It covers the whole row, so opening the row just uncovers more of the
 * photo below; nothing moves. Frosted by rank (frost) until the row opens.
 */
function pickBackdrop(f, blur) {
  const vars = `--blur:${blur};--ex:${f.ex};--ey:${f.ey};--size:${f.head};--ar:${f.ratio}${f.cap ? `;--cap:${f.cap}` : ""}`;
  return `<span class="pc-bg" aria-hidden="true" style="${vars}"><img src="${f.src}" alt="" decoding="async">${f.cap ? `<i class="edge"></i>` : ""}</span>`;
}

const deltaTag = (n) => n > 0 ? `<i class="up">↑${n}</i>` : n < 0 ? `<i class="dn">↓${-n}</i>` : `<i class="flat">–</i>`;

function picks(d, p) {
  const league = state.sort === "league";
  const cells = p.weeks.map((w) => {
    if (!w.pick) return `<div class="pk"><small>${w.ep}</small><span class="pk-blank">${w.ep <= d.weeksScored ? "–" : ""}</span><b></b></div>`;
    const pts = w.show == null ? "…" : league ? w.league : w.show;
    return `<div class="pk${w.won ? " won" : ""}"><small>${w.ep}</small>${framed(d.cast[w.pick])}<b>${pts}</b></div>`;
  }).join("");
  return `<div class="pk-grid">${cells}</div>`;
}
