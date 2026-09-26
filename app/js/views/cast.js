// Cast: a name strip (in standings order) above swipeable contestant slides.
import { esc, rich, framed } from "../ui.js";

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
// Points from each kind of task. Every axis is scaled to the best in the cast,
// so the outer edge means "top of the cast" there. This contestant is drawn
// in their colour; the other four are thin grey outlines for comparison.

const KINDS = [["P", "Prize"], ["F", "Filmed"], ["T", "Team"], ["L", "Live"]];

function radar(d, c) {
  const axes = KINDS.filter(([k]) => d.contestants.some((x) => x.ty[k] > 0));
  if (axes.length < 3) return "";
  const n = axes.length, R = 76, cx = 160, cy = 120;
  const max = Object.fromEntries(axes.map(([k]) => [k, Math.max(...d.contestants.map((x) => x.ty[k]))]));
  const at = (i, f) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f];
  };
  const xy = (p) => p.map((v) => v.toFixed(1)).join(",");
  const shape = (x) => axes.map(([k], i) => xy(at(i, x.ty[k] / max[k]))).join(" ");
  const rings = [0.25, 0.5, 0.75, 1].map((f) => `<polygon class="rd-ring" points="${axes.map((_, i) => xy(at(i, f))).join(" ")}"/>`).join("");
  const spokes = axes.map((_, i) => { const [x, y] = at(i, 1); return `<line class="rd-spoke" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join("");
  const others = d.contestants.filter((x) => x.key !== c.key).map((x) => `<polygon class="rd-other" points="${shape(x)}"><title>${esc(x.key)}</title></polygon>`).join("");
  const dots = axes.map(([k, label], i) => { const [x, y] = at(i, c.ty[k] / max[k]); return `<circle class="rd-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"><title>${esc(c.key)}: ${c.ty[k]} ${label.toLowerCase()} points (cast best ${max[k]})</title></circle>`; }).join("");
  const labels = axes.map(([k, label], i) => {
    const [x, y] = at(i, 1.2), anchor = Math.abs(x - cx) < 1 ? "middle" : x > cx ? "start" : "end";
    const dy = y < cy - 1 ? -8 : y > cy + 1 ? 12 : 0;
    return `<text class="rd-label" x="${x.toFixed(1)}" y="${(y + dy).toFixed(1)}" text-anchor="${anchor}">${label}<tspan class="rd-val" x="${x.toFixed(1)}" dy="15">${c.ty[k]} pts</tspan></text>`;
  }).join("");
  const summary = axes.map(([k, label]) => `${label} ${c.ty[k]} of a cast best ${max[k]}`).join(", ");
  return `
    <div class="card radar" style="--c:${c.color}">
      <div class="card-head"><span>Strengths</span><span class="legend">edge = best in the cast</span></div>
      <svg viewBox="0 0 320 250" role="img" aria-label="${esc(c.key)}'s points by kind of task: ${summary}">
        ${rings}${spokes}${others}
        <polygon class="rd-me" points="${shape(c)}"/>
        ${dots}${labels}
      </svg>
      <p class="rd-key"><span class="k-me"></span>${esc(c.key)} <span class="k-other"></span>Other contestants</p>
    </div>`;
}
