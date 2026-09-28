// Standings: a strip of weeks (Ep 1–10), an "Episode 4 Standings" headline and the
// leaders, then both boards side by side as they stood after that week: each
// row is a place, the Show's player on the left and the League's on the right,
// each over their pick that week. A week not yet scored is "Episode 5 Picks":
// the boards as they stand now. Tapping a player opens their ten weekly picks.
import { esc, listing, tier, ord, framed, smooth, fmtDay, fmtWhen, state } from "../ui.js";
import { GROUP, faceFor, NO_PICK } from "../heroes.js";
import { pickChooser } from "../edit.js";

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

/** Series with a group photo show the week's pick as each row's backdrop. */
const heroRows = () => !!GROUP[state.key]?.faces;

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
  return !p ? "" : state.edit ? pickChooser(d, p, w) : journey(d, p, side, w);
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
 * An opened half: the player's journey on that board. Their place after each
 * episode as a line in the board's colour, each week's pick sitting on it as a
 * little framed portrait with the points it scored (gold glow if it won the
 * episode), the latest place in a chip above, a gold dashed "1st" summit line,
 * and three facts above: winners called and the best pick or podiums, then
 * points missed against each episode's winner (Show) or the average finish
 * (League). All through
 * the week on show; picks already in for later weeks wait, faint, beyond it.
 */
function journey(d, p, side, w) {
  const k = side === "show" ? "show" : "league", n = d.players.length, upTo = Math.min(w, d.weeksScored);
  const played = p.weeks.filter((x) => x.ep <= upTo && x.show != null);
  const called = played.filter((x) => x.won).length;
  const fact = (label, value) => `<div class="jr-fact"><small>${label}</small><b>${value}</b></div>`;
  const best = [...played].sort((a, b) => b[k] - a[k] || b.show - a.show)[0];
  const facts = [fact("Called", played.length ? `${called}<i> of ${played.length}</i>` : "–")];
  if (k === "show") {
    facts.push(fact("Best pick", best ? `${esc(best.pick)} <i>${best.show}</i>` : "–"));
    facts.push(fact("Missed", played.length ? `${played.reduce((a, x) => a + (x.missed || 0), 0)}<i> pts</i>` : "–"));
  } else {
    const podiums = played.filter((x) => x.place <= 3).length;
    facts.push(fact("Podiums", played.length ? `${podiums}<i> of ${played.length}</i>` : "–"));
    facts.push(fact("Avg finish", played.length ? (played.reduce((a, x) => a + x.place, 0) / played.length).toFixed(1) : "–"));
  }
  // The plot: column i (episode i + 1) across, place down (1st at the top).
  const X = (e) => ((e - .5) / d.episodes.length) * 100, Y = (r) => (n > 1 ? ((r - 1) / (n - 1)) * 100 : 50);
  const pts = [];
  const cells = p.weeks.map((x) => {
    const e = x.ep, done = e <= upTo, r = done ? p.history[e - 1][`${k}Rank`] : null;
    if (done) pts.push([X(e), Y(r)]);
    const y = done ? Y(r) : (pts.length ? pts.at(-1)[1] : 50);
    const face = x.pick ? framed(d.cast[x.pick]) : `<span class="pk-blank">–</span>`;
    const got = done ? (x.pick ? x[k] : 0) : "";
    const cls = `jr-pt${done ? "" : " later"}${done && x.won ? " won" : ""}${e === upTo ? " now" : ""}`;
    const chip = e === upTo ? `<i class="jr-rk">${ord(r)}</i>` : "";
    return (x.pick || done) ? `<span class="${cls}" style="--x:${X(e).toFixed(2)}%;--y:${y.toFixed(2)}%;--i:${e}">${chip}${face}<b>${done ? `+${got}` : ""}</b></span>` : "";
  }).join("");
  const eps = d.episodes.map(({ ep }) => `<span class="${ep === upTo ? "now" : ep < upTo ? "" : "later"}" style="--x:${X(ep).toFixed(2)}%">${ep}</span>`).join("");
  return `<div class="jr ${k}">
    <div class="jr-facts">${facts.join("")}</div>
    <div class="jr-plot">
      <i class="jr-top" aria-hidden="true"><em>1st</em></i>
      ${pts.length > 1 ? `<svg class="jr-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="glow" d="${smooth(pts)}" pathLength="1"/><path d="${smooth(pts)}" pathLength="1"/></svg>` : ""}
      ${cells}
    </div>
    <div class="jr-eps" aria-hidden="true">${eps}</div>
  </div>`;
}
