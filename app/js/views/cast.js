import { esc, rich, ord, framed, state, swiperHTML } from "../ui.js";
import { metaFor } from "../meta.js";

export const castOrder = (d) => [...d.contestants].sort((a, b) => b.rank - a.rank || b.key.localeCompare(a.key));

export function viewCast() {
  const d = state.d, m = metaFor(state.key);
  const order = castOrder(d);
  const idx = Math.max(0, order.findIndex((c) => c.key === (state.arg || order.at(-1).key)));
  const worst = Math.max(...d.contestants.map((c) => c.rank));
  const overlay = order.every((c) => m.heroes?.[c.key]);
  const wall = order.map((c, i) => `
    <button class="frame ${i === idx ? "on" : ""} ${c.rank === worst && d.weeksScored ? "crooked" : ""}" data-go="${i}" data-swiper="cast-swiper" style="--c:${c.color}" aria-label="${esc(c.full)}, ${ord(c.rank)} on ${c.total}">
      ${framed(c)}<b class="frame-score">${c.total}</b>
    </button>`).join("");

  const maxEp = Math.max(...d.contestants.flatMap((c) => c.eps), 1);
  const cards = order.map((c) => {
    const bars = c.eps.map((v, i) => {
      const ep = i + 1, scored = ep <= d.weeksScored;
      return `<li class="${scored ? "" : "future"} ${d.winners[ep]?.winner === c.key ? "won" : ""}" style="--h:${scored ? (v / maxEp) * 100 : 0}%"><b>${scored ? v : ""}</b><span class="bar"></span><small>${ep}</small></li>`;
    }).join("");
    const hero = m.heroes?.[c.key];
    const kv = `
          <dl class="kv tight">
            <div><dt>Total</dt><dd>${c.total}</dd></div>
            <div><dt>Per ep</dt><dd>${c.avg.toFixed(1)}</dd></div>
            <div><dt>Ep wins</dt><dd>${c.wins}</dd></div>
            <div><dt>5-pointers</dt><dd>${c.fives}</dd></div>
            <div><dt>Picked</dt><dd>${c.pickedBy}<small>×</small></dd></div>
            <div><dt>To backers</dt><dd>${c.deliveredTo}</dd></div>
          </dl>
          <p class="cats">Prize <b>${ord(c.prizeRank)}</b> · Filmed <b>${ord(c.filmedRank)}</b> · Live <b>${ord(c.liveRank)}</b></p>`;
    const rank = d.weeksScored ? `${ord(c.rank)} in Series ${state.key}` : `Series ${state.key}`;
    if (hero) {
      // The hero shot is the card's backdrop. The portrait wall floats over the
      // top of it, the photo is dropped just enough that heads start below the
      // wall, and faces (~19–45% of the photo's height) are kept clear by the
      // .cc-face spacer; the name and stats begin under the chin.
      return `
    <article class="card cast-card has-hero" style="--c:${c.color}">
      <div class="cc-bg" aria-hidden="true"><img src="${hero}" alt="" width="640" height="865" loading="lazy" decoding="async"></div>
      <div class="cc-face"></div>
      <header class="cc-name"><p class="kicker">${rank}</p><h2>${esc(c.full)}</h2></header>
      <div class="cc-body">
        ${kv}
        <figure class="ep-chart"><ol>${bars}</ol></figure>
        ${c.stat ? `<p class="stat-note">${rich(c.stat)}</p>` : ""}
        ${c.bio ? `<p class="bio">${rich(c.bio)}</p>` : ""}
      </div>
    </article>`;
    }
    return `
    <article class="card cast-card" style="--c:${c.color}">
      <div class="cc-top">
        ${framed(c, "fp-l")}
        <div class="cc-info"><p class="kicker">${rank}</p><h2>${esc(c.full)}</h2>${kv}</div>
      </div>
      <figure class="ep-chart"><ol>${bars}</ol></figure>
      ${c.stat ? `<p class="stat-note">${rich(c.stat)}</p>` : ""}
      ${c.bio ? `<p class="bio">${rich(c.bio)}</p>` : ""}
    </article>`;
  });
  return `
  <div class="cast-view ${overlay ? "overlay" : ""}">
    <div class="wall" aria-label="Contestants by standing, first place on the right">${wall}</div>
    ${swiperHTML("cast-swiper", cards)}
  </div>`;
}
