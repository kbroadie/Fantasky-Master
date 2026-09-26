// Episodes: a scrollable Ep 1–10 strip (a dot in each winner's colour) above
// swipeable episode slides. Everywhere on the tab the cast sit in their studio
// seat order (1–5, from the all-time stats): the portraits, the league's
// picks, the task-table columns (each under its portrait) and the ballot.
import { esc, rich, ord, listing, framed, named, fmtDay, fmtWhen, untilText, icon, state } from "../ui.js";
import { statsFor } from "../alltime.js";

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

  const noVote = d.players.filter((p) => !p.weeks[e.ep - 1].pick).map((p) => p.name);
  const league = `
    <div class="card">
      <div class="card-head lg-head"><span>The league's picks</span><span class="cols"><span>Show</span><span>League</span></span></div>
      ${order.map((n) => {
        const by = wk.by[n];
        return `<div class="lg-row${n === w.winner ? " win" : ""}" style="--c:${d.cast[n].color}">
          <div class="lg-who">${named(d.cast[n])} <small>${ord(d.placing[e.ep][n])}</small>
            <div class="backers">${by.length ? esc(by.join(", ")) : `<span class="none">no picks</span>`}</div></div>
          <span class="cols"><b>+${pts(n)}</b><b>+${d.rankPts[e.ep][n]}</b></span>
        </div>`;
      }).join("")}
      ${noVote.length ? `<p class="card-foot">No pick: ${esc(listing(noVote))}</p>` : ""}
    </div>`;

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

  const notes = e.analysis ? `<div class="card note"><div class="card-head"><span>Episode analysis</span></div><p>${rich(e.analysis)}</p></div>` : "";
  return head(line) + `<div class="ep-body"><div class="pod">${pod}</div>${league}${table}${notes}</div>`;
}
