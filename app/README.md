# Fantasky Master: the app

The league site, designed for phones first and built around the players. It follows the rules in [../README.md](../README.md) and the calculations in [../FANTASKY_MASTER_EXPLAINED.md](../FANTASKY_MASTER_EXPLAINED.md).

Live at **https://kbroadie.github.io/Fantasky-Master/app/**.

## Data

The app reads **[`../data/fantasky_master_data.csv`](../data/fantasky_master_data.csv)** every time it loads. To update the league, edit that file as described in [`data/README.md`](../data/README.md); nothing in the app needs changing.

- `js/csv.js` parses the CSV.
- `js/league.js` derives the boards, ranks, movement, tiebreak placings, rank history, pick-rule status and contestant stats.

It also reads **[`../data/taskmaster_stats.csv`](../data/taskmaster_stats.csv)**, all-time stats for every Taskmaster contestant (series 1–22), for the Cast tab. `js/alltime.js` reads it. It's imported from a community Google Sheet with `node tools/import-stats.mjs`; don't edit it by hand. If it fails to load, the Cast tab still works and the radar compares against the league's own series.

## Layout

The layout follows the v1 prototype. A sticky, frosted-glass top bar holds:

- the title
- the series number, a gold chip: tap it to switch series
- a one-line countdown to the next episode: "Ep 5 airs in 5d 18h"
- three tabs: **Standings · Episodes · Cast**

On scroll the bar shrinks to one thin line. All three pages are drawn when the app loads, so switching tabs is instant. There is no personal "you" view; the app is the same for everyone.

| Tab | What's on it |
|---|---|
| **Standings** | A "Week 4 Standings" headline and who leads the Show and the League (tap either word for a one-line explanation), then one table with every player's rank and movement and their Show and League points. Behind each row is the contestant they picked this week (Patatas, the plush lion, if they didn't pick): their face from the cast photos, every head the same size with the eyes centred in the row (behind frosted glass that clears when you open the row), drifting slightly as you scroll. Opening a row uncovers the rest of the face. Tap **Show** or **League** to sort (▼/▲ shows the direction). Tap a player (the chevron) to open their ten weekly picks. |
| **Episodes** | A strip of Ep 1–10, each with a dot in the winner's colour, above swipeable episodes. Each has the five framed portraits in their studio seat order (as is the task table), with scores and how many players picked each. The winner glows in gold light that spills onto the portraits beside them; last place gives off a heavy green gas that sinks behind the portraits to the bottom of the card and spreads like dry ice, sloshing when you scroll. Then come the task-by-task table (long names show two lines; tap for the rest) and the write-up. Every future episode shows when its poll closes, in your time, with the five contestants. You can swipe anywhere down to the bottom of the screen. |
| **Cast** | A strip of names in standings order above swipeable contestant pages: portrait and total, points per episode as bars in their colour on one scale (a crown for a win), with a dashed line at the series median, a Performance radar of their Prize, Filmed and Live points per episode as z-scores against all 110 contestants in Taskmaster history (each axis shows its z-score, e.g. +2.48σ; rings every σ from −3σ at the centre to +3σ at the edge, the dashed ring is average; team tasks aren't counted), then their **Profile** (a short bio and personal facts: birthday, age, star sign, height (in feet and inches on US devices, cm elsewhere), birthplace, education, family, awards and more), with their face from the cast photos behind it. Above the bars, for finished series, **All-time records** lists every stat where they rank in the top 3 of the 105 contestants in finished series (e.g. Dara Ó Briain's "Task winner #1: won 40% of solo tasks"). The series still airing gets none until its final, because a few episodes are too few to rank. |

Every tab ends with a row of rubber ducks and a line saying which episode the scores are up to ("Scores updated after Episode 4").

Swiping left on Standings opens Episodes, swiping past the last episode carries on into the Cast tab, and swiping back from the first episode returns to Standings.

## Look

- **Palette:** Taskmaster red and gold on near-black.
- **Colour has one meaning each:** gold is the best result, green is moving up and red is moving down.
- **Type:** nothing is smaller than 11px.
- **Times:** every date, time and countdown is shown in the device's own time zone and format.
- **Faces:** contestants always appear as their gold-framed portraits.
- **Fonts:** as in v1, from Google Fonts: **Bungee** for headings, **Fredoka** for names, **Inter** for text and scores, **DM Mono** for labels.
- **Motion:** used for navigation (the sliding tab, a row opening), plus the winner's gold light and last place's stink gas on each episode (drawn on canvas, only while on screen). Reduced-motion settings switch these off.

## Performance

- **No framework, no build step, no dependencies.**
- **Portraits** load as small WebP versions of the Imgur images, lazily.
- **Reduced motion** settings are respected.

## Checks and screenshots

- `node tools/check-data.mjs` validates the CSV and re-checks the scoring against the worked example. It catches:
  - misspelt contestant or player names
  - missing or duplicate scores
  - gaps in scored episodes
  - ties without a tiebreak winner
  - totals that disagree with the all-time stats file, e.g. a live task entered as a prize task
- CI runs this check on every push and pull request.
- Pull requests also get a **screenshots** artifact of every view at phone and desktop size (from `tools/screenshots.mjs`); download it from the PR's Checks tab.

## Run locally

Serve the repository root, because the app loads `../data/…`:

```sh
npm run serve   # then open http://localhost:8000/app/
```
