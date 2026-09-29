// Standings: a strip of weeks (Ep 1–10), an "Episode 4 Standings" headline and the
// leaders, then both boards side by side as they stood after that week: each
// row is a place, the Show's player on the left and the League's on the right,
// each over their pick that week. A week not yet scored is "Episode 5 Picks":
// the boards as they stand now. Tapping a player opens their ten weekly picks.
import { esc, listing, tier, ord, fmtDay, fmtWhen, smooth, niceStep, state } from "../ui.js";
import { GROUP, faceFor, NO_PICK } from "../heroes.js";
import { pickChooser } from "../edit.js";
import { barsCard, median } from "./cast.js";

/** The week on show: state.wk, or the latest scored week. */
export const stWeek = (d) => Math.min(Math.max(1, state.wk || d.weeksScored), d.episodes.length);

/**
 * Each player as the table stood after week w: totals and ranks (from
 * league.js's per-week history).
 */
export function atWeek(d, w) {
  // Weeks not yet scored: the table as it stands now.
  if (w > d.weeksScored) return d.weeksScored ? atWeek(d, d.weeksScored) : d.players;
  return d.players.map((p) => {
    const h = p.history[w - 1];
    return { ...p, show: h.show, league: h.league, showRank: h.showRank, leagueRank: h.leagueRank };
  });
}

