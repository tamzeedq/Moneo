import type { Cents } from './types';

export const MINUS = '−';

const fmt2 = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmt0 = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export interface MoneyOpts {
  /** 2 for tables (default), 0 for steppers and gauge labels. */
  decimals?: 0 | 2;
  /** Prefix positive values with "+". */
  signed?: boolean;
}

/** en-CA CAD with a true minus sign (U+2212): "−$1,445.25", "+$748.72". */
export function money(cents: Cents, { decimals = 2, signed = false }: MoneyOpts = {}): string {
  const f = decimals === 0 ? fmt0 : fmt2;
  const abs = f.format(Math.abs(cents) / 100);
  if (cents < 0 && Math.round(Math.abs(cents) / (decimals === 0 ? 100 : 1)) !== 0) return MINUS + abs;
  if (signed && cents > 0) return '+' + abs;
  return abs;
}

/** Splits a value for hero numbers where the cents render in `faint`: { whole: "$48,216", cents: ".40" }. */
export function moneyParts(cents: Cents): { whole: string; cents: string } {
  const s = money(cents);
  const i = s.lastIndexOf('.');
  return { whole: s.slice(0, i), cents: s.slice(i) };
}

export function percent(ratio: number, decimals = 0): string {
  return (ratio * 100).toFixed(decimals) + '%';
}

/** Dollars (possibly fractional) to integer cents. */
export const toCents = (dollars: number): Cents => Math.round(dollars * 100);

export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
