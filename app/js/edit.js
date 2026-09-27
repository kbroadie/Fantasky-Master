// Edit mode: the commissioner's way to enter picks and episode scores from the
// page itself. Tap all seven footer ducks to open it. Changes show on the page
// straight away and stay local until Save, which writes them into
// data/fantasky_master_data.csv on GitHub (the Contents API), so they're live
// for everyone once Pages redeploys, about a minute later.
//
// Saving needs a GitHub fine-grained token that can edit this repo's contents.
// It's kept in this browser's localStorage only, never in the site. The ducks
// just open the door; the token is the lock.
//
// Every change is an op ({ pick } or { scores }) replayed onto the file: first
// onto the copy the page loaded (so the page updates), then, on Save, onto a
// fresh copy from GitHub (so nobody else's edits are overwritten). The file is
// checked with the same rules CI runs (checks.js) before it's sent.
import { $, esc, framed, state } from "./ui.js";
import { parseRows, toCSV, parseCSV } from "./csv.js";
import { checkData } from "./checks.js";

const REPO = "kbroadie/Fantasky-Master", BRANCH = "main", PATH = "data/fantasky_master_data.csv";
const FILE_API = `https://api.github.com/repos/${REPO}/contents/${PATH}`;
const KEY = "fm-gh-key";
const PREFIX = { P: "Prize: ", T: "Team: ", L: "Live: ", F: "" };
const TYPES = { P: "Prize", F: "Filmed", T: "Team", L: "Live" };

let base = "", ops = [], onData = () => {};
const drafts = {}; // open score grids, by "series/ep"

const store = {
  get: () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } },
  set: (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* private mode: key lasts the visit */ } },
};
let memKey = "";
const token = () => store.get() || memKey;

// ── The data file: ops on its rows ──────────────────────────────────────────

const colsOf = (rows) => Object.fromEntries(rows[0].map((h, i) => [h.replace(/^﻿/, "").trim(), i]));

/** Where an episode's rows are: its episode row, and the end of its block. */
function block(rows, C, s, ep) {
  const at = rows.findIndex((r) => r[C.record] === "episode" && r[C.series] === s && +r[C.episode] === ep);
  let end = at + 1;
  while (end < rows.length && rows[end][C.series] === s && rows[end][C.record] !== "episode" && rows[end][C.record] !== "contestant" && rows[end][C.record] !== "player") end++;
  return { at, end };
}

function applyPick(rows, { s, ep, player, c }) {
  const C = colsOf(rows);
  const i = rows.findIndex((r) => r[C.record] === "pick" && r[C.series] === s && +r[C.episode] === ep && r[C.player] === player);
  if (i >= 0) { if (c) rows[i][C.contestant] = c; else rows.splice(i, 1); return; }
  if (!c) return;
  const row = Array(rows[0].length).fill("");
  Object.assign(row, { [C.record]: "pick", [C.series]: s, [C.episode]: String(ep), [C.player]: player, [C.contestant]: c });
  // In the episode's block, among its picks in player order.
  const { at, end } = block(rows, C, s, ep);
  if (at < 0) throw new Error(`Series ${s} has no episode ${ep}`);
  let pos = end;
  for (let j = at + 1; j < end; j++) if (rows[j][C.record] === "pick" && rows[j][C.player].localeCompare(player) > 0) { pos = j; break; }
  rows.splice(pos, 0, row);
}

function applyScores(rows, { s, ep, tasks, cast, tb, title }) {
  const C = colsOf(rows);
  for (let j = rows.length - 1; j >= 0; j--) if (rows[j][C.record] === "score" && rows[j][C.series] === s && +rows[j][C.episode] === ep) rows.splice(j, 1);
  const { at } = block(rows, C, s, ep);
  if (at < 0) throw new Error(`Series ${s} has no episode ${ep}`);
  const out = tasks.flatMap((t, i) => cast.map((key, j) => {
    const row = Array(rows[0].length).fill("");
    Object.assign(row, { [C.record]: "score", [C.series]: s, [C.episode]: String(ep), [C.task_no]: String(i + 1),
      [C.task_type]: t.t, [C.task_name]: PREFIX[t.t] + t.name, [C.contestant]: key, [C.score]: String(t.scores[j]) });
    return row;
  }));
  rows.splice(at + 1, 0, ...out);
  rows[at][C.tiebreak_winner] = tb || "";
  if (title) rows[at][C.title] = title;
}

