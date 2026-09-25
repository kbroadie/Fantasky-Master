# Fantasky Master: the new app

A ground-up rebuild of the league site, designed for phones first and built around the players. It follows the rules in [../README.md](../README.md) and the calculations in [../FANTASKY_MASTER_EXPLAINED.md](../FANTASKY_MASTER_EXPLAINED.md).

Once merged to `main`, it's served at **https://kbroadie.github.io/Fantasky-Master/app/**.

## Data

The app reads **[`../data/fantasky_master_data.csv`](../data/fantasky_master_data.csv)** every time it loads, and treats it as the only source of league data. To update the league, edit the CSV as described in [`data/README.md`](../data/README.md); there's nothing else to change in the app.

- `js/csv.js` parses the CSV (UTF-8 with a byte-order mark, quoted fields, `<strong>` in text fields) and shapes it into one object per series.
- `js/league.js` derives everything else: both boards, ranks, rank movement, tiebreak placings, winners, pick-rule status, each player's rank history, and contestant statistics.
- `js/meta.js` only sets each series' look: Series 22 is Ancient Greek and Series 21 an American diner, from their real settings. A new series works without an entry there; it just gets the default look.

## What players see

| Where | What |
|---|---|
| **Front page** | Pick your name once and it's remembered on that phone. Your card shows your Show and League rank, movement, last week's result and any "Must pick" warning, above the countdown to the next poll deadline (in your time zone plus London, Eastern and Pacific). |
| **Table** | Show and League tables with gold, silver and bronze seals and rank movement, with your row highlighted. A floating "find me" bar appears while your row is off-screen. A strip at the top says who won the latest episode and which players backed them. The last-placed player hangs crooked. |
| **You** | Any player's season: both ranks with the gap to the players either side, a rank-history chart against the rest of the league, winner hit rate, average per pick against the league average, and points left on the table. It also has the pick-everyone tracker, week-by-week picks, and, for yourself, a planner for the remaining polls (saved on the device; you can copy it to paste into the chat). |
| **Episodes** | Swipeable wax-sealed envelopes. Each episode opens on **how the league did that week**: every contestant in finishing order with the players who backed them. Then comes your own result, a task-by-task scoreboard replay, the host's write-up from the CSV, and the full task scores, folded away. |
| **Cast** | A portrait wall of the contestants, each with how many league picks they got and how many points they delivered to their backers, plus the bio and stat text from the CSV. |

The **hero** is the Taskmaster house at night, drawn in SVG over a WebGL sky. Its ten windows are the ten episodes: a scored episode's window lights up with the winner's portrait, and next week's window glows like a candle. Knock on the caravan to see who answers.

## Built for phones

- **Bottom tab bar** within thumb reach, respecting the safe area on notched phones. On desktop it becomes a top pill bar.
- **Sizing:** tap targets are at least 44px, rows are compact, and the native `<select>` is used for choosing a player.
- **Small and dependency-free:** no framework, no build step and no dependencies. It's about 40 KB of gzipped code, and the CSV is about 9 KB gzipped (preloaded alongside the scripts).
- **Light on battery:**
  - The WebGL sky renders at half resolution, capped at 30 fps.
  - It stops completely once you scroll past the house or switch tabs.
  - Portraits load as small WebP versions of the Imgur images.
- **Motion:** respects reduced-motion settings, uses native View Transitions for tab and series changes, and uses scroll-driven animations where supported.

## Run locally

Serve the repository root, because the app loads `../data/…`:

```sh
python3 -m http.server 8000   # then open http://localhost:8000/app/
```
