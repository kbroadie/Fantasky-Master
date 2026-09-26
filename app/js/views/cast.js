// Cast: a name strip (in standings order) above swipeable contestant slides.
import { esc, rich, framed, state, ICON_PATHS } from "../ui.js";
import { statsFor, badgesFor, factsFor } from "../alltime.js";

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
    ${records(d, c)}
    <div class="card">
      <div class="card-head"><span>Points per episode</span>${c.wins ? `<span class="legend">👑 = won</span>` : ""}</div>
      <div class="bars" style="--c:${c.color}">${bars}</div>
    </div>
    ${radar(d, c)}
    ${factFile(c)}
    ${c.bio ? `<div class="card note"><div class="card-head"><span>Profile</span></div><p>${rich(c.bio)}</p></div>` : ""}
    ${c.stat ? `<div class="card note gold"><div class="card-head"><span>Statistical insight</span></div><p>${rich(c.stat)}</p></div>` : ""}`;
}

// ── All-time records and fact file (alltime.js) ──────────────────────────────

const statsRow = (c) => statsFor(state.allTime, state.key, c.full);

/** Badges for stats where this contestant is in Taskmaster's all-time top 10. */
function records(d, c) {
  const badges = badgesFor(state.allTime, statsRow(c));
  if (!badges.length) return "";
  return `
    <div class="card records">
      <div class="card-head"><span>All-time records</span><span class="legend">of ${badges[0].of} contestants</span></div>
      ${badges.map((b) => `<div class="rec"><b class="rec-label">${esc(b.label)}</b><span class="rec-rank${b.rank === 1 ? " top" : ""}">${b.tied ? "=" : ""}#${b.rank}</span><span class="rec-text">${esc(b.text)}</span></div>`).join("")}
    </div>`;
}

function factFile(c) {
  const facts = factsFor(statsRow(c));
  if (!facts.length) return "";
  return `
    <div class="card facts">
      <div class="card-head"><span>Fact file</span></div>
      <dl>${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    </div>`;
}

// ── Performance radar ───────────────────────────────────────────────────────
// Points per episode from Prize, Filmed and Live tasks (team tasks aren't
// counted), as z-scores against every contestant in Taskmaster history
// (state.stats, from the all-time stats; the league's series if those are
// missing). The scale runs from −3σ at the centre to +3σ at the edge,
// with a hairline ring at every whole σ and ticks where they cross the axes;
// the middle ring (dashed) is the all-series average. With ten or so
// contestants no z-score can pass ±3, so nothing is clipped in practice.
// Only the selected contestant is drawn; each axis label carries its z-score.

const KINDS = [["P", "Prize"], ["F", "Filmed"], ["L", "Live"]];
/** A z-score to two decimals with a proper sign: "+2.48", "−1.70", "0.00". */
const zText = (v) => (Math.abs(v) < 0.005 ? "0.00" : `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`);
const Z = 3;
const SIGMAS = [-2, -1, 0, 1, 2];

function radar(d, c) {
  const n = KINDS.length, R = 80, cx = 170, cy = 136;
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
  // One centred group per axis, set clear of the circle: the z-score as the
  // headline, with the icon and name as a quiet caption underneath. DM Mono
  // is monospaced, so the caption's width is known (11px × 0.66em per
  // character) and the icon + word can be centred as a unit.
  const labels = KINDS.map(([k, label], i) => {
    const top = i === 0, side = Math.sign(Math.round(Math.cos(ang(i)) * 100));
    const gx = top ? cx : cx + side * (R + 34), vy = top ? cy - R - 30 : cy + R * 0.5 + 6;
    const ico = 12, gap = 5, w = ico + gap + label.length * 11 * 0.66, left = gx - w / 2, ly = vy + 17;
    return `<text class="rd-z" x="${f1(gx)}" y="${f1(vy)}" text-anchor="middle">${zText(z(k))}<tspan class="rd-sigma" dx="1">σ</tspan></text>`
      + `<g class="rd-ico" transform="translate(${f1(left)} ${f1(ly - 10)}) scale(${ico / 16})"><path d="${ICON_PATHS[k]}"/></g>`
      + `<text class="rd-label" x="${f1(left + ico + gap)}" y="${f1(ly)}">${label}</text>`;
  }).join("");
  const id = `rd-${esc(c.key).replace(/\W/g, "")}`;
  const summary = KINDS.map(([k, label]) => `${label} ${zText(z(k))} standard deviations`).join(", ");
  return `
    <div class="card radar" style="--c:${c.color}">
      <div class="card-head"><span>Performance</span><span class="legend">${state.stats.n ? `z-score vs all ${state.stats.n} contestants` : "z-score vs all series"}</span></div>
      <svg viewBox="0 0 340 226" role="img" aria-label="${esc(c.key)}'s points per episode against every contestant in every series: ${summary}">
        <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.color}" stop-opacity=".9"/><stop offset="1" stop-color="${c.color}" stop-opacity=".65"/></linearGradient></defs>
        <circle class="rd-face" cx="${cx}" cy="${cy}" r="${R}"/>
        ${rings}${spokes}${ticks}
        <polygon points="${pts.map(([x, y]) => `${f1(x)},${f1(y)}`).join(" ")}" fill="url(#${id})"/>
        ${pts.map(([x, y]) => `<circle class="rd-pt" cx="${f1(x)}" cy="${f1(y)}" r="2.5"/>`).join("")}
        ${labels}
      </svg>
    </div>`;
}
