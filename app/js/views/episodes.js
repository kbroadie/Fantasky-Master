// Episodes: a scrollable Ep 1–10 strip (a dot in each winner's colour) above
// swipeable episode slides. Everywhere on the tab the cast sit in their studio
// seat order (1–5, from the all-time stats): the portraits, the task-table
// columns (each under its portrait) and the ballot.
import { esc, ord, listing, framed, named, fmtDay, fmtWhen, untilText, icon, state } from "../ui.js";
import { statsFor } from "../alltime.js";
import { rankWithTies } from "../league.js";

/** The cast in seat order; the CSV's order if the stats aren't loaded. */
function seated(d) {
  const seat = (n) => +(statsFor(state.allTime, state.key, d.cast[n].full)?.seat || 99);
  return [...d.names].sort((a, b) => seat(a) - seat(b) || d.names.indexOf(a) - d.names.indexOf(b));
}

export const epTabs = (d) => d.episodes.map((e) => {
  const w = d.winners[e.ep];
  const dot = w ? `<i class="dot" style="background:${d.cast[w.winner].color}" aria-hidden="true"></i>` : "";
  return `<button class="strip-tab${e.ep > d.weeksScored ? " tbd" : ""}" data-slide="${e.ep - 1}">${dot}Ep ${e.ep}</button>`;
}).join("");

export const epSlides = (d) => d.episodes.map((e) => `<section class="slide">${slide(d, e)}</section>`).join("");

function upcoming(d, e) {
  if (e.ep <= d.weeksAired) {
    return `<div class="card soon"><p class="soon-main">Results coming soon</p><p class="soon-sub">Aired ${esc(fmtWhen.format(e.air))}</p></div>`;
  }
  // Every future episode: when its poll closes, and the five contestants.
  return `
    <div class="card soon${d.nextEp?.ep === e.ep ? " next" : ""}">
      <p class="soon-sub">Who wins Episode ${e.ep}? The poll closes</p>
      <p class="soon-main">${esc(fmtWhen.format(e.air))}</p>
      <p class="soon-left">in ${untilText(e.air - Date.now())}</p>
      <div class="ballot">${seated(d).map((n) => `<span>${framed(d.cast[n])}<b style="color:${d.cast[n].color}">${esc(n)}</b></span>`).join("")}</div>
    </div>`;
}

function slide(d, e) {
  const head = (line) => `
    <div class="ep-head">
      <div class="kicker">Episode ${e.ep} · ${esc(fmtDay.format(e.air))}</div>
      <h2 class="ep-title">${esc(e.title || `Episode ${e.ep}`)}</h2>
      <div class="ep-sub">${line}</div>
    </div>`;
  if (e.ep > d.weeksScored) {
    const line = e.ep <= d.weeksAired ? "Aired · results coming soon" : d.nextEp?.ep === e.ep ? "Up next · poll open" : "Awaiting broadcast";
    return head(line) + `<div class="ep-body">${upcoming(d, e)}</div>`;
  }

  const w = d.winners[e.ep], wk = d.weekly[e.ep], pts = (n) => d.EPS[n][e.ep];
  const called = wk.hits.length;
  const line = `Won by ${named(d.cast[w.winner])} with ${w.top}${w.tiebreak ? " after a tiebreak" : ""}`
    + ` · ${called ? `${called} of ${wk.voters} called it` : "nobody called it"}`;

  const order = seated(d);
  const col = order.map((n) => d.idx[n]);
  // Last place (sharing it counts) gets the stink; the winner gets the gold
  // light. Both effects are drawn by podium-fx.js.
  const bottom = Math.max(...d.names.map((n) => d.placing[e.ep][n]));
  const isLast = (n) => n !== w.winner && d.placing[e.ep][n] === bottom;

  const pod = order.map((n) => {
    const backers = wk.by[n].length, win = n === w.winner, last = isLast(n);
    return `
    <div class="pod-col${win ? " win" : last ? " last" : ""}"${last ? ` aria-label="${esc(n)}, last place"` : ""}>
      ${framed(d.cast[n])}
      <span class="pod-name" style="color:${d.cast[n].color}">${esc(n)}</span>
      <b class="pod-pts">${pts(n)}</b>
      <span class="pod-picks">${backers ? `${backers} pick${backers > 1 ? "s" : ""}` : "no picks"}</span>
    </div>`;
  }).join("");

  const tasks = d.epTasks(e.ep);
  const table = `
    <div class="card tt-wrap"><table class="tt">
      <thead><tr><th>Task</th>${order.map((n) => `<th style="color:${d.cast[n].color}">${esc(n.slice(0, 3))}</th>`).join("")}</tr></thead>
      <tbody>${tasks.map((t) => {
        const s = col.map((i) => t.s[i]), hi = Math.max(...s), lo = Math.min(...s);
        return `<tr><td><span class="tn">${icon(t.t)}<span class="tname" title="${esc(t.n)}">${esc(t.n)}</span></span></td>${s.map((v) =>
          `<td class="sc${hi > lo && v === hi ? " best" : hi > lo && v === lo ? " worst" : ""}">${v}</td>`).join("")}</tr>`;
      }).join("")}
      <tr class="tot"><td>Total</td>${order.map((n) => `<td class="${n === w.winner ? "best" : ""}">${pts(n)}</td>`).join("")}</tr></tbody>
    </table></div>`;

  return head(line) + `<div class="ep-body"><div class="pod">${pod}</div>${table}${raceChart(d, e.ep)}</div>`;
}

