# Fantasky Master: the app

The league site, designed for phones first and built around the players. It follows the rules in [../README.md](../README.md) and the calculations in [../FANTASKY_MASTER_EXPLAINED.md](../FANTASKY_MASTER_EXPLAINED.md).

Live at **https://kbroadie.github.io/Fantasky-Master/app/**.

## Data

The app reads **[`../data/fantasky_master_data.csv`](../data/fantasky_master_data.csv)** every time it loads. To update the league, edit that file as described in [`data/README.md`](../data/README.md); nothing in the app needs changing.

- `js/csv.js` parses the CSV.
- `js/league.js` derives the boards, ranks, movement, tiebreak placings, rank history, pick-rule status and contestant stats.
- `js/meta.js` holds presentation only: each series' look (Series 22 Ancient Greek, Series 21 an American diner) and optional promo art from the Imgur albums (the Series 22 hero shots). A series without promo art falls back to the framed portraits.

## Layout

A floating dock at the bottom holds three tabs: **Standings · Episodes · Cast**. The series seal sits top right. There is no personal "you" view; the app is the same for everyone.

| Tab | What's on it |
|---|---|
| **Standings** | The HD-2D scene of the house, with the next poll deadline in an RPG-style dialog box. The table below lists every player with a strip of all ten episodes: each cell is coloured by the contestant they picked and shows the points it scored, and a gold outline marks a pick that won the episode. |
| **Episodes** | A numbered pager above swipeable episode cards. Each card has subtabs: **League** (which players backed each contestant, in finishing order), **Scoreboard** (a task-by-task replay), **Tasks** and **Write-up**. The chosen subtab stays put as you swipe between episodes. |
| **Cast** | Five gold-framed portraits in standings order (first place on the right), each with its score in large numbers, select between swipeable contestant cards: stats, league backing, a points-per-episode chart, and the bio and stat text from the CSV. For Series 22 each card uses the contestant's full-length hero shot as its backdrop, with the portrait row floating over the top of the photo, the name and stats below the face, and the photo panning against your swipe. The photos align to the top of the card. On desktop the hero stands to the right of the stats. |

Contestants appear as their full gold-framed portraits throughout.

## Type

Every font is from [Monaspace](https://github.com/githubnext/monaspace) (SIL OFL, licence in `fonts/OFL.txt`): five metric-compatible variable families, self-hosted and subset to Latin (about 460 KB in total, against 3.3 MB unsubset). Each family has one job:

- **Argon** (humanist): body text and write-ups; the easiest of the five to read in longer passages.
- **Neon** (grotesque): labels, tabs and every figure. Monospaced digits line up in tables for free.
- **Xenon** (slab): headings, set semi-wide on the width axis.
- **Radon** (handwriting): player names, like names chalked on a scoreboard.
- **Krypton** (mechanical): the RPG dialog box, the countdown and the task-type stamps.

Features in use:

- **Texture healing** (`calt`) is on everywhere.
- **Case-sensitive forms** (`case`) are on for all-caps labels.
- **The width axis** (`wdth`) sets the headings and logo apart.
- **Emphasis:** `<strong>` uses the weight axis and `<em>` the slant axis, with synthetic styles turned off.
- **Line breaking:** paragraphs use `text-wrap: pretty` and headings `text-wrap: balance`.

## The scene

The house is original pixel art, drawn in code at 480×144 pixels onto separate layers:

- **Far:** hills and a landmark from the series' location (the Museum of Water & Steam's standpipe tower for Series 22, Hampton Court for Series 21).
- **Middle:** the house, garden and caravan. Its ten windows are the ten episodes; a scored episode's window shows a pixelated crop of the winner's portrait.
- **Light:** a glow layer.
- **Particles:** chimney smoke and fireflies.
- **Near:** a foreground fence.

The layers sit at different depths in a CSS 3D scene. The far and near layers are blurred for a tilt-shift look, and the camera sways with your pointer, idle drift and scroll, which gives real parallax, in the style of Square Enix's HD-2D games. Tap a window to open its episode, or the caravan to hear from Alex.

## Performance

- **No framework, no build step, no dependencies.**
- **The scene is cheap to run:** its layers are tiny canvases upscaled with `image-rendering: pixelated`, particles update about 15 times a second, and everything stops once the scene is off-screen.
- **The sky:** a WebGL2 shader drawn at quarter resolution as chunky pixels, which also pauses once you scroll past.
- **Portraits** load as small WebP versions of the Imgur images.
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