/** Both boards at week w, each highest first (then by rank and name). */
export function boards(d, w) {
  const rows = atWeek(d, w);
  const by = (k) => [...rows].sort((a, b) => b[k] - a[k] || a[`${k}Rank`] - b[`${k}Rank`] || a.name.localeCompare(b.name));
  return { show: by("show"), league: by("league") };
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
 * The hero: "Episode 4 Standings" and who leads each board ("Episode 5 Picks" for a
 * week not yet scored), or when the series starts.
 */
export function standingsHero(d) {
  const w = stWeek(d);
  const how = `<button type="button" class="st-how" aria-expanded="${state.how}" aria-controls="st-explain">How scoring works<i class="st-how-chev" aria-hidden="true"></i></button>
    <div class="st-explain" id="st-explain"><div><div class="how-grid">${TERMS.map(howCard).join("")}</div></div></div>`;
  // The kicker, like the episode head's: the series and that week's episode.
  const kicker = `<div class="kicker">Series ${esc(state.key)} · ${esc(fmtDay.format(d.episodes[w - 1].air))}</div>`;
  if (!d.weeksScored) return `${kicker}<h2 class="ep-title">Episode ${w} Picks</h2><div class="ep-sub">The series starts ${esc(fmtWhen.format(d.episodes[0].air))}</div>${how}`;
  return `${kicker}<h2 class="ep-title">${w > d.weeksScored ? `Episode ${w} Picks` : `Episode ${w} Standings`}</h2><p class="st-leaders">${leaderLine(d, atWeek(d, w), w)}</p>${how}`;
}

/** Series with a group photo show the week's pick as each row's backdrop.
 *  Off for now (on request); set ROW_PHOTOS to bring them back. */
const ROW_PHOTOS = false;
const heroRows = () => ROW_PHOTOS && !!GROUP[state.key]?.faces;

/** Ep 1–10, like the episode strip; weeks not yet scored are faint. */
export const weekTabs = (d) => d.episodes.map(({ ep }) =>
  `<button class="strip-tab${ep > d.weeksScored ? " tbd" : ""}" data-week="${ep}">Ep ${ep}</button>`).join("");

export function standingsHead(d) {
  return `
    <div class="strip scroll" id="st-tabs">${weekTabs(d)}</div>
    <div class="hero st-hero${state.how ? " explain" : ""}">${standingsHero(d)}</div>
    <div class="card board">
      <div class="st-head">
        <span class="st-rk" aria-hidden="true"></span>
        <span class="st-side show"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="${HOW_ICONS.crown}"/></svg>Show</span>
        <span class="st-side league"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="${HOW_ICONS.trophy}"/></svg>League</span>
      </div>
      <div id="rows"></div>
    </div>`;
}

/**
 * One row per place: the place number in a fixed column at the left (it never
 * moves or changes), then the Show's player at that place and
 * the League's, each as name then points. Each half is a button that opens that player's
 * picks (rowMore). Rows are keyed by place; each half by player (data-p), so
 * a week change can slide each player to their new place (patchRows).
 */
export function standingsRows(d) {
  const w = stWeek(d), { show, league } = boards(d, w);
  const half = (p, side) => {
    const k = side === "show" ? "show" : "league", rank = p[`${k}Rank`];
    const num = `<span class="pc-num${rank === 1 ? " t1" : ""}">${p[k]}</span>`;
    const name = `<span class="pc-name"><span class="nm">${esc(p.name)}</span><svg class="chev" viewBox="0 0 10 6" aria-hidden="true"><path d="M1.25 1.25 5 4.75l3.75-3.5"/></svg></span>`;
    return `<button class="sd ${side === "show" ? "l" : "r"}" type="button" data-side="${side}" data-p="${esc(p.name)}" aria-expanded="false" aria-label="${esc(`${p.name}, ${ord(rank)} in the ${side === "show" ? "Show" : "League"} with ${p[k]} points`)}">${name + num}</button>`;
  };
  return show.map((l, i) => {
    const r = league[i];
    const bg = heroRows() ? pickBackdrop(faceOf(l, w), faceOf(r, w)) : "";
    return `
    <div class="pc${l.showRank === 1 || r.leagueRank === 1 ? " lead" : ""}">
      ${bg}
      <div class="pc-head"><span class="pc-rank"><b class="${tier(i + 1)}">${i + 1}</b></span>${half(l, "show")}${half(r, "league")}</div>
      <div class="pc-more"><div></div></div>
    </div>`;
  }).join("");
}

/** A player's pick that week, or Patatas if they didn't pick (or it isn't in yet). */
function faceOf(p, w) {
  const now = p.weeks[w - 1];
  return now?.pick ? faceFor(state.key, now.pick) : NO_PICK;
}

/** What an opened half shows: the player's ten picks (their chooser in edit mode). */
export function rowMore(d, name, side) {
  const w = stWeek(d), p = atWeek(d, w).find((x) => x.name === name);
  if (!p) return "";
  if (state.edit) return pickChooser(d, p, w);
  return `<div class="xp">${side === "show" ? showCards(d, p, w) : raceCard(d, p, w)}</div>`;
}

/**
 * An opened Show half: the Cast tab's Points per episode card, for the
 * player's picks. Each bar is the Show points their pick scored that
 * episode, in the pick's colour (a gold number for a pick that won, no
 * crown), with the pick's first three letters under it, above the episode
 * number, on the same scale as the Cast tab, with the median of every
 * player's weekly Show points. Through the week on show.
 */
function showCards(d, p, w) {
  const upTo = Math.min(w, d.weeksScored);
  const max = Math.max(1, ...d.contestants.flatMap((c) => c.eps.slice(0, d.weeksScored)));
  const all = d.players.flatMap((q) => q.weeks.filter((x) => x.scored && x.ep <= upTo && x.pick).map((x) => x.show));
  const at = (ep) => {
    const x = p.weeks[ep - 1];
    if (!x || ep > upTo) return null;
    return { v: x.pick ? x.show : 0, won: !!x.won, color: x.pick ? d.cast[x.pick].color : "var(--t4)", tag: x.pick ? x.pick.slice(0, 3) : "–" };
  };
  return barsCard(d, at, max, median(all), "var(--show-hi)", false);
}

/**
 * An opened League half: the Episodes tab's "The race so far" card, for the
 * League: every player's gap to the League leader, only the opened player's
 * line highlighted (journey).
 */
function raceCard(d, p, w) {
  // How far behind the League leader they are that week, in the legend's own type.
  const upTo = Math.min(w, d.weeksScored), pts = (q) => q.history[upTo - 1].league;
  const behind = upTo ? Math.max(...d.players.map(pts)) - pts(p) : null;
  return `<div class="card jr-card">
      <div class="card-head"><span>The race so far</span><span class="legend">${behind == null ? "" : `${behind} `}behind the leader</span></div>
      ${journey(d, p, "league", w)}
    </div>`;
}

/**
 * The row's backdrop: both players' picks, the Show's on the left and the
 * League's on the right, each cropped from their photo and scaled so every
 * head is the same size, with the eyes on the centre line of the row's top
 * line and in the middle of their half. The left photo cross-fades into the
 * right one across the middle of the row (.pf.r's mask). It covers the whole
 * row, so opening the row just uncovers more of the photos below; nothing
 * moves. Frosted (.pc-bg) until the row opens.
 */
function pickBackdrop(lf, rf) {
  const face = (f, side) => `<span class="pf ${side}" style="--ex:${f.ex};--ey:${f.ey};--size:${f.head};--ar:${f.ratio}${f.cap ? `;--cap:${f.cap}` : ""}"><img src="${f.src}" alt="" decoding="async">${f.cap ? `<i class="edge"></i>` : ""}</span>`;
  return `<span class="pc-bg" aria-hidden="true">${face(lf, "l")}${face(rf, "r")}</span>`;
}


/**
 * An opened half: the race chart from the Episodes tab ("The race so far"),
 * for the players on the opened board, across the full width of the row.
 * Each player's gap to the board's leader in points after every episode: the
 * leader runs flat along the top, everyone else below, over the race chart's
 * gridlines (tidy steps from niceStep, none at 0), smoothed the same way
 * (`smooth`, monotone). Only the opened player is highlighted: their line in
 * the board's colour; every other player is a very thin, faint line. No line
 * labels. The x axis runs episode 1 to 10 edge to edge (this week in gold,
 * later ones faint). The plot is stretched to the row (SVG with
 * preserveAspectRatio none and non-scaling strokes); the gridlines and axis
 * are HTML so they never stretch. All through the week on show.
 */
function journey(d, p, side, w) {
  const k = side === "show" ? "show" : "league", upTo = Math.min(w, d.weeksScored), last = d.episodes.length;
  const eps = Array.from({ length: upTo }, (_, i) => i + 1);
  const total = (q, e) => q.history[e - 1][k];
  const best = (e) => Math.max(...d.players.map((q) => total(q, e)));
  const gap = (q, e) => total(q, e) - best(e);
  const deepest = Math.max(1, ...eps.flatMap((e) => d.players.map((q) => -gap(q, e))));
  const step = niceStep(deepest), yMin = -Math.ceil(deepest / step) * step;
  const x = (e) => ((e - 1) / Math.max(1, last - 1)) * 100, y = (v) => (v / yMin) * 100, f = (v) => v.toFixed(2);
  const grid = Array.from({ length: Math.round(-yMin / step) }, (_, i) => `<i class="jr-grid" style="--y:${f(y(-(i + 1) * step))}%"></i>`).join("");
  const pts = (q) => eps.map((e) => [x(e), y(gap(q, e))]);
  const others = d.players.filter((q) => q.name !== p.name);
  const svg = (cls, paths) => `<svg class="jr-lines ${cls}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>`;
  const lines = upTo > 1 ? svg("jr-others", others.map((q) => `<path d="${smooth(pts(q))}"/>`).join("")) + svg("jr-me", `<path d="${smooth(pts(p))}"/>`)
    // Episode 1, with no lines yet, keeps dots (as the race chart does).
    : upTo ? others.map((q) => `<i class="jr-dot" style="--x:0%;--y:${f(y(gap(q, 1)))}%"></i>`).join("") + `<i class="jr-dot me" style="--x:0%;--y:${f(y(gap(p, 1)))}%"></i>` : "";
  const g = upTo ? gap(p, upTo) : 0;
  const axis = d.episodes.map(({ ep }) => `<span class="${ep === upTo ? "now" : ep > upTo ? "later" : ""}" style="--x:${f(x(ep))}%">${ep}</span>`).join("");
  const board = k === "show" ? "Show" : "League";
  const say = upTo ? `${p.name}: ${g ? `${-g} ${board} points behind the leader` : `leads the ${board} on ${total(p, upTo)}`} after episode ${upTo}, ${ord(p.history[upTo - 1][`${k}Rank`])}` : `${p.name}: no episodes scored yet`;
  return `<div class="jr ${k}" role="img" aria-label="${esc(say)}">
    <div class="jr-plot">${grid}${lines}<div class="jr-ax" aria-hidden="true">${axis}</div></div>
  </div>`;
}
