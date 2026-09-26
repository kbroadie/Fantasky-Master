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
// Points from Prize, Filmed and Live tasks (team tasks aren't counted). Each
// axis is scaled to the best in the cast, so the corner of the grey triangle
// means "top of the cast" there. Two solid shapes: the full triangle and
// this contestant's area in their colour.

const KINDS = [["P", "Prize"], ["F", "Filmed"], ["L", "Live"]];

function radar(d, c) {
  const n = KINDS.length, R = 84, cx = 160, cy = 118;
  const max = Object.fromEntries(KINDS.map(([k]) => [k, Math.max(1, ...d.contestants.map((x) => x.ty[k]))]));
  const at = (i, f) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f];
  };
  const pts = (f) => KINDS.map(([k], i) => at(i, f(k)).map((v) => v.toFixed(1)).join(",")).join(" ");
  const labels = KINDS.map(([, label], i) => {
    const [x, y] = at(i, 1.16), anchor = Math.abs(x - cx) < 1 ? "middle" : x > cx ? "start" : "end";
    return `<text class="rd-label" x="${x.toFixed(1)}" y="${(y < cy ? y - 4 : y + 14).toFixed(1)}" text-anchor="${anchor}">${label}</text>`;
  }).join("");
  const summary = KINDS.map(([k, label]) => `${label} ${c.ty[k]} of a cast best ${max[k]}`).join(", ");
  return `
    <div class="card radar" style="--c:${c.color}">
      <div class="card-head"><span>Strengths</span></div>
      <svg viewBox="0 0 320 196" role="img" aria-label="${esc(c.key)}'s task points: ${summary}">
        <polygon class="rd-area" points="${pts(() => 1)}"/>
        <polygon class="rd-me" points="${pts((k) => c.ty[k] / max[k])}"/>
        ${labels}
      </svg>
    </div>`;
}