// ── The race so far ─────────────────────────────────────────────────────────
// How far each contestant is behind the leader after every episode up to this
// one (the leader runs flat along 0 at the top; the x axis always runs 1 to
// 10, so the race builds rightwards week by week): a smooth line in their colour (a monotone cubic Bézier, so it
// never overshoots a point, e.g. above the leader's 0 or past a real low),
// labelled at the
// end with the first three letters of their name, like the task table's
// columns, and their gap (the leader's total). Tap a line to bring it
// forward and fade the rest; tap a point to read it in the caption.

/** A monotone cubic Bézier path through points sorted by x (Fritsch–Carlson). */
function smooth(pts) {
  const n = pts.length, f1 = (v) => v.toFixed(1);
  if (n < 3) return `M${pts.map(([x, y]) => `${f1(x)},${f1(y)}`).join("L")}`;
  const dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], h = dx[i] / 3;
    d += `C${f1(x0 + h)},${f1(y0 + t[i] * h)} ${f1(x1 - h)},${f1(y1 - t[i + 1] * h)} ${f1(x1)},${f1(y1)}`;
  }
  return d;
}

/** A tidy axis step (1, 2, 2.5 or 5 × 10ⁿ) giving at most five gridlines. */
function niceStep(max) {
  const raw = max / 4, p = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw);
}

