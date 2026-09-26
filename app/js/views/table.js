// Standings: one sortable table (Show or League points). Tapping a row opens
// that player's ten weekly picks.
import { esc, listing, ord, tier, framed, state } from "../ui.js";

/** The latest episode anyone has a pick for: the "this week" column. */
export const pickWeek = (d) => Math.max(d.weeksScored, ...d.players.map((p) => p.weeks.findLastIndex((w) => w.pick) + 1));

export function standingsHead(d) {
  const top = Math.max(...d.players.map((p) => p.show));
  const leaders = d.players.filter((p) => p.show === top).map((p) => p.name);
  const lead = !d.players.length ? "No picks logged yet"
    : d.complete ? `<strong>${esc(listing(leaders))}</strong> ${leaders.length > 1 ? "win" : "wins"} with ${top} points`
    : `<strong>${esc(listing(leaders))}</strong> ${leaders.length > 1 ? "lead" : "leads"} with ${top} points`;
  return `
    <div class="hero">
      <div class="kicker">Series ${state.key} · ${d.complete ? "Final" : `Week ${d.weeksScored}`}</div>
      <h1 class="hero-title">Standings</h1>
      <div class="hero-sub">${lead}</div>
    </div>
    <div class="st-head">
      <span class="st-rank">Rank</span>
      <span class="st-name">Player</span>
      <span class="st-pick">Wk ${pickWeek(d)}</span>
      <button class="st-num" data-sort="show">Show</button>
      <button class="st-num" data-sort="league">League</button>
    </div>
    <div id="rows"></div>`;
}

export function standingsRows(d) {
  const key = state.sort, wk = pickWeek(d);
  const rows = [...d.players].sort((a, b) => state.dir * (a[key] - b[key]) || a[`${key}Rank`] - b[`${key}Rank`] || a.name.localeCompare(b.name));
  return rows.map((p) => {
    const rank = p[`${key}Rank`], delta = p[`${key}Delta`];
    const now = p.weeks[wk - 1];
    const face = now?.pick ? `<span class="mini${now.won ? " won" : ""}">${framed(d.cast[now.pick])}</span>` : `<span class="mini none">–</span>`;
    return `
    <div class="pc${p.showRank === 1 ? " lead" : ""}">
      <button class="pc-head" aria-expanded="false">
        <span class="pc-rank"><b class="${tier(rank)}">${rank}</b>${deltaTag(delta)}</span>
        <span class="pc-name">${esc(p.name)}</span>
        ${face}
        <span class="pc-num${tier(p.showRank)}">${p.show}</span>
        <span class="pc-num${tier(p.leagueRank)}">${p.league}</span>
      </button>
      <div class="pc-more"><div>${picks(d, p)}</div></div>
    </div>`;
  }).join("");
}

const deltaTag = (n) => n > 0 ? `<i class="up">↑${n}</i>` : n < 0 ? `<i class="dn">↓${-n}</i>` : `<i class="flat">–</i>`;

function picks(d, p) {
  const league = state.sort === "league";
  const cells = p.weeks.map((w) => {
    if (!w.pick) return `<div class="pk"><small>E${w.ep}</small><span class="pk-blank">${w.ep <= d.weeksScored ? "–" : ""}</span><b></b></div>`;
    const pts = w.show == null ? "…" : league ? w.league : w.show;
    return `<div class="pk${w.won ? " won" : ""}"><small>E${w.ep}</small>${framed(d.cast[w.pick])}<b>${pts}</b></div>`;
  }).join("");
  const best = p.best ? `best ${p.best.show} with ${esc(p.best.pick)} in E${p.best.ep}` : "";
  const hits = p.hits ? `called ${p.hits} winner${p.hits > 1 ? "s" : ""} ★` : "no winners called yet";
  return `<div class="pk-grid">${cells}</div><p class="pk-note">${[hits, best, `${ord(p.showRank)} on Show, ${ord(p.leagueRank)} on League`].filter(Boolean).join(" · ")}</p>`;
}
