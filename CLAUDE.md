# Fantasky Master

Fantasy league for the TV show *Taskmaster*. Players pick one contestant per episode and score Show points (the contestant's score) and League points (5-4-3-2-1 by finishing place). Rules: `README.md`. Every calculation: `FANTASKY_MASTER_EXPLAINED.md`.

- **Live app:** https://kbroadie.github.io/Fantasky-Master/app/ (GitHub Pages serves `main` as-is).
- **Legacy site:** `index.html` at the root. It is frozen; don't read it or build on it.

## Layout

```
data/fantasky_master_data.csv   ← the ONLY league data (hand-edited; schema in data/README.md)
app/index.html                  page shell: top bar, home stage/dialog/me, <main>, floating dock
app/styles.css                  all styles; mobile-first, desktop in @media (min-width: 600/900px)
app/fonts/                      Monaspace variable woff2, subset to Latin (+ OFL.txt)
app/js/main.js                  state wiring, routing (#/series/view/arg), dialog, "you" card, events, boot
app/js/ui.js                    shared helpers ($, esc, ord, framed…), `state`, badges, swiper
app/js/views/{table,player,episodes,cast}.js   one file per tab; each returns an HTML string
app/js/league.js                pure scoring engine (derive) — must match the systems doc
app/js/csv.js                   CSV → series objects
app/js/meta.js                  presentation only: per-series theme + Imgur hero shots
app/js/stage.js                 HD-2D pixel-art house (canvas layers in CSS 3D); windows = episodes
app/js/gl.js, fx.js             WebGL sky; particle bursts
tools/check-data.mjs            validates the CSV + worked-example regression (no deps)
tools/screenshots.mjs           Playwright shots of every view at 390px and 1440px → shots/
```

## Conventions

- **No build step, no framework, no runtime dependencies.** Native ES modules; `package.json` is for tooling only.
- **Views** are functions returning template strings. Escape user and CSV text with `esc()`, or `rich()` to allow `<strong>`. Interactions go through delegated listeners in `main.js`.
- **Contestants** always appear as full gold-framed portraits (`framed()`), never cropped circles.
- **Fonts:** Monaspace only, one job per family:
  - `--f-body` Argon: reading.
  - `--f-ui` Neon: labels and figures.
  - `--f-head` Xenon: headings.
  - `--f-hand` Radon: player names.
  - `--f-mech` Krypton: dialog and stamps.
  - Keep `calt` on (texture healing); use `--ff-caps` for uppercase labels.
- **Hero shots** (`meta.js`): faces sit between about 19% and 45% of the photo height. The name and stats must start below that (`.cc-face` spacer), and the portrait row overlays the empty space above the heads.
- **Imgur images:** the page sets `referrer: no-referrer` because Imgur blocks some referrers. Portraits load as `…m.webp`.

## Commands

```sh
npm run serve                 # http://localhost:8000/app/
node tools/check-data.mjs     # run after any CSV or league.js change
npm ci && npx playwright install chromium && node tools/screenshots.mjs
```

In the Claude cloud sandbox:
- The headless browser can't reach Imgur, so use `FM_CURL_IMAGES=1 PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/screenshots.mjs`.
- The shots land in `shots/` (gitignored). Read them to review changes.

## Workflow

- Work on the session's `claude/…` branch and open one PR per round of feedback. Merge only when the user says so.
- CI (`.github/workflows/checks.yml`) runs the data check on every push and PR. PRs also upload a `screenshots` artifact.
- The user mostly uses the app on phones. Check the 390px shots first.
- **Re-subsetting fonts** (from the Monaspace repo's `fonts/Web Fonts/Variable Web Fonts`):
  `pyftsubset <Var.woff2> --flavor=woff2 --unicodes="U+0020-007E,U+00A0-00FF,U+2010-2027,U+2190-2199,U+2212,U+25B2,U+25B6,U+25BC,U+258C,U+2605,U+2713" --layout-features="calt,liga,ccmp,locl,case,frac,numr,dnom,sups,cv01,cv02,cv10,cv11,cv31"`
