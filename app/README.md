# Workout App

Garage-gym daily workout picker. See `SPEC.md` for the full contract.

## Run

```sh
npm install
npm run dev        # local dev server
npm run build       # typecheck + production build to dist/
npm run preview     # serve the production build locally
```

Set `VITE_BASE=/workout_app/` when building for GitHub Pages:

```sh
VITE_BASE=/workout_app/ npm run build
```

## Test / lint

```sh
npm run test        # vitest (domain layer unit tests)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run format       # prettier --write .
npm run check        # typecheck && lint && test
```

## Layout

- `src/domain/` — pure domain logic: types, cadence math, selection algorithm,
  timer state machine, import/export validation. Fully unit-tested, no DOM.
- `src/storage/` — `Storage` interface, IndexedDB implementation
  (`idb-keyval`), and first-run seed loading from `../seed/*.json`.
- `src/state/` — `@preact/signals` store wiring storage + seed together, plus
  the day-scoped "today's workout" helper (localStorage).
- `src/ui/` — screens and components (built in a later pass).
