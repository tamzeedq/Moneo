/**
 * Bank CSV import: column detection, date/amount parsing, category suggestions and duplicate checks.
 * Parsing the file itself (Papa Parse) happens in the UI; everything here works on plain records.
 */
import type { Category, Cents, ISODate, Transaction } from './types';

export interface ColumnMapping {
  date: string | null;
  merchant: string | null;
  /** One signed amount column… */
  amount: string | null;
  /** …or separate debit (out) and credit (in) columns. */
  debit: string | null;
  credit: string | null;
  category: string | null;
}

const find = (headers: string[], patterns: RegExp[]) =>
  patterns.map((re) => headers.find((h) => re.test(h.trim()))).find((h) => h !== undefined) ?? null;

/** Guesses which columns hold what, from common Canadian bank export headers. */
export function detectColumns(headers: string[]): ColumnMapping {
  const debit = find(headers, [/^debit/i, /withdrawal/i, /^money out/i, /^paid out/i]);
  const credit = find(headers, [/^credit/i, /deposit/i, /^money in/i, /^paid in/i]);
  return {
    date: find(headers, [/^(transaction |posted |posting )?date$/i, /date/i]),
    merchant: find(headers, [/^(merchant|payee|description|details|name|memo)$/i, /description|merchant|payee|details/i]),
    amount: debit && credit ? null : find(headers, [/^amount$/i, /amount|cad\$|value/i]),
    debit: debit && credit ? debit : null,
    credit: debit && credit ? credit : null,
    category: find(headers, [/^category$/i, /category/i]),
  };
}

export type DateOrder = 'ymd' | 'mdy' | 'dmy';

/** Picks the date order for a column: ISO if it looks like it, else d/m when any first part is over 12. */
export function detectDateOrder(values: string[]): DateOrder {
  const parts = values.map((v) => v.trim().split(/[/.\-\s]+/)).filter((p) => p.length >= 3);
  if (parts.some((p) => p[0].length === 4)) return 'ymd';
  if (parts.some((p) => Number(p[0]) > 12)) return 'dmy';
  return 'mdy';
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function parseDate(value: string, order: DateOrder): ISODate | null {
  const v = value.trim();
  // "Oct 3, 2025" / "3 Oct 2025"
  const named = v.match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/i) ?? v.match(/^(\d{1,2})\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})$/i);
  let y: number, m: number, d: number;
  if (named) {
    const [a, b] = /^\d/.test(named[1]) ? [named[2], named[1]] : [named[1], named[2]];
    m = MONTHS.indexOf(a.toLowerCase()) + 1;
    d = Number(b);
    y = Number(named[3]);
  } else {
    const p = v.split(/[/.\-\s]+/).map(Number);
    if (p.length < 3 || p.some((n) => !Number.isFinite(n))) return null;
    [y, m, d] = order === 'ymd' ? [p[0], p[1], p[2]] : order === 'mdy' ? [p[2], p[0], p[1]] : [p[2], p[1], p[0]];
    if (y < 100) y += 2000;
  }
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 1900)) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCDate() !== d) return null; // e.g. Feb 30
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "$1,234.56", "-12.50", "(12.50)", "12.50 CR", "1 234,56" → cents. Empty → null. */
export function parseAmount(value: string | undefined): Cents | null {
  if (value === undefined) return null;
  let v = value.trim();
  if (!v) return null;
  let sign = 1;
  if (/^\(.*\)$/.test(v)) {
    sign = -1;
    v = v.slice(1, -1);
  }
  if (/\b(dr|debit)\b/i.test(v)) sign = -1;
  v = v.replace(/\b(cr|dr|credit|debit|cad)\b/gi, '').replace(/[$\s\u00a0]/g, '');
  if (/^[-−]/.test(v)) {
    sign *= -1;
    v = v.slice(1);
  } else if (v.startsWith('+')) v = v.slice(1);
  // European decimal comma: "1.234,56" or "12,50"
  if (/,\d{2}$/.test(v) && !/\.\d{2}$/.test(v)) v = v.replace(/\./g, '').replace(',', '.');
  v = v.replace(/,/g, '');
  const n = Number(v);
  return Number.isFinite(n) ? sign * Math.round(n * 100) : null;
}

