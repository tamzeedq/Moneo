import { buildSeed, SEED_TODAY } from '@/data/seed';
import {
  budgetPool,
  budgetWatch,
  currentPaycheque,
  distributeTicks,
  goalNote,
  leftToAllocate,
  leftToBudget,
  netDelta,
  netPosition,
  periodInfo,
  recentTransactions,
  savingsRate,
  spendByCategory,
  spentBetween,
  splitRows,
  trailingSavingsRate,
  allocationsFor,
} from './selectors';
import { spendingPace } from './periods';
import type { Account, Allocation } from './types';

const data = buildSeed();
const today = SEED_TODAY;
const cur = currentPaycheque(data.paycheques, today)!;

describe('allocation maths', () => {
  it('left to allocate reaches exactly 0', () => {
    expect(leftToAllocate(264000, [110000, 58000, 52000, 12000, 32000])).toBe(0);
    expect(leftToAllocate(264000, [110000, 58000, 52000, 12000])).toBe(32000);
    expect(leftToAllocate(264000, [300000])).toBe(-36000);
  });

  const accounts = data.accounts as Account[];
  const allocs = (amts: Record<string, number>): Allocation[] =>
    Object.entries(amts).map(([accountId, amount]) => ({ paychequeId: 'x', accountId, amount }));

  it('savings rate = TFSA + Emergency + RRSP over net', () => {
    expect(
      savingsRate(264000, allocs({ chequing: 110000, tfsa: 58000, spending: 52000, emergency: 12000, rrsp: 32000 }), accounts),
    ).toBeCloseTo(102000 / 264000);
    expect(savingsRate(0, [], accounts)).toBe(0);
  });

  it('budget pool = Chequing + Spending', () => {
    expect(budgetPool(allocs({ chequing: 110000, tfsa: 58000, spending: 52000 }), accounts)).toBe(162000);
    expect(leftToBudget(162000, [65000, 42000])).toBe(55000);
  });

  it('distributes exactly 60 ticks', () => {
    const t = distributeTicks([110000, 58000, 52000, 12000, 32000], 264000);
    expect(t).toEqual([25, 13, 12, 3, 7]);
    expect(distributeTicks([1, 1, 1], 3, 60).reduce((a, b) => a + b)).toBe(60);
    expect(distributeTicks([100], 0)).toEqual([0]);
  });
});

describe('Overview figures from seed', () => {
  it('current period is day 8 of 14, next pay in 6 days', () => {
    expect(cur.payDate).toBe('2025-09-26');
    const info = periodInfo(cur, today);
    expect(info).toMatchObject({ elapsed: 8, length: 14, nextPayDate: '2025-10-10', daysUntilNext: 6 });
  });

  it('net position and delta', () => {
    expect(netPosition(data.accounts)).toBe(4821640);
    const d = netDelta(data.accounts, data.balanceSnapshots, cur.periodStart);
    expect(d.delta).toBe(184210);
    expect((d.pct * 100).toFixed(2)).toBe('3.97');
  });

  it('spent so far and categories', () => {
    expect(spentBetween(data.transactions, cur.periodStart, today)).toBe(183349);
    const cats = spendByCategory(data.transactions, data.categories, cur.periodStart, today);
    expect(cats.map((c) => c.category.name).slice(0, 5)).toEqual(['Housing', 'Groceries', 'Dining', 'Transport', 'Utilities']);
    expect(cats.map((c) => c.spent).slice(0, 5)).toEqual([65000, 38460, 21215, 16830, 14220]);
    expect(Math.round(cats[0].share * 100)).toBe(35);
  });

  it('savings rate shows 32%', () => {
    expect(Math.round(trailingSavingsRate(data, today) * 100)).toBe(32);
  });

  it('spending pace projects $2,088', () => {
    const pace = spendingPace(data, today)!;
    expect(pace.spent).toBe(183349);
    expect(Math.round(pace.projected / 100)).toBe(2088);
    expect(pace.actual).toHaveLength(9);
    expect(pace.average).toHaveLength(15);
  });

  it('latest split has $320 unallocated', () => {
    const rows = splitRows(cur, data.allocations, data.accounts);
    expect(rows.map((r) => [r.name, r.amount])).toEqual([
      ['Chequing', 110000],
      ['TFSA', 58000],
      ['Spending', 52000],
      ['Emergency', 12000],
      ['Unallocated', 32000],
    ]);
    expect(allocationsFor(data.allocations, cur.id)).toHaveLength(4);
  });

  it('budget watch top four', () => {
    const rows = budgetWatch(data.budgetLines, data.categories, data.transactions, cur).slice(0, 4);
    expect(rows.map((r) => [r.category.name, Math.round(r.used * 100)])).toEqual([
      ['Dining', 118],
      ['Housing', 100],
      ['Utilities', 89],
      ['Health', 87],
    ]);
    expect(rows[0].remaining).toBe(-3215);
  });

  it('recent transactions are newest first', () => {
    expect(
      recentTransactions(data.transactions, today)
        .map((t) => t.merchant)
        .slice(0, 4),
    ).toEqual(['Loblaws', 'Pizzeria on Ossington', 'Presto', 'Shoppers Drug Mart']);
  });

  it('goal notes', () => {
    expect(data.goals.map(goalNote)).toEqual(['About 7 paycheques to go', '$1,200 room left', 'Target May 2027']);
  });
});
