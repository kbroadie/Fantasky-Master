// Loads data/fantasky_master_data.csv (the single hand-edited source, see
// data/README.md) and shapes it into one object per series for league.js.

export const CSV_URL = "../data/fantasky_master_data.csv";

/**
 * RFC 4180 CSV → rows of raw fields (nothing trimmed; blank lines dropped).
 * toCSV() writes them back byte for byte, so the editor can change a few rows
 * of the data file without touching the rest.
 */
export function parseRows(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

/** Rows → CSV text, quoting only the fields that need it (as the data file does). */
export const toCSV = (rows) => rows.map((r) => r.map((f) => (/[",\r\n]/.test(f) ? `"${f.replace(/"/g, '""')}"` : f)).join(",")).join("\n") + "\n";

/** RFC 4180 CSV → array of objects keyed by the header row. */
export function parseCSV(text) {
  const [head, ...body] = parseRows(text.replace(/^\uFEFF/, ""));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
/** "1 Oct 2026" → "2026-10-01" */
function isoDate(s) {
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (!m) throw new Error(`Unreadable air_date "${s}"`);
  return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** Imgur direct links → the smaller "m" WebP rendition of the same image. */
function portrait(url) {
  const m = url.match(/^https:\/\/i\.imgur\.com\/([A-Za-z0-9]+)\.(png|jpe?g|webp)$/);
  return m ? `https://i.imgur.com/${m[1]}m.webp` : url;
}

export function buildSeries(records) {
  const out = {};
  const S = (k) => (out[k] ||= { cast: [], players: [], episodes: [], tasks: [], picks: {} });
  const taskIdx = {};

  for (const r of records) {
    const s = S(r.series);
    switch (r.record) {
      case "contestant":
        s.cast.push({
          key: r.contestant, full: r.full_name, color: r.accent_color || "#b8862b",
          img: portrait(r.portrait_url), bio: r.bio,
        });
        break;
      case "player":
        s.players.push(r.player);
        break;
      case "episode":
        s.episodes.push({
          ep: +r.episode,
          title: /^Episode \d+$/i.test(r.title) || !r.title ? null : r.title,
          date: isoDate(r.air_date),
          tb: r.tiebreak_winner || undefined,
        });
        break;
      case "score": {
        const key = `${r.series}|${r.episode}|${r.task_no}`;
        let t = taskIdx[key];
        if (!t) {
          t = taskIdx[key] = {
            ep: +r.episode, no: +r.task_no, t: r.task_type,
            n: r.task_name.replace(/^(Prize|Team|Live):\s*/i, ""), scores: {},
          };
          s.tasks.push(t);
        }
        // "DQ" is a disqualification: 0 points, marked as such in the app.
        const dq = /^dq$/i.test(r.score.trim());
        t.scores[r.contestant] = dq ? 0 : +r.score;
        if (dq) (t.dqs ||= new Set()).add(r.contestant);
        break;
      }
      case "pick":
        (s.picks[r.player] ||= [])[+r.episode - 1] = r.contestant;
        break;
    }
  }

  for (const s of Object.values(out)) {
    // Seating order is alphabetical by first name.
    s.cast.sort((a, b) => a.key.localeCompare(b.key));
    s.episodes.sort((a, b) => a.ep - b.ep);
    s.tasks.sort((a, b) => a.ep - b.ep || a.no - b.no);
    for (const t of s.tasks) {
      t.s = s.cast.map((c) => t.scores[c.key] ?? 0);
      t.dq = s.cast.map((c) => !!t.dqs?.has(c.key));
    }
    for (const p of s.players) s.picks[p] ||= [];
    for (const p of Object.keys(s.picks)) s.picks[p] = Array.from({ length: 10 }, (_, i) => s.picks[p][i] || null);
  }
  return out;
}

/**
 * The data file as text. "no-cache" revalidates with the server every time
 * (a quick 304 when nothing changed), so a pick saved from edit mode shows for
 * everyone as soon as the site redeploys, not when a cached copy expires.
 */
export async function loadText() {
  const res = await fetch(CSV_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Couldn't load league data (${res.status})`);
  return res.text();
}
