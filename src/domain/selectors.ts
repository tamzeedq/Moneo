import type {
  Account,
  AccountKind,
  Allocation,
  BalanceSnapshot,
  BudgetLine,
  Category,
  Cents,
  Goal,
  ISODate,
  MoneoData,
  NetSnapshot,
  Paycheque,
  Transaction,
} from './types';
import { addDaysISO, daysBetween, monthYear } from './dates';
import { money, sum } from './money';

export const SAVINGS_KINDS: readonly AccountKind[] = ['tfsa', 'emergency', 'rrsp'];
export const BUDGET_KINDS: readonly AccountKind[] = ['chequing', 'spending'];

// ─── Paycheques & periods ────────────────────────────────────────────────────

const byPayDate = (a: Paycheque, b: Paycheque) => a.payDate.localeCompare(b.payDate);

/** Paycheques on or before `today`, oldest first. */
export function pastPaycheques(paycheques: Paycheque[], today: ISODate): Paycheque[] {
  return paycheques.filter((p) => p.payDate <= today).sort(byPayDate);
}

/** The paycheque whose period contains today (the latest one received). */
export function currentPaycheque(paycheques: Paycheque[], today: ISODate): Paycheque | undefined {
  const past = pastPaycheques(paycheques, today);
  return past[past.length - 1];
}

export interface PeriodInfo {
  start: ISODate;
  end: ISODate;
  /** Whole days elapsed since the period started ("day 8 of 14"). */
  elapsed: number;
  length: number;
  /** elapsed ÷ length: where you should be by today. */
  fraction: number;
  nextPayDate: ISODate;
  daysUntilNext: number;
}

export function periodInfo(p: Paycheque, today: ISODate): PeriodInfo {
  const length = daysBetween(p.periodStart, p.periodEnd) + 1;
  const elapsed = Math.min(Math.max(daysBetween(p.periodStart, today), 0), length);
  const nextPayDate = addDaysISO(p.periodEnd, 1);
  return {
    start: p.periodStart,
    end: p.periodEnd,
    elapsed,
    length,
    fraction: elapsed / length,
    nextPayDate,
    daysUntilNext: Math.max(daysBetween(today, nextPayDate), 0),
  };
}

// ─── Allocation maths ────────────────────────────────────────────────────────

export const allocationsFor = (allocations: Allocation[], paychequeId: string) =>
  allocations.filter((a) => a.paychequeId === paychequeId);

/** Net minus everything allocated. Exactly 0 when every dollar has a job; negative when over. */
export function leftToAllocate(net: Cents, amounts: readonly Cents[]): Cents {
  return net - sum(amounts);
}

const kindOf = (accounts: Account[]) => {
  const m = new Map(accounts.map((a) => [a.id, a.kind]));
  return (id: string) => m.get(id);
};

/** (TFSA + Emergency + RRSP) ÷ net. */
export function savingsRate(net: Cents, allocs: Allocation[], accounts: Account[]): number {
  if (net <= 0) return 0;
  const kind = kindOf(accounts);
  const saved = sum(allocs.filter((a) => SAVINGS_KINDS.includes(kind(a.accountId)!)).map((a) => a.amount));
  return saved / net;
}

/** Average savings rate over the last `n` paycheques received. */
export function trailingSavingsRate(data: MoneoData, today: ISODate, n = 3): number {
  const recent = pastPaycheques(data.paycheques, today).slice(-n);
  if (!recent.length) return 0;
  const rates = recent.map((p) => savingsRate(p.net, allocationsFor(data.allocations, p.id), data.accounts));
  return sum(rates) / rates.length;
}

/** Chequing + Spending allocations fund the category budget. */
export function budgetPool(allocs: Allocation[], accounts: Account[]): Cents {
  const kind = kindOf(accounts);
  return sum(allocs.filter((a) => BUDGET_KINDS.includes(kind(a.accountId)!)).map((a) => a.amount));
}

export function leftToBudget(pool: Cents, plans: readonly Cents[]): Cents {
  return pool - sum(plans);
}

/**
 * Distributes `count` ticks across amounts proportionally (largest remainder),
 * so the bar always has exactly `count` ticks. Returns one tick count per amount.
 */
