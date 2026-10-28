# Moneo

Paycheque-centric personal finance: each paycheque is split across your accounts, the spending part is budgeted, and progress is tracked on the Overview and in Chart Studio. The design handoff lives in `design_handoff_moneo/`.

## Develop

Requires Node 22 (see `.nvmrc`).

```bash
npm install
npm run dev          # http://localhost:5173
npm run check        # typecheck + lint + format check + unit tests
npm run e2e          # Playwright end-to-end tests against a production build
npm run build
```

Other scripts: `npm test` (Vitest), `npm run lint`, `npm run format`, `npm run e2e:ui` (Playwright UI mode).

## Workspaces

Data is local-first (Dexie/IndexedDB), in one of two separate local databases:

- **My data** (default): your own data on the real clock. It starts empty, and a welcome screen sets up starter accounts.
- **Demo**: the design's sample data with "today" pinned to Sat, Oct 4 2025 so the screens match the mockups. Open it with `?workspace=demo`, from the welcome screen, or from Settings. Bump `SEED_VERSION` in `src/data/seed.ts` to reseed browsers' demo data.

All storage goes through the `Repository` interface in `src/data/repository.ts`, which a server implementation will replace in Phase 1.

## Code map

- `src/domain/`: pure, unit-tested logic (money, dates, selectors, periods, wizard, charts, CSV import, view models)
- `src/data/`: storage (Dexie), seed and starter data, workspaces
- `src/pages/`: screens; `src/components/`: shared UI and charts; `src/lib/`: small utilities (ids, download, error reporting)
- `e2e/`: Playwright specs; demo-workspace tests use `openDemo()` from `e2e/helpers.ts`

Design tokens: `src/styles/tokens.css` (light on `:root`, dark on `[data-theme=dark]`), mapped into Tailwind in `src/styles/index.css`.
