/**
 * Placeholder data for the POC, using the figures from the design mockups.
 * Everything here is replaceable: the app only reads it through the repository.
 * Money is in integer cents; "today" is pinned to 2025-10-04 (see domain/dates.ts).
 */
import type {
  Account,
  Allocation,
  BalanceSnapshot,
  Bill,
  BudgetLine,
  ChartDef,
  Category,
  Cents,
  Goal,
  MoneoData,
  NetSnapshot,
  Paycheque,
  SplitTemplate,
  Transaction,
} from '@/domain/types';
import { addDaysISO, daysBetween } from '@/domain/dates';
import { toCents } from '@/domain/money';

export const PROFILE = { name: 'Sam' };

/** Bump when the seed changes so existing local databases are reseeded (POC only). */
export const SEED_VERSION = 9;

export const SEED_TODAY = '2025-10-04';
const CURRENT_PAY_DATE = '2025-09-26';

// ─── Accounts ────────────────────────────────────────────────────────────────

const accounts: Account[] = [
  { id: 'chequing', name: 'Chequing', purpose: 'Bills & fixed costs', kind: 'chequing', color: 'var(--inv)', balance: 341210, order: 0, splitOrder: 0 },
  { id: 'tfsa', name: 'TFSA', purpose: 'Investing', kind: 'tfsa', color: 'var(--acc)', balance: 2324055, order: 1, splitOrder: 1 },
  { id: 'emergency', name: 'Emergency fund', shortName: 'Emergency', purpose: 'Savings goal', kind: 'emergency', color: '#8fae8f', balance: 842000, order: 2, splitOrder: 3 },
  { id: 'rrsp', name: 'RRSP', purpose: 'Retirement', kind: 'rrsp', color: '#7f95ab', balance: 1410280, order: 3, splitOrder: 4 },
  { id: 'spending', name: 'Spending', purpose: 'Day-to-day spending', kind: 'spending', color: '#d8b67a', balance: 48620, order: 4, splitOrder: 2 },
  { id: 'visa', name: 'Visa', purpose: 'Credit card', kind: 'credit', color: '#a8a29a', balance: -144525, order: 5 },
];

/** Change in balance over the current pay period (drives the deltas and sparklines). */
const periodDeltas: Record<string, Cents> = {
  chequing: 74872,
  tfsa: 78040,
  emergency: 12000,
  rrsp: 43918,
  spending: -3380,
  visa: -21240,
};

// ─── Categories ──────────────────────────────────────────────────────────────

const categories: Category[] = [
  { id: 'housing', name: 'Housing', color: '#d9825f', fundedFrom: 'chequing', order: 0 },
  { id: 'groceries', name: 'Groceries', color: '#d8b67a', fundedFrom: 'spending', order: 1 },
  { id: 'dining', name: 'Dining', color: '#8fae8f', fundedFrom: 'spending', order: 2 },
  { id: 'transport', name: 'Transport', color: '#7f95ab', fundedFrom: 'spending', order: 3 },
  { id: 'utilities', name: 'Utilities', color: '#a88aa6', fundedFrom: 'chequing', order: 4 },
  { id: 'shopping', name: 'Shopping', color: '#c99a8e', fundedFrom: 'spending', order: 5 },
  { id: 'health', name: 'Health', color: '#a8a29a', fundedFrom: 'spending', order: 6 },
  { id: 'subscriptions', name: 'Subscriptions', color: '#6f8f86', fundedFrom: 'chequing', order: 7 },
];

const currentPlan: Record<string, number> = {
  housing: 650, groceries: 450, dining: 180, transport: 200, utilities: 160, shopping: 150, health: 120, subscriptions: 60,
};

// ─── Templates ───────────────────────────────────────────────────────────────

const tpl = (c: number, t: number, s: number, e: number, r: number) => ({
  chequing: toCents(c), tfsa: toCents(t), spending: toCents(s), emergency: toCents(e), rrsp: toCents(r),
});

