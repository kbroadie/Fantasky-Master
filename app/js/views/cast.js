// Cast: a name strip (in standings order) above swipeable contestant slides.
import { esc, rich, framed, state, ICON_PATHS } from "../ui.js";

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

// ── Performance radar ───────────────────────────────────────────────────────
// Points per episode from Prize, Filmed and Live tasks (team tasks aren't
// counted), as z-scores against every contestant in every series
// (state.stats). The scale runs from −3σ at the centre to +3σ at the edge,
// with a hairline ring at every whole σ and ticks where they cross the axes;
// the middle ring (dashed) is the all-series average. With ten or so
// contestants no z-score can pass ±3, so nothing is clipped in practice.
// Only the selected contestant is drawn, with no numbers or legend.

const KINDS = [["P", "Prize"], ["F", "Filmed"], ["L", "Live"]];
const Z = 3;
const SIGMAS = [-2, -1, 0, 1, 2];

function radar(d, c) {
  const n = KINDS.length, R = 80, cx = 170, cy = 108;
  const eps = Math.max(1, d.weeksScored), st = state.stats;
  const z = (k) => (st[k].sd ? (c.ty[k] / eps - st[k].mean) / st[k].sd : 0);
  const r = (k) => Math.min(1, Math.max(0, (z(k) + Z) / (2 * Z)));
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const at = (i, f) => [cx + Math.cos(ang(i)) * R * f, cy + Math.sin(ang(i)) * R * f];
  const f1 = (v) => v.toFixed(1);
  const pts = KINDS.map(([k], i) => at(i, r(k)));
  const ringAt = (s) => (s + Z) / (2 * Z);
  const rings = SIGMAS.map((s) => `<circle class="rd-ring${s === 0 ? " avg" : ""}" cx="${cx}" cy="${cy}" r="${f1(R * ringAt(s))}"/>`).join("");
  const spokes = KINDS.map((_, i) => { const [x, y] = at(i, 1); return `<line class="rd-axis" x1="${cx}" y1="${cy}" x2="${f1(x)}" y2="${f1(y)}"/>`; }).join("");
  const ticks = KINDS.map((_, i) => [...SIGMAS.map(ringAt), 1].map((f) => {
    const [x, y] = at(i, f), a = ang(i) + Math.PI / 2, dx = Math.cos(a) * 3, dy = Math.sin(a) * 3;
    return `<line class="rd-tick" x1="${f1(x - dx)}" y1="${f1(y - dy)}" x2="${f1(x + dx)}" y2="${f1(y + dy)}"/>`;
  }).join("")).join("");
  // Label = icon + word. DM Mono is monospaced, so the word's width is known
  // (11px, 0.6em advance + 0.12em tracking) and the pair can be placed as a unit.
  const labels = KINDS.map(([k, label], i) => {
    const [x, y] = at(i, 1.13), side = Math.abs(x - cx) < 1 ? 0 : x > cx ? 1 : -1;
    const w = label.length * 11 * 0.72, ico = 13, gap = 5, total = ico + gap + w;
    const left = side === 1 ? x : side === -1 ? x - total : x - total / 2;
    const base = y < cy ? y - 2 : y + 13;
    return `<g class="rd-ico" transform="translate(${f1(left)} ${f1(base - 10.5)}) scale(${ico / 16})"><path d="${ICON_PATHS[k]}"/></g>`
      + `<text class="rd-label" x="${f1(left + ico + gap)}" y="${f1(base)}">${label}</text>`;
  }).join("");
  const id = `rd-${esc(c.key).replace(/\W/g, "")}`;
  const summary = KINDS.map(([k, label]) => `${label} ${z(k) >= 0 ? "+" : "−"}${Math.abs(z(k)).toFixed(1)} standard deviations`).join(", ");
  return `
    <div class="card radar" style="--c:${c.color}">
      <div class="card-head"><span>Performance</span></div>
      <svg viewBox="0 0 340 204" role="img" aria-label="${esc(c.key)}'s points per episode against every contestant in every series: ${summary}">
        <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.color}" stop-opacity=".9"/><stop offset="1" stop-color="${c.color}" stop-opacity=".65"/></linearGradient></defs>
        <circle class="rd-face" cx="${cx}" cy="${cy}" r="${R}"/>
        ${rings}${spokes}${ticks}
        <polygon points="${pts.map(([x, y]) => `${f1(x)},${f1(y)}`).join(" ")}" fill="url(#${id})"/>
        ${pts.map(([x, y]) => `<circle class="rd-pt" cx="${f1(x)}" cy="${f1(y)}" r="2.5"/>`).join("")}
        ${labels}
      </svg>
    </div>`;
}
