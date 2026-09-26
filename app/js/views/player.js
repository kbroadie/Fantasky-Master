import { esc, ord, plural, fmtShortDay, framed, store, state, meIn, link, rankSeal, deltaTag, statusLine, swiperHTML } from "../ui.js";
import { EPISODES } from "../league.js";
import { epState } from "../stage.js";

export function viewPlayer() {
  const d = state.d, me = meIn(d);
  const name = state.arg && d.allPlayers.includes(state.arg) ? state.arg : me;
  const options = [...d.allPlayers].sort().map((n) => `<option ${n === name ? "selected" : ""}>${esc(n)}</option>`).join("");
  const top = `
    <header class="pl-top">
      <select data-player-select aria-label="Player">${name ? "" : '<option value="" selected>Choose a player…</option>'}${options}</select>
      ${name && name !== me ? `<button class="btn" data-me-set="${esc(name)}" type="button">This is me</button>` : name ? `<span class="you-tag">you</span>` : ""}
    </header>`;
  if (!name) return `<section class="card">${top}<p class="empty">Choose a name to see their season.</p></section>`;
  const p = d.byName[name];
  if (!p) return `<section class="card">${top}<h2 class="pl-name">${esc(name)}</h2><p class="empty">No votes in Series ${state.key} yet.</p>${name === me && d.nextEp ? planner(name) : ""}</section>`;

  const n = d.players.length;
  const board = (key, label) => {
    const sorted = [...d.players].sort((a, b) => b[key] - a[key]);
    const ahead = sorted.filter((q) => q[key] > p[key]).at(-1), behind = sorted.find((q) => q[key] < p[key]);
    const gap = !ahead ? (behind ? `+${p[key] - behind[key]} on ${esc(behind.name)}` : "top") : `−${ahead[key] - p[key]} to ${esc(ahead.name)}`;
    return `<button class="pl-board ${state.sort === key ? "on" : ""}" data-sort="${key}" type="button">${rankSeal(p[key + "Rank"])}
      <span><small>${label} · ${ord(p[key + "Rank"])}/${n}</small><b>${p[key]}</b>${deltaTag(p[key + "Delta"])}<em>${gap}</em></span></button>`;
  };

  const leagueAvg = d.weeksScored ? Object.values(d.weekly).reduce((a, w) => a + w.avgShow, 0) / d.weeksScored : 0;
  const counts = Object.fromEntries(d.names.map((x) => [x, 0]));
  for (const w of p.weeks) if (w.pick && counts[w.pick] !== undefined) counts[w.pick]++;
  const needed = d.names.filter((x) => !p.weeks.slice(0, d.weeksScored).some((w) => w.pick === x));
  const ruleMsg = p.status ? statusLine(p.status)
    : needed.length ? `<span class="rule-msg">Still to pick: ${needed.map(esc).join(", ")} · ${plural(EPISODES - d.weeksScored, "poll")} left</span>`
    : `<span class="rule-msg ok">✓ Everyone picked at least once</span>`;

  const overview = `
    ${d.weeksScored ? bumpChart(name) : ""}
    <dl class="kv">
      <div><dt>Winner hit</dt><dd>${p.hits}<small>/${p.played}</small></dd></div>
      <div><dt>Avg pick</dt><dd>${(p.played ? p.show / p.played : 0).toFixed(1)}<small class="under">league ${leagueAvg.toFixed(1)}</small></dd></div>
      <div><dt>Best week</dt><dd>${p.best ? `${p.best.show}<small> E${p.best.ep}</small>` : "–"}</dd></div>
      <div><dt>Left on table</dt><dd>${p.missed}</dd></div>
    </dl>
    <div class="rule-track">
      <p class="kicker">Everyone at least once</p>
      <ul>${d.names.map((x) => `<li class="${counts[x] ? "got" : ""}">${framed(d.cast[x])}<b>${counts[x] ? `×${counts[x]}` : "–"}</b></li>`).join("")}</ul>
      ${ruleMsg}
    </div>`;

  const lastShown = d.nextEp ? Math.max(d.nextEp.ep, d.weeksAired) : EPISODES;
  const weeks = `<ol class="pl-weeks">${p.weeks.slice(0, lastShown).map((w, i) => {
    const e = i + 1, st = epState(d, e), c = w.pick ? d.cast[w.pick] : null, win = d.winners[e];
    const res = w.show != null ? `<b>${w.show}</b><small>${ord(w.place)} +${w.league}</small>` : `<small>${st === "scored" ? "no vote" : st === "pending" ? "soon" : w.pick ? "pick in" : "open"}</small>`;
    const note = w.show != null ? (w.won ? `<span class="hit">★ winner</span>` : `<span class="miss">${esc(win.winner)} won, ${win.top}</span>`) : `<span class="miss">${esc(d.raw.episodes[i].title || fmtShortDay.format(d.episodes[i].air))}</span>`;
    return `<li class="${st} ${w.won ? "won" : ""}"><a href="${link("episodes", e)}"><span class="pw-ep">${e}</span>${c ? framed(c, "fp-s") : `<span class="fp-empty"></span>`}<span class="pw-mid"><b>${c ? esc(c.key) : "—"}</b>${note}</span><span class="pw-res">${res}</span></a></li>`;
  }).join("")}</ol>`;

  const plan = name === me && d.nextEp ? planner(name) : `<p class="empty small">${name === me ? "The series is over." : `Only ${esc(name)} can plan their picks here.`}</p>`;
  const subs = ["Overview", "Weeks", "Plan"];
  return `
  <section class="card player">
    ${top}
    <div class="pl-head"><div class="pl-boards">${board("show", "Show")}${board("league", "League")}</div></div>
    <div class="subtabs" role="tablist">${subs.map((s, i) => `<button role="tab" data-go="${i}" data-swiper="pl-swiper" aria-selected="${state.plSub === i}">${s}</button>`).join("")}</div>
    ${swiperHTML("pl-swiper", [overview, weeks, plan])}
  </section>`;
}