const apply = (rows, op) => (op.kind === "pick" ? applyPick : applyScores)(rows, op);
const replay = (text) => { const rows = parseRows(text); for (const op of ops) apply(rows, op); return toCSV(rows); };

function addOp(op) {
  const same = (o) => o.kind === op.kind && o.s === op.s && o.ep === op.ep && (op.kind !== "pick" || o.player === op.player);
  ops = ops.filter((o) => !same(o)).concat(op);
  onData(replay(base));
  status();
}

// ── GitHub ──────────────────────────────────────────────────────────────────

const gh = (url, opts = {}) => fetch(url, {
  ...opts, cache: "no-store",
  headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token()}`, "X-GitHub-Api-Version": "2022-11-28", ...opts.headers },
});

function b64encode(s) {
  const b = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(bin);
}
const b64decode = (s) => new TextDecoder("utf-8", { ignoreBOM: true }).decode(Uint8Array.from(atob(s.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

async function getFile() {
  const res = await gh(`${FILE_API}?ref=${BRANCH}`);
  if (res.status === 401) throw new Error("GitHub didn't accept the key. It may have expired; tap Key to paste a new one.");
  if (res.status === 404) throw new Error(`The key can't see ${REPO}. Give it access to that repository.`);
  if (!res.ok) throw new Error(`GitHub said ${res.status}`);
  const j = await res.json();
  return { sha: j.sha, text: b64decode(j.content) };
}

function message() {
  const picks = ops.filter((o) => o.kind === "pick"), scores = ops.filter((o) => o.kind === "scores");
  const lines = [
    ...scores.map((o) => `Scores: Series ${o.s} Ep ${o.ep}${o.src ? ` (${o.src})` : ""}`),
    ...[...new Set(picks.map((o) => `${o.s}/${o.ep}`))].map((k) => {
      const [s, ep] = k.split("/"), these = picks.filter((o) => `${o.s}/${o.ep}` === k);
      return `Picks: Series ${s} Wk ${ep} (${these.map((o) => `${o.player}: ${o.c || "none"}`).join(", ")})`;
    }),
  ];
  return `${lines.length > 1 ? `${lines.length} edits from edit mode` : lines[0]}\n\n${lines.join("\n")}\n\nSaved from the app's edit mode.`;
}

async function save() {
  if (!ops.length) return;
  status("Saving…", "busy");
  try {
    for (let attempt = 0; ; attempt++) {
      const { sha, text } = await getFile();
      const out = replay(text);
      const { errors, warnings } = checkData(parseCSV(out));
      if (errors.length) throw new Error(`Not saved: ${errors.slice(0, 3).join(" · ")}`);
      if (warnings.length && attempt === 0 && !confirm(`${warnings.join("\n")}\n\nSave anyway?`)) { status(); return; }
      const res = await gh(FILE_API, { method: "PUT", body: JSON.stringify({ message: message(), content: b64encode(out), sha, branch: BRANCH }) });
      // Someone else saved in between: start again from their copy.
      if ((res.status === 409 || res.status === 422) && attempt < 2) continue;
      if (res.status === 403 || res.status === 404) throw new Error("The key can read but not save. Give it Contents: Read and write.");
      if (!res.ok) throw new Error(`GitHub said ${res.status}${res.status === 422 ? " (the file changed; try again)" : ""}`);
      base = out;
      ops = [];
      onData(base);
      status("Saved. Live for everyone in about a minute.", "ok");
      return;
    }
  } catch (e) {
    status(e.message, "bad");
  }
}

