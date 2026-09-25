# Fantasky Master — Complete Technical and Functional Explanation

This document describes the Fantasky Master web app in full: what it is for, how its data is structured, every calculation it performs, and every screen and interaction. It is written to be read by a language model (or a new developer) who has not seen the code. Terms are defined before they are used, formulas are given explicitly, and a fully worked example is included.

The document describes `index.html` as of the fixes that make early picks score nothing and compute the cast average per aired episode.

---

## 1. One-paragraph summary

Fantasky Master is a **fantasy league for the British TV comedy panel show _Taskmaster_**. Each series of Taskmaster has 5 celebrity **contestants** who compete over 10 **episodes**; in every episode they attempt several **tasks** and each receives 0–5 points per task (occasionally 6). In the fantasy league, a group of friends (**players**) each **pick one contestant per episode**. A player earns points based on how well their picked contestant did that week. The app shows the league table (**Standings**), a breakdown of every episode (**Episodes**), and a profile of every contestant (**Cast**). It supports two series (Series 21, finished; Series 22, in progress) and a toggle between them.

---

## 2. Glossary (read this first)

| Term | Meaning |
|---|---|
| **Series** | One season of Taskmaster. The app contains Series 21 (`s21`, complete, 10 episodes aired) and Series 22 (`s22`, in progress). |
| **Contestant** / **cast member** | One of the 5 comedians competing on the TV show in a series. Series 22: Richard, Matt, Isy, Chloe, Nina. Series 21: Amy, Armando, Joanna, Joel, Kumail. |
| **Episode** (ep) | One of 10 weekly broadcasts, numbered 1–10. |
| **Task** | A single challenge within an episode. Each contestant gets a score for each task. |
| **Task type** | Every task is one of four types: **P** = Prize task, **F** = Filmed task, **T** = Team task, **L** = Live (studio) task. |
| **Player** | A person in the fantasy league (e.g. Kevin, Riley, Julia). Players are *not* on the TV show. |
| **Pick** | The contestant a player chose for a specific episode. |
| **Weeks aired** (`WEEKS_AIRED`) | How many episodes of the active series have been broadcast and scored. Series 21 = 10, Series 22 = 4. Episodes after this number are "upcoming". |
| **Show points** — the **Show** column (internally **PvE**, "player vs environment") | A player's raw fantasy score: the sum of the actual episode points scored by each contestant they picked. |
| **League points** — the **League** column (internally **PvP**, "player vs player") | A player's placement score: each week the 5 contestants are ranked by that episode's score and awarded 5/4/3/2/1 "rank points"; a player earns the rank points of their pick. |
| **Rank delta** | How many places a player moved in the standings since the previous week (positive = moved up). These are entered by hand, not computed. |

---

## 3. Technology and structure

- **One file.** The entire app is `index.html`: an HTML skeleton, one embedded `<style>` block (plain CSS with custom properties/variables; no Tailwind, no preprocessor), and one embedded `<script>` block (plain JavaScript; no React/Vue/framework, no build step, no dependencies).
- **Hosting.** GitHub Pages serves the file at `https://kbroadie.github.io/Fantasky-Master/` directly from the `main` branch of `kbroadie/Fantasky-Master`.
- **No backend, no storage.** All league data is hard-coded as JavaScript constants inside the file. Nothing is saved; there is no login. Updating the league means editing the file (see §11).
- **External resources.** Google Fonts (Libre Caslon Display, Libre Caslon Text, Libre Franklin) and contestant portrait images hot-linked from `i.imgur.com`. If an image fails to load, a text placeholder is shown instead.
- **Rendering model.** JavaScript builds HTML strings (template literals) and injects them with `innerHTML`. Switching series recomputes everything and rebuilds all three pages.

---

## 4. Raw data model (per series)

Each series is one entry in the object `SERIES_RAW`, keyed `s21` or `s22`:

```js
SERIES_RAW = {
  s21: { weeksAired: 10, NAMES, PORT, CONT, TASKS, EM, EI, PICKS, RD, RD_PVP },
  s22: { weeksAired: 4,  NAMES, PORT, CONT, TASKS, EM, EI, PICKS, RD, RD_PVP },
}
```

