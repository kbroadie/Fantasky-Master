// The house: an original SVG illustration whose ten windows are the ten
// episodes. Ground floor = episodes 1–4, first floor = 5–9, the attic
// oculus = the finale. Scored windows light up with the winner inside.

const W = 52, H = 78;
const GROUND = [343, 421.5, 578.5, 657];
const FIRST = [343, 421.5, 500, 578.5, 657];

export const WINDOWS = [
  ...GROUND.map((cx) => ({ cx, cy: 408 + H / 2, shape: "rect" })),
  ...FIRST.map((cx) => ({ cx, cy: 268 + H / 2, shape: "rect" })),
  { cx: 500, cy: 180, shape: "circle", r: 25 },
];

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function epState(d, ep) {
  if (ep <= d.weeksScored) return "scored";
  if (ep <= d.weeksAired) return "pending";
  if (d.nextEp && d.nextEp.ep === ep) return "next";
  return "future";
}

function windowMarkup(d, seriesKey, i) {
  const ep = i + 1;
  const w = WINDOWS[i];
  const state = epState(d, ep);
  const meta = d.raw.episodes[i];
  const win = d.winners[ep];
  const c = win ? d.cast[win.winner] : null;
  const label = state === "scored"
    ? `Episode ${ep}: ${meta.title || ""}. Won by ${c.full}${win.tiebreak ? " on a tiebreak" : ""}.`
    : state === "pending" ? `Episode ${ep} has aired. Results coming soon.`
    : `Episode ${ep}${meta.title ? `: ${meta.title}` : ""}. Not aired yet.`;

  const clipId = `wclip-${ep}`;
  const glass = w.shape === "circle"
    ? `<circle cx="${w.cx}" cy="${w.cy}" r="${w.r}"/>`
    : `<rect x="${w.cx - W / 2}" y="${w.cy - H / 2}" width="${W}" height="${H}" rx="3"/>`;
  const s = w.shape === "circle" ? (w.r * 2) / 105 : 60 / 105;
  const portrait = c
    ? `<image href="${c.img}" x="${w.cx - 112 * s}" y="${w.cy - 122 * s}" width="${225 * s}" height="${266 * s}" clip-path="url(#${clipId})" class="win-face" preserveAspectRatio="none" decoding="async"/>`
    : "";
  const mullions = w.shape === "circle"
    ? `<path class="mullion" d="M${w.cx - w.r} ${w.cy}H${w.cx + w.r}M${w.cx} ${w.cy - w.r}V${w.cy + w.r}"/>`
    : `<path class="mullion" d="M${w.cx} ${w.cy - H / 2}V${w.cy + H / 2}M${w.cx - W / 2} ${w.cy - 6}H${w.cx + W / 2}"/>`;
  const frame = w.shape === "circle"
    ? `<circle class="wframe" cx="${w.cx}" cy="${w.cy}" r="${w.r + 3}"/>`
    : `<rect class="wframe" x="${w.cx - W / 2 - 3}" y="${w.cy - H / 2 - 3}" width="${W + 6}" height="${H + 6}" rx="4"/>
       <rect class="sill" x="${w.cx - W / 2 - 7}" y="${w.cy + H / 2 + 2}" width="${W + 14}" height="6" rx="1.5"/>`;
  const num = w.shape === "circle"
    ? `<text class="wnum" x="${w.cx}" y="${w.cy + w.r + 18}">${ep}</text>`
    : `<text class="wnum" x="${w.cx}" y="${w.cy + H / 2 + 22}">${ep}</text>`;

  return `
  <a href="#/${seriesKey}/episodes/${ep}" class="win ${state}" data-ep="${ep}" style="--c:${c ? c.color : "transparent"};--i:${i}" aria-label="${esc(label)}">
    <title>${esc(label)}</title>
    <clipPath id="${clipId}">${glass}</clipPath>
    <g class="halo">${glass}</g>
    ${frame}
    <g class="glass">${glass}</g>
    ${portrait}
    <g class="tint">${glass}</g>
    ${mullions}
    ${num}
  </a>`;
}

function prop(theme) {
  if (theme === "diner") {
    return `
    <g class="prop neon" aria-hidden="true">
      <rect x="196" y="420" width="6" height="120" fill="#1a1414"/>
      <rect x="150" y="380" width="98" height="52" rx="10" fill="#140d15" stroke="#2c1f2e" stroke-width="3"/>
      <text x="199" y="416" class="neon-text">EAT</text>
    </g>`;
  }
  return `
  <g class="prop column" aria-hidden="true">
    <rect x="186" y="532" width="62" height="10" fill="#cfc6b4"/>
    <rect x="192" y="524" width="50" height="10" fill="#e2dac8"/>
    <path d="M198 524 L201 420 H233 L236 524Z" fill="#ddd4c1"/>
    <path d="M206 522 L208 422 M214 522 L215 422 M221 522 L221 422 M228 522 L227 422" stroke="#bcb29f" stroke-width="2"/>
    <path d="M192 420 H242 L238 410 H196Z" fill="#e8e0cd"/>
    <path d="M190 410 H244 V402 H190Z" fill="#d3cab7"/>
    <path d="M233 402 L246 380 L240 402Z" fill="#cfc6b4"/>
    <g transform="translate(262 500)">
      <path d="M10 0 H26 L24 6 C36 12 38 28 28 40 H8 C-2 28 0 12 12 6Z" fill="#b5562f"/>
      <path d="M4 18 H32" stroke="#1d1410" stroke-width="3"/>
      <path d="M6 26 H30" stroke="#1d1410" stroke-width="1.5" stroke-dasharray="3 3"/>
    </g>
  </g>`;
}