function raceChart(d, upTo) {
  const names = d.names, eps = Array.from({ length: upTo }, (_, i) => i + 1);
  const total = Object.fromEntries(names.map((n) => [n, [0]]));
  for (const e of eps) for (const n of names) total[n][e] = total[n][e - 1] + d.EPS[n][e];
  // The gap to the leader after each episode: 0 for the leader, negative below.
  const best = Object.fromEntries(eps.map((e) => [e, Math.max(...names.map((n) => total[n][e]))]));
  const gap = (n, e) => total[n][e] - best[e];
  const leaders = (e) => names.filter((n) => !gap(n, e));
  const sorted = (e) => [...names].sort((a, b) => total[b][e] - total[a][e]);
  const rank = (e, name) => rankWithTies(sorted(e), (n) => total[n][e]).get(name);
  const deepest = Math.max(1, ...eps.flatMap((e) => names.map((n) => -gap(n, e))));
  const step = niceStep(deepest), yMin = -Math.ceil(deepest / step) * step;
  const W = 340, L = 10, R = 330, T = 12, B = 160, H = B + 24; // the plot fills the card
  // The x axis always runs 1 to 10: the race starts at the left edge and
  // builds to the right week by week; episodes still to come are faint.
  // The plot fills the card (to R); only when this episode's dots would leave
  // too little room for their labels (about 66 units: "JOA 165", so episodes
  // 9 and 10) does the axis tighten just enough to keep them to the right.
  const last = d.episodes.length, LBL = 66;
  const xEnd = Math.min(R, L + (W - LBL - L) * (last - 1) / Math.max(1, upTo - 1));
  const x = (e) => L + ((e - 1) / (last - 1)) * (xEnd - L), y = (v) => T + (v / yMin) * (B - T);
  const f1 = (v) => v.toFixed(1);
  const ticks = Array.from({ length: Math.round(-yMin / step) + 1 }, (_, i) => -i * step);
  const grid = ticks.filter((v) => v).map((v) => `<line class="rc-grid" x1="${L}" x2="${R}" y1="${f1(y(v))}" y2="${f1(y(v))}"/>`).join("");
  const xAxis = d.episodes.map(({ ep: e }) => `<text class="rc-axis${e === upTo ? " now" : e > upTo ? " later" : ""}" x="${f1(x(e))}" y="${H - 6}" text-anchor="middle">${e}</text>`).join("");
  // End labels at each line's end, kept at least 15 apart: push down where
  // they crowd, cap the lowest at the plot's bottom (clear of the episode
  // numbers), then push up only the ones that still crowd. A hairline joins a moved label to its line.
  const ends = sorted(upTo), labelY = {};
  ends.forEach((m, i) => { labelY[m] = Math.max(y(gap(m, upTo)), i ? labelY[ends[i - 1]] + 15 : -Infinity); });
  labelY[ends.at(-1)] = Math.min(labelY[ends.at(-1)], B);
  for (let i = ends.length - 2; i >= 0; i--) labelY[ends[i]] = Math.min(labelY[ends[i]], labelY[ends[i + 1]] - 15);
  // Leader drawn last, so its line sits on top. Each contestant is one group
  // (data-who) so a tap can bring it forward and fade the rest.
  const lines = [...ends].reverse().map((name) => {
    const c = d.cast[name].color, pts = eps.map((e) => [x(e), y(gap(name, e))]);
    const path = pts.length > 1 ? `<path class="rc-line" d="${smooth(pts)}" style="stroke:${c}"/><path class="rc-tap" d="${smooth(pts)}"/>` : "";
    // No points on the lines; only Episode 1, with no lines yet, shows dots.
    const dots = upTo > 1 ? "" : pts.map(([a, b], i) => `<circle class="rc-pt${i === upTo - 1 ? " now" : ""}" cx="${f1(a)}" cy="${f1(b)}" r="${i === upTo - 1 ? 5 : 3.5}" style="fill:${c}"/>`).join("");
    const [lx, ly] = pts.at(-1), ty = labelY[name], g = gap(name, upTo);
    const lead = Math.abs(ty - ly) > 3 ? `<path class="rc-lead" d="M${f1(lx + 6)},${f1(ly)}L${f1(lx + 12)},${f1(ty)}" style="stroke:${c}"/>` : "";
    const label = `<text class="rc-name" x="${f1(lx + 14)}" y="${f1(ty + 4)}" style="fill:${c}">${esc(name.slice(0, 3))}<tspan class="rc-total" dx="6">${g ? `−${-g}` : total[name][upTo]}</tspan></text>`;
    const hits = pts.map(([a, b], i) => {
      const e = i + 1, gg = gap(name, e);
      const say = `Ep ${e} · ${name} · ${total[name][e]} points · ${gg ? `${-gg} behind ${listing(leaders(e))}` : leaders(e).length > 1 ? "joint leader" : "leading"} (${ord(rank(e, name))})`;
      return `<circle class="rc-hit" cx="${f1(a)}" cy="${f1(b)}" r="12" data-say="${esc(say)}"><title>${esc(say)}</title></circle>`;
    }).join("");
    return `<g data-who="${esc(name)}">${path}${dots}${lead}${label}${hits}</g>`;
  }).join("");
  const summary = ends.map((m) => `${m} ${gap(m, upTo) ? `${-gap(m, upTo)} behind` : `leads on ${total[m][upTo]}`}`).join(", ");
  return `
    <div class="card race">
      <div class="card-head"><span>The race so far</span><span class="legend">points behind the leader</span></div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Points behind the leader after episode ${upTo}: ${esc(summary)}">${grid}${xAxis}${lines}</svg>
      <p class="rc-cap"></p>
    </div>`;
}
