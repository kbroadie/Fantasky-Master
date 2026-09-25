# Fantasky Master: the new app

A ground-up rebuild of the league site. It follows the rules in [../README.md](../README.md) and the calculations in [../FANTASKY_MASTER_EXPLAINED.md](../FANTASKY_MASTER_EXPLAINED.md). None of it is based on the old `index.html`.

Once pushed to `main`, it's served at **https://kbroadie.github.io/Fantasky-Master/app/**.

## What's in it

| Part | What it does |
|---|---|
| **The house** | The hero is an original SVG of the Taskmaster house at night, with one window per episode: the ground floor is Episodes 1–4, the first floor 5–9, and the attic window the finale. A scored episode's window lights up with the winner inside. An aired-but-unscored episode flickers like a TV, and next week's window glows like a candle. Knock on the caravan. |
| **The task card** | *"Pick the winner of …"*: a stopwatch countdown to the poll deadline (the 22:00 London livestream), shown in your own time zone plus London, Eastern and Pacific. It warns automatically in the week when UK and US clocks change on different weekends. When a series ends, the card shows the golden head going to the champion instead. |
| **Standings** | Wax-seal ranks (gold, silver, bronze), Show and League boards (tap a heading to re-sort), rank movement, the red "Must pick" warning, a per-player pick history, and the last-placed player hanging crooked. |
| **Episodes** | Ten envelopes. Scored ones are open, with the winner peeking out; future ones are wax-sealed. Opening one replays the scoreboard task by task, then shows auto-generated "Alex's notes", every task with its scores, and who picked whom. |
| **Cast** | A portrait wall of the Imgur framed portraits hanging on wires (hover to swing them; last place hangs crooked). Each profile has totals, the average per episode, prize/filmed/live ranks and a chart of points per episode. |
| **Lab** | Your own picks, saved on your device only. See what you would have scored, where you'd rank, and plan around the pick-everyone rule. Includes "Perfect hindsight" and "Copy my picks". |
| **Series themes** | Each series has its own look, taken from the show: Series 22 is **Ancient Greek** (a Greek-key border, a column and amphora, steam from the Museum of Water & Steam), and Series 21 is an **American diner** (a checkerboard border, a neon EAT sign, neon dusk). Switching series with the wax seal changes the sky and plays a circular reveal. |

## Technology

- **No framework, no build step, no dependencies.** It uses native ES modules and GitHub Pages serves the folder as-is. All app code and data comes to about 43 KB gzipped.
- **WebGL2 sky** (`js/gl.js`): a single full-screen fragment shader draws stars, the moon, drifting cloud, chimney smoke, a lamp that follows your pointer, and film grain. To keep it cheap it renders at half resolution, is capped at 30 fps, and pauses when the tab is hidden. With reduced motion it draws a single still frame. Without WebGL2 it falls back to a CSS gradient.
  - I chose WebGL2 over WebGPU because WebGPU still has gaps on Android and Linux, and a single fragment shader gains nothing from it.
- **Particles** (`js/fx.js`): a 2D canvas for wax shards, confetti, sparks and steam. Its animation loop runs only while particles are alive.
- **Native browser motion:** the View Transitions API for tab and series changes, scroll-driven animations (`animation-timeline`) for the house parallax and reveal-on-scroll (only where supported), and the Popover API for the series menu.
- **Variable fonts:** Fraunces, with its `SOFT` and `WONK` axes animated on the wordmark, Special Elite (typewriter) and Caveat (handwriting).
- **Accessibility:** it honours `prefers-reduced-motion` throughout, uses real links and buttons, supports the keyboard (including the house windows and the caravan), and has visible focus rings.
- Portraits come from the Imgur albums in the systems doc. A `no-referrer` policy is set because Imgur refuses hot-linked images from some referrers.

## Keeping it up to date

Edit **`js/data.js`** only; the instructions are at the top of that file. After an episode airs:

1. Append its tasks to that series' `tasks`, with scores in seating (alphabetical) order.
2. Add each player's final vote to `picks`.
3. If there was a tie for 1st, add `tb: "Name"` to that episode.

Everything else is derived by `js/league.js`.

**Task scores** for Series 21 and Series 22 Episodes 1–4 come from the [Taskmaster Wiki](https://taskmaster.fandom.com). Every episode total matches the worked example in the systems doc.

**League picks:** the only ones in the Markdown docs are Riley's Series 22 Episodes 1–4 picks (plus Ellen and Katherine as yet to vote). The rest of the group's picks need adding to `picks`.

## Run locally

```sh
cd app && python3 -m http.server 8000   # then open http://localhost:8000
```