/** Normalises a bank description for matching: "LOBLAWS #1234 TORONTO ON" → "loblaws". */
export function merchantKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.(com|ca|net|org)\b/g, '')
    .replace(/[#*]\s*\d+.*$/, '')
    .replace(/\b(pos|purchase|interac|debit|visa|mc|preauth(orized)?|e-?transfer|payment)\b/g, '')
    .replace(/\b(on|qc|bc|ab|mb|sk|ns|nb|nl|pe|toronto|montreal|vancouver|ottawa|calgary)\b.*$/, '')
    .replace(/[^a-z0-9& ]+/g, ' ')
    .replace(/\b\d{3,}\b/g, '') // store / terminal numbers
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tidies an all-caps bank description for display: "LOBLAWS #1234 TORONTO" → "Loblaws". */
export function displayMerchant(s: string): string {
  const key = merchantKey(s) || s.trim().toLowerCase();
  return key.replace(/\b\w/g, (c) => c.toUpperCase());
}

const KEYWORDS: [RegExp, string][] = [
  [/rent|property|mortgage|landlord/, 'housing'],
  [/loblaw|no frills|sobeys|metro|farm boy|costco|walmart|freshco|food basics|grocer|market/, 'groceries'],
  [/restaurant|pizza|cafe|coffee|tim hortons|starbucks|uber eats|doordash|skip|bar |pub|thai|sushi|burger/, 'dining'],
  [/presto|ttc|uber|lyft|shell|petro|esso|gas|parking|transit|go transit/, 'transport'],
  [/hydro|enbridge|bell|rogers|telus|fido|koodo|internet|water|utility/, 'utilities'],
  [/amazon|indigo|uniqlo|canadian tire|ikea|best buy|winners|h&m/, 'shopping'],
  [/shoppers|pharma|rexall|gym|goodlife|dental|clinic|health/, 'health'],
  [/netflix|spotify|icloud|apple\.com|crave|disney|youtube|prime/, 'subscriptions'],
];

/** Category for a description: same merchant seen before wins, then keyword rules, then the CSV's own column. */
export function suggestCategory(
  description: string,
  history: Map<string, string>,
  categories: Category[],
  csvCategory?: string,
): string | undefined {
  const key = merchantKey(description);
  if (history.has(key)) return history.get(key);
  const lower = description.toLowerCase();
  for (const [re, id] of KEYWORDS) if (re.test(lower) && categories.some((c) => c.id === id)) return id;
  if (csvCategory) {
    const c = categories.find((x) => x.name.toLowerCase() === csvCategory.trim().toLowerCase());
    if (c) return c.id;
  }
  return undefined;
}

/** merchantKey → most recent categoryId, from existing transactions. */
export function merchantHistory(txs: Transaction[]): Map<string, string> {
  const m = new Map<string, string>();
  [...txs].sort((a, b) => a.date.localeCompare(b.date)).forEach((t) => t.categoryId && m.set(merchantKey(t.merchant), t.categoryId));
  return m;
}

export interface ImportRow {
  line: number;
  date: ISODate | null;
  merchant: string;
  amount: Cents | null;
  categoryId?: string;
  duplicate: boolean;
  error?: string;
  /** Selected for import (defaults: valid and not a duplicate). */
  include: boolean;
}

export function buildRows(
  records: Record<string, string>[],
  mapping: ColumnMapping,
  opts: { accountId: string; existing: Transaction[]; categories: Category[]; dateOrder?: DateOrder },
): ImportRow[] {
  const order = opts.dateOrder ?? detectDateOrder(records.map((r) => (mapping.date ? (r[mapping.date] ?? '') : '')));
  const history = merchantHistory(opts.existing);
  const seen = new Set(
    opts.existing.filter((t) => t.accountId === opts.accountId).map((t) => `${t.date}|${t.amount}|${merchantKey(t.merchant)}`),
  );
  return records.map((r, i) => {
    const raw = mapping.merchant ? (r[mapping.merchant] ?? '').trim() : '';
    const date = mapping.date ? parseDate(r[mapping.date] ?? '', order) : null;
    let amount: Cents | null;
    if (mapping.amount) amount = parseAmount(r[mapping.amount]);
    else {
      const out = parseAmount(r[mapping.debit ?? '']) ?? 0;
      const inn = parseAmount(r[mapping.credit ?? '']) ?? 0;
      amount = mapping.debit || mapping.credit ? inn - Math.abs(out) : null;
    }
    const merchant = raw ? displayMerchant(raw) : '';
    const error = !date
      ? 'Unreadable date'
      : amount === null
        ? 'Unreadable amount'
        : !merchant
          ? 'No description'
          : amount === 0
            ? 'Zero amount'
            : undefined;
    const key = `${date}|${amount}|${merchantKey(merchant)}`;
    const duplicate = !error && seen.has(key);
    if (!error) seen.add(key); // also catches repeats inside the file
    return {
      line: i + 2, // header is line 1
      date,
      merchant,
      amount,
      categoryId:
        amount !== null && amount < 0
          ? suggestCategory(raw, history, opts.categories, mapping.category ? r[mapping.category] : undefined)
          : undefined,
      duplicate,
      error,
      include: !error && !duplicate,
    };
  });
}

export function rowsToTransactions(rows: ImportRow[], accountId: string, newId: () => string): Transaction[] {
  return rows
    .filter((r) => r.include && !r.error)
    .map((r) => ({ id: newId(), date: r.date!, merchant: r.merchant, amount: r.amount!, accountId, categoryId: r.categoryId }));
}

export function transactionsCsv(txs: Transaction[], categories: Category[], accounts: { id: string; name: string }[]): string {
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const acc = new Map(accounts.map((a) => [a.id, a.name]));
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [...txs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) =>
      [
        t.date,
        t.merchant,
        (t.amount / 100).toFixed(2),
        t.categoryId ? (cat.get(t.categoryId) ?? '') : t.paychequeId ? 'Paycheque' : '',
        acc.get(t.accountId) ?? '',
      ]
        .map(esc)
        .join(','),
    );
  return ['Date,Merchant,Amount,Category,Account', ...lines].join('\n');
}