// ── Opening: the ducks, the key, the bar ────────────────────────────────────

let lit = 0, litTimer = 0;
function duck(dk) {
  if (state.edit || dk.classList.contains("lit")) return;
  dk.classList.add("lit");
  lit++;
  clearTimeout(litTimer);
  const all = () => document.querySelectorAll("#foot .dk.lit").forEach((x) => x.classList.remove("lit"));
  if (lit >= 7) { lit = 0; setTimeout(() => { all(); open(); }, 250); return; }
  // Leave it half done and they go out again.
  litTimer = setTimeout(() => { lit = 0; all(); }, 4000);
}

function open() {
  if (token()) return start();
  keyDialog();
}

function keyDialog() {
  let dlg = $("#ed-key");
  if (!dlg) {
    document.body.insertAdjacentHTML("beforeend", `
      <dialog id="ed-key" class="ed-dialog">
        <form method="dialog">
          <h2>Edit mode</h2>
          <p>Saving writes picks and scores into the league's data on GitHub. Paste a GitHub key that can edit it. It stays in this browser and is never part of the site.</p>
          <ol>
            <li>On GitHub, open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">a new fine-grained token</a>.</li>
            <li>Repository access: <b>Only select repositories</b>, then <b>Fantasky-Master</b>.</li>
            <li>Permissions: <b>Contents</b>, <b>Read and write</b>.</li>
            <li>Generate it, copy it and paste it here.</li>
          </ol>
          <input id="ed-key-in" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…" aria-label="GitHub key">
          <p class="ed-msg" id="ed-key-msg"></p>
          <div class="ed-actions">
            <button type="button" class="ed-btn" data-ed="forget">Forget key</button>
            <span></span>
            <button type="button" class="ed-btn" value="cancel" data-ed="cancel">Cancel</button>
            <button type="submit" class="ed-btn gold" data-ed="use">Start editing</button>
          </div>
        </form>
      </dialog>`);
    dlg = $("#ed-key");
    dlg.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-ed]");
      if (!b) return;
      if (b.dataset.ed === "cancel") return dlg.close();
      if (b.dataset.ed === "forget") { store.set(""); memKey = ""; $("#ed-key-in").value = ""; $("#ed-key-msg").textContent = "Key forgotten on this device."; b.hidden = true; return; }
      if (b.dataset.ed === "use") {
        e.preventDefault();
        const v = $("#ed-key-in").value.trim(), msg = $("#ed-key-msg");
        if (!v) { msg.textContent = "Paste the key first."; return; }
        const prev = memKey;
        memKey = v;
        msg.textContent = "Checking…";
        try {
          if (store.get() !== v) store.set("");
          await getFile();
          store.set(v);
          dlg.close();
          start();
        } catch (err) { memKey = prev; msg.textContent = err.message; }
      }
    });
  }
  $("#ed-key-in").value = "";
  $("#ed-key-msg").textContent = "";
  dlg.querySelector('[data-ed="forget"]').hidden = !token();
  dlg.showModal();
}

function start() {
  if (state.edit) return;
  state.edit = true;
  document.body.classList.add("editing");
  if (!$("#ed-bar")) {
    document.body.insertAdjacentHTML("beforeend", `
      <div class="ed-bar" id="ed-bar" role="region" aria-label="Edit mode">
        <span class="ed-status" id="ed-status" aria-live="polite"></span>
        <button type="button" class="ed-btn" data-ed="key">Key</button>
        <button type="button" class="ed-btn gold" data-ed="save">Save</button>
        <button type="button" class="ed-btn" data-ed="done">Done</button>
      </div>`);
    $("#ed-bar").addEventListener("click", (e) => {
      const b = e.target.closest("[data-ed]")?.dataset.ed;
      if (b === "save") save();
      if (b === "key") keyDialog();
      if (b === "done") stop();
    });
  }
  status();
  onData(replay(base));
}

