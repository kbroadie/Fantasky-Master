// Standings: a strip of weeks (Ep 1–10), an "Episode 4 Standings" headline and the
// leaders, then both boards side by side as they stood after that week: each
// row is a place, the Show's player on the left and the League's on the right,
// each over their pick that week. A week not yet scored is "Episode 5 Picks":
// the boards as they stand now. Tapping a player opens their ten weekly picks.
import { esc, listing, tier, ord, fmtDay, fmtWhen, state } from "../ui.js";
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
 * A flowing Bézier through every point (Catmull-Rom, as cubic Béziers), for
 * the journey's lines: curvier than the race chart's monotone curve, which
 * runs nearly straight through steadily rising totals. Each control point's
 * height is kept between its two points', so a flat week never dips.
 */
function curve(pts) {
  const f = (v) => v.toFixed(2), clamp = (v, a, b) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));
  let path = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1] || pts[i], [x1, y1] = pts[i], [x2, y2] = pts[i + 1], [x3, y3] = pts[i + 2] || pts[i + 1];
    const c1 = [x1 + (x2 - x0) / 6, clamp(y1 + (y2 - y0) / 6, y1, y2)], c2 = [x2 - (x3 - x1) / 6, clamp(y2 - (y3 - y1) / 6, y1, y2)];
    path += `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(x2)},${f(y2)}`;
  }
  return path;
}

/**
 * An opened half: the player's journey as two comparative line charts, one
 * under each column, with no numbers, only lines, so they show how the
 * player is doing against everyone else at a glance. On the left, Points:
 * their Show running total after each episode, a red line, the plot running
 * from 0 to the leader's total. On the right, Position: their place on the
 * League after each episode, a blue line with 1st at the top. Every other
 * player is a very thin, faint line behind. Five evenly spaced hairline
 * gridlines; both x axes run episode 1 to 10 edge to edge, like the race
 * chart, so the two line up (after episode 1, each player is a dot). The
 * same whichever half was opened. All through the week on show.
 */
function journey(d, p, side, w) {
  const upTo = Math.min(w, d.weeksScored), n = d.players.length, last = d.episodes.length;
  const W = 160, L = 2, R = 158, T = 4, B = 96, H = B + 4, f1 = (v) => v.toFixed(1);
  const x = (e) => L + ((e - 1) / Math.max(1, last - 1)) * (R - L);
  const grid = [0, 1, 2, 3, 4].map((i) => { const gy = f1(T + (i / 4) * (B - T)); return `<line class="rc-grid" x1="${L}" x2="${R}" y1="${gy}" y2="${gy}"/>`; }).join("");
  // One chart: every player's line through the episodes so far, the opened
  // player's drawn last. A line of one point (after episode 1) is a dot.
  const chart = (cls, title, y, say) => {
    const pts = (q) => [...Array.from({ length: upTo }, (_, i) => [x(i + 1), y(q, i + 1)])];
    const line = (q) => { const v = pts(q); return v.length > 1 ? `d="${curve(v)}"` : ""; };
    const dot = (q, r) => { const v = pts(q); return v.length === 1 ? `<circle cx="${f1(v[0][0])}" cy="${f1(v[0][1])}" r="${r}"/>` : ""; };
    const others = d.players.filter((q) => q.name !== p.name);
    const lines = upTo ? `<g class="jr-others">${others.map((q) => `<path ${line(q)}/>${dot(q, 1)}`).join("")}</g>`
      + `<g class="jr-me"><path pathLength="1" ${line(p)}/>${dot(p, 2.5)}</g>` : "";
    return `<div class="jr-c ${cls}"><p class="jr-t">${title}</p><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(say)}">${grid}${lines}</svg></div>`;
  };
  const show = (q, e) => q.history[e - 1].show, place = (q, e) => q.history[e - 1].leagueRank;
  const top = upTo ? Math.max(1, ...d.players.map((q) => show(q, upTo))) : 1;
  const now = upTo && p.history[upTo - 1];
  const points = chart("show", "Points", (q, e) => B - (show(q, e) / top) * (B - T),
    now ? `${p.name}'s Show points after each episode, ${ord(now.showRank)} after episode ${upTo}, against the other players` : `${p.name}: no episodes scored yet`);
  const position = chart("league", "Position", (q, e) => T + ((place(q, e) - 1) / Math.max(1, n - 1)) * (B - T),
    now ? `${p.name}'s League position after each episode, ${ord(now.leagueRank)} after episode ${upTo}, against the other players` : `${p.name}: no episodes scored yet`);
  return `<div class="jr">
    <p class="jr-key" aria-hidden="true"><span><i class="me"></i>${esc(p.name)}</span><span><i></i>Others</span></p>
    <div class="jr-two">${points}${position}</div>
  </div>`;
}
