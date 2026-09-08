# workout_app

A single-user garage-gym daily workout picker. It holds a pool of workouts, pulls one per day that
respects per-movement cadence (for example, deadlifts no more than every 7 days) and the equipment
you have, runs a format-aware timer with audio cues, and logs weight and reps.

## Layout

| Path | What it is |
|---|---|
| `app/` | **The current app.** Browser PWA (Vite + Preact + TypeScript), no backend. See `app/SPEC.md` and `app/README.md`. |
| `app/seed/` | Curated movement library and workout pool derived from the original spreadsheet. |
| `project_docs/`, `xlsx_version/` | Domain reference: workout formats, intensity levels, movement list, the original spreadsheet. |
| everything else at the root | Legacy Flutter prototype (June 2025). Not maintained; slated for archival. |

## Develop

```sh
cd app
npm install
npm run dev      # local dev server
npm run check    # typecheck + lint + tests
npm run build    # production bundle in app/dist
```

Hosted on Cloudflare Workers (static assets, see `app/wrangler.jsonc`), built from `main` on every push with build command `npm ci && npm run build` and deploy command `npx wrangler deploy`. The root `package.json` and `wrangler.jsonc` are a shim so the build works whether Cloudflare's root directory is `/` or `app`. CI runs typecheck, lint, tests, and a build on pull requests.
