import { buildSeed, SEED_TODAY } from '@/data/seed';
import {
  averagePlan,
  expectedPaycheques,
  budgetStatus,
  createDraft,
  draftPool,
  draftToRecords,
  firstInvalidStep,
  goalImpact,
  lastSpent,
  moveDivider,
  nextPayDate,
  payPeriod,
  sameAmountCount,
  savingsOf,
  splitStatus,
  stepAmount,
} from './wizard';

const data = buildSeed();
const today = SEED_TODAY;

describe('pay dates', () => {
  it('bi-weekly, monthly and semi-monthly', () => {
    expect(nextPayDate('2025-09-26', 'biweekly')).toBe('2025-10-10');
    expect(nextPayDate('2025-01-31', 'monthly')).toBe('2025-02-28');
    expect(nextPayDate('2025-10-01', 'semimonthly')).toBe('2025-10-15');
    expect(nextPayDate('2025-10-15', 'semimonthly')).toBe('2025-10-31');
    expect(nextPayDate('2025-10-31', 'semimonthly')).toBe('2025-11-15');
  });
  it('period runs to the day before the next pay date', () => {
    expect(payPeriod('2025-10-10', 'biweekly')).toEqual({ start: '2025-10-10', end: '2025-10-23', days: 14 });
  });
});

describe('draft prefill', () => {
  const d = createDraft(data, today);
  it('prefills from the Sep 26 paycheque', () => {
    expect(d).toMatchObject({
      basedOn: 'p-2025-09-26',
      net: 264000,
      payDate: '2025-10-10',
      source: 'Northwind Ltd.',
      templateId: 'standard',
    });
    expect(d.allocations).toEqual({ chequing: 110000, tfsa: 58000, spending: 52000, emergency: 12000, rrsp: 32000 });
    expect(d.gross! - d.deductions.reduce((a, x) => a + x.amount, 0)).toBe(d.net);
  });
  it('copies the last plan', () => {
    expect(d.budget.map((b) => b.categoryId)[0]).toBe('housing');
    expect(d.budget).toHaveLength(8);
  });
  it('"Same as last 5 of 6"', () => {
    expect(sameAmountCount(data.paycheques, today, 264000)).toEqual({ same: 5, of: 6 });
  });
});

describe('split', () => {
  it('status and continue rules', () => {
    expect(splitStatus(264000, { a: 264000 })).toMatchObject({ left: 0, tone: 'pos', label: 'Every dollar has a job', canContinue: true });
    expect(splitStatus(264000, { a: 200000 })).toMatchObject({ left: 64000, label: '$640.00 still unassigned', canContinue: true });
    expect(splitStatus(264000, { a: 270000 })).toMatchObject({ label: '$60.00 over the paycheque', canContinue: false });
  });
  it('steppers clamp at $0', () => {
    expect(stepAmount(1000, -2000)).toBe(0);
    expect(stepAmount(1000, 2000)).toBe(3000);
  });
  it('dragging a divider moves money between neighbours only', () => {
    const order = ['a', 'b', 'c'];
    const next = moveDivider(order, { a: 10000, b: 10000, c: 5000 }, 0, 13340);
    expect(next).toEqual({ a: 13000, b: 7000, c: 5000 });
    expect(moveDivider(order, { a: 10000, b: 10000, c: 5000 }, 0, 99999)).toEqual({ a: 20000, b: 0, c: 5000 });
    expect(moveDivider(order, { a: 10000, b: 10000, c: 5000 }, 1, 0)).toEqual({ a: 10000, b: 0, c: 15000 });
  });
  it('pool, savings and goal impact', () => {
    const al = { chequing: 110000, tfsa: 58000, spending: 52000, emergency: 12000, rrsp: 32000 };
    expect(draftPool(data.accounts, al)).toBe(162000);
    expect(savingsOf(data.accounts, al)).toBe(102000);
    const gi = goalImpact(data.goals, al);
    expect(gi.map((g) => [g.goal.name, g.add, g.after])).toEqual([
      ['Emergency fund', 12000, 854000],
      ['TFSA room · 2026', 58000, 638000],
      ['Japan trip', 0, 124000],
    ]);
  });
});

describe('budget', () => {
  it('status', () => {
    expect(budgetStatus(162000, [162000])).toMatchObject({ tone: 'pos', label: 'Pool fully budgeted' });
    expect(budgetStatus(162000, [100000]).label).toBe('$620.00 left unbudgeted, stays in Spending');
    expect(budgetStatus(162000, [197000])).toMatchObject({ tone: 'acc', label: '$350.00 over the pool' });
  });
  it('last spent and 3-paycheque average', () => {
    expect(lastSpent(data, today).dining).toBe(21215);
    const avg = averagePlan(data, today, ['housing', 'groceries']);
    expect(avg[0].plan).toBe(65000);
    expect(avg[1].plan % 1000).toBe(0);
  });
});

describe('records', () => {
  it('creates paycheque, allocations and budget lines', () => {
    const d = createDraft(data, today);
    const r = draftToRecords(d, 'p-new');
    expect(r.paycheque).toMatchObject({ id: 'p-new', periodStart: '2025-10-10', periodEnd: '2025-10-23', net: 264000 });
    expect(r.allocations).toHaveLength(5);
    expect(r.budgetLines.every((b) => b.paychequeId === 'p-new')).toBe(true);
  });
  it('blocks on invalid steps', () => {
    const d = createDraft(data, today);
    expect(firstInvalidStep(d)).toBeUndefined();
    expect(firstInvalidStep({ ...d, net: 0 })).toBe('details');
    expect(firstInvalidStep({ ...d, allocations: { chequing: 300000 } })).toBe('split');
  });
});

describe('expected paycheques', () => {
  it('nothing is due while the current period is running', () => {
    expect(expectedPaycheques(data.paycheques, today)).toMatchObject({ due: [], next: '2025-10-10' });
  });
  it('lists every missed bi-weekly pay date, oldest first', () => {
    expect(expectedPaycheques(data.paycheques, '2025-10-30')).toMatchObject({ due: ['2025-10-10', '2025-10-24'], next: '2025-11-07' });
  });
  it('a pay date of today counts as due', () => {
    expect(expectedPaycheques(data.paycheques, '2025-10-10').due).toEqual(['2025-10-10']);
  });
  it('one-off paycheques and empty workspaces expect nothing', () => {
    const once = data.paycheques.map((p) => ({ ...p, repeats: 'once' as const }));
    expect(expectedPaycheques(once, '2026-01-01').due).toEqual([]);
    expect(expectedPaycheques([], today)).toEqual({ due: [], basis: undefined });
  });
});