| Field | Type | Meaning |
|---|---|---|
| `weeksAired` | integer 0–10 | Number of episodes broadcast and scored (Series 22 reads it from the constant `S22_WEEKS_AIRED`). |
| `NAMES` | array of 5 strings | The contestants' short names. **Order matters**: every score array `s` in `TASKS` is aligned to this order, and it is the tiebreak order for "episode winner" (§5.6). |
| `PORT` | `{name: imageURL}` | Portrait image per contestant. |
| `CONT` | `{name: {full, acc, bio, stat}}` | Full name, an accent colour (hex), a biography paragraph (HTML), and a "statistical insight" paragraph (HTML). The bio and stat texts are hand-written, not generated. |
| `TASKS` | array of `{ep, n, t, s}` | One entry per task. `ep` = episode number; `n` = task name (may start with "Prize:", "Team:", "Live:", which is stripped for display); `t` = type `"P"`, `"F"`, `"T"` or `"L"`; `s` = array of 5 scores aligned to `NAMES`. |
| `EM` | `{ep: {t, d}}` | Episode metadata: title `t` and air date `d` as a string like `"1 Oct 2026"`. Present for all 10 episodes, including upcoming ones. |
| `EI` | `{ep: html}` | Hand-written "Episode Analysis" paragraph for each aired episode. |
| `PICKS` | `{player: {ep: contestantName or null}}` | Each player's pick for each episode. A missing key or `null` means "no pick that week". A player with an empty object has never picked. |
| `RD` | `{player: integer}` | Hand-entered rank change on the Show points board since last week. |
| `RD_PVP` | `{player: integer}` | Hand-entered rank change on the League points board since last week. |

Example task entry (Series 22, episode 1, prize task):

```js
{ep:1, n:"Prize: The droopiest object", t:"P", s:[1,3,5,2,4]}
// NAMES_S22 = ["Richard","Matt","Isy","Chloe","Nina"]
// => Richard 1, Matt 3, Isy 5, Chloe 2, Nina 4
```

---

## 5. Calculations (the core logic)

All derived data is computed in `computeDerived()` every time a series is loaded. The active series' raw fields are copied into global variables (`NAMES`, `TASKS`, `PICKS`, `WEEKS_AIRED`, and so on) by `loadSeries(key)`.

### 5.1 Tie-aware ranking: `rankWithTies(sortedArray, keyFn, idFn)`

Used everywhere a rank is shown. The input must already be sorted best-first. It assigns **standard competition ranking** ("1-2-2-4"): tied items share the rank of the first of them, and the next distinct value skips ahead by the number of tied items.

```
rank[item0] = 1
for i ≥ 1:
    rank[item_i] = (key(item_i) == key(item_{i-1})) ? rank[item_{i-1}] : i + 1
```

Example: scores `[67, 63, 63, 61]` → ranks `[1, 2, 2, 4]`.

### 5.2 Contestant episode totals: `EPS`

For each contestant `c` and each episode `e` (1–10):

```
EPS[c][e] = Σ over tasks with task.ep == e of task.s[index of c in NAMES]
```

Upcoming episodes have no tasks, so their totals are `0`.

### 5.3 Contestant totals by task type: `TY`

```
TY[c][type] = Σ over all tasks with task.t == type of task.s[index of c]      (type ∈ P, F, T, L)
```

### 5.4 Players and **Show points** (PvE): `PLAYERS`

For each player `p` (in the insertion order of `PICKS`):

```
epPts[e] = EPS[pick_e][e]   if the player picked someone for episode e AND e ≤ WEEKS_AIRED
         = null             otherwise (no pick, or episode not aired yet)

total (Show points) = Σ epPts[e] over e = 1..10, treating null as 0
used   = set of contestants the player has picked at least once
unused = contestants never picked
```

In words: **Show points = the sum of the real episode scores of the contestants you picked, counting only aired episodes.**

### 5.5 **League points** (PvP): `CAST_EP_RANK_PTS` and `PVP_SCORE`

Step 1: for each episode, rank the 5 contestants by that episode's total (`EPS`) using `rankWithTies`, and convert rank to rank points:

```
rankPoints[e][c] = 6 − rank_of_c_in_episode_e
```

So 1st = 5, 2nd = 4, 3rd = 3, 4th = 2, 5th = 1. **Ties share points**, and the next contestant drops accordingly. Example (Series 22 ep 2): Richard 14, Matt 14, Nina 14, Isy 13, Chloe 8 → ranks 1, 1, 1, 4, 5 → rank points 5, 5, 5, 2, 1.

Step 2: for each player:

```
League points = Σ over e = 1..WEEKS_AIRED where the player has a pick of rankPoints[e][pick_e]
```