export function bumpChart(name) {
  const d = state.d, key = state.sort, n = d.players.length, W = d.weeksScored;
  const w = 640, h = 180, px = 34, py = 12;
  const x = (i) => (W === 1 ? w / 2 : px + (i * (w - px - 14)) / (W - 1));
  const y = (r) => py + ((r - 1) * (h - 2 * py)) / Math.max(1, n - 1);
  const line = (p) => p.history.map((hh, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(hh[key + "Rank"]).toFixed(1)}`).join("");
  const me = d.byName[name];
  const others = d.players.filter((p) => p.name !== name).map((p) => `<path d="${line(p)}" class="bump-o"/>`).join("");
  const dots = me.history.map((hh, i) => `<rect x="${x(i) - 9}" y="${y(hh[key + "Rank"]) - 9}" width="18" height="18" class="bump-dot"/><text x="${x(i)}" y="${y(hh[key + "Rank"]) + 4}" class="bump-n">${hh[key + "Rank"]}</text>`).join("");
  return `
    <figure class="bump">
      <figcaption>${key === "show" ? "Show" : "League"} rank by episode</figcaption>
      <svg viewBox="0 0 ${w} ${h + 16}" role="img" aria-label="${esc(name)}'s ${key} rank after each episode: ${me.history.map((hh) => hh[key + "Rank"]).join(", ")}">
        <text x="0" y="${y(1) + 4}" class="bump-y">1st</text><text x="0" y="${y(n) + 4}" class="bump-y">${ord(n)}</text>
        ${others}<path d="${line(me)}" class="bump-me"/>${dots}
        ${Array.from({ length: W }, (_, i) => `<text x="${x(i)}" y="${h + 14}" class="bump-x">${i + 1}</text>`).join("")}
      </svg>
    </figure>`;
}

export const planKey = (name) => `fm-plan-${state.key}-${name}`;
export function planner(name) {
  const d = state.d, p = d.byName[name], plan = store.get(planKey(name), {});
  const openEps = d.episodes.filter((e) => e.ep > d.weeksAired).map((e) => e.ep);
  const chosen = (e) => p?.weeks[e - 1].pick || plan[e] || null;
  const have = new Set();
  for (let e = 1; e <= EPISODES; e++) { const c = e <= d.weeksAired ? p?.weeks[e - 1].pick : chosen(e); if (c) have.add(c); }
  const needed = d.names.filter((x) => !have.has(x));
  const free = openEps.filter((e) => !chosen(e)).length;
  const msg = !needed.length ? `<p class="plan ok">✓ This plan picks everyone at least once.</p>`
    : needed.length > free ? `<p class="plan bad">Can't fit ${needed.map(esc).join(", ")}: only ${plural(free, "free poll")}.</p>`
    : needed.length === free ? `<p class="plan bad">Every free poll is spoken for: ${needed.map(esc).join(", ")}.</p>`
    : `<p class="plan">Still to fit in: ${needed.map(esc).join(", ")} · ${plural(free, "free poll")}.</p>`;
  return `
    <div class="planner">
      ${msg}
      <ol class="plan-rows">${openEps.map((e) => {
        const entered = p?.weeks[e - 1].pick;
        return `<li><span class="plan-ep">${e}</span><div class="choices" role="radiogroup" aria-label="Episode ${e} plan">${d.names.map((x) => {
          const on = (entered || plan[e]) === x;
          return `<button type="button" role="radio" aria-checked="${on}" aria-label="${esc(x)}" class="choice ${on ? "on" : ""}" ${entered ? "disabled" : ""} data-plan="${e}" data-name="${x}" style="--c:${d.cast[x].color}">${framed(d.cast[x])}</button>`;
        }).join("")}</div></li>`;
      }).join("")}</ol>
      <div class="actions"><button class="btn" data-plan-copy type="button">Copy plan</button><button class="btn ghost" data-plan-clear type="button">Clear</button></div>
      <p class="fine">Saved on this device only. Your real vote is the WhatsApp poll.</p>
    </div>`;
}

// Episodes -------------------------------------------------------------------