const templates: SplitTemplate[] = [
  { id: 'standard', name: 'Standard bi-weekly', description: 'Bills first, 22% to TFSA, rest to spending', amounts: tpl(1100, 580, 520, 120, 320), order: 0 },
  { id: 'aggressive', name: 'Aggressive savings', description: 'Moves $400 from Spending to TFSA', amounts: tpl(1100, 980, 120, 120, 320), order: 1 },
  { id: 'holiday', name: 'Holiday month', description: 'Extra $300 to Spending, RRSP paused', amounts: tpl(1100, 580, 820, 140, 0), order: 2 },
  { id: 'blank', name: 'Start blank', description: 'Allocate from $0', amounts: tpl(0, 0, 0, 0, 0), order: 3 },
];

// ─── Paycheques & allocations ────────────────────────────────────────────────

/** Savings rate (%) per paycheque, oldest first, for the paycheques before the last three. */
const historicRates = [17, 19, 18, 21, 20, 22, 21, 23, 22, 24, 23, 26, 25, 24, 27, 26, 28, 27, 30, 29, 31, 30, 33];
const NET = 264000;

const paycheques: Paycheque[] = [];
const allocations: Allocation[] = [];

function addPaycheque(payDate: string, net: Cents, amounts: Record<string, number>, note?: string, templateId = 'standard') {
  const id = 'p-' + payDate;
  paycheques.push({
    id,
    source: 'Northwind Ltd.',
    payDate,
    periodStart: payDate,
    periodEnd: addDaysISO(payDate, 13),
    net,
    gross: net === NET ? 361538 : undefined,
    deductions:
      net === NET
        ? [
            { label: 'Income tax', amount: 61240 },
            { label: 'CPP', amount: 19820 },
            { label: 'EI', amount: 5962 },
            { label: 'Benefits', amount: 10516 },
          ]
        : undefined,
    depositAccountId: 'chequing',
    repeats: 'biweekly',
    note,
    templateId,
  });
  for (const [accountId, dollars] of Object.entries(amounts)) {
    if (dollars > 0) allocations.push({ paychequeId: id, accountId, amount: toCents(dollars) });
  }
}

{
  const total = historicRates.length + 3;
  for (let k = 0; k < total; k++) {
    const payDate = addDaysISO(CURRENT_PAY_DATE, -14 * (total - 1 - k));
    const fromLatest = total - 1 - k;
    if (fromLatest === 0) addPaycheque(payDate, NET, { chequing: 1100, tfsa: 580, spending: 520, emergency: 120 });
    // Sep 12 and Aug 29 each save $920 (35%): with Sep 26's 26.5% the 3-paycheque average is 32%.
    else if (fromLatest === 1 || fromLatest === 2) addPaycheque(payDate, NET, { chequing: 1100, tfsa: 580, spending: 620, emergency: 120, rrsp: 220 });
    else if (payDate === '2025-08-15')
      addPaycheque(payDate, 314000, { chequing: 1100, tfsa: 580, spending: 1020, emergency: 120, rrsp: 320 }, 'Included $500 bonus');
    else {
      // Older paycheques: savings follow the historic rate, split 60/15/25 across TFSA/Emergency/RRSP.
      const saved = Math.round((historicRates[k] / 100) * 2640 / 10) * 10;
      const tfsa = Math.round(saved * 0.6 / 10) * 10, emergency = Math.round(saved * 0.15 / 10) * 10;
      addPaycheque(payDate, NET, { chequing: 1100, tfsa, emergency, rrsp: saved - tfsa - emergency, spending: 2640 - 1100 - saved });
    }
  }
}

// Next paycheque (Oct 10) is not in the data yet: the Overview forecasts it from the repeat rule.

const budgetLines: BudgetLine[] = paycheques.flatMap((p) =>
  Object.entries(currentPlan).map(([categoryId, plan]) => ({ paychequeId: p.id, categoryId, plan: toCents(plan) })),
);

// ─── Transactions ────────────────────────────────────────────────────────────

type TxRow = [day: number, merchant: string, categoryId: string, accountId: string, dollars: number];

