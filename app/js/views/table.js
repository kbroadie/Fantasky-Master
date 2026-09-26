// Standings: a "Week 4 Standings" headline, then one sortable table (Show or League).
// Tapping a row opens that player's ten weekly picks.
import { esc, tier, framed, fmtWhen, state } from "../ui.js";
import { GROUP, faceFor } from "../heroes.js";

/** The latest episode anyone has a pick for: the "this week" column. */
export const pickWeek = (d) => Math.max(d.weeksScored, ...d.players.map((p) => p.weeks.findLastIndex((w) => w.pick) + 1));

/** The hero: one headline, "Week 4 Standings", or when the series starts. */
function standingsHero(d) {
  const e = d.weeksScored;
  if (!e) return `<h2 class="ep-title">Series ${state.key} starts</h2><div class="ep-sub">${esc(fmtWhen.format(d.episodes[0].air))}</div>`;
  return `<h2 class="ep-title">Week ${e} Standings</h2>`;
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
        <button class="st-num" data-sort="show"><i class="arr"></i>Show</button>
        <button class="st-num" data-sort="league"><i class="arr"></i>League</button>
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
    const bg = heroRows() && now?.pick ? pickBackdrop(d.cast[now.pick], now.won) : "";
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
 * The row's backdrop: the contestant the player picked this week, cropped
 * from the series' group photo, scaled so every face is the same size (set
 * by the distance between the pupils) and the photo spans the row edge to
 * edge, with the eyes
 * on the centre line of the row's top line and in the gap between the name
 * and the Show column. It covers the whole row, so opening the row just
 * uncovers more of the photo below; nothing moves.
 */
function pickBackdrop(c, won) {
  const f = faceFor(state.key, c.key);
  if (!f) return "";
  return `<span class="pc-bg${won ? " won" : ""}" aria-hidden="true"><img src="${f.src}" alt="" decoding="async" style="--ex:${f.ex};--ey:${f.ey};--size:${f.head};--ar:${f.ratio}"></span>`;
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
