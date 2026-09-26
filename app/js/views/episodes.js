// Episodes: a scrollable Ep 1–10 strip (a dot in each winner's colour) above
// swipeable episode slides. Everywhere on the tab the cast sit in their studio
// seat order (1–5, from the all-time stats): the portraits, the task-table
// columns (each under its portrait) and the ballot.
import { esc, ord, framed, named, fmtDay, fmtWhen, untilText, icon, state } from "../ui.js";
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
// A bump chart: each contestant's rank by running total after every episode
// up to this one (1st at the top), a line in their colour, labelled at the end
// with their name and total. Ties share a rank and are nudged apart so both
// lines show. Tap a point to read it in the caption.

function raceChart(d, upTo) {
  const names = d.names, eps = Array.from({ length: upTo }, (_, i) => i + 1);
  const total = Object.fromEntries(names.map((n) => [n, [0]]));
  for (const e of eps) for (const n of names) total[n][e] = total[n][e - 1] + d.EPS[n][e];
  // rank[e][n], competition ranking ("1-2-2-4") on the running total
  const rank = {};
  for (const e of eps) {
    const sorted = [...names].sort((a, b) => total[b][e] - total[a][e]);
    rank[e] = Object.fromEntries([...rankWithTies(sorted, (n) => total[n][e])]);
  }
  const W = 340, L = 34, R = 236, T = 16, row = 28, n = names.length, H = T + (n - 1) * row + 34;
  const x = (e) => (upTo === 1 ? R : L + ((e - 1) / (upTo - 1)) * (R - L));
  const y = (e, name) => {
    const r = rank[e][name], tied = names.filter((m) => rank[e][m] === r).sort((a, b) => d.idx[a] - d.idx[b]);
    return T + (r - 1) * row + (tied.indexOf(name) - (tied.length - 1) / 2) * 6;
  };
  const f1 = (v) => v.toFixed(1);
  const grid = names.map((_, i) => `<line class="rc-grid" x1="${L}" x2="${R}" y1="${T + i * row}" y2="${T + i * row}"/><text class="rc-axis" x="${L - 10}" y="${T + i * row + 4}" text-anchor="end">${ord(i + 1)}</text>`).join("");
  const xAxis = eps.map((e) => `<text class="rc-axis${e === upTo ? " now" : ""}" x="${f1(x(e))}" y="${H - 6}" text-anchor="middle">${e}</text>`).join("");
  // End labels: at each line's last point, but at least 15 apart, so tied
  // contestants' names don't sit on top of each other (pushed apart evenly).
  const labelY = {}, ends = [...names].sort((a, b) => y(upTo, a) - y(upTo, b));
  ends.forEach((m, i) => { labelY[m] = Math.max(y(upTo, m), i ? labelY[ends[i - 1]] + 15 : -Infinity); });
  const over = Math.max(0, labelY[ends.at(-1)] - (T + (n - 1) * row + 3));
  for (const m of ends) labelY[m] -= over / 2;
  // Leader drawn last, so its line sits on top
  const byFinal = [...names].sort((a, b) => rank[upTo][b] - rank[upTo][a]);
  const lines = byFinal.map((name) => {
    const c = d.cast[name].color, pts = eps.map((e) => [x(e), y(e, name)]);
    const line = upTo > 1 ? `<polyline points="${pts.map(([a, b]) => `${f1(a)},${f1(b)}`).join(" ")}" style="stroke:${c}"/>` : "";
    const dots = pts.map(([a, b], i) => `<circle class="rc-pt${i === upTo - 1 ? " now" : ""}" cx="${f1(a)}" cy="${f1(b)}" r="${i === upTo - 1 ? 5 : 3.5}" style="fill:${c}"/>`).join("");
    const [lx] = pts.at(-1), ly = labelY[name];
    const label = `<text class="rc-name" x="${f1(lx + 12)}" y="${f1(ly + 4)}" style="fill:${c}">${esc(name)}<tspan class="rc-total" dx="6">${total[name][upTo]}</tspan></text>`;
    const hits = pts.map(([a, b], i) => {
      const e = i + 1, say = `Ep ${e} · ${name} · ${ord(rank[e][name])} on ${total[name][e]} points`;
      return `<circle class="rc-hit" cx="${f1(a)}" cy="${f1(b)}" r="12" data-say="${esc(say)}"><title>${esc(say)}</title></circle>`;
    }).join("");
    return `<g>${line}${dots}${label}${hits}</g>`;
  }).join("");
  const summary = [...names].sort((a, b) => rank[upTo][a] - rank[upTo][b]).map((m) => `${ord(rank[upTo][m])} ${m} ${total[m][upTo]}`).join(", ");
  return `
    <div class="card race">
      <div class="card-head"><span>The race so far</span><span class="legend">rank by total points</span></div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Standings by total points after episode ${upTo}: ${esc(summary)}">${grid}${xAxis}${lines}</svg>
      <p class="rc-cap">Tap a point for the standings that week</p>
    </div>`;
}