export function distributeTicks(amounts: readonly Cents[], total: Cents, count = 60): number[] {
  if (total <= 0) return amounts.map(() => 0);
  const raw = amounts.map((a) => (Math.max(a, 0) / total) * count);
  const out = raw.map(Math.floor);
  const target = Math.min(count, Math.round(sum(raw)));
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; sum(out) < target && k < order.length; k++) out[order[k][1]]++;
  return out;
}

export interface SplitRow {
  accountId: string | null; // null = unallocated
  name: string;
  color: string;
  amount: Cents;
  share: number;
}

/** Allocation rows for a paycheque in split order, plus an "Unallocated" row when money is left. */
export function splitRows(p: Paycheque, allocations: Allocation[], accounts: Account[]): SplitRow[] {
  const allocs = allocationsFor(allocations, p.id);
  const rows: SplitRow[] = accounts
    .filter((a) => a.splitOrder !== undefined)
    .sort((a, b) => a.splitOrder! - b.splitOrder!)
    .map((a) => ({
      accountId: a.id,
      name: a.shortName ?? a.name,
      color: a.color,
      amount: sum(allocs.filter((x) => x.accountId === a.id).map((x) => x.amount)),
      share: 0,
    }))
    .filter((r) => r.amount > 0);
  const left = leftToAllocate(p.net, rows.map((r) => r.amount));
  if (left > 0) rows.push({ accountId: null, name: 'Unallocated', color: 'var(--faint)', amount: left, share: 0 });
  return rows.map((r) => ({ ...r, share: r.amount / p.net }));
}

// ─── Balances ────────────────────────────────────────────────────────────────

export const netPosition = (accounts: Account[]): Cents => sum(accounts.map((a) => a.balance));

export function snapshotsFor(snapshots: BalanceSnapshot[], accountId: string): BalanceSnapshot[] {
  return snapshots.filter((s) => s.accountId === accountId).sort((a, b) => a.date.localeCompare(b.date));
}

/** Balance at the end of `date`: the latest snapshot on or before it. */
export function balanceAt(snapshots: BalanceSnapshot[], accountId: string, date: ISODate): Cents | undefined {
  let found: BalanceSnapshot | undefined;
  for (const s of snapshotsFor(snapshots, accountId)) if (s.date <= date) found = s;
  return found?.balance;
}

/** Change in balance since the period started. */
export function accountDelta(account: Account, snapshots: BalanceSnapshot[], periodStart: ISODate): Cents {
  const start = balanceAt(snapshots, account.id, periodStart);
  return start === undefined ? 0 : account.balance - start;
}

export function netDelta(accounts: Account[], snapshots: BalanceSnapshot[], periodStart: ISODate) {
  const delta = sum(accounts.map((a) => accountDelta(a, snapshots, periodStart)));
  const before = netPosition(accounts) - delta;
  return { delta, pct: before ? delta / Math.abs(before) : 0 };
}

export type NetRange = '1M' | '6M' | '1Y' | 'All';

export function netHistory(snapshots: NetSnapshot[], range: NetRange, today: ISODate): NetSnapshot[] {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date)).filter((s) => s.date <= today);
  const days = { '1M': 31, '6M': 183, '1Y': 365, All: Infinity }[range];
  if (days === Infinity) return sorted;
  const from = addDaysISO(today, -days);
  return sorted.filter((s) => s.date >= from);
}

// ─── Spending ────────────────────────────────────────────────────────────────

/** Spending = outgoing categorised transactions (excludes transfers and paycheque deposits). */
export const isSpend = (t: Transaction) => t.amount < 0 && !!t.categoryId;

export const inRange = (t: { date: ISODate }, start: ISODate, end: ISODate) => t.date >= start && t.date <= end;

export function spentBetween(txs: Transaction[], start: ISODate, end: ISODate): Cents {
  return -sum(txs.filter((t) => isSpend(t) && inRange(t, start, end)).map((t) => t.amount));
}

export interface CategorySpend {
  category: Category;
  spent: Cents;
  share: number;
}