function stop() {
  if (ops.length && !confirm(`Discard ${ops.length} unsaved change${ops.length > 1 ? "s" : ""}?`)) return;
  ops = [];
  for (const k of Object.keys(drafts)) delete drafts[k];
  state.edit = false;
  document.body.classList.remove("editing");
  onData(base);
}

function status(text, kind = "") {
  const el = $("#ed-status");
  if (!el) return;
  const n = ops.length;
  el.textContent = text || (n ? `${n} unsaved change${n > 1 ? "s" : ""}` : "Edit mode · all saved");
  el.className = `ed-status ${kind}`;
  $('#ed-bar [data-ed="save"]').disabled = !n || kind === "busy";
}

// ── Picks (Standings rows) ──────────────────────────────────────────────────

/** In edit mode, an opened row chooses the player's pick for the week on show. */
export function pickChooser(d, p, w) {
  const cur = p.weeks[w - 1]?.pick ?? null;
  const opts = d.names.map((n) => `<button type="button" class="pk${cur === n ? " on" : ""}" data-pick="${esc(n)}" aria-pressed="${cur === n}">${framed(d.cast[n])}<b style="color:${d.cast[n].color}">${esc(n)}</b></button>`).join("");
  return `<div class="pk-edit" data-player="${esc(p.name)}" data-week="${w}">
    <p class="pk-edit-h">Wk ${w} pick</p>
    <div class="pk-choose">${opts}<button type="button" class="pk pk-none${cur == null ? " on" : ""}" data-pick="" aria-pressed="${cur == null}"><span class="pk-blank">–</span><b>None</b></button></div>
  </div>`;
}

// ── Scores (Episodes) ───────────────────────────────────────────────────────

const draftKey = (ep) => `${state.key}/${ep}`;

/** In edit mode, each aired episode starts with a card to enter its scores. */
export function scoresCard(d, e, order) {
  const dr = drafts[draftKey(e.ep)];
  const pending = ops.some((o) => o.kind === "scores" && o.s === state.key && o.ep === e.ep);
  const head = (right) => `<div class="card-head"><span>Scores</span><span class="legend">${right}</span></div>`;
  if (!dr) {
    return `<div class="card ed-card" data-ep="${e.ep}" data-order="${esc(order.join("|"))}">${head(pending ? "changed, not saved yet" : e.ep <= d.weeksScored ? "entered" : "not entered yet")}
      <div class="ed-actions ed-pad">
        <button type="button" class="ed-btn gold" data-ed="wiki">Get from the wiki</button>
        <button type="button" class="ed-btn" data-ed="hand">${e.ep <= d.weeksScored ? "Edit" : "Enter by hand"}</button>
      </div></div>`;
  }
  if (dr.loading) return `<div class="card ed-card" data-ep="${e.ep}" data-order="${esc(order.join("|"))}">${head("Taskmaster Wiki")}<p class="ed-note">Asking the wiki…</p></div>`;
  const opt = (v, label, on) => `<option value="${esc(v)}"${on ? " selected" : ""}>${esc(label)}</option>`;
  const heads = `<div class="ed-scores ed-heads">${order.map((n) => `<span style="color:${d.cast[n].color}">${esc(n.slice(0, 3))}</span>`).join("")}</div>`;
  const tasks = dr.tasks.map((t, i) => `
    <div class="ed-task" data-i="${i}">
      <div class="ed-line">
        <span class="ed-no">${i + 1}</span>
        <select data-f="t" aria-label="Task ${i + 1} type">${Object.entries(TYPES).map(([k, v]) => opt(k, v, t.t === k)).join("")}</select>
        <input data-f="name" value="${esc(t.name)}" aria-label="Task ${i + 1} name" placeholder="Task name">
        <button type="button" class="ed-x" data-ed="del" aria-label="Remove task ${i + 1}">×</button>
      </div>
      <div class="ed-scores">${order.map((n) => `<input data-f="s" data-who="${esc(n)}" value="${esc(t.scores[n] ?? "")}" maxlength="2" autocapitalize="characters" autocomplete="off" aria-label="${esc(n)}, task ${i + 1}">`).join("")}</div>
    </div>`).join("");
  return `<div class="card ed-card open" data-ep="${e.ep}" data-order="${esc(order.join("|"))}">${head(dr.src ? "from the Taskmaster Wiki" : "by hand")}
    <div class="ed-form">
      ${dr.error ? `<p class="ed-msg bad">${esc(dr.error)}</p>` : ""}
      ${dr.warnings?.length ? dr.warnings.map((w) => `<p class="ed-msg">${esc(w)}</p>`).join("") : ""}
      <label class="ed-field"><span>Title</span><input data-f="title" value="${esc(dr.title)}" placeholder="Episode ${e.ep}"></label>
      ${heads}${tasks}
      <div class="ed-actions"><button type="button" class="ed-btn" data-ed="add">+ Task</button><span></span><button type="button" class="ed-btn" data-ed="wiki">Get from the wiki</button></div>
      <label class="ed-field"><span>Tiebreak</span><select data-f="tb">${opt("", "None", !dr.tb)}${order.map((n) => opt(n, n, dr.tb === n)).join("")}</select></label>
      <p class="ed-hint">Scores are whole numbers, or DQ for a disqualification.</p>
      <div class="ed-actions">
        <span></span>
        <button type="button" class="ed-btn" data-ed="cancel">Cancel</button>
        <button type="button" class="ed-btn gold" data-ed="use">Use these</button>
      </div>
    </div></div>`;
}

