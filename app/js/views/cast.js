// Cast: a name strip (in standings order) above swipeable contestant slides.
import { esc, rich, tier, framed, ICON } from "../ui.js";

/** Contestants by series total, best first. */
export const castOrder = (d) => [...d.contestants].sort((a, b) => a.rank - b.rank || a.key.localeCompare(b.key));

export const castTabs = (d) => castOrder(d).map((c, i) => `<button class="strip-tab" data-slide="${i}">${esc(c.key)}</button>`).join("");

export function castSlides(d) {
  // One scale for every contestant, so bars compare across slides.
  const max = Math.max(1, ...d.contestants.flatMap((c) => c.eps.slice(0, d.weeksScored)));
  return castOrder(d).map((c) => `<section class="slide">${slide(d, c, max)}</section>`).join("");
}

function slide(d, c, max) {
  const bars = d.episodes.map((e) => {
    if (e.ep > d.weeksScored) return `<div class="bar tbd"><b></b><i></i><small>${e.ep}</small></div>`;
    const v = c.eps[e.ep - 1], won = d.winners[e.ep]?.winner === c.key;
    return `<div class="bar${won ? " won" : ""}"><b>${v}</b><i style="height:${Math.max(3, v / max * 100).toFixed(1)}%"></i><small>${e.ep}</small></div>`;
  }).join("");
  const split = (icon, label, pts, rank) => `<span>${icon} ${label} <b>${pts}</b> <em class="${tier(rank) || "t0"}">#${rank}</em></span>`;

  return `
    <div class="cd-hero">
      <div class="cd-img">${framed(c)}</div>
      <div class="cd-info">
        <h2 class="cd-name" style="color:${c.color}">${esc(c.full)}</h2>
        <div class="cd-sub">Rank #${c.rank} · avg ${c.avg.toFixed(1)}/ep${c.wins ? ` · ${c.wins} win${c.wins > 1 ? "s" : ""}` : ""}</div>
        <div class="cd-pts">${c.total}</div>
        <div class="cd-pts-l">total points</div>
      </div>
    </div>
    <div class="cd-league">Picked <b>${c.pickedBy}</b> time${c.pickedBy === 1 ? "" : "s"} by the league · earned them <b>${c.deliveredTo}</b> points</div>
    <div class="card">
      <div class="card-head"><span>Points per episode</span>${c.wins ? `<span class="legend">👑 = won</span>` : ""}</div>
      <div class="bars" style="--c:${c.color}">${bars}</div>
      <p class="split">${split(ICON.P, "Prize", c.ty.P, c.prizeRank)}${split(ICON.F, "Filmed", c.ty.F + c.ty.T, c.filmedRank)}${split(ICON.L, "Live", c.ty.L, c.liveRank)}</p>
    </div>
    ${c.bio ? `<div class="card note"><div class="card-head"><span>Profile</span></div><p>${rich(c.bio)}</p></div>` : ""}
    ${c.stat ? `<div class="card note gold"><div class="card-head"><span>Statistical insight</span></div><p>${rich(c.stat)}</p></div>` : ""}`;
}
