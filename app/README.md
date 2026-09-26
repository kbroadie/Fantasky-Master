# Fantasky Master: the app

The league site, designed for phones first and built around the players. It follows the rules in [../README.md](../README.md) and the calculations in [../FANTASKY_MASTER_EXPLAINED.md](../FANTASKY_MASTER_EXPLAINED.md).

Live at **https://kbroadie.github.io/Fantasky-Master/app/**.

## Data

The app reads **[`../data/fantasky_master_data.csv`](../data/fantasky_master_data.csv)** every time it loads. To update the league, edit that file as described in [`data/README.md`](../data/README.md); nothing in the app needs changing.

- `js/csv.js` parses the CSV.
- `js/league.js` derives the boards, ranks, movement, tiebreak placings, rank history, pick-rule status and contestant stats.
- `js/meta.js` holds presentation only: each series' look (Series 22 Ancient Greek, Series 21 an American diner) and optional promo art from the Imgur albums: the Series 22 cast group photo and hero shots. A series without promo art falls back to the framed portraits.

## Layout

Tabs sit at the top: **Table · You · Episodes · Cast**, with the series seal alongside.

| Tab | What's on it |
|---|---|
| **Table** | The HD-2D scene of the house, with the next poll deadline in an RPG-style dialog box, and your own card (rank, points, movement, last result). The table below lists every player with a strip of all ten episodes: each cell is coloured by the contestant they picked and shows the points it scored, and a gold outline marks a pick that won the episode. |
| **You** | Any player's season, as three swipeable panels: **Overview** (both ranks and the gap to the player above or below, a rank-history chart, winner hit rate, average pick against the league, points left on the table, the pick-everyone tracker), **Weeks**, and **Plan** (your remaining picks, saved on the device, with a copy button). |
| **Episodes** | A numbered pager above swipeable episode cards. Each card has subtabs: **League** (who backed whom, in finishing order), **Scoreboard** (a task-by-task replay), **Tasks** and **Write-up**. The chosen subtab stays put as you swipe between episodes. |
| **Cast** | A wall of gold-framed portraits above swipeable contestant cards: stats, league backing, a points-per-episode chart, and the bio and stat text from the CSV. For Series 22 the wall hangs over the cast group photo, and each card leads with the contestant's full-length hero shot, which pans against your swipe. |

Contestants appear as their full gold-framed portraits throughout.

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

## Run locally

Serve the repository root, because the app loads `../data/…`:

```sh
python3 -m http.server 8000   # then open http://localhost:8000/app/
```
