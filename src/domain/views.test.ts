import { buildSeed, SEED_TODAY } from '@/data/seed';
import {
  accountActivity, allocationMap, balanceHistory, budgetSummary, budgetedPaycheques, composition, needsAttention,
  paychequeHistory, sameAllocations,
} from './views';

const data = buildSeed();
const today = SEED_TODAY;
const sep26 = data.paycheques.find((p) => p.id === 'p-2025-09-26')!;

describe('paycheques', () => {
  it('history status lines', () => {
    const h = paychequeHistory(data, today);
    expect(h[0].paycheque.payDate).toBe('2025-09-26');
    expect(h[0]).toMatchObject({ status: '$320.00 unallocated', tone: 'acc' });
    expect(h[1]).toMatchObject({ status: 'Fully allocated', tone: 'pos' });
    expect(h.find((r) => r.paycheque.payDate === '2025-08-15')!.status).toBe('Fully allocated · included $500 bonus');
  });
  it('allocation map includes unfunded split accounts', () => {
    const m = allocationMap(data, sep26.id);
    expect(m).toEqual({ chequing: 110000, tfsa: 58000, spending: 52000, emergency: 12000, rrsp: 0 });
    expect(sameAllocations(m, { ...m, rrsp: 0 })).toBe(true);
    expect(sameAllocations(m, { ...m, rrsp: 2000 })).toBe(false);
  });
});

describe('budget', () => {
  it('current period summary matches 3c', () => {
    const s = budgetSummary(data, sep26, today);
    expect(s).toMatchObject({ plan: 197000, spent: 183349, left: 13651, daysLeft: 6, length: 14, state: 'current' });
    expect(Math.round(s.used * 100)).toBe(93);
    expect(Math.round(s.projected / 100)).toBe(2088);
  });
  it('past periods are finished', () => {
    const prev = budgetedPaycheques(data).at(-2)!;
    expect(budgetSummary(data, prev, today)).toMatchObject({ state: 'past', daysLeft: 0, pace: 1 });
  });
  it('needs attention', () => {
    expect(needsAttention(data, sep26).map((r) => `${r.name}: ${r.note}`)).toEqual([
      'Dining: $32.15 over plan',
      'Housing: 100% used · $0.00 left',
      'Utilities: 89% used · $17.80 left',
      'Health: 87% used · $15.63 left',
    ]);
  });
});

describe('accounts', () => {
  it('composition', () => {
    const c = composition(data.accounts);
    expect(c.assets).toBe(4966165);
    expect(c.liabilities).toBe(-144525);
  });
  it('activity merges allocations and transactions', () => {
    const a = accountActivity(data, 'tfsa', today);
    expect(a[0]).toMatchObject({ date: '2025-09-26', label: 'Paycheque allocation', amount: 58000 });
    expect(accountActivity(data, 'spending', today)[0].label).toBe('Loblaws');
  });
  it('balance history reaches back a year and ends at the balance', () => {
    const all = balanceHistory(data, 'tfsa', 'All', today);
    expect(all.length).toBeGreaterThan(60);
    expect(all.at(-1)!.balance).toBe(2324055);
    expect(balanceHistory(data, 'tfsa', '1M', today).length).toBeLessThan(all.length);
  });
});