/** Current period (starts Sep 26), days 0–7, in the order they happened. */
const currentPeriod: TxRow[] = [
  [0, 'GoodLife Fitness', 'health', 'visa', 80.19],
  [0, 'Pai Northern Thai', 'dining', 'visa', 46.8],
  [1, 'Spotify', 'subscriptions', 'visa', 11.99],
  [1, 'Shell', 'transport', 'visa', 58.3],
  [1, 'No Frills', 'groceries', 'spending', 64.18],
  [1, 'Uniqlo', 'shopping', 'visa', 59.9],
  [1, 'Bar Raval', 'dining', 'visa', 54.2],
  [2, 'Netflix', 'subscriptions', 'visa', 18.99],
  [2, 'St. Lawrence Market', 'groceries', 'spending', 41.12],
  [2, 'Indigo', 'shopping', 'visa', 32.5],
  [2, 'Uber', 'transport', 'visa', 24],
  [2, 'Uber Eats', 'dining', 'visa', 32.4],
  [3, 'iCloud', 'subscriptions', 'visa', 3.99],
  [3, 'Toronto Hydro', 'utilities', 'chequing', 48.6],
  [3, 'Tim Hortons', 'dining', 'spending', 8.45],
  [3, 'Farm Boy', 'groceries', 'spending', 52.37],
  [4, 'Crave', 'subscriptions', 'visa', 12],
  [4, 'Starbucks', 'dining', 'spending', 6.95],
  [4, 'Enbridge Gas', 'utilities', 'chequing', 22.5],
  [4, 'Green P Parking', 'transport', 'visa', 12],
  [4, 'Loblaws', 'groceries', 'spending', 71.9],
  [5, 'Balzac’s Coffee', 'dining', 'spending', 15.5],
  [5, 'No Frills', 'groceries', 'spending', 30.36],
  [5, 'Tim Hortons', 'dining', 'spending', 9.1],
  [5, 'Sobeys', 'groceries', 'spending', 38.25],
  [5, 'Petro-Canada', 'transport', 'visa', 34],
  [5, 'Canadian Tire', 'shopping', 'visa', 32.5],
  [5, 'Northview Properties', 'housing', 'chequing', 650],
  [5, 'Bell Canada', 'utilities', 'chequing', 71.1],
  [6, 'Shoppers Drug Mart', 'health', 'spending', 24.18],
  [6, 'Presto', 'transport', 'visa', 40],
  [7, 'Pizzeria on Ossington', 'dining', 'visa', 38.75],
  [7, 'Loblaws', 'groceries', 'spending', 86.42],
];

/** Second half of a period (days 8–13): split of the late-period total across categories. */
const lateMix: [day: number, merchant: string, categoryId: string, accountId: string, share: number][] = [
  [8, 'Loblaws', 'groceries', 'spending', 0.4],
  [10, 'Tim Hortons', 'dining', 'spending', 0.12],
  [11, 'Presto', 'transport', 'visa', 0.2],
  [12, 'Bar Raval', 'dining', 'visa', 0.18],
  [13, 'Amazon', 'shopping', 'visa', 0.1],
];

/** Deterministic PRNG (Park–Miller), same as the mockups. */
function rng(seed: number) {
  let x = seed;
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
}

const transactions: Transaction[] = [];
{
  let n = 0;
  const push = (t: Omit<Transaction, 'id'>) => transactions.push({ id: 't' + String(++n).padStart(5, '0'), ...t });
  const rand = rng(42);
  const sorted = [...paycheques].sort((a, b) => a.payDate.localeCompare(b.payDate));
  // The three periods before the current one are tuned so the 3-paycheque average projects $2,088.
  const tuned: Record<number, [early: number, late: number]> = { 1: [1.06, 231.4], 2: [1.12, 262.18], 3: [1.08, 269.95] };
  sorted.forEach((p, idx) => {
    const back = sorted.length - 1 - idx;
    const [factor, lateTotal] = tuned[back] ?? [0.85 + rand() * 0.25, 200 + rand() * 120];
    push({ date: p.payDate, merchant: p.source, accountId: p.depositAccountId, amount: p.net, paychequeId: p.id });
    for (const [day, merchant, categoryId, accountId, dollars] of currentPeriod) {
      const amt = back === 0 || categoryId === 'housing' ? dollars : dollars * factor;
      // Past periods shift each transaction by up to a day (rent by up to two) so the average isn't a copy of this period.
      const jitter = back === 0 ? 0 : Math.round((rand() * 2 - 1) * (categoryId === 'housing' ? 2 : 1));
      const d = Math.min(7, Math.max(0, day + jitter));
      push({ date: addDaysISO(p.periodStart, d), merchant, categoryId, accountId, amount: -toCents(amt) });
    }
    if (back === 0) return; // current period: days 8+ haven't happened yet
    let used = 0;
    lateMix.forEach(([day, merchant, categoryId, accountId, share], i) => {
      const cents = i === lateMix.length - 1 ? toCents(lateTotal) - used : Math.round(toCents(lateTotal) * share);
      used += cents;
      push({ date: addDaysISO(p.periodStart, day), merchant, categoryId, accountId, amount: -cents });
    });
  });
}