In words: **League points rewards picking the week's best performer**, regardless of how many raw points that performer actually scored. Like Show points, only aired episodes count; a pick made ahead of broadcast earns nothing until its episode airs.

### 5.6 Board ranks: `PVE_RANK` and `PVP_RANK`

```
PVE_RANK = rankWithTies(players sorted by Show points descending)
PVP_RANK = rankWithTies(players sorted by League points descending)
```

These include players who never picked (they score 0 and rank last), but those players are hidden from the Standings table, so they never affect the visible ranks of anyone else.

### 5.7 Other derived values

| Value | Formula | Used on |
|---|---|---|
| **Episode winner** | The contestant with the highest episode total; if tied, the one that appears **first in `NAMES`**. (`NAMES_S22` deliberately lists Richard first so that ep 2, a real three-way tie Richard won on the show's tiebreak, names him.) | Episodes page ("Won by …") |
| **Contestant series total** | `Σ EPS[c][1..10]` | Cast page |
| **Cast order** | Contestants sorted by series total, descending. | Cast page tab order |
| **Contestant series rank** ("Rank #N") | Position in that sort, **without** tie handling (ties broken by `NAMES` order). | Cast page |
| **Contestant average** ("avg X/ep") | `series total ÷ WEEKS_AIRED`, i.e. points per aired episode (shown as 0.0 if nothing has aired). Example: Nina, 70 points after 4 episodes → 17.5. | Cast page |
| **Category ranks** (prize / filmed / live) | `rankWithTies` over contestants by `TY.P`, by `TY.F + TY.T` (team tasks count as filmed), and by `TY.L`. | Cast page |
| **Standings leader** | The player with the highest Show points among players with at least one pick (ties go to `PICKS` insertion order). | Standings header ("X leads with N points") |

---

## 6. Worked example (Series 22, player "Riley")

Riley's picks: ep1 Richard, ep2 Matt, ep3 Chloe, ep4 Chloe.

Episode totals (from `TASKS_S22`):

| Ep | Richard | Matt | Isy | Chloe | Nina |
|---|---|---|---|---|---|
| 1 | 13 | 17 | 13 | **19** | 18 |
| 2 | **14** | **14** | 13 | 8 | **14** |
| 3 | 11 | 13 | 9 | **21** | 17 |
| 4 | 9 | 12 | **24** | 19 | 21 |

**Show points** = Richard ep1 (13) + Matt ep2 (14) + Chloe ep3 (21) + Chloe ep4 (19) = **67**.

**League points**: rank points per episode:
- **Ep 1:** Chloe 5, Nina 4, Matt 3, Richard and Isy tied 4th, so 2 each. Riley's pick Richard = **2**.
- **Ep 2:** Richard, Matt and Nina tied 1st, so 5 each; Isy 2; Chloe 1. Riley's pick Matt = **5**.
- **Ep 3:** Chloe 5, Nina 4, Matt 3, Richard 2, Isy 1. Riley's pick Chloe = **5**.
- **Ep 4:** Isy 5, Nina 4, Chloe 3, Matt 2, Richard 1. Riley's pick Chloe = **3**.

League points = 2 + 5 + 5 + 3 = **15**.

Both numbers match the app: Riley is ranked 1st on Show points with 67, and has 15 League points.

---

## 7. Screens and features

The page has a masthead, a pinned navigation row of three envelope tabs, and three pages: **Standings**, **Episodes** and **Cast**. Only one page is visible at a time.

### 7.1 Masthead (top of page, scrolls away)

- **Nameplate:** "Fantasky Master", newspaper-style.
- **Dateline:** "Series 22 ✦ The Fantasy League". The series number is a clickable chip. **Clicking it (or pressing Enter/Space on it) toggles between Series 21 and 22** (`toggleSeries()` → `loadSeries()`), which recomputes all data and rebuilds every page.
- **Airtime footnote:** for Series 22, a single line such as "† Episode 5 airs Thu, 1 Oct, 9pm — in 06d 09h 19m".
  - The next episode is `weeksAired + 1`, its date comes from `EM`, and it is treated as **21:00 on that date in the viewer's local time zone** (`parseEpDate`).
  - The remaining time is recomputed every second (`tickCountdown`) but shown to the minute, as days/hours/minutes. It stops at `00d 00h 00m`.
  - For Series 21, or when no next episode exists, it reads "† Series complete."

### 7.2 Navigation

- **Main tabs:** three envelope-shaped buttons, Standings, Episodes and Cast (`nav(name, button)`). The row stays pinned to the top while scrolling. The active envelope is drawn "open", with its card pulled up. Switching tabs scrolls the window to the top.
- **Swipe gestures (touch):**
  - Swiping left past Episode 10 jumps to the Cast page.
  - Swiping right on Episode 1 jumps to Standings.
  - Swiping right on the first cast member jumps back to Episode 10.

### 7.3 Standings page

- **Header:**
  - A kicker line, "Series 22 · Week 4" (the week is `WEEKS_AIRED`).
  - The title "Standings".
  - A sub-line naming the leader and their Show points.
- **Column headers:** Rank · Player · **Show** · **League**.
  - Only Show and League are clickable (`sortStandings(key)`).
  - Clicking a column sorts by it, descending; clicking the same column again flips to ascending.
  - The active column is highlighted.
  - The sort is by that single number; players with equal values keep their `PICKS` insertion order.
- **Rows** (one card per player): only players with **at least one pick** are shown. Each row contains:
  - **Rank:** the tie-aware rank *on the board currently sorted by* (`PVE_RANK` or `PVP_RANK`). Ranks 1–3 are drawn on gold, silver and bronze wax seals.
  - **Rank delta** (under the rank), from `RD` (Show points board) or `RD_PVP` (League points board), matching the active sort. Shown as "+N" (green), "−N" (red), or "—" for no change.
  - **Name**, **Show** points and **League** points. Each number is coloured by *its own board's* top-3 rank (gold, silver or bronze tone), independent of the current sort.
  - **Card frame:** the leader on Show points gets a gold-edged card; ranks 2–3 on Show points get silver edges.
  - **Last place:** the player(s) holding the worst visible rank on the current board have their card tilted slightly (a deliberate joke).
- **Expanding a row** (tap or click it, `togglePC`): reveals a strip of 10 weekly cells, E1–E10. Each cell shows one of:
  - **Aired week with a pick:** the picked contestant's portrait and that week's points. The points follow the active sort: raw episode points when sorted by Show points, or rank points (1–5) when sorted by League points. The player's best week is highlighted and the worst is dimmed; on League points, 5 is best and 1 is worst.
  - **Upcoming week with a pick:** a dimmed portrait with "…".
  - **Upcoming week with no pick:** a small sealed-envelope drawing.
  - **Aired week with no pick:** a dash.

### 7.4 Episodes page

- **Sub-tabs:** Ep 1 … Ep 10. Upcoming episodes are dimmed. Clicking a sub-tab scrolls a horizontal carousel to that episode, and swiping the carousel updates the active sub-tab.
- **Upcoming episode:** a header ("Episode N · date", title, "Awaiting broadcast") and a large sealed envelope reading "Sealed until [date]".
- **Aired episode:**
  1. **Header:** "Episode N · date", the episode title, and "Won by [winner] with [points] points".
  2. **Podium strip:** all 5 contestants in **alphabetical order**, each with portrait, name and episode total. The winner's total is highlighted.
  3. **Task table:** one row per task, with a type icon (prize, filmed, team, live), the task name (with the "Prize:/Team:/Live:" prefix removed), and each contestant's score in alphabetical column order. In each row the highest score is highlighted and the lowest dimmed, **but only if not all scores are equal**. The final row shows each contestant's episode total; every contestant tied for the top total is highlighted.
  4. **Episode Analysis:** the hand-written `EI` paragraph.

### 7.5 Cast page

- **Sub-tabs:** one per contestant, ordered by series total (highest first). They work like the Episodes carousel.
- **Contestant slide:**
  1. **Hero:**
     - Portrait and full name, in the contestant's accent colour.
     - "Rank #N · avg X/ep": series rank and average, as defined in §5.7.
     - Series total.
     - The three category ranks: "#N prize · #N filmed · #N live", tie-aware, with team tasks counted as filmed.
  2. **Box score** (a grid of E1–E10 plus a total column):
     - **Row "Tot":** the episode totals. The contestant's best aired episode is highlighted and the worst dimmed.
     - **Prize row:** points from prize tasks per episode.
     - **Filmed row:** points from filmed *and* team tasks.
     - **Live row:** points from live tasks.
     - Upcoming episodes show "—".
  3. **Profile:** the `CONT.bio` paragraph.
  4. **Statistical insight:** the `CONT.stat` paragraph.

---

## 8. Visual design (for context)

A "19th-century newspaper meets Taskmaster red and gold" theme:

- **Ground and cards:** a deep claret page with ivory "index card" panels for everything you read.
- **Brand colours:** Taskmaster red (wax seals, best scores, rank drops) and gold (masthead, rules, leaders, active states).
- **Accent colours:** each carries one meaning:
  - the four task types: prize saffron, filmed cobalt, team emerald, live plum;
  - rank rises: emerald;
  - the card-copy labels: Episode Analysis cobalt, Profile teal, Statistical insight plum.
- **Type:** Libre Caslon Display for the nameplate and headlines, Libre Caslon Text for names and reading copy, and Libre Franklin for numbers and small labels.
- **Layout:** responsive for phones (tested 320–760 px wide); the page is capped at 680 px wide (840 px on large screens).

Styling never affects the calculations.

---

## 9. Function map (where things live in the script)

| Function / constant | Role |
|---|---|
| `*_S21`, `*_S22` constants, `SERIES_RAW` | Raw league data (§4). |
| `rankWithTies` | Tie-aware ranking (§5.1). |
| `computeDerived` | Builds `EPS`, `TY`, `PLAYERS`, `CAST_EP_RANK_PTS`, `PVP_SCORE`, `PVP_RANK`, `PVE_RANK` (§5). |
| `loadSeries(key)`, `toggleSeries()` | Activate a series, recompute, rebuild all pages and the masthead. The app starts with `loadSeries('s22')`. |
| `buildStandings`, `renderStandingsList`, `sortStandings`, `updateSortHeaderUI`, `buildPlayerSlide`, `togglePC` | Standings page (§7.3). |
| `buildEpTabs`, `selEp`, `buildEpSlide`, `updateEpTabsFade` | Episodes page (§7.4). |
| `buildCast`, `selCast`, `buildCastSlide`, `updateCastOrder` | Cast page (§7.5). |
| `nav` | Main tab switching. |
| `renderMasthead`, `parseEpDate`, `nextEpisodeInfo`, `renderCountdown`, `tickCountdown` | Series chip and airtime footnote (§7.1). |
| `contImg`, `imgFail` | Portrait image with text fallback. |
| `TASK_ICON`, `WAX_SEAL_SVG`, `sealedEnvelope`, `cleanTask`, `rnkFmt`, `rnkCol` | Presentation helpers. |
| `deltaHTML`, `ptColor` | Legacy helpers, defined but no longer called. |

---

## 10. Edge cases, conventions and known caveats

1. **Early (pending) picks don't count.** A pick for an episode that has not aired yet contributes nothing to Show points or League points, and is displayed as "…" in the player's weekly strip. (League points has to skip unaired weeks explicitly: all contestants score 0 in an unaired episode, which would otherwise read as a five-way tie for 1st worth 5 rank points each.)
2. **Contestant "avg /ep" is per aired episode.** It divides the contestant's total by `WEEKS_AIRED`, the number of episodes that produced that total.
3. **Rank deltas are manual.** `RD` and `RD_PVP` are not computed from week-over-week standings; they must be re-entered after each episode or they go stale.
4. **Hidden players.** Players with no picks at all (Series 22: Ellen, Katherine) are omitted from the Standings table but still exist in the data.
5. **Ties.** Board ranks, category ranks and weekly rank points are tie-aware. The contestant series rank on the Cast page and the episode winner name are not: they fall back to `NAMES` order.
6. **Scores above 5 are allowed.** One Series 22 task awarded a bonus point (a 6); it is kept as-is so totals match the source.
7. **Airtime time zone.** The code comment calls 21:00 "the real UK broadcast slot", but the date is built in the viewer's local time zone, so viewers outside the UK see a countdown to 21:00 their time.

---

## 11. How the league is updated each week (maintenance)

After a new Series 22 episode airs, edit `index.html`:

1. **Scores:** append that episode's tasks to `TASKS_S22` (`{ep, n, t, s}`, with `s` in `NAMES_S22` order).
2. **Weeks aired:** increment `S22_WEEKS_AIRED`.
3. **Picks:** add each player's pick for the new week to `PICKS_S22`. Next week's picks can be entered early too; they won't score until that episode airs (§10.1).
4. **Episode text:** add or confirm the episode title and date in `EM_S22`, and write an Analysis paragraph in `EI_S22`.
5. **Rank deltas:** update `RD_S22` and `RD_PVP_S22` with each player's rank change on each board.
6. **Contestant text (optional):** refresh `CONT_S22[name].stat` / `.bio`.

Everything else — totals, both boards, ranks, highlights, medals, the episode page, the cast box scores and the airtime footnote — recalculates automatically on page load.
