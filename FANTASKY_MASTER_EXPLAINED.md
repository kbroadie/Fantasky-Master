# Fantasky Master — Complete Technical and Functional Explanation

This document describes the Fantasky Master web app in full: what it is for, how its data is structured, every calculation it performs, and every screen and interaction. It is written to be read by a language model (or a new developer) who has not seen the code. Terms are defined before they are used, formulas are given explicitly, and a fully worked example is included.

The document describes `index.html` as of the change that derives the season state from the clock and the data (aired and scored episodes, rank changes, current series), applies episode tiebreaks to League points, shows airtimes in the viewer's time zone, and flags the pick-every-contestant rule when it becomes binding.

- **Live app:** <https://kbroadie.github.io/Fantasky-Master/>
- **Source:** <https://github.com/kbroadie/Fantasky-Master> (`index.html`)
- **Taskmaster YouTube channel** (where episodes livestream): <https://www.youtube.com/@Taskmaster>
- **Player-facing rules and how to vote:** [README.md](README.md)

---

## 1. One-paragraph summary

Fantasky Master is a **fantasy league for the British TV comedy panel show _Taskmaster_**. Each series of Taskmaster has 5 celebrity **contestants** who compete over 10 **episodes**; in every episode they attempt several **tasks** and each receives 0–5 points per task (occasionally 6). In the fantasy league, a group of friends (**players**) each **pick one contestant per episode**. A player earns points based on how well their picked contestant did that week. The app shows the league table (**Standings**), a breakdown of every episode (**Episodes**), and a profile of every contestant (**Cast**). It currently holds two series (Series 21, finished; Series 22, in progress), opens on whichever is current by the clock, and has a toggle to step between them.

---

### How picks are collected (outside the app)

The app does not collect votes. The league runs in a private WhatsApp group:

1. **Polls.** At the start of each series the host posts **10 WhatsApp polls, one per episode**. Each poll lists the 5 contestants in the show's **seating order, which is always alphabetical by first name** (Series 22: Chloe, Isy, Matt, Nina, Richard).
2. **Voting.** Each player votes for one contestant per poll and may change their vote any number of times until the poll closes.
   - **League rule — pick every contestant at least once.** Across the 10 polls of a series, each player must vote for each of the 5 contestants at least once. The other 5 picks are free, including repeats.
   - **The app doesn't enforce or score the rule, but it flags it once it becomes binding** (§7.3): a red line under the player's name appears only when the contestants they still need fill every remaining poll.
   - **One recorded violation.** In the recorded data, Series 21 player Riley never picked Joanna, so their Series 21 row shows "Never picked: Joanna".
