// Cast: a name strip (in standings order) above swipeable contestant slides.
import { esc, rich, tier, framed, ICON } from "../ui.js";

/** Contestants by series total, best first. */
export const castOrder = (d) => [...d.contestants].sort((a, b) => a.rank - b.rank || a.key.localeCompare(b.key));

export const castTabs = (d) => castOrder(d).map((c, i) => `<button class="strip-tab" data-slide="${i}">${esc(c.key)}</button>`).join("");

export const castSlides = (d) => castOrder(d).map((c) => `<section class="slide">${slide(d, c)}</section>`).join("");

function slide(d, c) {
  const i = d.idx[c.key], scored = d.weeksScored;
  const eps = c.eps.slice(0, scored), hi = Math.max(...eps), lo = Math.min(...eps);
  const sum = (ep, types) => d.epTasks(ep).filter((t) => types.includes(t.t)).reduce((a, t) => a + t.s[i], 0);
  const row = (label, types) => {
    const cells = d.episodes.map((e) => e.ep > scored ? `<td class="blank">–</td>` : `<td>${sum(e.ep, types)}</td>`).join("");
    return `<tr><th>${label}</th>${cells}<td class="sum">${types.reduce((a, t) => a + c.ty[t], 0)}</td></tr>`;
  };
  const totals = d.episodes.map((e) => {
    if (e.ep > scored) return `<td class="blank">–</td>`;
    const v = c.eps[e.ep - 1];
    return `<td class="${v === hi && hi > lo ? "best" : v === lo && hi > lo ? "worst" : ""}${d.winners[e.ep]?.winner === c.key ? " won" : ""}">${v}</td>`;
  }).join("");
  const rk = (r) => `<b class="${tier(r) || "t0"}">#${r}</b>`;

  return `
    <div class="cd-hero">
      <div class="cd-img">${framed(c)}</div>
      <div class="cd-info">
        <h2 class="cd-name" style="color:${c.color}">${esc(c.full)}</h2>
        <div class="cd-sub">Rank #${c.rank} · avg ${c.avg.toFixed(1)}/ep${c.wins ? ` · ${c.wins} win${c.wins > 1 ? "s" : ""}` : ""}</div>
        <div class="cd-pts">${c.total}</div>
        <div class="cd-pts-l">total points</div>
        <div class="cd-ranks"><span>${ICON.P} ${rk(c.prizeRank)} prize</span><span>${ICON.F} ${rk(c.filmedRank)} filmed</span><span>${ICON.L} ${rk(c.liveRank)} live</span></div>
      </div>
    </div>
    <div class="cd-league">Picked <b>${c.pickedBy}</b> time${c.pickedBy === 1 ? "" : "s"} by the league · earned them <b>${c.deliveredTo}</b> points</div>
    <div class="card tt-wrap"><table class="bs">
      <thead><tr><th></th>${d.episodes.map((e) => `<th>E${e.ep}</th>`).join("")}<th class="sum">Tot</th></tr></thead>
      <tbody>
        <tr class="tot"><th>Tot</th>${totals}<td class="sum best">${c.total}</td></tr>
        ${row(ICON.P, ["P"])}${row(ICON.F, ["F", "T"])}${row(ICON.L, ["L"])}
      </tbody>
    </table></div>
    ${c.bio ? `<div class="card note"><div class="card-head"><span>Profile</span></div><p>${rich(c.bio)}</p></div>` : ""}
    ${c.stat ? `<div class="card note gold"><div class="card-head"><span>Statistical insight</span></div><p>${rich(c.stat)}</p></div>` : ""}`;
}
