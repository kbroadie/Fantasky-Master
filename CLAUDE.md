# Fantasky Master

Fantasy league for the TV show *Taskmaster*. Players pick one contestant per episode and score Show points (the contestant's score) and League points (5-4-3-2-1 by finishing place). Rules: `README.md`. Every calculation: `FANTASKY_MASTER_EXPLAINED.md`.

- **Live app:** https://kbroadie.github.io/Fantasky-Master/app/ (GitHub Pages serves `main` as-is).
- **Legacy site:** `index.html` at the root. It is frozen; don't read it or build on it.

## Layout

```
data/fantasky_master_data.csv   ← the ONLY league data (hand-edited; schema in data/README.md)
data/taskmaster_stats.csv       all-time stats for every contestant, S1–22 (imported, never hand-edited)
app/index.html                  sticky top bar (masthead + 3 tabs) and the three pages
app/styles.css                  all styles; mobile-first, wider layouts in @media at the end
app/js/main.js                  renders all pages at load, tabs, swipers, sorting, series toggle, countdown, routing (#/series/page/arg)
app/js/ui.js                    shared helpers ($, esc, ord, framed…) and `state`
app/js/views/{table,episodes,cast}.js   one file per tab (Standings, Episodes, Cast); each returns HTML strings
app/js/podium-fx.js             canvas effects on episode podiums: winner's gold light, last place's stink gas
app/js/heroes.js                presentation only: each series' cast group photo, and each contestant's eyes and pupil distance in it (Standings rows, Cast profiles)
app/js/league.js                pure scoring engine (derive) — must match the systems doc
app/js/csv.js                   CSV → series objects
app/js/alltime.js               loads taskmaster_stats.csv: the radar baseline, all-time record badges, profile facts
tools/check-data.mjs            validates the CSV + worked-example regression + cross-check against the stats (no deps)
tools/import-stats.mjs          regenerates taskmaster_stats.csv from the all-time stats Google Sheet
tools/screenshots.mjs           Playwright shots of every view at 390px and 1440px → shots/
```

## UX framework

The user's v1 prototype is the model: fast, clean, obvious navigation. The aim is to make it fun and emotionally engaging without making anyone think harder.

- **Top bar** (sticky, frosted glass):
  - The brand.
  - The series number, a gold chip with a swap icon: tap it to switch series.
  - One line of text counting down to the next episode: "Ep 5 airs in 5d 18h" (no pill or background; the numbers are gold). The air date and time are on the episode page, not here.
  - Below them, three segmented tabs, with a gold panel that slides behind the active one.
  - On scroll it compacts to one thin line plus label-only tabs. The height it saves goes back as margin (`--hdr-h`, `--tabs-h`… in `:root`), so the layout height never changes. Keep that invariant, or scroll anchoring makes the bar flicker.
- **Standings:**
  - A last-week strip at the top: the winner's portrait and who called it, then "👑 Riley leads Show   🏆 Jamie leads League" (no scores, no separator). Tap it to open that episode.
  - Then one table sorted by Show or League. The active header shows ▼/▲; tap again to reverse.
  - Each row shows rank and movement, the player's name (no 👑/🏆 on it), Show, League and a chevron. Tap a row to open that player's ten picks: portraits and points only, with no text line under them.
  - **Series with a group photo (22):** the player's pick that week is the row's backdrop (`pickBackdrop` in `table.js`), behind the whole row card.
    - The backdrop is the contestant's face cropped from the series' cast group photo (`GROUP` in `heroes.js`: `https://i.imgur.com/aTYNG68.jpeg`, 5246×3936). Every face is drawn the same size: the photo is scaled so the pupils are `--eyes` apart (50px on phones, 64px from 600px up; `sep` in `heroes.js` is each face's pupil distance), and never smaller than it takes to span the row edge to edge. Pillars and neighbours at the sides are fine; the reshade darkens them.
    - The eyes sit on the centre line of the row's top line (`--head / 2`) and in the gap between the name and Show (`--tx`).
    - It's anchored to the top, so opening a row doesn't move it; it just uncovers more of the photo, lightly dimmed behind the picks.
    - A slight vertical scroll parallax (`parallax` in `main.js`, 6% of the row's distance from mid-screen, keyed to the top line so an opened row's own photo doesn't move). Off under reduced motion.
    - Reshaded darker behind the name and numbers, and warmed gold if the pick won.
  - **Series without a group photo (21):** no pick is shown in the rows.
  - 👑 marks the Show leader and 🏆 the League leader in the last-week strip only, not on the rows. Task types use their own gold line icons (`icon()` in `ui.js`), never emoji, so 🏆 means only one thing.
  - The five columns (rank, player, Show, League, chevron) are shared by the header and rows, and each has one alignment; the sort arrow sits left of the header label so the numbers' right edges line up.
- **Episodes / Cast:** a tab strip over scroll-snapped slides.
  - Swiping past the first or last slide carries on into the neighbouring tab, and a left swipe on Standings goes to Episodes (`edgeNav` in `main.js`). There's no visual hint while you pull (removed on request).
  - Episode tabs carry a dot in the winner's colour.
  - The episode portraits run lowest score to highest (winner on the right), and the task-table columns follow them so each sits under its portrait. The league's picks read winner first.
  - The winner gets gold light (no crown on the episode portraits); last place (ties included) gets stink gas and a score in the fog's muted olive (#a3a86e). Both are canvas effects (`podium-fx.js`), aiming for over-the-top realism:
    - **Gold:** a volumetric glow and slowly turning light rays behind the frame, a light pool on the shelf, warm bounce light screened onto the neighbouring portraits, neighbours casting shadows along the shelf away from the winner, a blooming rim light on the gilt frame, rising gold dust and glints.
    - **Stink:** heavier-than-air gas, drawn as shaded puffs (lit from above, darker beneath), mostly on the back layer behind the portraits, with a faint veil in front for the low bank. It seeps from behind the portrait, sinks right onto the bottom edge of the podium card (its padding box) and spreads along it like dry ice on a countertop, flattening and thickening as it lands. It collides with all four sides and never leaves the card. There's no cartoon cloud.
    - **Scroll physics:** the gas and dust have inertia. Page scrolling sloshes the gas and stirs the dust, and scroll speed briefly surges the gold. Swiping between episodes doesn't push them, and an episode's gas is cleared when it goes off screen, so none trails into the next one.
    - **Cost:** only podiums on screen are simulated, nothing runs in a hidden tab, and reduced motion gets one settled still frame.
  - The league's picks list each contestant's backers as plain comma-separated names (no pills, not bold).
  - Every future episode shows its poll deadline, the time left and the five contestants.
  - The swiper always reaches the bottom of the screen (`fit` in `main.js`), so you can swipe below a short slide.
  - The Cast tab shows points per episode as bars on one scale for all five contestants (a crown and gold number for a win, no outline). Each bar is exactly its score over the series' best episode (`--f` × `--plot`); the number and crown sit above the plot and never squeeze the bar. A dashed line marks the series median (every contestant's scored episodes), keyed in the card head as "median 16". Then a Performance radar with three axes, Prize, Filmed and Live, each labelled with its line icon (team tasks aren't counted, not even in Filmed).
    - Above the bars, an **All-time records** card: every stat where the contestant is in the all-time top 3 (`BADGES` in `alltime.js`, `TOP`), best rank first; no card if there are none. Ties show "=#3"; #1 glows gold. Finished series only, on both sides: the series still airing gets no badges and isn't in the pool (105 contestants), because a few episodes are too few to rank (in S21 only one of eight top-10 places after ep 4 lasted).
    - After the radar, the **Profile**: who they are, never how they're doing. A short bio (`bio` in the CSV) then personal facts: birthday (device locale), age, star sign, height ("173 cm", or "5′ 8″" when the device's region is the US), birthplace, education, children, siblings, Edinburgh Comedy Award, biggest film, also in, marathon (`factsFor`), skipping anything blank. Seat isn't shown (removed on request). With a group photo (22), their face (`faceFor` in `heroes.js`) sits behind the card, offset right (`.pf-bg`: eyes `--eyes` apart at `--fx`/`--fy`); the bio narrows to the left of it and the facts sit below on the darkened lower part. No face (21): a plain card. There's no statistical insight card (removed on request); the CSV's `stat` column isn't shown.
    - Each axis is a z-score of points per episode against all 110 contestants in Taskmaster history (`allTimePerEpisode` in `alltime.js`, stored as `state.stats`; `perEpisodeStats` in `ui.js` over the league's own series is the fallback if the stats file fails to load). It's per episode so a series in progress compares fairly with a finished one.
    - The scale runs from −3σ at the centre to +3σ at the edge of the circle. There's a hairline ring at every whole σ, with ticks where the rings cross the axes, and a dashed gold ring at 0σ (the all-series average).
    - Only the selected contestant is drawn: a solid shape in their colour with a subtle gradient, small vertex points and no outline. Each axis has one centred group set clear of the circle: the z-score to two decimals as the headline ("+2.48σ"), with the icon and name as a muted caption below. The card head says "z-score vs all 110 contestants". The look is precise and minimal: hairlines, no decoration.
- **Times are local:** every date, time and countdown uses the device's time zone and locale (`fmtDay`, `fmtWhen` in `ui.js`). Never hard-code London.
- **Icons:** task types (Prize, Filmed, Team, Live) use one monoline SVG set (`ICON_PATHS` / `icon()` in `ui.js`): 16px grid, 1.5 stroke, gold. Don't mix in emoji; they render in clashing styles. Emoji are only for the 👑/🏆/crown badges.
- **Nothing smaller than 11px.** Use weight and colour for hierarchy.
- **Standings backdrop layers:** the photo and its reshade must rasterise as one layer (`.pc-bg` is isolated; the `img` has no `filter`, `will-change` or 3D transform). Each row's photo is thousands of pixels wide; promoted to its own compositing layer, iOS Safari had to re-rasterise every one while the top bar resized, and the rows flashed white.
- **Emotion comes from faces, gold and colour, not motion.** Use framed portraits, a crown for the winner, gold/silver/bronze for the top three, gold for a pick that won, and contestant accent colours. The only decorative motion is the episode podium effects and the Standings backdrop parallax (both requested; see above), which stop under `prefers-reduced-motion`. Otherwise transitions are only for navigation, such as the tab slide and the row expanding.

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
node tools/import-stats.mjs   # refresh data/taskmaster_stats.csv from the Google Sheet, then run check-data
npm ci && npx playwright install chromium && node tools/screenshots.mjs
```

In the Claude cloud sandbox:
- The headless browser can't reach Imgur or Google Fonts, so use `FM_CURL_IMAGES=1 PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/screenshots.mjs`.
- The shots land in `shots/` (gitignored). Read them to review changes.

## Workflow

- Work on the session's `claude/…` branch and open one PR per round of feedback. Merge only when the user says so.
- CI (`.github/workflows/checks.yml`) runs the data check on every push and PR. PRs also upload a `screenshots` artifact.
- The user mostly uses the app on phones. Check the 390px shots first.
