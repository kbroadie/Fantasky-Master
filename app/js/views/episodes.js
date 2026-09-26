// Episodes: a scrollable Ep 1–10 strip above swipeable episode slides. Each
// slide shows the five framed portraits with their scores, who in the league
// backed whom, the task-by-task table and the write-up.
import { esc, rich, ord, listing, framed, named, fmtDay, ICON } from "../ui.js";

export const epTabs = (d) => d.episodes.map((e) =>
  `<button class="strip-tab${e.ep > d.weeksScored ? " tbd" : ""}" data-slide="${e.ep - 1}">Ep ${e.ep}</button>`).join("");

export const epSlides = (d) => d.episodes.map((e) => `<section class="slide">${slide(d, e)}</section>`).join("");

function slide(d, e) {
  const head = (line) => `
    <div class="ep-head">
      <div class="kicker">Episode ${e.ep} · ${fmtDay.format(e.air)}</div>
      <h2 class="ep-title">${esc(e.title || `Episode ${e.ep}`)}</h2>
      <div class="ep-sub">${line}</div>
    </div>`;
  if (e.ep > d.weeksScored) {
    const aired = e.ep <= d.weeksAired;
    const next = d.nextEp?.ep === e.ep;
    return head(aired ? "Aired · results coming soon" : next ? "Up next · airs 10pm UK" : "Awaiting broadcast")
      + `<div class="ep-body"><div class="pod">${d.names.map((n) => `<div class="pod-col dim">${framed(d.cast[n])}<span class="pod-name" style="color:${d.cast[n].color}">${esc(n)}</span></div>`).join("")}</div></div>`;
  }

  const w = d.winners[e.ep], wk = d.weekly[e.ep], pts = (n) => d.EPS[n][e.ep];
  const called = wk.hits.length;
  const line = `Won by ${named(d.cast[w.winner])} with ${w.top}${w.tiebreak ? " after a tiebreak" : ""}`
    + ` · ${called ? `${called} of ${wk.voters} called it` : "nobody called it"}`;

  // Portraits and table columns stay in seating (alphabetical) order so each
  // column sits under its portrait.
  const pod = d.names.map((n) => `
    <div class="pod-col${n === w.winner ? " win" : ""}">
      ${framed(d.cast[n])}
      <span class="pod-name" style="color:${d.cast[n].color}">${esc(n)}</span>
      <b class="pod-pts">${pts(n)}</b>
    </div>`).join("");

  // Who backed whom, in finishing order.
  const finish = [...d.names].sort((a, b) => d.placing[e.ep][a] - d.placing[e.ep][b] || pts(b) - pts(a));
  const noVote = d.players.filter((p) => !p.weeks[e.ep - 1].pick).map((p) => p.name);
  const league = `
    <div class="card">
      <div class="card-head"><span>The league's picks</span><span class="cols"><span>Show</span><span>League</span></span></div>
      ${finish.map((n) => {
        const by = wk.by[n];
        return `<div class="lg-row${n === w.winner ? " win" : ""}" style="--c:${d.cast[n].color}">
          <div class="lg-who">${named(d.cast[n])} <small>${ord(d.placing[e.ep][n])}</small>
            <div class="chips">${by.length ? by.map((p) => `<span class="chip">${esc(p)}</span>`).join("") : `<span class="none">no picks</span>`}</div></div>
          <span class="cols"><b>+${pts(n)}</b><b>+${d.rankPts[e.ep][n]}</b></span>
        </div>`;
      }).join("")}
      ${noVote.length ? `<p class="card-foot">No pick: ${esc(listing(noVote))}</p>` : ""}
    </div>`;

  const tasks = d.epTasks(e.ep);
  const table = `
    <div class="card tt-wrap"><table class="tt">
      <thead><tr><th>Task</th>${d.names.map((n) => `<th style="color:${d.cast[n].color}">${esc(n.slice(0, 3))}</th>`).join("")}</tr></thead>
      <tbody>${tasks.map((t) => {
        const hi = Math.max(...t.s), lo = Math.min(...t.s);
        return `<tr><td><span class="tn"><span>${ICON[t.t] || ""}</span>${esc(t.n)}</span></td>${t.s.map((s) =>
          `<td class="sc${hi > lo && s === hi ? " best" : hi > lo && s === lo ? " worst" : ""}">${s}</td>`).join("")}</tr>`;
      }).join("")}
      <tr class="tot"><td>Total</td>${d.names.map((n) => `<td class="${n === w.winner ? "best" : ""}">${pts(n)}</td>`).join("")}</tr></tbody>
    </table></div>`;

  const notes = e.analysis ? `<div class="card note"><div class="card-head"><span>Episode analysis</span></div><p>${rich(e.analysis)}</p></div>` : "";
  return head(line) + `<div class="ep-body"><div class="pod">${pod}</div>${league}${table}${notes}</div>`;
}
