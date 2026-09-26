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

- **Top bar** (sticky, frosted glass):
  - The brand.
  - The series number, a gold chip with a swap icon: tap it to switch series.
  - A one-line gold chip counting down to the next episode: "Ep 5 airs in 5d 18h". The air date and time are on the episode page, not here.
  - Below them, three segmented tabs, with a gold panel that slides behind the active one.
  - On scroll it compacts to one thin line plus label-only tabs. The height it saves goes back as margin (`--hdr-h`, `--tabs-h`… in `:root`), so the layout height never changes. Keep that invariant, or scroll anchoring makes the bar flicker.
- **Standings:**
  - A last-week strip at the top: the winner's portrait, who called it, and who leads each board. Tap it to open that episode.
  - Then one table sorted by Show or League. The active header shows ▼/▲; tap again to reverse.
  - Each row shows rank and movement, the player's pick that week as a framed face, Show, League and a chevron. Tap a row to open that player's ten picks.
  - 👑 marks the Show leader and 🏆 the League leader, whatever the sort. Task types use their own gold line icons (`icon()` in `ui.js`), never emoji, so 🏆 means only one thing.
  - The six columns (rank, player, pick, Show, League, chevron) are shared by the header and rows, and each has one alignment; the sort arrow sits left of the header label so the numbers' right edges line up.
- **Episodes / Cast:** a tab strip over scroll-snapped slides.
  - Swiping past the first or last slide carries on into the neighbouring tab, and a left swipe on Standings goes to Episodes (`edgeNav` in `main.js`). There's no visual hint while you pull (removed on request).
  - Episode tabs carry a dot in the winner's colour.
  - Portraits, the league's picks and the task table all run in finishing order.
  - The next episode shows its poll deadline and the five contestants.
  - The Cast tab shows points per episode as bars on one scale for all five contestants, and a Performance radar with three axes, Prize, Filmed and Live, each labelled with its line icon (team tasks aren't counted, not even in Filmed).
    - Each axis is a z-score of points per episode against every contestant in every series (`perEpisodeStats` in `ui.js`, stored as `state.stats`). It's per episode so a series in progress compares fairly with a finished one.
    - The scale runs from −3σ at the centre to +3σ at the edge of the circle. There's a hairline ring at every whole σ, with ticks where the rings cross the axes, and a dashed gold ring at 0σ (the all-series average).
    - Only the selected contestant is drawn: a solid shape in their colour with a subtle gradient, small vertex points and no outline. Each axis has one centred group set clear of the circle: the z-score to two decimals as the headline ("+2.48σ"), with the icon and name as a muted caption below. The card head says "z-score vs all series". The look is precise and minimal: hairlines, no decoration.
- **Times are local:** every date, time and countdown uses the device's time zone and locale (`fmtDay`, `fmtWhen` in `ui.js`). Never hard-code London.
- **Icons:** task types (Prize, Filmed, Team, Live) use one monoline SVG set (`ICON_PATHS` / `icon()` in `ui.js`): 16px grid, 1.5 stroke, gold. Don't mix in emoji; they render in clashing styles. Emoji are only for the 👑/🏆/crown badges.
- **Nothing smaller than 11px.** Use weight and colour for hierarchy.
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
