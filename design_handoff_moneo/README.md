# Handoff: Moneo — personal finance dashboard (POC)

## Overview
Moneo is a paycheque-centric personal finance app. Money is planned **per paycheque** (bi-weekly), not per calendar month: each paycheque is split across accounts (Chequing, TFSA, Spending, Emergency, RRSP), the spending portion is budgeted by category for that pay period, and progress is tracked on a dense Overview and in a Chart Studio where users build and pin their own charts.

This POC should cover three flows:
1. **Overview** dashboard (4a)
2. **Add paycheque** wizard: Details → Split → Budget → Review (5a–5d)
3. **Chart Studio**: Library → New from question → Editor → Pin to Overview (6a–6d)

Secondary screens (Paycheques list, Budget, Accounts) exist at lower density (3b–3d). Build them after the three flows above, restyled to the 4a density.

## About the design files
The files in `design/` are **design references created in HTML**: prototypes that show the intended look and behaviour. They are not production code to copy. Recreate them in the stack below (or the target codebase's existing environment, if there is one), using its patterns and libraries.

- `design/Moneo Mockups.dc.html` opens directly in a browser (keep `support.js` next to it). It is a canvas of design turns. **Newest turn is at the top.** Every screen has an ID badge (4a, 5b…).
- Each turn header has a light/dark toggle, and many controls are live (steppers, templates, chart type, range, toggles, card size). Use the file to check behaviour, and `screenshots/` for static reference.
- **Final screens:** 4a, 5a–5d, 6a–6d. **Reference only:** 3b (Paycheques), 3c (Budget), 3d (Accounts). **Ignore:** turns 1–2, 3a and 3e (superseded explorations).

## Fidelity
**High-fidelity.** Colours, type, spacing, radii and copy are final. Recreate them pixel-close. The sample data (merchants, balances, goals) is placeholder. Ship it as seed/mock data and keep it easy to replace.

---

## Recommended stack (and why)

| Concern | Pick | Why, given these designs |
|---|---|---|
| App | **React 18 + TypeScript + Vite** | Single-user dashboard, no SEO needs. Vite gives the fastest POC loop. Use Next.js only if you need server rendering or auth later. |
| Routing | **React Router v6** (or TanStack Router) | Pages: `/`, `/paycheques`, `/paycheques/new/:step`, `/budget`, `/accounts`, `/charts`, `/charts/new`, `/charts/:id`, `/charts/:id/pin`. |
| Styling | **Tailwind CSS v4** with tokens as CSS variables | The design is a small, strict token set with a light/dark swap. Put the tokens in `:root` / `[data-theme=dark]` and map them in the Tailwind theme. |
| UI primitives | **Radix UI** (Select, Switch, Dialog, Popover, Tooltip, ToggleGroup) | Unstyled and accessible, so they fit a custom look. Use them for the selects (▾), toggles, segmented controls and card menus. |
| Charts | **Hand-rolled SVG + `d3-scale` / `d3-shape`** | The charts are custom: tick bars, half-ring gauges, sparklines, stacked bars, plan markers and annotated lines. A chart library would fight the styling. Use d3 only for maths (scales, line/area paths). Optional: visx for axes. |
| Drag | **dnd-kit** | Two cases: dragging dividers on the allocation bar (3b/5b) and moving the pinned card on the Overview layout (6d). |
| State | **Zustand** | One store for the paycheque wizard draft (it must persist across the 4 steps and survive reloads), one for UI (theme, period). |
| Persistence (POC) | **Dexie (IndexedDB)**, seeded from `seed.ts` | Local-first, no backend needed for the POC. Keep the data layer behind a small repository interface so Supabase/Postgres can replace it later. |
| Money | **Integer cents** everywhere + `Intl.NumberFormat('en-CA', {style:'currency', currency:'CAD'})` | Avoids float drift in splits. "Left to allocate" must reach exactly $0.00. |
| Dates | **date-fns** | Bi-weekly period maths (`addWeeks`, pay-period ranges). |
| CSV import | **Papa Parse** | Needed for the "Import CSV" action on the Overview. |
| Fonts | **@fontsource/geist** + **@fontsource/geist-mono** | Self-host. |
| Tests | **Vitest** + Testing Library | Unit-test the allocation and budget maths first. |

Later, outside the POC: Supabase (auth + Postgres + row-level security), bank aggregation (Plaid / Flinks for Canada), and Tauri if a desktop app is wanted.

---

## Design tokens

### Colour: light / dark
| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#f6f5f2` | `#0e0f0f` | App background |
| `panel` | `#ffffff` | `#171918` | Cards |
| `panel2` | `#f1f0ec` | `#212423` | Table header rows, inset boxes, selected template |
| `navOn` | `#ffffff` | `#212423` | Active nav item, active segment |
| `seg` | `#ebe9e4` | `#1b1d1c` | Segmented-control track |
| `line` | `rgba(0,0,0,.06)` | `rgba(255,255,255,.07)` | All 1px borders and dividers |
| `ink` | `#16181a` | `#eeeeec` | Primary text |
| `mute` | `#6b6e70` | `#9a9d9b` | Secondary text, labels |
| `faint` | `#a6a8a6` | `#5f6361` | Axis labels, placeholders, decimals ("$2,640**.00**") |
| `acc` (terracotta) | `#c25a3a` | `#e0835f` | Primary accent: CTAs, selected states, over-budget, unallocated |
| `pos` | `#4f8a62` | `#8fbf9f` | Positive deltas, completed steps, "every dollar has a job" |
| `inv` | `#16181a` | `#eeeeec` | Inverted (ink) buttons and dark cards |
| `invInk` | `#ffffff` | `#0e0f0f` | Text on `inv` |
| `invMute` | `#a9aca9` | `#5f6361` | Secondary text on `inv` |
| `track` | `#eeece7` | `#232625` | Empty bar/gauge tracks, unfilled ticks |
| `shadow` | `0 1px 2px rgba(0,0,0,.05)` | none | Active nav / segment only |

**Category / series palette** (same in both themes): `#d9825f` (Housing), `#d8b67a` (Groceries), `#8fae8f` (Dining), `#7f95ab` (Transport), `#a88aa6` (Utilities), `#c99a8e` (Subscriptions), `#a8a29a` (Other).
**Account colours:** Chequing = `inv`, TFSA = `acc`, Spending = `#d8b67a`, Emergency = `#8fae8f`, RRSP = `#7f95ab`, Visa = `#a8a29a`.
Category avatar tint = palette colour at 20% alpha (`#RRGGBB33`).

### Typography
- Family: **Geist** (400/500/600). **Geist Mono** is only used in superseded turns and is not needed.
- `font-variant-numeric: tabular-nums` on the body. All money aligns.
- Scale (px / weight / letter-spacing):
  - Hero number: 40–48 / 500 / -0.045em (net position, paycheque amount)
  - Big stat: 30–34 / 500 / -0.04em
  - Card stat: 20–26 / 500 / -0.035em
  - Page title: 22 / 600 / -0.025em
  - Card title: 14 / 500
  - Body / table: 13 / 400–500
  - Label / meta: 12 / 400, colour `mute`
  - Micro (axis, sublabels): 11 / 400; 10 for step numbers
- Decimal cents in hero numbers are rendered in `faint`.

### Spacing, radius, layout
- App frame: 1280px design width. Sidebar **220px** (padding 24/16, border-right `line`). Main padding **22px 28px**. Gap between cards **14px**.
- Card: `panel` bg, 1px `line` border, radius **18px**, padding **18–22px**. Inner rows separated by 1px `line`.
- Radii: 22 (large hero cards in 3x), 18 (cards), 16 (footers), 14 (Overview layout map, template rows), 12 (template/size options), 10–11 (inputs, buttons), 9 (step pills), 7 (avatars), 999 (chips, toggles).
- Inputs: padding 9–10 / 12px, radius 10, 1px `line` border, `bg` fill. Focused/primary input gets a 1.5px `acc` border.
- Buttons: primary = `inv` bg / `invInk` text; strongest CTA (Save paycheque, Pin chart, Pin to Overview) = `acc` bg / white text; secondary = 1px `line` border. Padding 10px 16–18px, 13px/500.
- Chips: 6px 12px, radius 999; selected = `inv` fill.
- Toggles: 34×20 track (`acc` on, `track` off), 14px white knob, 0.2s transition.
- Nav item: 9px 12px, radius 10. Active = `navOn` + `shadow`, weight 500.

---

## Screens

Every screen shares the **app shell**: sidebar (logo = 22px `acc` rounded square + "moneo" 18/600, nav Overview / Paycheques / Budget / Accounts / Chart Studio, bottom links Import / Export, Settings) and a main column with a header row (breadcrumb 12px `mute` above a 22px title on the left; actions on the right, always including the light/dark toggle).

### 4a — Overview (`screenshots/4a-overview-light.png`, `-dark.png`)
Dense card grid, top to bottom:
1. **Header:** "Good morning, Sam" plus "Saturday, Oct 4 · day 8 of 14 this paycheque". Period segmented control (Paycheque / Week / Month / Quarter / Year / Custom), theme toggle, "+ Add paycheque" (inv) → starts the 5a wizard.
2. **Net position card** (full width): hero balance with faint decimals, delta in `pos` with ▲; three quick stats (Paycheque in / Spent so far / Savings rate) separated by vertical `line`. On the right, an area line chart with a 1M/6M/1Y/All selector, terracotta stroke and a gradient fill fading to transparent.
3. **Row:** Accounts card (2×3 mini-cards: colour square, name, balance, delta, sparkline green when up / terracotta when down) | dark `inv` **Next paycheque** card (amount, progress bar of days elapsed, date · source, "Plan →" acc button) above a 2×2 quick-action grid (+ Transaction, Update balance, Import CSV, New chart).
4. **Row of three:** Spending pace (actual line vs. 3-paycheque average line, dot at today, dashed projection, "on track for $2,088") | By category (half-ring gauge with total in the centre, legend rows: dot, name, amount, %) | Latest paycheque split (tick bar, table of accounts, "Unallocated" row in `acc`, outlined "Finish allocating" button).
5. **Row:** Recent transactions (wider column; table with columns Merchant / Account / Amount; merchant cell = tinted initial avatar + name + "Category · Date" sublabel; positive amounts in `pos`) | Budget watch (per category: name, % used, bar with a tick marking where you should be by today, "$spent of $plan" and remaining / "$x over" in `acc`) | Goals (name, "$current / $target", progress bar in goal colour, sublabel).

### 5a–5d — Add paycheque wizard
Shared: the header holds a **4-step stepper** (Details · Split · Budget · Review) in a `seg` pill. The current step uses a `navOn` bg and an `acc` number circle; completed steps show ✓ on `pos`; future steps use `track`. A sticky **footer card** has Back/Cancel on the left and a status line plus the primary action on the right.

**5a Details** (`5a-add-paycheque-details.png`)
- Left: Details card. The net deposit input is large (40px), focused with an `acc` border, and shows a hint like "Same as last 5 of 6". Below it, a 3-col grid: Pay date, Source, Deposited to (account colour dot), Pay period, then Repeats chips spanning 2 columns (Every 2 weeks / Twice a month / Monthly / One-off; chips wrap and never truncate). Note textarea last.
- Gross-to-net card (optional): line items (Gross, Income tax, CPP, EI, Benefits, Net) with colour squares, plus a 60-tick bar showing take-home as % of gross.
- Right: "Start the split from" templates (radio rows with name, description and a 4px mix bar of account colours). **Selecting a template sets the step 2 allocations.** Templates: Standard bi-weekly, Aggressive savings, Holiday month, Start blank. Below it, a "Recent paycheques" bar chart (7 bars, current one in `acc`, note about the overtime outlier).
- Footer: Cancel | "Next: split $2,640.00 across 5 accounts" · Continue →

**5b Split** (`5b-add-paycheque-split.png`, `-dark.png`)
- Hero card: paycheque amount on the left, template chip + Reset, "Left to allocate" on the right (`pos` at $0, `acc` otherwise). A **60-tick allocation bar** (each tick 1/60 of the paycheque, coloured by account in order, unfilled = `track`) with a legend showing %.
- Table: Account (colour avatar + sublabel) / Balance now / **This paycheque stepper** (− amount +, ±$20 per click, clicking the amount allows exact typing, floor $0) / After.
- Right: **Goal impact**: for each goal, a bar with the current fill plus a 45%-opacity extension for this paycheque's contribution, and "+$x" or "No change". Below it, a dark card: "Funds the budget in step 3" = Chequing + Spending.
- Footer status: "Every dollar has a job" (`pos`) / "$x still unassigned" / "$x over the paycheque" (`acc`). Continue is allowed while unassigned but shows a warning. Block Continue when over.

**5c Budget** (`5c-add-paycheque-budget.png`)
- Category table: Category (tinted initial avatar + "from Chequing/Spending") / **Plan vs. last period** (bar = plan, scale max $720; a 2px `ink` marker at 55% opacity shows last period's actual; note "Last period ran $x over this plan" in `acc`, or "$x cushion vs. last period" in `mute`) / Last spent / Plan stepper (±$10).
- Header chips: Copy last plan (default), 3-paycheque average, + Category.
- Right: **Budget pool** half-ring gauge (segments per category, in palette colours) with "Left to budget" in the centre, then rows Pool / Budgeted / Rolled over (`pos`). "Bills due this period" list.
- Footer: Back | status ("Pool fully budgeted" / "$x left unbudgeted, stays in Spending" / "$x over the pool") · Review →

**5d Review** (`5d-add-paycheque-review.png`)
- Summary strip with 4 columns: Paycheque in / Moved to savings (+ savings rate %) / Budgeted / Unallocated.
- Three cards: **Transfers to make** (checkbox rows "Chequing → TFSA", amount, plus a reminder toggle), **Balances after** (each account with new balance and +delta), **Budget** (stacked proportion bar + list).
- Footer: Back | Save as template (secondary) · **Save paycheque** (acc). Saving creates the paycheque, allocation and budget records, then returns to Overview with a confirmation toast.

### 6a–6d — Chart Studio
**6a Library** (`6a-chart-library.png`): header with search, theme toggle and "+ New chart". Filter chips (All / Pinned / Drafts / Spending / Saving / Accounts). A 3-col grid of chart cards: title, type · range sublabel, status badge (Pinned = `acc` at 13% bg with `acc` text; Draft/Saved = `panel2`/`mute`), headline number + delta, a **110px live mini chart**, and a footer with "Edited …" and placement. A dashed banner at the bottom links to templates.

**Mini-chart kinds** (one shared `<MiniChart kind>` component; also used at 280px height in 6b):
- `line` / `area`: SVG path, 2px stroke, area fill = stroke colour at ~13–20% alpha
- `stackedBars`: 6 months × 5 segments, 2px gaps, radius 3
- `barsVsPlan`: single bars, `acc` when over the plan else `#d8b67a`, dashed `ink` plan line at 50% opacity
- `allocationTicks`: 48 ticks coloured by account
- `ranked`: horizontal bars with label and amount

**6b New chart from a question** (`6b-chart-new-from-question.png`): left, a 380px list of question rows (numbered square, question, sublabel, arrow; selected = `acc` border and number fill). Right, a large preview using the user's real data: name, headline number + delta, chart, x-range labels, and 3 info tiles (Data / Chart / Updates). Actions: Customize → 6c, "Use this chart →" saves and opens it.
Questions → charts: Am I saving more? → savings rate line · Where does my money go? → stacked bars · Am I sticking to plan? → bars vs. plan · Is my net position growing? → area · Where does each paycheque go? → allocation ticks · Where do I shop most? → ranked merchants.

**6c Editor** (`6c-chart-editor.png`, `-dark.png`): 3 columns (230 / flex / 230).
- Left config: Measure select (with formula hint "TFSA + Emergency + RRSP ÷ net pay"), Bucket by, **Range** segmented (3 mo = 6 paycheques, 6 mo = 12, 1 yr = 26), **Chart type** chips (Line / Area / Bars), toggles **Compare to target** and **Show notes**.
- Centre: headline "Latest · Oct 10 · 39%", legend, 300px plot with y gridlines (0–40%, dashed `line`), the series in the chosen colour, a dashed target line at 30%, **notes** as white dots with an `ink` ring and a label chip above (only notes inside the range are shown), the latest point highlighted, and a dark tooltip pinned to the lower-right corner of the plot. X labels every ~1/6 of the range. In Bars mode, the last bar is full opacity, bars below target drop to 35% when the target is on, others 70%.
- Under the plot, a 4-up stats strip that recalculates with the range: Average, Best, Change since start, "At or above target x of n".
- Right style panel: Title, **Colour** swatches (acc, `#7f95ab`, `#8fae8f`, ink; selected has a double ring), Y axis Percent/Dollars, Target, notes list + "+ Add note".

**6d Pin to Overview** (`6d-chart-pin-to-overview.png`): left, an **Overview layout map**: a 4-col grid (64px rows) of skeleton cards mirroring 4a. The new card has a dashed `acc` border and a live sparkline, and can be dragged. Right: **Card size** options (Small = 1 col, Medium = 2 cols, Large = 4 cols × 2 rows, each with an 8-cell icon); changing size reflows the map (animate 0.25s). Then a "Place after" select, "Also show on Paycheques" toggle, refresh mode, and a dark summary card. Footer: Back to editor | status · **Pin chart** (acc).

### Reference only: 3b Paycheques, 3c Budget, 3d Accounts
Use for content and behaviour, but restyle to 4a density (radius 18, 14px gaps, 13px body).
- **3b** has the original **draggable allocation bar** (drag the dividers, snaps to $10). Reuse it as an alternative input in 5b.
- **3c** has budget gauges and the category watch list.
- **3d** has the account list with sparklines, an allocation composition bar and a detail panel (trend chart + activity) for the selected account.

---

## Interactions & behaviour
- **Theme:** light/dark toggle in every header. Persist to localStorage and respect `prefers-color-scheme` on first load. Background transitions 0.3s.
- **Wizard draft:** one object in the Zustand store, persisted to localStorage, so Back and Forward never lose input. Step 2 defaults come from the selected template, step 3 defaults from "Copy last plan".
- **Steppers:** ±$20 (accounts) and ±$10 (categories), clamped at $0. Clicking the value turns it into a numeric input. Totals, ticks, gauges and goal impact all recalculate live.
- **Validation:** net deposit > 0; pay date required; Split cannot be over the paycheque; a Budget over the pool shows a warning but is allowed.
- **Charts:** hover shows a tooltip with the nearest point (the mockup pins it to the latest point). Range, type, target, notes and colour update instantly with no reload.
- **Empty states:** no paycheques yet → the Overview "Next paycheque" card becomes "Add your first paycheque". No charts → 6a shows the question list from 6b inline.
- **Number formatting:** en-CA, CAD, minus sign "−" (U+2212), 2 decimals in tables and 0 decimals in steppers and gauge labels.

## State & data model (TypeScript)
```ts
type Cents = number;
type AccountKind = 'chequing'|'tfsa'|'spending'|'emergency'|'rrsp'|'credit';
interface Account { id: string; name: string; kind: AccountKind; institution?: string; color: string; balance: Cents; }
interface Paycheque { id: string; source: string; payDate: string; periodStart: string; periodEnd: string;
  net: Cents; gross?: Cents; deductions?: { label: string; amount: Cents }[]; depositAccountId: string;
  repeats: 'biweekly'|'semimonthly'|'monthly'|'once'; note?: string; templateId?: string; }
interface Allocation { paychequeId: string; accountId: string; amount: Cents; }
interface Category { id: string; name: string; color: string; fundedFrom: string /* accountId */; }
interface BudgetLine { paychequeId: string; categoryId: string; plan: Cents; }
interface Transaction { id: string; date: string; merchant: string; categoryId?: string; accountId: string; amount: Cents; }
interface Goal { id: string; name: string; target: Cents; current: Cents; accountId?: string; color: string; due?: string; }
interface SplitTemplate { id: string; name: string; description: string; amounts: Record<string, Cents>; }
interface Bill { id: string; name: string; amount: Cents; due: string; accountId: string; }
interface ChartDef { id: string; title: string; question?: string;
  measure: 'savingsRate'|'spending'|'netPosition'|'allocation'|'merchantSpend'|'categoryVsPlan';
  bucket: 'paycheque'|'week'|'month'; range: number; kind: 'line'|'area'|'bars'|'stackedBars'|'barsVsPlan'|'allocationTicks'|'ranked';
  color: string; target?: number; showTarget: boolean; showNotes: boolean; notes: { date: string; label: string }[];
  status: 'draft'|'saved'|'pinned'; pin?: { size: 'S'|'M'|'L'; after: string; alsoOn?: string[] }; }
```
Derived values (selectors, all unit-tested): left to allocate, savings rate (TFSA + Emergency + RRSP ÷ net), budget pool (Chequing + Spending allocations), left to budget, spending pace vs. 3-paycheque average, budget "where you should be today" marker = (days elapsed ÷ period days).

**Seed data:** use the figures in the mockups. Accounts: Chequing $3,412.10, TFSA $23,240.55, Emergency $8,420.00, RRSP $14,102.80, Spending $486.20, Visa −$1,445.25. Paycheque $2,640 every 2 weeks from Northwind Ltd. Default split 1100 / 580 / 520 / 120 / 320. Budget 650 / 420 / 160 / 180 / 150 / 60. Goals: Emergency $8,420/$10,000, TFSA room $5,800/$7,000, Japan trip $1,240/$4,000. Savings-rate series (26 paycheques): `17,19,18,21,20,22,21,23,22,24,23,26,25,24,27,26,28,27,30,29,31,30,33,34,36,39`. The full mock arrays are in the logic class at the bottom of the HTML file (`v3()`, `v5()`, `v6()`).

## Suggested build order
1. Tokens, theme, app shell, routing
2. Data layer + seed + money/date utils + selectors (with tests)
3. Overview (4a)
4. Add paycheque wizard (5a → 5d)
5. Chart Studio (6a → 6d), starting with the shared `MiniChart`
6. Paycheques / Budget / Accounts restyled from 3b–3d

## Kickoff prompt for Claude Code
> Read `design_handoff_moneo/README.md` and the screenshots. Scaffold a React + TypeScript + Vite app using the recommended stack. Implement the design tokens as CSS variables with light/dark themes, then the app shell, the data layer with seed data, and the Overview (4a). Match the screenshots closely. Stop after the Overview so I can review, then continue with the wizard (5a–5d) and Chart Studio (6a–6d).

## Assets
No images or icon files. The logo is a 22px rounded square in `acc` next to the word "moneo" (Geist 600). Glyphs used: ▾ ▲ ▼ → ← ✓ − +. Swap in an icon set (e.g. Lucide) if you want, keeping strokes at 1.5px.

## Files
- `design/Moneo Mockups.dc.html` + `design/support.js`: the interactive mockup canvas (open in a browser)
- `screenshots/`:
  - 4a-overview-light.png, 4a-overview-dark.png
  - 5a-add-paycheque-details.png, 5b-add-paycheque-split.png, 5b-add-paycheque-split-dark.png, 5c-add-paycheque-budget.png, 5d-add-paycheque-review.png
  - 6a-chart-library.png, 6b-chart-new-from-question.png, 6c-chart-editor.png, 6c-chart-editor-dark.png, 6d-chart-pin-to-overview.png
  - 3b-paycheques.png, 3c-budget.png, 3d-accounts.png (reference only)
