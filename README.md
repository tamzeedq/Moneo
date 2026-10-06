# Moneo
Paycheque-centric personal finance dashboard (POC). Design handoff lives in `design_handoff_moneo/`.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest: money + selector maths
npm run build
```

- Data is local-first (Dexie/IndexedDB), seeded from `src/data/seed.ts`. Bump `SEED_VERSION` there to reseed existing browsers.
- "Today" is pinned to 2025-10-04 so the seed matches the mockups. Set `VITE_DEMO_DATE=live` (or another `yyyy-MM-dd`) to change it.
- Design tokens: `src/styles/tokens.css` (light on `:root`, dark on `[data-theme=dark]`), mapped into Tailwind in `src/styles/index.css`.
