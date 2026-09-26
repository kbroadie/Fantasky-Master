// Cast: a name strip (in standings order) above swipeable contestant slides.
import { esc, rich, framed, state, ICON } from "../ui.js";

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
    </div>
    ${radar(d, c)}
    ${c.bio ? `<div class="card note"><div class="card-head"><span>Profile</span></div><p>${rich(c.bio)}</p></div>` : ""}
    ${c.stat ? `<div class="card note gold"><div class="card-head"><span>Statistical insight</span></div><p>${rich(c.stat)}</p></div>` : ""}`;
}

// ── Strengths radar ─────────────────────────────────────────────────────────
// Points per episode from Prize, Filmed and Live tasks (team tasks aren't
// counted). Each axis runs from 0 at the centre to the best per-episode
// figure by any contestant in any series at the edge of the circle
// (state.best). Gridlines at quarters; this contestant's area is a solid
// shape in their colour, with subtle gradients and no outline.

const KINDS = [["P", "Prize"], ["F", "Filmed"], ["L", "Live"]];

function radar(d, c) {
  const n = KINDS.length, R = 84, cx = 170, cy = 112;
  const eps = Math.max(1, d.weeksScored), best = state.best;
  const val = (k) => c.ty[k] / eps;
  const at = (i, f) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f];
  };
  const xy = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;
  const shape = KINDS.map(([k], i) => xy(at(i, Math.min(1, best[k] ? val(k) / best[k] : 0)))).join(" ");
  const rings = [0.25, 0.5, 0.75].map((f) => `<circle class="rd-grid" cx="${cx}" cy="${cy}" r="${(R * f).toFixed(1)}"/>`).join("");
  const spokes = KINDS.map((_, i) => { const [x, y] = at(i, 1); return `<line class="rd-grid" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join("");
  const labels = KINDS.map(([k, label], i) => {
    const [x, y] = at(i, 1.14), anchor = Math.abs(x - cx) < 1 ? "middle" : x > cx ? "start" : "end";
    return `<text class="rd-label" x="${x.toFixed(1)}" y="${(y < cy ? y - 2 : y + 14).toFixed(1)}" text-anchor="${anchor}">${ICON[k]} ${label}</text>`;
  }).join("");
  const id = `rd-${esc(c.key).replace(/\W/g, "")}`;
  const summary = KINDS.map(([k, label]) => `${label} ${val(k).toFixed(1)} per episode (best in any series: ${best[k].toFixed(1)})`).join(", ");
  return `
    <div class="card radar" style="--c:${c.color}">
      <div class="card-head"><span>Strengths</span></div>
      <svg viewBox="0 0 340 214" role="img" aria-label="${esc(c.key)}'s points per episode: ${summary}">
        <defs>
          <radialGradient id="${id}-bg"><stop offset="0" stop-color="#fff" stop-opacity=".09"/><stop offset="1" stop-color="#fff" stop-opacity=".035"/></radialGradient>
          <linearGradient id="${id}-me" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.color}"/><stop offset="1" stop-color="${c.color}" stop-opacity=".62"/></linearGradient>
        </defs>
        <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${id}-bg)"/>
        ${rings}${spokes}
        <polygon points="${shape}" fill="url(#${id}-me)"/>
        ${labels}
      </svg>
    </div>`;
}
