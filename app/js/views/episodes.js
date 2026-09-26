import { $, $$, esc, rich, ord, reducedMotion, TYPE, fmtLocal, fmtShortDay, framed, state, swiperHTML } from "../ui.js";
import { epState } from "../stage.js";
import { burstAt } from "../fx.js";

export const selectedEp = () => (state.arg ? +state.arg : state.d.weeksScored || state.d.nextEp?.ep || 1);
export const EP_SUBS = [["league", "League"], ["score", "Scoreboard"], ["tasks", "Tasks"], ["notes", "Write-up"]];

export function viewEpisodes() {
  const d = state.d, sel = selectedEp();
  const pager = d.raw.episodes.map((e) => {
    const st = epState(d, e.ep), w = d.winners[e.ep], c = w && d.cast[w.winner];
    return `<button class="pg ${st} ${e.ep === sel ? "on" : ""}" data-go="${e.ep - 1}" data-swiper="ep-swiper" style="--c:${c ? c.color : "transparent"}" aria-label="Episode ${e.ep}">${e.ep}</button>`;
  }).join("");
  return `
  <div class="pager" aria-label="Episodes">${pager}</div>
  <div class="subtabs" role="tablist">${EP_SUBS.map(([k, l]) => `<button role="tab" data-epsub="${k}" aria-selected="${state.epSub === k}">${l}</button>`).join("")}</div>
  ${swiperHTML("ep-swiper", d.raw.episodes.map((e) => episodeCard(e.ep)), `data-sub="${state.epSub}"`)}`;
}

export function episodeCard(ep) {
  const d = state.d, e = d.raw.episodes[ep - 1], air = d.episodes[ep - 1].air, st = epState(d, ep);
  const head = `<p class="kicker">Episode ${ep} · ${esc(fmtShortDay.format(air))}</p><h2>${e.title ? esc(e.title) : `Episode ${ep}`}</h2>`;
  if (st !== "scored") {
    const msg = st === "pending" ? "Aired. Scores and picks coming soon."
      : st === "next" ? `Sealed until ${esc(fmtLocal.format(air))}. Poll closes in <b data-countdown></b>.`
      : `Sealed until ${esc(fmtLocal.format(air))}.`;
    return `<article class="card ep sealed">${head}<div class="envelope" aria-hidden="true"><span class="env-seal">${ep}</span></div><p class="sealed-msg">${msg}</p></article>`;
  }

  const w = d.winners[ep], c = d.cast[w.winner], tasks = d.epTasks(ep), wk = d.weekly[ep];
  const order = [...d.names].sort((a, b) => d.placing[ep][a] - d.placing[ep][b] || d.EPS[b][ep] - d.EPS[a][ep]);

  const league = `<ol class="lw">${order.map((n) => {
    const cc = d.cast[n], who = wk.by[n];
    return `<li class="${n === w.winner ? "win" : ""}" style="--c:${cc.color}">
      ${framed(cc)}
      <div><div class="lw-head"><b>${esc(n)}</b><span class="lw-place">${ord(d.placing[ep][n])}</span><span class="lw-pts">${d.EPS[n][ep]}<small>S</small> +${d.rankPts[ep][n]}<small>L</small></span></div>
      <div class="lw-who">${who.length ? who.map((pn) => `<span class="chip">${esc(pn)}</span>`).join("") : `<span class="nobody">nobody</span>`}</div></div>
    </li>`;
  }).join("")}</ol>`;

  const score = `
    <div class="race" data-ep="${ep}">
      <div class="race-head"><span class="race-step"></span><button class="btn btn-sm replay" data-ep="${ep}" type="button">▶ Replay</button></div>
      <ol class="race-rows">${d.names.map((n) => `<li class="race-row" data-name="${n}" style="--c:${d.cast[n].color}">${framed(d.cast[n])}<span class="race-name">${esc(n)}</span><span class="race-track"><span class="race-bar"></span></span><b class="race-total">${d.EPS[n][ep]}</b></li>`).join("")}</ol>
    </div>`;

  const taskList = `<ol class="tasks">${tasks.map((t) => {
    const max = Math.max(...t.s), min = Math.min(...t.s);
    return `<li class="task t-${t.t}"><div class="task-h"><span class="stamp">${TYPE[t.t]}</span><b>${esc(t.n)}</b></div>
      <ol class="scores">${d.names.map((n, j) => `<li class="${max !== min && t.s[j] === max ? "top" : max !== min && t.s[j] === min ? "low" : ""}" style="--c:${d.cast[n].color}" title="${esc(n)}">${framed(d.cast[n])}<b>${t.s[j]}</b></li>`).join("")}</ol></li>`;
  }).join("")}</ol>`;

  const notes = `<div class="notes">${e.analysis ? `<p>${rich(e.analysis)}</p>` : `<p>${esc(c.full)} won with ${w.top} points.</p>`}</div>`;

  return `
  <article class="card ep" style="--c:${c.color}">
    <div class="ep-top">${framed(c, "fp-m")}<div>${head}
      <p class="verdict"><b>${esc(c.key)}</b> ${w.tiebreak ? `won a ${w.tied.length}-way tie on ${w.top} after the tiebreak` : `won with ${w.top}`} · ${wk.hits.length}/${wk.voters} backed them · avg ${wk.avgShow.toFixed(1)}</p>
    </div></div>
    <div class="panel" data-panel="league">${league}</div>
    <div class="panel" data-panel="score">${score}</div>
    <div class="panel" data-panel="tasks">${taskList}</div>
    <div class="panel" data-panel="notes">${notes}</div>
  </article>`;
}

export const raceTimers = {};
export function playRace(ep, instant = false) {
  const root = $(`.race[data-ep="${ep}"]`);
  if (!root) return;
  clearTimeout(raceTimers[ep]);
  const d = state.d, tasks = d.epTasks(ep);
  const rows = Object.fromEntries($$(".race-row", root).map((r) => [r.dataset.name, r]));
  const max = Math.max(...d.names.map((n) => d.EPS[n][ep]), 1);
  const rowH = 46;
  $(".race-rows", root).style.height = `${rowH * d.names.length}px`;
  const show = (k) => {
    const tot = Object.fromEntries(d.names.map((n, i) => [n, tasks.slice(0, k).reduce((a, t) => a + t.s[i], 0)]));
    const order = [...d.names].sort((a, b) => tot[b] - tot[a] || (k === tasks.length ? d.placing[ep][a] - d.placing[ep][b] : 0));
    order.forEach((n, i) => {
      const r = rows[n];
      r.style.transform = `translateY(${i * rowH}px)`;
      $(".race-bar", r).style.width = `${(tot[n] / max) * 100}%`;
      $(".race-total", r).textContent = tot[n];
      r.classList.toggle("winner", k === tasks.length && n === d.winners[ep].winner);
    });
    $(".race-step", root).textContent = k === 0 ? "Before task 1" : k === tasks.length ? "Final" : `After task ${k} · ${TYPE[tasks[k - 1].t]}`;
    if (k === tasks.length && !instant) setTimeout(() => burstAt($(".fp", rows[d.winners[ep].winner]), { colors: [d.cast[d.winners[ep].winner].color, "#f4d67a", "#f1e6cc"], count: 50 }), 250);
  };
  if (instant || reducedMotion) { show(tasks.length); return; }
  let k = 0;
  const step = () => { show(k); if (k++ < tasks.length) raceTimers[ep] = setTimeout(step, k === 1 ? 350 : 650); };
  step();
}

// Cast -----------------------------------------------------------------------

/** Contestants in standings order, last place on the left and first on the right. */
