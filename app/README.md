# Fantasky Master: the app

The league site, designed for phones first and built around the players. It follows the rules in [../README.md](../README.md) and the calculations in [../FANTASKY_MASTER_EXPLAINED.md](../FANTASKY_MASTER_EXPLAINED.md).

Live at **https://kbroadie.github.io/Fantasky-Master/app/**.

## Data

The app reads **[`../data/fantasky_master_data.csv`](../data/fantasky_master_data.csv)** every time it loads. To update the league, edit that file as described in [`data/README.md`](../data/README.md); nothing in the app needs changing.

- `js/csv.js` parses the CSV.
- `js/league.js` derives the boards, ranks, movement, tiebreak placings, rank history, pick-rule status and contestant stats.

## Layout

The layout follows the v1 prototype. A sticky top bar holds:

- the title
- the series number: tap it to switch series
- a red seven-segment countdown to the next episode
- three tabs: **Standings · Episodes · Cast**

A gold panel slides behind the active tab. All three pages are drawn when the app loads, so switching tabs is instant. There is no personal "you" view; the app is the same for everyone.

| Tab | What's on it |
|---|---|
| **Standings** | Who's leading, then one table with every player's rank and movement, the face of the contestant they picked this week (glowing gold if the pick won), and their Show and League points. Tap **Show** or **League** to sort by it; tap again to reverse. Tap a player to open their ten weekly picks as framed portraits with the points each one earned. |
| **Episodes** | A strip of Ep 1–10 above swipeable episodes. Each has the five framed portraits with scores (a crown on the winner), the league's picks in finishing order (who backed whom and what they earned), the task-by-task table and the write-up. |
| **Cast** | A strip of names in standings order above swipeable contestant pages: portrait, total, category ranks, how often the league picked them and what they earned for it, an episode-by-episode box score, the bio and a stat. |

Swiping past the last episode carries on into the Cast tab, and swiping back from the first episode returns to Standings.

## Look

- **Palette:** Taskmaster red and gold on near-black.
- **Colour has one meaning each:** gold is the best result, green is moving up and red is moving down.
- **Faces:** contestants always appear as their gold-framed portraits.
- **Fonts:** system fonts only, so there's nothing to download.
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
