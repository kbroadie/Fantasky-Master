// Standings: last week's result, then one sortable table (Show or League).
// Tapping a row opens that player's ten weekly picks.
import { esc, listing, ord, tier, framed, named, fmtWhen, state } from "../ui.js";

/** The latest episode anyone has a pick for: the "this week" column. */
export const pickWeek = (d) => Math.max(d.weeksScored, ...d.players.map((p) => p.weeks.findLastIndex((w) => w.pick) + 1));

function leaders(d, key) {
  const top = Math.max(...d.players.map((p) => p[key]));
  return { names: listing(d.players.filter((p) => p[key] === top).map((p) => p.name)), top };
}

/** The last scored episode's winner, who called it, and who's leading. */
function lastWeek(d) {
  const e = d.weeksScored;
  if (!e) {
    const first = d.episodes[0];
    return `<div class="last"><div class="last-txt"><span class="kicker">Series ${state.key}</span>
      <b class="last-main">Starts ${esc(fmtWhen.format(first.air))}</b></div></div>`;
  }
  const w = d.winners[e], wk = d.weekly[e], c = d.cast[w.winner];
  const called = wk.hits.length
    ? `${wk.hits.length} of ${wk.voters} called it: <span class="callers">${esc(listing(wk.hits))}</span>`
    : `Nobody called it`;
  const show = leaders(d, "show"), league = leaders(d, "league");
  const verb = (n) => d.complete ? (n.includes(" and ") ? "win" : "wins") : (n.includes(" and ") ? "lead" : "leads");
  const lead = show.names === league.names
    ? `<b>${esc(show.names)}</b> ${verb(show.names)} both boards: ${show.top} Show, ${league.top} League`
    : `<b>${esc(show.names)}</b> ${verb(show.names)} Show (${show.top}) · <b>${esc(league.names)}</b> ${verb(league.names)} League (${league.top})`;
  return `
    <button class="last" data-ep="${e}" aria-label="Open episode ${e}">
      <span class="last-face">${framed(c)}</span>
      <span class="last-txt">
        <span class="kicker">Series ${state.key} · Episode ${e}${d.complete ? " · Final" : ""}</span>
        <span class="last-main">${named(c)} won with ${w.top}</span>
        <span class="last-sub">${called}</span>
      </span>
      <span class="chev" aria-hidden="true"></span>
    </button>
    <p class="lead-line">👑 ${lead}</p>`;
}

export function standingsHead(d) {
  return `
    <div class="hero">${lastWeek(d)}</div>
    <div class="st-head">
      <span class="st-rank">Rank</span>
      <span class="st-name">Player</span>
      <span class="st-pick">Wk ${pickWeek(d)}</span>
      <button class="st-num" data-sort="show">Show<i class="arr"></i></button>
      <button class="st-num" data-sort="league">League<i class="arr"></i></button>
      <span></span>
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
    <div class="pc${rank === 1 ? " lead" : ""}">
      <button class="pc-head" aria-expanded="false">
        <span class="pc-rank"><b class="${tier(rank)}">${rank}</b>${deltaTag(delta)}</span>
        <span class="pc-name">${esc(p.name)}${rank === 1 ? `<span class="crown" role="img" aria-label="leader">👑</span>` : ""}</span>
        ${face}
        <span class="pc-num${tier(p.showRank)}">${p.show}</span>
        <span class="pc-num${tier(p.leagueRank)}">${p.league}</span>
        <span class="chev" aria-hidden="true"></span>
      </button>
      <div class="pc-more"><div>${picks(d, p)}</div></div>
    </div>`;
  }).join("");
}

const deltaTag = (n) => n > 0 ? `<i class="up">↑${n}</i>` : n < 0 ? `<i class="dn">↓${-n}</i>` : `<i class="flat">–</i>`;

function picks(d, p) {
  const league = state.sort === "league";
  const cells = p.weeks.map((w) => {
    if (!w.pick) return `<div class="pk"><small>${w.ep}</small><span class="pk-blank">${w.ep <= d.weeksScored ? "–" : ""}</span><b></b></div>`;
    const pts = w.show == null ? "…" : league ? w.league : w.show;
    return `<div class="pk${w.won ? " won" : ""}"><small>${w.ep}</small>${framed(d.cast[w.pick])}<b>${pts}</b></div>`;
  }).join("");
  const best = p.best ? `best ${p.best.show} with ${esc(p.best.pick)} in ep ${p.best.ep}` : "";
  const hits = p.hits ? `called ${p.hits} winner${p.hits > 1 ? "s" : ""} ★` : "no winners called yet";
  return `<div class="pk-grid">${cells}</div><p class="pk-note">${[hits, best, `${ord(p.showRank)} on Show, ${ord(p.leagueRank)} on League`].filter(Boolean).join(" · ")}</p>`;
}