// ─── Goals & bills ───────────────────────────────────────────────────────────

const goals: Goal[] = [
  { id: 'emergency', name: 'Emergency fund', target: 1000000, current: 842000, accountId: 'emergency', color: '#8fae8f', kind: 'balance', contributionPerPaycheque: 23000, order: 0 },
  { id: 'tfsa-2026', name: 'TFSA room · 2026', target: 700000, current: 580000, accountId: 'tfsa', color: 'var(--acc)', kind: 'room', order: 1 },
  { id: 'japan', name: 'Japan trip', target: 400000, current: 124000, color: '#d8b67a', due: '2027-05-01', kind: 'balance', order: 2 },
];

const bills: Bill[] = [
  { id: 'rent', name: 'Rent · Northview Properties', amount: 130000, due: '2025-11-01', accountId: 'chequing' },
  { id: 'bell', name: 'Bell Canada', amount: 7110, due: '2025-10-14', accountId: 'chequing' },
  { id: 'netflix', name: 'Netflix', amount: 1899, due: '2025-10-18', accountId: 'visa' },
];

// ─── Balance history ─────────────────────────────────────────────────────────

/** Random walk ending at `end`, starting `delta × span` below it (ported from the mockups). */
function walk(seed: number, end: number, delta: number, n: number, span: number): number[] {
  const r = rng(seed);
  const st = end - delta * span;
  const amp = Math.abs(delta) * 0.25 + Math.abs(end) * 0.006;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? end : st + ((end - st) * i) / (n - 1) + (r() - 0.5) * amp));
}

/** 20 points per account: every 2 days up to the period start, then daily to today. */
const balanceSnapshots: BalanceSnapshot[] = accounts.flatMap((a, i) => {
  const delta = periodDeltas[a.id];
  const pts = walk(7 + i * 31, a.balance / 100, delta / 100, 20, 2);
  const dates = [
    ...Array.from({ length: 12 }, (_, k) => addDaysISO(CURRENT_PAY_DATE, -2 * (11 - k))),
    ...Array.from({ length: 8 }, (_, k) => addDaysISO(CURRENT_PAY_DATE, k + 1)),
  ];
  return pts.map((v, k) => ({
    accountId: a.id,
    date: dates[k],
    // Pin the period-start point so the delta is exact.
    balance: k === 11 ? a.balance - delta : toCents(v),
  }));
});

/** Weekly net position for ~18 months, through key points, ending at today's exact total. */
const netSnapshots: NetSnapshot[] = (() => {
  const keys: [string, number][] = [
    ['2024-04-05', 33800], ['2024-07-05', 35900], ['2024-10-04', 38100], ['2025-01-03', 39600],
    ['2025-04-04', 40700], ['2025-05-02', 41100], ['2025-06-06', 42100], ['2025-07-04', 42900],
    ['2025-08-01', 43700], ['2025-08-15', 44900], ['2025-08-29', 45700], ['2025-09-12', 46600],
    ['2025-09-26', 47450],
  ];
  const end = accounts.reduce((s, a) => s + a.balance, 0);
  const r = rng(11);
  // Weekly points counted back from today so they are evenly spaced.
  const dates: string[] = [];
  for (let d = addDaysISO(SEED_TODAY, -7); d >= keys[0][0]; d = addDaysISO(d, -7)) dates.unshift(d);
  const out: NetSnapshot[] = [];
  for (const d of dates) {
    const j = keys.findIndex(([k]) => k > d);
    const [d0, v0] = keys[Math.max(j - 1, 0)];
    const [d1, v1] = j === -1 ? [SEED_TODAY, end / 100] : keys[j];
    const t = daysBetween(d0, d) / Math.max(daysBetween(d0, d1), 1);
    out.push({ date: d, value: toCents(v0 + (v1 - v0) * t + (r() - 0.5) * 160) });
  }
  out.push({ date: SEED_TODAY, value: end });
  return out;
})();

