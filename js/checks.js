// The data file's rules, shared by tools/check-data.mjs (run by CI on every
// push) and edit mode (run before anything is saved), so a save from the
// page can't put anything in the file that CI would reject.
import { buildSeries } from "./csv.js";
import { derive } from "./league.js";

/**
 * rows: the data file's records (parseCSV). stats: taskmaster_stats.csv's rows,
 * for the cross-check (optional). Returns { errors, warnings, series }.
 */
export function checkData(rows, stats = []) {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);

  const RECORDS = new Set(["contestant", "player", "episode", "score", "pick"]);
  const bySeries = {};
  rows.forEach((r, i) => {
    const at = `row ${i + 2}`;
    if (!RECORDS.has(r.record)) return err(`${at}: unknown record type "${r.record}"`);
    if (!/^\d+$/.test(r.series)) return err(`${at}: series "${r.series}" is not a number`);
    (bySeries[r.series] ||= []).push({ ...r, at });
  });

  for (const [key, recs] of Object.entries(bySeries)) {
    const S = `Series ${key}`;
    const of = (t) => recs.filter((r) => r.record === t);
    const cast = of("contestant").map((r) => r.contestant);
    const roster = new Set(of("player").map((r) => r.player));

    if (cast.length !== 5) err(`${S}: expected 5 contestants, found ${cast.length}`);
    if (new Set(cast).size !== cast.length) err(`${S}: duplicate contestant names`);
    for (const r of of("contestant")) {
      if (!/^#[0-9a-f]{6}$/i.test(r.accent_color)) warn(`${S} ${r.at}: ${r.contestant} accent_color "${r.accent_color}" isn't a #rrggbb hex`);
      if (!/^https:\/\//.test(r.portrait_url)) err(`${S} ${r.at}: ${r.contestant} portrait_url must be an https link`);
    }

    const eps = of("episode").map((r) => +r.episode).sort((a, b) => a - b);
    if (eps.join() !== "1,2,3,4,5,6,7,8,9,10") err(`${S}: episode rows should be 1–10 exactly once, found ${eps.join(",")}`);
    for (const r of of("episode")) {
      if (!/^\d{1,2} [A-Za-z]{3,} \d{4}$/.test(r.air_date)) err(`${S} ${r.at}: air_date "${r.air_date}" should look like "1 Oct 2026"`);
      if (r.tiebreak_winner && !cast.includes(r.tiebreak_winner)) err(`${S} ${r.at}: tiebreak_winner "${r.tiebreak_winner}" isn't a contestant`);
    }

    // Scores: each task has exactly one row per contestant, consistent type and name.
    const tasks = {};
    for (const r of of("score")) {
      if (!cast.includes(r.contestant)) err(`${S} ${r.at}: score for unknown contestant "${r.contestant}"`);
      if (!"PFTL".includes(r.task_type) || r.task_type.length !== 1) err(`${S} ${r.at}: task_type "${r.task_type}" should be P, F, T or L`);
      if (!/^(\d+|DQ)$/i.test(r.score) || +r.score > 10) err(`${S} ${r.at}: score "${r.score}" should be a whole number 0–10, or DQ`);
      const k = `${r.episode}/${r.task_no}`;
      const t = (tasks[k] ||= { rows: [], at: r.at });
      t.rows.push(r);
    }
    for (const [k, t] of Object.entries(tasks)) {
      const names = t.rows.map((r) => r.contestant);
      const missing = cast.filter((c) => !names.includes(c));
      if (missing.length) err(`${S} ep ${k.replace("/", " task ")}: missing a score for ${missing.join(", ")}`);
      if (new Set(names).size !== names.length) err(`${S} ep ${k.replace("/", " task ")}: a contestant has two scores`);
      if (new Set(t.rows.map((r) => r.task_type + "|" + r.task_name)).size > 1) err(`${S} ep ${k.replace("/", " task ")}: rows disagree on task_type or task_name`);
    }
    const scored = [...new Set(of("score").map((r) => +r.episode))].sort((a, b) => a - b);
    if (scored.some((e, i) => e !== i + 1)) err(`${S}: scored episodes should run from 1 with no gaps, found ${scored.join(",")}`);

    // Picks: known player and contestant, one per player per episode.
    const seen = new Set();
    for (const r of of("pick")) {
      if (!roster.has(r.player)) err(`${S} ${r.at}: pick by "${r.player}", who has no player row`);
      if (!cast.includes(r.contestant)) err(`${S} ${r.at}: pick of unknown contestant "${r.contestant}"`);
      if (!(+r.episode >= 1 && +r.episode <= 10)) err(`${S} ${r.at}: pick for episode "${r.episode}"`);
      const k = `${r.player}/${r.episode}`;
      if (seen.has(k)) err(`${S} ${r.at}: ${r.player} has two picks for episode ${r.episode}`);
      seen.add(k);
    }
  }

  // Top-score ties need a tiebreak winner (and only ties should have one).
  const series = errors.length ? {} : buildSeries(rows);
  for (const [key, raw] of Object.entries(series)) {
    const d = derive(raw, new Date());
    for (const [ep, w] of Object.entries(d.winners)) {
      const tb = raw.episodes[ep - 1].tb;
      if (w.tiebreak && !tb) warn(`Series ${key} ep ${ep}: ${w.tied.join(", ")} tied on ${w.top}; add tiebreak_winner`);
      if (tb && !w.tiebreak) warn(`Series ${key} ep ${ep}: tiebreak_winner set but there was no tie for 1st`);
      if (tb && w.tiebreak && !w.tied.includes(tb)) err(`Series ${key} ep ${ep}: tiebreak_winner ${tb} wasn't one of the tied contestants`);
    }
  }

  // Cross-check against the all-time stats (data/taskmaster_stats.csv, imported
  // by tools/import-stats.mjs): when the stats cover the same number of
  // episodes as the CSV has scored, totals and task-type points should agree.
  if (stats.length) {
    for (const [key, raw] of Object.entries(series)) {
      const d = derive(raw, new Date());
      for (const c of d.contestants) {
        const r = stats.find((s) => +s.series === +key && s.name.trim().toLowerCase() === c.full.trim().toLowerCase());
        if (!r) { warn(`Series ${key}: ${c.full} isn't in the all-time stats`); continue; }
        if (+r.episodes !== d.weeksScored) continue;
        const eps = d.weeksScored, near = (a, b) => Math.abs(a - b) < 0.02;
        const bad = [
          !near(+r.points, c.total) && `total ${c.total} vs ${r.points}`,
          !near(+r.prize_per_ep * eps, c.ty.P) && `prize ${c.ty.P} vs ${(+r.prize_per_ep * eps).toFixed(0)}`,
          !near(+r.live_per_ep * eps, c.ty.L) && `live ${c.ty.L} vs ${(+r.live_per_ep * eps).toFixed(0)}`,
          !near(+r.solo_filmed_points, c.ty.F) && `filmed ${c.ty.F} vs ${r.solo_filmed_points}`,
        ].filter(Boolean);
        if (bad.length) warn(`Series ${key} ${c.full}: the CSV and the all-time stats disagree (${bad.join(", ")}); check task types and scores`);
      }
    }
  }

  return { errors, warnings, series };
}