/** The episode's scores as they are now, for the grid. */
function current(d, ep) {
  const e = d.episodes[ep - 1];
  return {
    title: e.title || "", tb: e.tb || "",
    tasks: d.epTasks(ep).map((t) => ({ t: t.t, name: t.n, scores: Object.fromEntries(d.names.map((n, i) => [n, t.dq?.[i] ? "DQ" : t.s[i]])) })),
  };
}

/** Read the grid back into its draft (so a re-render keeps what was typed). */
function readGrid(card) {
  const dr = drafts[draftKey(+card.dataset.ep)];
  if (!dr?.tasks) return dr;
  dr.title = card.querySelector('[data-f="title"]')?.value.trim() ?? dr.title;
  dr.tb = card.querySelector('[data-f="tb"]')?.value ?? dr.tb;
  card.querySelectorAll(".ed-task").forEach((el) => {
    const t = dr.tasks[+el.dataset.i];
    t.t = el.querySelector('[data-f="t"]').value;
    t.name = el.querySelector('[data-f="name"]').value.trim();
    for (const inp of el.querySelectorAll('[data-f="s"]')) t.scores[inp.dataset.who] = inp.value.trim().toUpperCase();
  });
  return dr;
}

async function fromWiki(card, d, ep, redraw) {
  const k = draftKey(ep), was = drafts[k]?.tasks ? readGrid(card) : null;
  drafts[k] = { loading: true };
  redraw();
  try {
    const { fetchEpisode } = await import("./wiki.js");
    const cast = d.names.map((n) => ({ key: n, full: d.cast[n].full }));
    const w = await fetchEpisode(state.key, ep, cast);
    const now = current(d, ep);
    drafts[k] = {
      src: w.page, warnings: w.warnings,
      title: now.title && !/^Episode \d+$/.test(now.title) ? now.title : w.title,
      tb: w.tiebreak,
      tasks: w.tasks.map((t, i) => {
        // Keep the names already in the data file, and its DQs (the wiki often shows a DQ as 0).
        const had = now.tasks[i];
        const scores = Object.fromEntries(d.names.map((n, j) => [n, t.scores[j] === 0 && had?.scores[n] === "DQ" ? "DQ" : t.scores[j] ?? ""]));
        return { t: t.t, name: had && had.t === t.t ? had.name : t.name, scores };
      }),
    };
  } catch (e) {
    drafts[k] = was ? { ...was, error: e.message } : { ...current(d, ep), error: `${e.message}. You can enter them by hand.` };
  }
  redraw();
}