/**
 * Weekly balances before the recent 20-point window, so the Accounts chart can show 6M/1Y/All.
 * Each account follows the net-position trend from its first recent snapshot, with a little noise.
 */
const olderSnapshots: BalanceSnapshot[] = (() => {
  const out: BalanceSnapshot[] = [];
  accounts.forEach((a, i) => {
    const recent = balanceSnapshots.filter((b) => b.accountId === a.id).sort((x, y) => x.date.localeCompare(y.date));
    const anchor = recent[0];
    const netAt = (d: string) => [...netSnapshots].reverse().find((n) => n.date <= d)?.value ?? netSnapshots[0].value;
    const base = netAt(anchor.date);
    const r = rng(300 + i * 17);
    for (const n of netSnapshots) {
      if (n.date >= anchor.date) break;
      const v = anchor.balance * (n.value / base) + (r() - 0.5) * Math.abs(anchor.balance) * 0.03;
      out.push({ accountId: a.id, date: n.date, balance: Math.round(v) });
    }
  });
  return out;
})();

// ─── Charts (6a library) ─────────────────────────────────────────────────────

const chart = (c: Partial<ChartDef> & Pick<ChartDef, 'id' | 'title' | 'measure' | 'bucket' | 'range' | 'kind'>): ChartDef => ({
  color: 'var(--acc)',
  showTarget: false,
  showNotes: false,
  notes: [],
  status: 'saved',
  editedAt: SEED_TODAY,
  ...c,
});

/** Pinned charts sit after Goals so the top of the Overview matches 4a. */
const charts: ChartDef[] = [
  chart({
    id: 'savings-rate', title: 'Savings rate by paycheque', question: 'Am I saving more?', measure: 'savingsRate', bucket: 'paycheque',
    range: 12, kind: 'line', yAxis: 'percent', target: 30, showTarget: true, showNotes: true, status: 'pinned',
    pin: { size: 'M', after: 'goals', pinnedAt: '2025-06-01T12:00:00Z' }, editedAt: SEED_TODAY,
    notes: [
      { date: '2025-08-15', label: 'Bonus +$500' },
      { date: '2025-07-04', label: 'Raise · 4%' },
      { date: '2025-04-11', label: 'Car repair' },
    ],
  }),
  chart({
    id: 'monthly-spending', title: 'Monthly spending by category', question: 'Where does my money go?', measure: 'spending',
    bucket: 'month', range: 6, kind: 'stackedBars', status: 'pinned', pin: { size: 'L', after: 'goals', pinnedAt: '2025-06-03T12:00:00Z' }, editedAt: '2025-09-30',
  }),
  chart({
    id: 'dining-plan', title: 'Dining vs. plan', question: 'Am I sticking to plan?', measure: 'categoryVsPlan', categoryId: 'dining',
    bucket: 'month', range: 6, kind: 'barsVsPlan', status: 'draft', editedAt: '2025-09-22',
  }),
  chart({
    id: 'net-position', title: 'Net position', question: 'Is my net position growing?', measure: 'netPosition', bucket: 'month',
    range: 12, kind: 'area', color: '#8fae8f', status: 'pinned', pin: { size: 'M', after: 'goals', pinnedAt: '2025-06-02T12:00:00Z' }, editedAt: '2025-08-14',
  }),
  chart({
    id: 'paycheque-split', title: 'Where each paycheque goes', question: 'Where does each paycheque go?', measure: 'allocation',
    bucket: 'paycheque', range: 1, kind: 'allocationTicks', status: 'saved', pin: { size: 'M', after: '', alsoOn: ['paycheques'] }, editedAt: '2025-10-04',
  }),
  chart({
    id: 'grocery-merchants', title: 'Top grocery merchants', question: 'Where do I shop most?', measure: 'merchantSpend',
    categoryId: 'groceries', bucket: 'month', range: 91, kind: 'ranked', status: 'draft', editedAt: '2025-07-30',
  }),
];

export function buildSeed(): MoneoData {
  return {
    accounts,
    paycheques,
    allocations,
    categories,
    budgetLines,
    transactions,
    goals,
    templates,
    bills,
    balanceSnapshots: [...olderSnapshots, ...balanceSnapshots],
    netSnapshots,
    charts,
  };
}
