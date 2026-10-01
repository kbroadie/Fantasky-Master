# Fantasky Master: the app

The league site, designed for phones first and built around the players. It follows the rules in [README.md](README.md) and the calculations in [FANTASKY_MASTER_EXPLAINED.md](FANTASKY_MASTER_EXPLAINED.md).

Live at **https://kbroadie.github.io/fantasky-master/**.

## Data

The app reads **[`data/fantasky_master_data.csv`](data/fantasky_master_data.csv)** every time it loads (always the newest copy). To update the league, use edit mode (below) or edit that file as described in [`data/README.md`](data/README.md); nothing in the app needs changing.

### Edit mode

Tap all seven rubber ducks at the bottom of any tab to open edit mode. The first time on a device it asks for a GitHub key: a [fine-grained token](https://github.com/settings/personal-access-tokens/new) with access to only this repository and **Contents: Read and write**. The key stays in that browser; it's never part of the site.

- **Picks:** on Standings, pick a week, open a player's row and tap their pick (or None).
- **Episodes:** edit the page itself. Tap the title to change it. On an aired episode the task table's names and scores become boxes you can type in (tap a task's icon to change its type); your changes apply when you tap away from the table. **Get scores from the wiki** fills in the table from the [Taskmaster Wiki](https://taskmaster.fandom.com); check it and add any DQs. Before an episode airs the button gets its title instead, as soon as the wiki lists it.
- **Save** writes everything into the data file on GitHub in one commit. The data is checked first with the same rules as `tools/check-data.mjs`. Everyone sees the change about a minute later, when the site redeploys. **Done** leaves edit mode (asking first if anything isn't saved).
- Scores, standings, sorting and every chart are worked out from the data file, so nothing else needs doing.

- `js/csv.js` parses the CSV.
- `js/league.js` derives the boards, ranks, movement, tiebreak placings, rank history, pick-rule status and contestant stats.

It also reads **[`data/taskmaster_stats.csv`](data/taskmaster_stats.csv)**, all-time stats for every Taskmaster contestant (series 1–22), for the Cast tab. `js/alltime.js` reads it. It's imported from a community Google Sheet with `node tools/import-stats.mjs`; don't edit it by hand. If it fails to load, the Cast tab still works and the radar compares against the league's own series.

## Layout

The layout follows the v1 prototype. A sticky, frosted-glass top bar holds:

- the title
- the series number, a gold chip: tap it to switch series
- a one-line countdown to the next episode: "Ep 5 airs in 5d 18h"
- three tabs: **Standings · Episodes · Cast**

On scroll the bar shrinks to one thin line. All three pages are drawn when the app loads, so switching tabs is instant. There is no personal "you" view; the app is the same for everyone.

| Tab | What's on it |
|---|---|
| **Standings** | Tap the **Show** or **League** heading to open that board's race above the table: every player's gap to the leader after each week, each player in their own colour (tap a line to follow one player; tap the heading again to close it). A strip of Wk 1–10 (tap a week, or swipe the table sideways, to see the standings as they were then; the rows slide to their new places. Weeks still to come show only when the episode airs), a "Week 4 Standings" headline and who leads the Show and the League, with a **How scoring works** button that explains both, then one table with every player's rank and movement and their Show and League points. Behind each row is the contestant they picked this week (Patatas, the plush lion, if they didn't pick): their face from the cast photos, every head the same size with the eyes centred in the row (behind frosted glass that clears when you open the row), drifting slightly as you scroll. Opening a row uncovers the rest of the face. Tap **Show**, **League** or **Player** to sort (▼/▲ shows the direction; the rows slide to their new places). Tap a player (the chevron) to open their ten weekly picks. |
| **Episodes** | A strip of Ep 1–10 above swipeable episodes. Each has the five framed portraits in their studio seat order (as is the task table), with scores and how many players picked each. The winner glows in gold light that spills onto the portraits beside them; last place gives off a heavy green gas that sinks behind the portraits to the bottom of the card and spreads like dry ice, sloshing when you scroll. Then come the task-by-task table (long names show two lines; tap for the rest) and the race so far: a line chart of how far each contestant is behind the leader after every episode up to that one, as smooth curves (tap a line to follow one contestant, or a point for that week). An episode not yet scored shows only when it airs, in your time. You can swipe anywhere down to the bottom of the screen. |
| **Cast** | A strip of names in standings order above swipeable contestant pages: a header like an episode's (portrait, place, name, total; the leader's portrait bathed in the winner's gold light), points per episode as bars in their colour on one scale (a crown for a win), with a dashed line at the series median, a Performance radar of their Prize, Filmed and Live points per episode as z-scores against all 110 contestants in Taskmaster history (each axis shows its z-score, e.g. +2.48σ; rings every σ from −3σ at the centre to +3σ at the edge, the dashed ring is average; team tasks aren't counted), then their **Profile** (a short bio and personal facts: birthday, age, star sign, height (in feet and inches on US devices, cm elsewhere), birthplace, education, family, awards and more), with their face from the cast photos behind it. Above the bars, for finished series, **All-time records** lists every stat where they rank in the top 3 of the 105 contestants in finished series (e.g. Dara Ó Briain's "Task winner #1: won 40% of solo tasks"). The series still airing gets none until its final, because a few episodes are too few to rank. |

Every tab ends with a row of rubber ducks.

Swiping left on Standings' Week 10 opens Episodes, swiping past the last episode carries on into the Cast tab, and swiping back from the first episode returns to Standings.

## Look

- **Palette:** Taskmaster red and gold on near-black.
- **Colour has one meaning each:** gold is the best result, green is moving up and red is moving down.
- **Type:** nothing is smaller than 11px.
- **Times:** every date, time and countdown is shown in the device's own time zone and format.
- **Faces:** contestants always appear as their gold-framed portraits.
- **Fonts:** as in v1, from Google Fonts: **Bungee** for headings, **Nunito** for names (Fredoka in v1, replaced for legibility), **Inter** for text and scores, **DM Mono** for labels.
- **Motion:** used for navigation (the sliding tab, a row opening), plus the winner's gold light and last place's stink gas on each episode (drawn on canvas, only while on screen). Reduced-motion settings switch these off.

## Performance

- **No framework, no build step, no dependencies.**
- **First visit:** How scoring works opens by itself the first time a device visits, then starts closed.
- **Sharing:** a link to the site shows a preview card (the brand and this series' cast) in WhatsApp and other apps, and adding it to a home screen gives a gold "FM" icon named Fantasky.
- **Portraits** are small WebP files in `img/`, served by GitHub Pages with the site (Imgur is blocked in the UK), loaded lazily.
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

Serve the repository root (the app loads `data/…`):

```sh
npm run serve   # then open http://localhost:8000/
```
