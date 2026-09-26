// Imports the all-time Taskmaster contestant stats (every contestant in every
// series) from the league's shared Google Sheet into data/taskmaster_stats.csv.
// The sheet has one tab per episode snapshot; its first tab is the latest,
// which is what the CSV export returns. Only the columns the app uses are
// kept, under short names. Re-run after the sheet is updated:
//   node tools/import-stats.mjs            (fetches the sheet)
//   node tools/import-stats.mjs file.csv   (uses a CSV you exported yourself)

import { readFileSync, writeFileSync } from "node:fs";
import { parseCSV } from "../app/js/csv.js";

const SHEET = "1S8L34lUyaaV78K02_eAAS-URsKxrWxY1aHT9qKXSoe8";
const OUT = new URL("../data/taskmaster_stats.csv", import.meta.url);

// short name ← the sheet's column header
const COLUMNS = {
  series: "Series",
  name: "Contestant",
  episodes: "Total Episodes",
  tasks: "Total Tasks",
  points: "Total Points",
  prize_per_ep: "Prize Task Points Per Ep",
  live_per_ep: "Live Task Points Per Ep",
  solo_filmed_points: "Solo Filmed Task Points",
  solo_filmed_tasks: "Solo Filmed Tasks",
  first_or_last_pct: "Combined % of Times Contestant Came First Or Last (Solo Tasks)",
  dq_pct: "% of tasks ending in DQ/0 Points",
  subj_minus_obj: "Difference Between Subjective and Objective Task Scores",
  fastest_ppt: "Points Per Fastest Wins Task",
  solo_win_pct: "% of Solo Task Won",
  solo_last_pct: "% of Last Place In Solo Task",
  episode_win_pct: "% of Episodes Won",
  team_ppt: "Points Per Team Task",
  dob: "Date of birth",
  star_sign: "Star sign",
  age: "Age at first show broadcast date",
  seat: "Seat Position",
  degree: "University Degree",
  footlights: "Footlights?",
  birth_place: "Birth place",
  birth_country: "Birth Country",
  height_cm: "Height in cm",
  children: "Number of children at time of recording",
  siblings: "Siblings",
  edinburgh_award: "Edinburgh Comedy Award Winner?",
  doctor_who: "Appeared in Doctor Who",
  ghosts: 'Appeared in "Ghosts"',
  biggest_film: "Name of Biggest Major Motion Picture",
  marathon: "Have They Run The London Marathon (or similar?)",
};

const text = process.argv[2]
  ? readFileSync(process.argv[2], "utf8")
  : await (await fetch(`https://docs.google.com/spreadsheets/d/${SHEET}/export?format=csv`)).text();
const rows = parseCSV(text).filter((r) => r.Contestant && /^\d+(\.0)?$/.test(r.Series));
const missing = Object.values(COLUMNS).filter((h) => !(h in rows[0]));
if (missing.length) throw new Error(`The sheet has no column(s): ${missing.join("; ")}`);

const clean = (v) => {
  v = (v ?? "").trim();
  if (/^-?\d+(\.\d+)?%$/.test(v)) return String(+v.slice(0, -1)); // "45.10%" → "45.1"
  if (/^-?\d+\.0+$/.test(v)) return String(+v);                    // "22.0" → "22"
  return v;
};
const cell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const keys = Object.keys(COLUMNS);
const lines = [keys.join(","), ...rows.map((r) => keys.map((k) => cell(clean(r[COLUMNS[k]]))).join(","))];
writeFileSync(OUT, lines.join("\n") + "\n");
const series = [...new Set(rows.map((r) => clean(r.Series)))];
console.log(`✓ ${rows.length} contestants, series ${series[0]}–${series.at(-1)} → data/taskmaster_stats.csv`);
