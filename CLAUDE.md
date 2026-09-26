# Fantasky Master

Fantasy league for the TV show *Taskmaster*. Players pick one contestant per episode and score Show points (the contestant's score) and League points (5-4-3-2-1 by finishing place). Rules: `README.md`. Every calculation: `FANTASKY_MASTER_EXPLAINED.md`.

- **Live app:** https://kbroadie.github.io/Fantasky-Master/app/ (GitHub Pages serves `main` as-is).
- **Legacy site:** `index.html` at the root. It is frozen; don't read it or build on it.

## Layout

```
data/fantasky_master_data.csv   ← the ONLY league data (hand-edited; schema in data/README.md)
app/index.html                  sticky top bar (masthead + 3 tabs) and the three pages
app/styles.css                  all styles; mobile-first, wider layouts in @media at the end
app/js/main.js                  renders all pages at load, tabs, swipers, sorting, series toggle, countdown, routing (#/series/page/arg)
app/js/ui.js                    shared helpers ($, esc, ord, framed…) and `state`
app/js/views/{table,episodes,cast}.js   one file per tab (Standings, Episodes, Cast); each returns HTML strings
app/js/league.js                pure scoring engine (derive) — must match the systems doc
app/js/csv.js                   CSV → series objects
tools/check-data.mjs            validates the CSV + worked-example regression (no deps)
tools/screenshots.mjs           Playwright shots of every view at 390px and 1440px → shots/
```

## UX framework

The user's v1 prototype is the model: fast, clean, obvious navigation. The aim is to make it fun and emotionally engaging without making anyone think harder.

- **Top bar** (sticky): brand; the series number, which you tap to switch series; a red seven-segment countdown to the next episode. Below it are three segmented tabs, with a gold panel that slides behind the active one. The bar compacts on scroll.
- **Standings:** one table sorted by Show or League (tap a header to sort, tap again to reverse). Each row shows rank, movement, the player's pick that week as a framed face, then Show and League. Tap a row to open that player's ten picks.
- **Episodes / Cast:** a tab strip over scroll-snapped slides. Swiping past the first or last slide carries on into the neighbouring tab.
- **Emotion comes from faces, gold and colour, not motion.** Use framed portraits, a crown for the winner, gold/silver/bronze for the top three, gold for a pick that won, and contestant accent colours. There are no decorative animations; transitions are only for navigation, such as the tab slide and the row expanding.

## Conventions

- **No personalisation:** there is no "you", player picker or planner (removed on request). There are three tabs only.
- **No build step, no framework, no runtime dependencies.** Native ES modules; `package.json` is for tooling only.
- **Views** are functions returning template strings. Escape user and CSV text with `esc()`, or `rich()` to allow `<strong>`. Interactions go through delegated listeners in `main.js`.
- **Contestants** always appear as full gold-framed portraits (`framed()`), never cropped circles.
- **Fonts:** the v1 set, loaded from Google Fonts, one job each:
  - `--ff-head` Bungee: headings and the brand. It has one weight; keep it at 400.
  - `--ff-name` Fredoka: player and contestant names.
  - `--ff` Inter: body text and every score.
  - `--fm` DM Mono: labels. Only 400 and 500 are loaded.
  - `font-synthesis: none` is set, so never ask for a weight that isn't loaded.
  - Use tabular figures for numbers.
- **Terms:** use **Show** and **League** points, as in README.md.
- **Imgur images:** the page sets `referrer: no-referrer` because Imgur blocks some referrers. Portraits load as `…m.webp`.

## Commands

```sh
npm run serve                 # http://localhost:8000/app/
node tools/check-data.mjs     # run after any CSV or league.js change
npm ci && npx playwright install chromium && node tools/screenshots.mjs
```

In the Claude cloud sandbox:
- The headless browser can't reach Imgur or Google Fonts, so use `FM_CURL_IMAGES=1 PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/screenshots.mjs`.
- The shots land in `shots/` (gitignored). Read them to review changes.

## Workflow

- Work on the session's `claude/…` branch and open one PR per round of feedback. Merge only when the user says so.
- CI (`.github/workflows/checks.yml`) runs the data check on every push and PR. PRs also upload a `screenshots` artifact.
- The user mostly uses the app on phones. Check the 390px shots first.
