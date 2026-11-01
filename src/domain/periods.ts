/**
 * Time windows for the Overview period selector (Paycheque / Week / Month / Quarter / Year / Custom),
 * and spending pace measured against the same window in previous periods.
 */
import {
  addMonths,
  addQuarters,
  addWeeks,
  addYears,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  getQuarter,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import type { Cents, ISODate, MoneoData, Paycheque, Transaction } from './types';
import { addDaysISO, daysBetween, parse, shortDate, toISO } from './dates';
import { sum } from './money';
import { allocationsFor, isSpend, pastPaycheques, SAVINGS_KINDS } from './selectors';

export type PeriodKind = 'Paycheque' | 'Week' | 'Month' | 'Quarter' | 'Year' | 'Custom';

export interface TimeWindow {
  kind: PeriodKind;
  start: ISODate;
  end: ISODate;
  label: string;
  /** Days in the window. */
  length: number;
  /** Whole days from the start to today, clamped to the window ("day 8 of 14"). */
  elapsed: number;
  /** Today falls inside the window. */
  current: boolean;
}

/** Singular noun for copy like "vs. 3-month avg". */
export const PERIOD_NOUN: Record<PeriodKind, string> = {
  Paycheque: 'paycheque',
  Week: 'week',
  Month: 'month',
  Quarter: 'quarter',
  Year: 'year',
  Custom: 'period',
};

function make(kind: PeriodKind, start: ISODate, end: ISODate, label: string, today: ISODate): TimeWindow {
  const length = daysBetween(start, end) + 1;
  return {
    kind,
    start,
    end,
    label,
    length,
    elapsed: Math.min(Math.max(daysBetween(start, today), 0), length),
    current: start <= today && today <= end,
  };
}

const rangeLabel = (start: ISODate, end: ISODate) => `${shortDate(start)} – ${shortDate(end)}`;

/** The calendar window of `kind` that contains `date`. */
function calendarWindow(kind: Exclude<PeriodKind, 'Paycheque' | 'Custom'>, date: ISODate, today: ISODate): TimeWindow {
  const d = parse(date);
  switch (kind) {
    case 'Week': {
      const s = startOfWeek(d, { weekStartsOn: 1 });
      return make(kind, toISO(s), toISO(endOfWeek(d, { weekStartsOn: 1 })), `Week of ${shortDate(toISO(s))}`, today);
    }
    case 'Month':
      return make(kind, toISO(startOfMonth(d)), toISO(endOfMonth(d)), format(d, 'MMMM yyyy'), today);
    case 'Quarter':
      return make(kind, toISO(startOfQuarter(d)), toISO(endOfQuarter(d)), `Q${getQuarter(d)} ${format(d, 'yyyy')}`, today);
    case 'Year':
      return make(kind, toISO(startOfYear(d)), toISO(endOfYear(d)), format(d, 'yyyy'), today);
  }
}

const paychequeWindow = (p: Paycheque, today: ISODate) =>
  make('Paycheque', p.periodStart, p.periodEnd, rangeLabel(p.periodStart, p.periodEnd), today);

/**
 * The window to show for a period choice. "Paycheque" is the latest paycheque received (undefined before the first);
 * "Custom" defaults to the last 30 days.
 */
export function periodWindow(
  kind: PeriodKind,
  today: ISODate,
  paycheques: Paycheque[],
  custom?: { start: ISODate; end: ISODate } | null,
): TimeWindow | undefined {
  if (kind === 'Paycheque') {
    const cur = pastPaycheques(paycheques, today).at(-1);
    return cur && paychequeWindow(cur, today);
  }
  if (kind === 'Custom') {
    const start = custom?.start ?? addDaysISO(today, -29);
    const end = custom?.end ?? today;
    return start <= end ? make(kind, start, end, rangeLabel(start, end), today) : make(kind, end, start, rangeLabel(end, start), today);
  }
  return calendarWindow(kind, today, today);
}

/** The `n` windows before `w`, oldest first: previous paycheques, or the same calendar unit stepped back. */
export function previousWindows(w: TimeWindow, n: number, paycheques: Paycheque[], today: ISODate): TimeWindow[] {
  if (w.kind === 'Paycheque') {
    const before = pastPaycheques(paycheques, today).filter((p) => p.periodStart < w.start);
    return before.slice(-n).map((p) => paychequeWindow(p, today));
  }
  const start = parse(w.start);
  return Array.from({ length: n }, (_, i) => {
    const k = n - i; // oldest first
    switch (w.kind) {
      case 'Week':
        return calendarWindow('Week', toISO(addWeeks(start, -k)), today);
      case 'Month':
        return calendarWindow('Month', toISO(addMonths(start, -k)), today);
      case 'Quarter':
        return calendarWindow('Quarter', toISO(addQuarters(start, -k)), today);
      case 'Year':
        return calendarWindow('Year', toISO(addYears(start, -k)), today);
      default: {
        const s = addDaysISO(w.start, -w.length * k);
        return make('Custom', s, addDaysISO(s, w.length - 1), rangeLabel(s, addDaysISO(s, w.length - 1)), today);
      }
    }
  });
}

// ─── Spending pace ───────────────────────────────────────────────────────────

export interface PaceSeries {
  /** Cumulative spend at the start of each day 0..elapsed (index = day of the window). */
  actual: Cents[];
  /** Average cumulative spend of the previous windows, days 0..length. */
  average: Cents[];
  spent: Cents;
  /** spent + what the average previous window still spent from this point to its end. */
  projected: Cents;
  length: number;
  elapsed: number;
  /** How many previous windows the average is over. */
  compared: number;
}

/**
 * Cumulative spend from `start` over `days` days; out[i] = spent before day i.
 * Days past `stopAfter` add nothing, so a 30-day month compared with a 31-day one doesn't run into the next month.
 */
function cumulative(txs: Transaction[], start: ISODate, days: number, stopAfter = days): Cents[] {
  const daily = new Array<Cents>(days).fill(0);
  for (const t of txs) {
    if (!isSpend(t)) continue;
    const d = daysBetween(start, t.date);
    if (d >= 0 && d < Math.min(days, stopAfter)) daily[d] -= t.amount;
  }
  const out: Cents[] = [0];
  for (const v of daily) out.push(out[out.length - 1] + v);
  return out;
}

/** Spending in `w` against the average of `previous` windows, aligned by day. */
export function paceFor(txs: Transaction[], w: TimeWindow, previous: TimeWindow[]): PaceSeries {
  // The latest point includes today's spending.
  const full = cumulative(txs, w.start, w.length);
  const actual = full.slice(0, w.elapsed + 1);
  actual[w.elapsed] = full[Math.min(w.elapsed + 1, w.length)];
  const average = new Array<Cents>(w.length + 1).fill(0);
  for (const p of previous) cumulative(txs, p.start, w.length, p.length).forEach((v, i) => (average[i] += v / previous.length));
  const rounded = average.map(Math.round);
  const spent = actual[actual.length - 1];
  const projected = previous.length && w.current ? spent + rounded[w.length] - rounded[w.elapsed] : spent;
  return { actual, average: rounded, spent, projected, length: w.length, elapsed: w.elapsed, compared: previous.length };
}

/** Spending this paycheque period vs. the average of the previous `n` paycheque periods. */
export function spendingPace(data: MoneoData, today: ISODate, n = 3): PaceSeries | undefined {
  const w = periodWindow('Paycheque', today, data.paycheques);
  return w && paceFor(data.transactions, w, previousWindows(w, n, data.paycheques, today));
}

// ─── Window summaries ────────────────────────────────────────────────────────

/** Paycheques paid inside the window, their total and the share sent to savings (null without paycheques). */
export function incomeIn(data: MoneoData, w: TimeWindow) {
  const pays = data.paycheques.filter((p) => p.payDate >= w.start && p.payDate <= w.end);
  const net = sum(pays.map((p) => p.net));
  const savings = new Set(data.accounts.filter((a) => SAVINGS_KINDS.includes(a.kind)).map((a) => a.id));
  const saved = sum(
    pays
      .flatMap((p) => allocationsFor(data.allocations, p.id))
      .filter((a) => savings.has(a.accountId))
      .map((a) => a.amount),
  );
  return { count: pays.length, net, savingsRate: net ? saved / net : null };
}

/** The window's last day that has happened: today for the current window, its end for past ones. */
export const throughToday = (w: TimeWindow, today: ISODate) => (today < w.end ? today : w.end);