function useGrid(card, d, ep) {
  const dr = readGrid(card);
  let bad = 0;
  card.querySelectorAll(".bad").forEach((x) => x.classList.remove("bad"));
  card.querySelectorAll(".ed-task").forEach((el) => {
    const name = el.querySelector('[data-f="name"]');
    if (!name.value.trim()) { name.classList.add("bad"); bad++; }
    for (const inp of el.querySelectorAll('[data-f="s"]')) if (!/^(\d{1,2}|DQ)$/i.test(inp.value.trim()) || +inp.value > 10) { inp.classList.add("bad"); bad++; }
  });
  if (!dr.tasks.length) bad++;
  if (bad) { dr.error = dr.tasks.length ? "Fill in the marked boxes: every score is 0–10 or DQ." : "Add at least one task."; return false; }
  addOp({
    kind: "scores", s: state.key, ep, cast: d.names, tb: dr.tb, title: dr.title, src: dr.src ? "Taskmaster Wiki" : "",
    tasks: dr.tasks.map((t) => ({ t: t.t, name: t.name, scores: d.names.map((n) => t.scores[n]) })),
  });
  delete drafts[draftKey(ep)];
  return true;
}

// ── Setup ───────────────────────────────────────────────────────────────────

/**
 * text: the data file as the page loaded it. onChange(text): re-render the
 * page from this text (called on every change, after a save, and on leaving).
 */
export function initEdit(text, onChange) {
  base = text;
  onData = onChange;

  $("#foot").addEventListener("click", (e) => { const dk = e.target.closest(".dk"); if (dk) duck(dk); });

  // Standings: choose a pick.
  $("#p-standings").addEventListener("click", (e) => {
    const b = e.target.closest(".pk-edit [data-pick]");
    if (!b || !state.edit) return;
    const box = b.closest(".pk-edit");
    addOp({ kind: "pick", s: state.key, ep: +box.dataset.week, player: box.dataset.player, c: b.dataset.pick || null });
  });

  // Episodes: the scores card.
  const eps = $("#ep-body");
  eps.addEventListener("input", (e) => { const card = e.target.closest(".ed-card.open"); if (card) readGrid(card); });
  eps.addEventListener("click", (e) => {
    const b = e.target.closest(".ed-card [data-ed]");
    if (!b || !state.edit) return;
    const card = b.closest(".ed-card"), ep = +card.dataset.ep, k = draftKey(ep), d = state.d;
    const redraw = () => {
      const el = eps.querySelector(`.ed-card[data-ep="${ep}"]`);
      if (el) el.outerHTML = scoresCard(d, d.episodes[ep - 1], el.dataset.order.split("|"));
    };
    const what = b.dataset.ed;
    if (what === "wiki") return fromWiki(card, d, ep, redraw);
    if (what === "hand") { drafts[k] = current(d, ep); if (!drafts[k].tasks.length) drafts[k].tasks = [blankTask(d)]; }
    if (what === "cancel") delete drafts[k];
    if (what === "add") readGrid(card).tasks.push(blankTask(d));
    if (what === "del") readGrid(card).tasks.splice(+b.closest(".ed-task").dataset.i, 1);
    if (what === "use") {
      // Invalid boxes are outlined in place; a redraw would lose that.
      if (!useGrid(card, d, ep)) {
        const form = card.querySelector(".ed-form");
        let msg = form.querySelector(".ed-msg.bad");
        if (!msg) form.insertAdjacentHTML("afterbegin", `<p class="ed-msg bad"></p>`), msg = form.querySelector(".ed-msg.bad");
        msg.textContent = drafts[k].error;
        delete drafts[k].error;
        card.querySelector(".bad:not(.ed-msg)")?.focus();
      }
      return;
    }
    redraw();
  });
}

const blankTask = (d) => ({ t: "F", name: "", scores: Object.fromEntries(d.names.map((n) => [n, ""])) });