export function houseSVG(d, seriesKey, theme) {
  const windows = d.raw.episodes.map((_, i) => windowMarkup(d, seriesKey, i)).join("");
  return `
<svg class="house" viewBox="0 0 1000 600" role="group" aria-label="The Taskmaster house. Each window is an episode." preserveAspectRatio="xMidYMax meet">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--wall-a)"/><stop offset="1" style="stop-color:var(--wall-b)"/>
    </linearGradient>
    <pattern id="bricks" width="28" height="14" patternUnits="userSpaceOnUse">
      <path d="M0 13.5H28M14 0V7M0 7H28M0 7V14" stroke="rgba(0,0,0,.22)" stroke-width="1" fill="none"/>
    </pattern>
    <pattern id="tiles" width="22" height="12" patternUnits="userSpaceOnUse">
      <path d="M0 11.5H22M11 0V6M0 6H22" stroke="rgba(255,255,255,.05)" stroke-width="1" fill="none"/>
    </pattern>
    <radialGradient id="lamp" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#ffd88f" stop-opacity=".9"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--grass)"/><stop offset=".45" style="stop-color:var(--grass)"/><stop offset="1" style="stop-color:var(--grass);stop-opacity:0"/>
    </linearGradient>
    <linearGradient id="path" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e9dfc6" stop-opacity=".18"/><stop offset="1" stop-color="#e9dfc6" stop-opacity="0"/>
    </linearGradient>
    <filter id="blur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>

  <!-- tree -->
  <g class="tree" aria-hidden="true">
    <path d="M92 540 C96 470 100 430 96 390 H112 C110 430 114 470 120 540Z" fill="#1b1310"/>
    <g fill="var(--leaf)">
      <circle cx="104" cy="360" r="58"/><circle cx="62" cy="392" r="40"/><circle cx="146" cy="394" r="42"/><circle cx="104" cy="310" r="38"/>
    </g>
  </g>

  ${prop(theme)}

  <!-- chimney (behind roof) -->
  <rect x="600" y="118" width="34" height="90" fill="var(--wall-a)"/>
  <rect x="600" y="118" width="34" height="90" fill="url(#bricks)"/>
  <rect x="595" y="110" width="44" height="11" rx="2" fill="#2a201c" class="chimney-top"/>

  <!-- body -->
  <rect x="290" y="228" width="420" height="312" fill="url(#wall)"/>
  <rect x="290" y="228" width="420" height="312" fill="url(#bricks)"/>
  <rect x="290" y="380" width="420" height="6" fill="rgba(255,255,255,.07)"/>

  <!-- roof -->
  <polygon points="266,236 500,98 734,236" fill="var(--roof)"/>
  <polygon points="266,236 500,98 734,236" fill="url(#tiles)"/>
  <path d="M262 238 L500 96 L738 238" fill="none" stroke="#e9dfc6" stroke-opacity=".75" stroke-width="5" stroke-linejoin="round"/>

  <!-- door -->
  <g class="door" aria-hidden="true">
    <ellipse cx="540" cy="424" rx="34" ry="34" fill="url(#lamp)" class="porch-glow"/>
    <path d="M470 540 V432 A30 30 0 0 1 530 432 V540Z" fill="#e9dfc6" opacity=".85"/>
    <path d="M475 540 V434 A25 25 0 0 1 525 434 V540Z" fill="var(--door)"/>
    <path d="M478 430 A22 22 0 0 1 522 430Z" fill="#ffcf7a" opacity=".75"/>
    <path d="M500 410 V430 M486 416 L494 428 M514 416 L506 428" stroke="var(--door)" stroke-width="2"/>
    <rect x="481" y="446" width="38" height="36" rx="2" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="2"/>
    <rect x="481" y="490" width="38" height="40" rx="2" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="2"/>
    <circle cx="516" cy="488" r="3" fill="#e6c26b"/>
    <rect x="538" y="416" width="8" height="12" rx="2" fill="#ffe3a3"/>
    <rect x="462" y="538" width="76" height="8" rx="2" fill="#bdb29a"/>
  </g>

  ${windows}

  <!-- ground -->
  <path d="M-1400 548 Q-400 528 250 536 T1000 540 T2400 536 V800 H-1400Z" fill="url(#ground)"/>
  <path d="M466 546 L430 610 H570 L534 546Z" fill="url(#path)"/>

  <!-- caravan -->
  <g class="caravan" role="button" tabindex="0" aria-label="The caravan. Knock to see who's in.">
    <title>The caravan</title>
    <path d="M770 520 L744 532" stroke="#bdb29a" stroke-width="5" stroke-linecap="round"/>
    <rect x="770" y="452" width="196" height="76" rx="28" fill="#ece1c7"/>
    <rect x="770" y="496" width="196" height="10" fill="var(--accent)"/>
    <rect x="792" y="468" width="30" height="58" rx="5" fill="#d8ccae" stroke="#bdb29a" stroke-width="2"/>
    <circle cx="816" cy="498" r="2.5" fill="#8a7f68"/>
    <rect class="caravan-win" x="880" y="466" width="62" height="26" rx="8" fill="#ffcf7a"/>
    <path d="M911 466 V492" stroke="#ece1c7" stroke-width="3"/>
    <circle cx="866" cy="532" r="15" fill="#1b1512"/><circle cx="866" cy="532" r="6" fill="#8a7f68"/>
    <g class="alex" aria-hidden="true">
      <circle cx="896" cy="476" r="6" fill="#241b16"/>
      <path d="M888 492 Q896 478 904 492Z" fill="#241b16"/>
    </g>
  </g>
</svg>`;
}
