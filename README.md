# Daily Care — Мій ритм

A mobile-friendly Ukrainian calendar for daily habits and medication records. Built with vanilla TypeScript, separate HTML/CSS source files, and Vite.

## Development

Use Node.js 26, matching package.json and GitHub Actions.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. `npm start` is an alias for the same Vite development server. Changes reload automatically.

## Project structure

- `src/index.html` — page structure, configuration dialog, and reference links.
- `src/app.ts` — calendar rendering, navigation, checkboxes, and editor actions.
- `src/schedule.ts` — date arithmetic, course phases, and configuration validation.
- `src/storage.ts` — localStorage reads, writes, and checkbox validation.
- `src/style.css` — responsive styles and compact dose labels.
- `public/config.json` — editable default schedule, copied unchanged to the build.
- `vite.config.ts` — Vite server settings and relative asset URLs for GitHub Pages.
- `test/schedule.test.ts` — schedule boundary tests.

## Edit the schedule

Change `public/config.json` and rebuild for deployment. The Rules dialog edits a browser-local override and supports JSON export.

- `startDate`: first day, YYYY-MM-DD.
- `months`: duration in calendar months; end date is exclusive.
- `timeZone`: determines today's date.
- `rules`: unique stable `id`, `name`, `dose`, `times`, `months`, optional `note` and `warning`.
- `phases`: contiguous one-based, inclusive `fromDay`/`toDay` ranges with doses keyed by time. A final `toDay: null` lasts to the course/calendar end.

Rule courses start at the calendar start. Walking is rendered last without changing its time. Notes about meals do not automatically shift entry times.

## Browser storage

Checkmarks use `rhythm-checks`, keyed by `date|ruleId@time`. A saved Rules configuration uses `rhythm-config` and overrides the default JSON, including after deployments. To load new defaults, open Rules, choose the initial rules button, review, and save. This does not erase checkmarks.

Storage is specific to the browser and origin. Keep using the same hostname and port to retain access to existing data. There is no account sync or push notification service.

## Checks and production build

```sh
npm test
npm run typecheck
npm run build
npm run preview
```

`npm run build` runs strict type checking, tests, and the Vite production build in sequence. CI uses this same command after `npm ci`.

Vite builds to `dist/`, with HTML, JavaScript, and CSS as separate files. Upload the whole directory to a static host. Serve it over HTTP(S); double-clicking `dist/index.html` is not a supported way to run the app.

## GitHub Pages

The workflow in `.github/workflows/build-deploy.yml` runs on pushes to `main` and manual dispatches on `main`. It installs dependencies with `npm ci`, checks types, runs tests, builds with Vite, and deploys only `dist/` using official Pages actions. No custom secrets or deploy key are needed.

1. Push the source and `package-lock.json` to GitHub.
2. Select **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Push to `main`, or choose **Actions → Build & Deploy → Run workflow** on `main`.
4. Open the successful deployment URL from the `github-pages` environment.

Relative asset URLs support `https://USERNAME.github.io/REPOSITORY/`. If the deployment branch changes, update both the push filter and build job condition. GitHub Pages may expose the medical schedule publicly; check the intended audience before publishing. Local preparation does not publish the site.

## Medication records

The schedule records user-provided information and is not a verified prescription. Preserve explicit user choices when editing the app. Supporting notes retain known discrepancies, including the chromium source record's `200 мг` versus the previously checked Solgar product's `200 мкг`. Do not silently infer doses or substitute medicines.

TypeScript uses strict checking via `tsconfig.json`. Domain types live in `src/types.ts`; validate external JSON at runtime before treating it as a typed configuration.

`src/` is the Vite application root. Static configuration stays in the project-level `public/`; Vite copies it into the project-level `dist/`. Keep package files, TypeScript/Vite configuration, and `test/` at the project root.

## Install on a phone

The production build includes `manifest.json`, a service worker, and sunflower icons. On Android, use the browser's **Install app / Add to Home screen** command. On iPhone, open the site in Safari and choose **Share → Add to Home Screen**. After the first online visit finishes caching, the calendar can open offline. Saved checkmarks remain in localStorage. New versions activate when the app is reopened; an open configuration editor is not forcibly reloaded.
