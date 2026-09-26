// Validates data/fantasky_master_data.csv and checks the scoring engine against
// the worked example in FANTASKY_MASTER_EXPLAINED.md. No dependencies:
//   node tools/check-data.mjs
// Exits non-zero on any error; warnings are printed but don't fail.

import { readFileSync } from "node:fs";
import { parseCSV, buildSeries } from "../app/js/csv.js";
import { derive } from "../app/js/league.js";

const CSV = process.env.FM_CSV || new URL("../data/fantasky_master_data.csv", import.meta.url);
const errors = [], warnings = [];
const err = (m) => errors.push(m), warn = (m) => warnings.push(m);

const rows = parseCSV(readFileSync(CSV, "utf8"));
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
    if (!/^\d+$/.test(r.score) || +r.score > 10) err(`${S} ${r.at}: score "${r.score}" should be a whole number 0–10`);
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

// Regression: the worked example in FANTASKY_MASTER_EXPLAINED.md §7.
if (series[22]) {
  const d = derive(series[22], new Date());
  const riley = d.byName.Riley?.history?.[3];
  if (!riley || riley.show !== 67 || riley.league !== 14) err(`Worked example: Riley after Series 22 ep 4 should be 67 Show / 14 League, got ${riley ? `${riley.show} / ${riley.league}` : "nothing"}`);
  const ep2 = d.rankPts[2];
  const want = { Richard: 5, Matt: 4, Nina: 4, Isy: 2, Chloe: 1 };
  if (!ep2 || Object.entries(want).some(([n, p]) => ep2[n] !== p)) err(`Worked example: Series 22 ep 2 placement points should be ${JSON.stringify(want)}, got ${JSON.stringify(ep2)}`);
}

for (const w of warnings) console.warn(`warning: ${w}`);
for (const e of errors) console.error(`error: ${e}`);
console.log(errors.length ? `✗ ${errors.length} error(s)` : `✓ ${rows.length} rows OK${warnings.length ? `, ${warnings.length} warning(s)` : ""}`);
process.exit(errors.length ? 1 : 0);