3. **Deadline.** A WhatsApp poll timer closes each poll automatically when that episode starts **livestreaming on the [Taskmaster YouTube channel](https://www.youtube.com/@Taskmaster): 22:00 London** (normally 17:00 US Eastern / 14:00 US Pacific; one hour later in the US for any episode falling between the UK and US clock changes, e.g. 29 Oct 2026).
4. **Scoring.** At some point after the episode airs (at the host's convenience), the host enters the task scores (`TASKS`) and the poll results (`PICKS`) into `index.html` (see §11), pushes it, and shares the updated page link in the group. Until then the app knows the episode has aired (from the clock) but not its results.

So `PICKS[player][ep]` is exactly that player's final vote in the episode-`ep` poll, and a missing or `null` pick means they did not vote.

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
| **Aired weeks** (`WEEKS_AIRED`) | How many episodes of the active series have **started livestreaming**, by the clock (22:00 London on each episode's date). Their polls are closed. |
| **Scored weeks** (`WEEKS_SCORED`) | The highest episode that has **task scores entered** in the data. Only these weeks count towards any score. Between an episode airing and the host entering its results, `WEEKS_SCORED` is one behind `WEEKS_AIRED`. |
| **Show points** — the **Show** column (internally **PvE**, "player vs environment") | A player's raw fantasy score: the sum of the actual episode points scored by each contestant they picked. |
| **League points** — the **League** column (internally **PvP**, "player vs player") | A player's placement score: each week the 5 contestants are placed 1st–5th by that episode's score (a tie for 1st is settled by the show's tiebreak) and awarded 5/4/3/2/1 "rank points"; a player earns the rank points of their pick. |
| **Tiebreak** | When contestants tie for the top episode score, the show runs a tiebreak task. Its winner (`EM[ep].tb`) is the episode winner. The tiebreak affects **only League points**, never Show points. |
| **Rank delta** | How many places a player moved on a board since the previous scored week (positive = moved up). Computed automatically. |

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
  s21: { NAMES, PORT, CONT, TASKS, EM, EI, PICKS },
  s22: { NAMES, PORT, CONT, TASKS, EM, EI, PICKS },
}
```

The key is `"s"` plus the series number; the series number shown on screen is read from it (`seriesNum`). Adding a future series means adding another entry (e.g. `s23`) — nothing else in the code names a specific series. Nothing about progress (episodes aired or scored, rank changes) is stored: it is all derived (§5.0).

| Field | Type | Meaning |
|---|---|---|
| `NAMES` | array of 5 strings | The contestants' short names. **Order matters**: every score array `s` in `TASKS` is aligned to this order. |
| `PORT` | `{name: imageURL}` | Portrait image per contestant. |
| `CONT` | `{name: {full, acc, bio, stat}}` | Full name, an accent colour (hex), a biography paragraph (HTML), and a "statistical insight" paragraph (HTML). The bio and stat texts are hand-written, not generated. |
| `TASKS` | array of `{ep, n, t, s}` | One entry per task. `ep` = episode number; `n` = task name (may start with "Prize:", "Team:", "Live:", which is stripped for display); `t` = type `"P"`, `"F"`, `"T"` or `"L"`; `s` = array of 5 scores aligned to `NAMES`. |
| `EM` | `{ep: {t, d, tb?}}` | Episode metadata: title `t`; London air date `d` as a string like `"1 Oct 2026"` (the episode livestreams at 22:00 London that day); and, only when contestants tied for the top score, `tb`, the tiebreak winner's name. Present for all 10 episodes, including upcoming ones. Example: `EM_S22[2] = {t:"This Is Food Glue", d:"10 Sep 2026", tb:"Richard"}`. |
| `EI` | `{ep: html}` | Hand-written "Episode Analysis" paragraph for each aired episode. |
| `PICKS` | `{player: {ep: contestantName or null}}` | Each player's pick for each episode. A missing key or `null` means "no pick that week". A player with an empty object has never picked. |

Example task entry (Series 22, episode 1, prize task):

```js
{ep:1, n:"Prize: The droopiest object", t:"P", s:[1,3,5,2,4]}
// NAMES_S22 = ["Richard","Matt","Isy","Chloe","Nina"]
// => Richard 1, Matt 3, Isy 5, Chloe 2, Nina 4
```

---

## 5. Calculations (the core logic)

All derived data is computed every time a series is loaded. `loadSeries(key)` copies the series' raw fields into global variables (`NAMES`, `TASKS`, `EM`, `PICKS`, …), works out `WEEKS_AIRED` and `WEEKS_SCORED` (§5.0), then calls `computeDerived()`.

### 5.0 Clock and season state

- **Air instant of an episode:** `parseEpDate(EM[ep].d)` returns **22:00 Europe/London on that date** as a real instant. `zonedTimeToDate` computes it with the browser's time-zone database, so it's correct in both BST and GMT.
- **`WEEKS_AIRED`** = the number of episodes whose air instant is at or before now.
- **`WEEKS_SCORED`** = the highest `ep` appearing in `TASKS` (0 if none).
- **Current series** (`currentSeriesKey`) = the newest series whose Episode 1 has aired. The app opens on it, and a series added ahead of its premiere stays in the archive until then.
- **Next episode** (`nextEpisodeInfo`) = the first episode of the showing series whose air instant is still in the future, or `null` if all have aired.

Rule of thumb: **anything about scores uses `WEEKS_SCORED`; anything about the schedule or open polls uses `WEEKS_AIRED`.**

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
epPts[e] = EPS[pick_e][e]   if the player picked someone for episode e AND e ≤ WEEKS_SCORED
         = null             otherwise (no pick, or episode not scored yet)

total (Show points) = Σ epPts[e] over e = 1..10, treating null as 0
used   = set of contestants the player has picked at least once
unused = contestants never picked
```

In words: **Show points = the sum of the real episode scores of the contestants you picked, counting only scored episodes.**

### 5.5 **League points** (PvP): `CAST_EP_RANK_PTS` and `PVP_SCORE`

Step 1: for each episode, rank the 5 contestants by that episode's total (`EPS`) using `rankWithTies`, and convert rank to rank points:

```
rankPoints[e][c] = 6 − rank_of_c_in_episode_e
```

So 1st = 5, 2nd = 4, 3rd = 3, 4th = 2, 5th = 1. **Ties share points**, and the next contestant drops accordingly: two contestants tied for 4th both get 2.

**Exception — a tie for 1st.** The show settles it with a tiebreak task, recorded as `EM[ep].tb`. The tiebreak winner keeps rank 1 (5 points), and every other contestant tied for 1st drops to rank 2 (4 points). Contestants below are unaffected. If no `tb` is recorded, the tie is shared.

Example (Series 22 ep 2): Richard 14, Matt 14, Nina 14, Isy 13, Chloe 8, with `tb:"Richard"` → ranks 1, 2, 2, 4, 5 → rank points 5, 4, 4, 2, 1.

Step 2: for each player:

```
League points = Σ over e = 1..WEEKS_SCORED where the player has a pick of rankPoints[e][pick_e]
```

In words: **League points rewards picking the week's best performer**, regardless of how many raw points that performer actually scored. Like Show points, only scored episodes count; a pick made ahead of broadcast earns nothing until its episode is scored.

### 5.6 Board ranks and weekly movement: `PVE_RANK`, `PVP_RANK`, `RD`, `RD_PVP`

`boardsAsOf(weeks)` computes both boards counting episodes 1..`weeks` only:

```
PVE_RANK = rankWithTies(players sorted by Show points descending)      // as of WEEKS_SCORED
PVP_RANK = rankWithTies(players sorted by League points descending)    // as of WEEKS_SCORED

RD[p]     = PVE rank as of (WEEKS_SCORED − 1)  −  PVE rank now
RD_PVP[p] = PVP rank as of (WEEKS_SCORED − 1)  −  PVP rank now
```

Positive = moved up. With only one scored week, every delta is 0. The ranks include players who never picked (they score 0 and rank last), but those players are hidden from the Standings table, so they never affect the visible ranks of anyone else.

### 5.7 Other derived values

| Value | Formula | Used on |
|---|---|---|
| **Episode winner** (`episodeWinner`) | The contestant with the highest episode total. If several tie, the recorded tiebreak winner `EM[ep].tb`; the page then says "… after a tiebreak". If no `tb` is recorded, the first tied name in `NAMES` is used. | Episodes page ("Won by …") |
| **Contestant series total** | `Σ EPS[c][1..10]` | Cast page |
| **Cast order** | Contestants sorted by series total, descending. | Cast page tab order |
| **Contestant series rank** ("Rank #N") | Position in that sort, **without** tie handling (ties broken by `NAMES` order). | Cast page |
| **Contestant average** ("avg X/ep") | `series total ÷ WEEKS_SCORED`, i.e. points per scored episode (shown as 0.0 if nothing is scored). Example: Nina, 70 points after 4 episodes → 17.5. | Cast page |
| **Category ranks** (prize / filmed / live) | `rankWithTies` over contestants by `TY.P`, by `TY.F + TY.T` (team tasks count as filmed), and by `TY.L`. | Cast page |
| **Standings leader** | The player with the highest Show points among players with at least one pick (ties go to `PICKS` insertion order). | Standings header ("X leads with N points") |
| **Pick-every-contestant check** | `known` = contestants the player picked in episodes 1..`WEEKS_SCORED`; `needed` = contestants not in `known`; `left` = 10 − `WEEKS_SCORED`. Shown only when `needed` is non-empty and `needed ≥ left`. The line reads "Must pick: …" when `needed = left > 0`, "Can't fit all of: …" when `needed > left > 0`, and "Never picked: …" when `left = 0`. Aired-but-unentered weeks count as still available, because their picks aren't known yet. | Standings row |

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
- **Ep 2:** Richard, Matt and Nina tied on 14; Richard won the tiebreak, so Richard 5, Matt 4, Nina 4; Isy 2; Chloe 1. Riley's pick Matt = **4**.
- **Ep 3:** Chloe 5, Nina 4, Matt 3, Richard 2, Isy 1. Riley's pick Chloe = **5**.
- **Ep 4:** Isy 5, Nina 4, Chloe 3, Matt 2, Richard 1. Riley's pick Chloe = **3**.

League points = 2 + 4 + 5 + 3 = **14**.

Both numbers match the app: Riley is ranked 1st on Show points with 67, and has 14 League points. The Episode 2 tiebreak doesn't change Show points; Matt's 14 still counts in full.

---

## 7. Screens and features

The page has a masthead, a pinned navigation row of three envelope tabs, and three pages: **Standings**, **Episodes** and **Cast**. Only one page is visible at a time.

### 7.1 Masthead (top of page, scrolls away)

- **Nameplate:** "Fantasky Master", newspaper-style.
- **Dateline:** "Series 22 ✦ The Fantasy League". The series number is a clickable chip. **Clicking it (or pressing Enter/Space on it) steps to the next series**, oldest to newest and wrapping round (`toggleSeries()` → `loadSeries()`). This recomputes all data and rebuilds every page. The chip is red for the current series and ivory for a past one.
- **Airtime footnote:** a single line such as "† Episode 5 airs Thu, 1 Oct, 2pm PDT — in 06d 00h 48m".
  - The next episode is `nextEpisodeInfo()` (§5.0). Its 22:00-London livestream is shown **in the viewer's own time zone, with the zone's name** (`localAirtimeText`): e.g. "10pm BST" in London, "5pm EDT" in New York, "2pm PDT" in Los Angeles. Daylight-saving differences are handled automatically: Episode 9 (29 Oct 2026, after the UK clock change but before the US one) shows "10pm GMT", "6pm EDT" and "3pm PDT".
  - The remaining time is recomputed every second (`tickCountdown`) and shown to the minute. When it reaches zero, the footnote moves on to the following episode.
  - When every episode of the showing series has aired, it reads "† Series complete."

### 7.2 Navigation

- **Main tabs:** three envelope-shaped buttons, Standings, Episodes and Cast (`nav(name, button)`). The row stays pinned to the top while scrolling. The active envelope is drawn "open", with its card pulled up. Switching tabs scrolls the window to the top.
- **Swipe gestures (touch):**
  - Swiping left past Episode 10 jumps to the Cast page.
  - Swiping right on Episode 1 jumps to Standings.
  - Swiping right on the first cast member jumps back to Episode 10.

### 7.3 Standings page

- **Header:**
  - A kicker line, "Series 22 · Week 4" (the week is `WEEKS_SCORED`).
  - The title "Standings".
  - A sub-line naming the leader and their Show points.
- **Column headers:** Rank · Player · **Show** · **League**.
  - Only Show and League are clickable (`sortStandings(key)`).
  - Clicking a column sorts by it, descending; clicking the same column again flips to ascending.
  - The active column is highlighted.
  - The sort is by that single number; players with equal values keep their `PICKS` insertion order.
- **Rows** (one card per player): only players with **at least one pick** are shown. Each row contains:
  - **Rank:** the tie-aware rank *on the board currently sorted by* (`PVE_RANK` or `PVP_RANK`). Ranks 1–3 are drawn on gold, silver and bronze wax seals.
  - **Rank delta** (under the rank), from `RD` (Show board) or `RD_PVP` (League board), matching the active sort (§5.6). Shown as "+N" (green), "−N" (red), or "—" for no change.
  - **Pick-every-contestant line** (under the name, in red), only when binding (§5.7): "Must pick: Isy, Nina", "Can't fit all of: …", or "Never picked: Joanna".
  - **Name**, **Show** points and **League** points. Each number is coloured by *its own board's* top-3 rank (gold, silver or bronze tone), independent of the current sort.
  - **Card frame:** the leader on Show points gets a gold-edged card; ranks 2–3 on Show points get silver edges.
  - **Last place:** the player(s) holding the worst visible rank on the current board have their card tilted slightly (a deliberate joke).
- **Expanding a row** (tap or click it, `togglePC`): reveals a strip of 10 weekly cells, E1–E10. Each cell shows one of:
  - **Aired week with a pick:** the picked contestant's portrait and that week's points. The points follow the active sort: raw episode points when sorted by Show points, or rank points (1–5) when sorted by League points. The player's best week is highlighted and the worst is dimmed; on League points, 5 is best and 1 is worst.
  - **Unscored week with a pick:** a dimmed portrait with "…".
  - **Week not yet aired, no pick:** a small sealed-envelope drawing (the poll is still open).
  - **Aired week with no pick:** a dash (the poll closed without a vote).

### 7.4 Episodes page

- **Sub-tabs:** Ep 1 … Ep 10. Unscored episodes are dimmed. Clicking a sub-tab scrolls a horizontal carousel to that episode, and swiping the carousel updates the active sub-tab.
- **Episode not yet aired:** a header ("Episode N · date", title, "Awaiting broadcast") and a large sealed envelope reading "Sealed until [date]".
- **Aired but not yet scored:** the header only, reading "Aired · results coming soon".
- **Scored episode:**
  1. **Header:** "Episode N · date", the episode title, and "Won by [winner] with [points] points", plus " after a tiebreak" when the win came from one.
  2. **Podium strip:** all 5 contestants in **alphabetical order**, each with portrait, name and episode total. Only the winner's total is highlighted.
  3. **Task table:** one row per task, with a type icon (prize, filmed, team, live), the task name (with the "Prize:/Team:/Live:" prefix removed), and each contestant's score in alphabetical column order. In each row the highest score is highlighted and the lowest dimmed, **but only if not all scores are equal**. The final row shows each contestant's episode total; the winner's total is highlighted.
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
     - Unscored episodes show "—".
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
| `zonedTimeToDate`, `parseEpDate`, `EPISODES_PER_SERIES`, `AIR_TZ`/`AIR_HOUR`/`AIR_MIN` | Livestream instants, DST-aware (§5.0). |
| `seriesNum`, `SERIES_KEYS`, `currentSeriesKey` | Series numbers and which series is current (§5.0). |
| `computeDerived` | Builds `EPS`, `TY`, `PLAYERS`, `CAST_EP_RANK_PTS` (with tiebreaks), `PVP_SCORE`, `PVE_RANK`, `PVP_RANK`, `RD`, `RD_PVP` (§5). |
| `boardsAsOf(weeks)` | Both boards and their ranks counting episodes 1..`weeks` (§5.6). |
| `episodeWinner(ep)` | Episode winner, honouring the recorded tiebreak (§5.7). |
| `loadSeries(key)`, `toggleSeries()` | Activate a series (including `WEEKS_AIRED`/`WEEKS_SCORED`), recompute, and rebuild all pages and the masthead. The app starts with `loadSeries(currentSeriesKey())`. |
| `buildStandings`, `renderStandingsList`, `sortStandings`, `updateSortHeaderUI`, `buildPlayerSlide`, `togglePC` | Standings page (§7.3). |
| `buildEpTabs`, `selEp`, `buildEpSlide`, `updateEpTabsFade` | Episodes page (§7.4). |
| `buildCast`, `selCast`, `buildCastSlide`, `updateCastOrder` | Cast page (§7.5). |
| `nav` | Main tab switching. |
| `renderMasthead`, `nextEpisodeInfo`, `localAirtimeText`, `renderCountdown`, `tickCountdown` | Series chip and airtime footnote (§7.1). |
| `contImg`, `imgFail` | Portrait image with text fallback. |
| `TASK_ICON`, `WAX_SEAL_SVG`, `sealedEnvelope`, `cleanTask`, `rnkFmt`, `rnkCol` | Presentation helpers. |
| `deltaHTML`, `ptColor` | Legacy helpers, defined but no longer called. |

---

## 10. Edge cases, conventions and known caveats

1. **Only scored weeks count.** A pick for an episode that hasn't been scored yet — not aired, or aired but not entered — contributes nothing to Show points or League points, and is displayed as "…" in the player's weekly strip. This also protects League points: an unscored episode has every contestant on 0, which would otherwise read as a five-way tie for 1st worth 5 rank points each.
2. **Contestant "avg /ep" is per scored episode.** It divides the contestant's total by `WEEKS_SCORED`, the number of episodes that produced that total.
3. **Hidden players.** Players with no picks at all (Series 22: Ellen, Katherine) are omitted from the Standings table but still exist in the data.
4. **Ties.** Board ranks, category ranks and weekly rank points are tie-aware, except a tie for an episode's 1st place, which the recorded tiebreak splits into 1st and 2nd for League points only (§5.5). The contestant series rank on the Cast page is not tie-aware: it falls back to `NAMES` order.
5. **Scores above 5 are allowed.** One Series 22 task awarded a bonus point (a 6); it is kept as-is so totals match the source.
6. **The footnote matches the voting deadline.** Both are the 22:00-London livestream. The WhatsApp poll timers enforce the deadline; the app only displays it.
7. **The clock is the viewer's device clock.** Aired status and the countdown come from the viewer's system time. A device set to the wrong time sees the wrong aired/open state, but scores are unaffected, because they depend only on `WEEKS_SCORED`.

---

## 11. How the league is updated each week (maintenance)

At any time after a Series 22 episode airs, edit `index.html`:

1. **Scores:** append that episode's tasks to `TASKS_S22` (`{ep, n, t, s}`, with `s` in `NAMES_S22` order). This alone marks the episode as scored.
2. **Picks:** copy each player's final vote from that episode's WhatsApp poll into `PICKS_S22` (a player who didn't vote gets no entry). Future weeks' votes can be entered early too; they won't score until that episode is scored (§10.1).
3. **Tiebreak (only if contestants tied for the top score):** add `tb:"Name"` to that episode's `EM_S22` entry.
4. **Episode text:** confirm the episode title in `EM_S22`, and write an Analysis paragraph in `EI_S22`.
5. **Contestant text (optional):** refresh `CONT_S22[name].stat` / `.bio`.

Everything else — aired and scored weeks, totals, both boards, ranks, weekly rank changes, the episode winner, highlights, medals, pick-rule lines, the cast box scores, the airtime footnote and which series is current — is derived automatically from the data and the clock.

**New series:** add a `SERIES_RAW` entry keyed `"s" + number` with the same fields, and the 10 London air dates in its `EM`. It becomes the current series automatically once its Episode 1 airs.
