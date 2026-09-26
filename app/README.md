# Fantasky Master: the app

The league site, designed for phones first and built around the players. It follows the rules in [../README.md](../README.md) and the calculations in [../FANTASKY_MASTER_EXPLAINED.md](../FANTASKY_MASTER_EXPLAINED.md).

Live at **https://kbroadie.github.io/Fantasky-Master/app/**.

## Data

The app reads **[`../data/fantasky_master_data.csv`](../data/fantasky_master_data.csv)** every time it loads. To update the league, edit that file as described in [`data/README.md`](../data/README.md); nothing in the app needs changing.

- `js/csv.js` parses the CSV.
- `js/league.js` derives the boards, ranks, movement, tiebreak placings, rank history, pick-rule status and contestant stats.

## Layout

The layout follows the v1 prototype. A sticky, frosted-glass top bar holds:

- the title
- the series number, a gold chip: tap it to switch series
- the next poll deadline, in your own time zone, over a gold pill of time left
- three tabs: **Standings · Episodes · Cast**

On scroll the bar shrinks to one thin line. All three pages are drawn when the app loads, so switching tabs is instant. There is no personal "you" view; the app is the same for everyone.

| Tab | What's on it |
|---|---|
| **Standings** | Last week at a glance: the winner's portrait, who called it and who leads each board (tap it to open that episode). Then one table with every player's rank and movement, a crown on the leader, the face of the contestant they picked this week (glowing gold if the pick won), and their Show and League points. Tap **Show** or **League** to sort (▼/▲ shows the direction). Tap a player (the chevron) to open their ten weekly picks. |
| **Episodes** | A strip of Ep 1–10, each with a dot in the winner's colour, above swipeable episodes. Each has the five framed portraits in finishing order, with scores, how many players picked each, and a crown on the winner. Then come the league's picks (who backed whom and what they earned), the task-by-task table (long names show two lines; tap for the rest) and the write-up. The next episode shows when its poll closes, in your time. |
| **Cast** | A strip of names in standings order above swipeable contestant pages: portrait and total, how often the league picked them, points per episode as bars in their colour (a crown for a win) with the Prize/Filmed/Live split underneath, then the bio and a stat. |

Swiping past the last episode carries on into the Cast tab (a gold "Cast ›" tab slides in as you pull), and swiping back from the first episode returns to Standings.

## Look

- **Palette:** Taskmaster red and gold on near-black.
- **Colour has one meaning each:** gold is the best result, green is moving up and red is moving down.
- **Type:** nothing is smaller than 11px.
- **Times:** every date, time and countdown is shown in the device's own time zone and format.
- **Faces:** contestants always appear as their gold-framed portraits.
- **Fonts:** as in v1, from Google Fonts: **Bungee** for headings, **Fredoka** for names, **Inter** for text and scores, **DM Mono** for labels.
- **Motion:** used only for navigation, such as the sliding tab and a row opening.

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
- CI runs this check on every push and pull request.
- Pull requests also get a **screenshots** artifact of every view at phone and desktop size (from `tools/screenshots.mjs`); download it from the PR's Checks tab.

## Run locally

Serve the repository root, because the app loads `../data/…`:

```sh
npm run serve   # then open http://localhost:8000/app/
```