/** Spend per category in a window, biggest first. Categories with no spend are dropped. */
export function spendByCategory(txs: Transaction[], categories: Category[], start: ISODate, end: ISODate): CategorySpend[] {
  const totals = new Map<string, Cents>();
  for (const t of txs) if (isSpend(t) && inRange(t, start, end)) totals.set(t.categoryId!, (totals.get(t.categoryId!) ?? 0) - t.amount);
  const total = sum([...totals.values()]);
  return categories
    .map((category) => ({ category, spent: totals.get(category.id) ?? 0, share: 0 }))
    .filter((c) => c.spent > 0)
    .map((c) => ({ ...c, share: total ? c.spent / total : 0 }))
    .sort((a, b) => b.spent - a.spent || a.category.order - b.category.order);
}

export interface BudgetWatchRow {
  category: Category;
  plan: Cents;
  spent: Cents;
  used: number;
  remaining: Cents; // negative = over
}

/** Budget lines for a paycheque with spend to date, most-used first. */
export function budgetWatch(
  lines: BudgetLine[],
  categories: Category[],
  txs: Transaction[],
  paycheque: Paycheque,
): BudgetWatchRow[] {
  const spend = new Map(
    spendByCategory(txs, categories, paycheque.periodStart, paycheque.periodEnd).map((c) => [c.category.id, c.spent]),
  );
  const cats = new Map(categories.map((c) => [c.id, c]));
  return lines
    .filter((l) => l.paychequeId === paycheque.id && cats.has(l.categoryId))
    .map((l) => {
      const spent = spend.get(l.categoryId) ?? 0;
      return { category: cats.get(l.categoryId)!, plan: l.plan, spent, used: l.plan ? spent / l.plan : 0, remaining: l.plan - spent };
    })
    .sort((a, b) => b.used - a.used);
}

export interface PaceSeries {
  /** Cumulative spend at the start of each day 0..elapsed (index = day of period). */
  actual: Cents[];
  /** Average cumulative spend of previous periods, days 0..length. */
  average: Cents[];
  spent: Cents;
  /** spent + what the average period still spends from today to the end. */
  projected: Cents;
  length: number;
  elapsed: number;
}

function cumulative(txs: Transaction[], start: ISODate, days: number): Cents[] {
  const daily = new Array<Cents>(days).fill(0);
  for (const t of txs) {
    if (!isSpend(t)) continue;
    const d = daysBetween(start, t.date);
    if (d >= 0 && d < days) daily[d] -= t.amount;
  }
  const out: Cents[] = [0];
  for (const v of daily) out.push(out[out.length - 1] + v);
  return out; // length days + 1; out[i] = spent before day i
}

/** Spending this period vs. the average of the previous `n` paycheque periods. */
export function spendingPace(data: MoneoData, today: ISODate, n = 3): PaceSeries | undefined {
  const past = pastPaycheques(data.paycheques, today);
  const cur = past[past.length - 1];
  if (!cur) return undefined;
  const info = periodInfo(cur, today);
  // Include today's spending in the latest point.
  const actualFull = cumulative(data.transactions, cur.periodStart, info.length);
  const actual = actualFull.slice(0, info.elapsed + 1);
  actual[info.elapsed] = actualFull[Math.min(info.elapsed + 1, info.length)];
  const prev = past.slice(-1 - n, -1);
  const average = new Array<Cents>(info.length + 1).fill(0);
  for (const p of prev) cumulative(data.transactions, p.periodStart, info.length).forEach((v, i) => (average[i] += v / prev.length));
  const rounded = average.map(Math.round);
  const spent = actual[actual.length - 1];
  const projected = prev.length ? spent + rounded[info.length] - rounded[info.elapsed] : spent;
  return { actual, average: rounded, spent, projected, length: info.length, elapsed: info.elapsed };
}

export function recentTransactions(txs: Transaction[], today: ISODate, n = 6): Transaction[] {
  return txs
    .filter((t) => t.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, n);
}

// ─── Goals ───────────────────────────────────────────────────────────────────

export function goalNote(g: Goal): string {
  const left = Math.max(g.target - g.current, 0);
  if (g.due) return 'Target ' + monthYear(g.due);
  if (g.kind === 'room') return money(left, { decimals: 0 }) + ' room left';
  if (g.contributionPerPaycheque) {
    const n = Math.ceil(left / g.contributionPerPaycheque);
    return n <= 0 ? 'Reached' : `About ${n} paycheque${n === 1 ? '' : 's'} to go`;
  }
  return money(left, { decimals: 0 }) + ' to go';
}
