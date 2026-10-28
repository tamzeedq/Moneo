import { buildSeed, SEED_TODAY } from '@/data/seed';
import { incomeIn, paceFor, periodWindow, previousWindows, spendingPace, throughToday } from './periods';
import type { Transaction } from './types';

const data = buildSeed();
const today = SEED_TODAY; // Saturday, Oct 4 2025

describe('period windows', () => {
  it('paycheque window is the latest paycheque period', () => {
    expect(periodWindow('Paycheque', today, data.paycheques)).toMatchObject({
      start: '2025-09-26',
      end: '2025-10-09',
      length: 14,
      elapsed: 8,
      current: true,
      label: 'Sep 26 – Oct 9',
    });
    expect(periodWindow('Paycheque', today, [])).toBeUndefined();
  });

  it('calendar windows contain today; weeks start on Monday', () => {
    expect(periodWindow('Week', today, [])).toMatchObject({ start: '2025-09-29', end: '2025-10-05', label: 'Week of Sep 29', elapsed: 5 });
    expect(periodWindow('Month', today, [])).toMatchObject({ start: '2025-10-01', end: '2025-10-31', length: 31, label: 'October 2025' });
    expect(periodWindow('Quarter', today, [])).toMatchObject({ start: '2025-10-01', end: '2025-12-31', label: 'Q4 2025' });
    expect(periodWindow('Year', today, [])).toMatchObject({ start: '2025-01-01', end: '2025-12-31', length: 365, label: '2025' });
  });

  it('custom defaults to the last 30 days and orders a reversed range', () => {
    expect(periodWindow('Custom', today, [])).toMatchObject({ start: '2025-09-05', end: '2025-10-04', length: 30 });
    expect(periodWindow('Custom', today, [], { start: '2025-09-10', end: '2025-09-01' })).toMatchObject({
      start: '2025-09-01',
      end: '2025-09-10',
      current: false,
    });
  });

  it('previous windows step back, oldest first', () => {
    const month = periodWindow('Month', today, [])!;
    expect(previousWindows(month, 3, [], today).map((w) => w.label)).toEqual(['July 2025', 'August 2025', 'September 2025']);
    const pay = periodWindow('Paycheque', today, data.paycheques)!;
    expect(previousWindows(pay, 3, data.paycheques, today).map((w) => w.start)).toEqual(['2025-08-15', '2025-08-29', '2025-09-12']);
  });
});

describe('pace over windows', () => {
  const tx = (date: string, cents: number): Transaction => ({
    id: date + cents,
    date,
    merchant: 'x',
    accountId: 'a',
    categoryId: 'c',
    amount: -cents,
  });

  it('matches the paycheque projection from the design ($2,088)', () => {
    expect(Math.round(spendingPace(data, today)!.projected / 100)).toBe(2088);
  });

  it("a shorter previous month doesn't borrow the next month's spending", () => {
    const oct = periodWindow('Month', '2025-10-31', [])!;
    const sep = previousWindows(oct, 1, [], '2025-10-31');
    // $10 on Sep 30 counts for September; $99 on Oct 1 must not leak into September's day 31.
    const pace = paceFor([tx('2025-09-30', 1000), tx('2025-10-01', 9900)], oct, sep);
    expect(pace.average[31]).toBe(1000);
    expect(pace.spent).toBe(9900);
  });

  it('past windows project nothing beyond what was spent', () => {
    const w = periodWindow('Custom', today, [], { start: '2025-09-01', end: '2025-09-07' })!;
    const pace = paceFor([tx('2025-09-02', 500)], w, previousWindows(w, 3, [], today));
    expect(pace).toMatchObject({ spent: 500, projected: 500, elapsed: 7 });
    expect(throughToday(w, today)).toBe('2025-09-07');
  });
});

describe('income in a window', () => {
  it('counts paycheques paid inside it', () => {
    const month = periodWindow('Month', '2025-09-15', data.paycheques)!;
    const income = incomeIn(data, month);
    expect(income).toMatchObject({ count: 2, net: 528000 });
    expect(income.savingsRate).toBeGreaterThan(0.25);
    expect(incomeIn(data, periodWindow('Week', '2025-10-04', [])!)).toEqual({ count: 0, net: 0, savingsRate: null });
  });
});
