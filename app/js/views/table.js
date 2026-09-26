import { esc, ord, listing, framed, state, link, rankSeal, deltaTag, statusLine } from "../ui.js";
import { EPISODES } from "../league.js";

export function viewStandings() {
  const d = state.d, key = state.sort, other = key === "show" ? "league" : "show";
  const P = [...d.players].sort((a, b) => a[key + "Rank"] - b[key + "Rank"] || b[other] - a[other] || a.name.localeCompare(b.name));
  const worst = Math.max(...P.map((p) => p[key + "Rank"]));
  const head = `
    <header class="v-head">
      <div><p class="kicker">Series ${state.key} · Ep ${d.weeksScored}/${EPISODES}</p><h2>The Table</h2></div>
      <div class="seg" role="group" aria-label="Rank by">
        <button data-sort="show" aria-pressed="${key === "show"}">Show</button>
        <button data-sort="league" aria-pressed="${key === "league"}">League</button>
      </div>
    </header>`;
  if (!P.length) return `<section class="card">${head}<p class="empty">Nobody has voted in Series ${state.key} yet.</p></section>`;

  const rows = P.map((p) => {
    const rank = p[key + "Rank"];
    const strip = p.weeks.map((w) => {
      const c = w.pick && d.cast[w.pick];
      if (w.scored && c) return `<i class="${w.won ? "w" : ""}" style="--c:${c.color}" title="Ep ${w.ep}: ${esc(w.pick)}, ${w.show} Show, ${ord(w.place)}">${key === "show" ? w.show : w.league}</i>`;
      if (w.scored) return `<i class="x" title="Ep ${w.ep}: no vote">·</i>`;
      return c ? `<i class="soon" style="--c:${c.color}" title="Ep ${w.ep}: ${esc(w.pick)}"></i>` : `<i class="o"></i>`;
    }).join("");
    return `
    <li class="row ${rank === worst && P.length > 2 ? "crooked" : ""}">
      <div class="row-in">
        ${rankSeal(rank)}
        <span class="who"><b class="pname">${esc(p.name)}</b>${p.status ? statusLine(p.status) : ""}</span>
        <span class="strip" aria-hidden="true">${strip}</span>
        <span class="pts"><b data-count="${p[key]}">${p[key]}</b><small>${p[other]} ${other === "show" ? "S" : "L"}</small></span>
        ${deltaTag(p[key + "Delta"])}
      </div>
    </li>`;
  }).join("");

  return `
  <section class="card table">
    ${head}
    ${d.weeksScored ? weekStrip(d.weeksScored) : ""}
    <div class="legend"><span>Rank</span><span>Player</span><span class="lg-strip">Ep 1–10 · ${key} pts</span><span>Total</span></div>
    <ol class="rows">${rows}</ol>
    ${d.inactive.length ? `<p class="foot">Yet to vote: ${d.inactive.map(esc).join(", ")}</p>` : ""}
  </section>`;
}

export function weekStrip(e) {
  const d = state.d, w = d.winners[e], wk = d.weekly[e], c = d.cast[w.winner];
  const hits = wk.hits.map(esc);
  return `
    <a class="week-strip" href="${link("episodes", e)}" style="--c:${c.color}">
      ${framed(c, "fp-s")}
      <span><small>Episode ${e}</small><b>${esc(c.key)} won${w.tiebreak ? " on a tiebreak" : ""}.</b>
      ${wk.hits.length ? `${wk.hits.length}/${wk.voters} backed ${esc(c.key)}: ${listing(hits)}.` : "Nobody backed the winner."} Avg ${wk.avgShow.toFixed(1)} pts.</span>
    </a>`;
}

// You ------------------------------------------------------------------------
