import Papa from 'papaparse';
import { buildSeed } from '@/data/seed';
import {
  buildRows,
  detectColumns,
  detectDateOrder,
  displayMerchant,
  merchantKey,
  parseAmount,
  parseDate,
  rowsToTransactions,
  suggestCategory,
  merchantHistory,
  transactionsCsv,
} from './csvImport';

const data = buildSeed();

describe('columns', () => {
  it('detects a signed amount column', () => {
    expect(detectColumns(['Transaction Date', 'Description', 'Amount', 'Balance'])).toMatchObject({
      date: 'Transaction Date',
      merchant: 'Description',
      amount: 'Amount',
      debit: null,
      credit: null,
    });
  });
  it('detects debit/credit columns', () => {
    expect(detectColumns(['Date', 'Payee', 'Withdrawals', 'Deposits'])).toMatchObject({
      amount: null,
      debit: 'Withdrawals',
      credit: 'Deposits',
      merchant: 'Payee',
    });
  });
});

describe('dates', () => {
  it('detects order', () => {
    expect(detectDateOrder(['2025-10-03'])).toBe('ymd');
    expect(detectDateOrder(['10/03/2025', '09/30/2025'])).toBe('mdy');
    expect(detectDateOrder(['03/10/2025', '30/09/2025'])).toBe('dmy');
  });
  it('parses', () => {
    expect(parseDate('2025-10-03', 'ymd')).toBe('2025-10-03');
    expect(parseDate('10/3/25', 'mdy')).toBe('2025-10-03');
    expect(parseDate('3.10.2025', 'dmy')).toBe('2025-10-03');
    expect(parseDate('Oct 3, 2025', 'mdy')).toBe('2025-10-03');
    expect(parseDate('3 October 2025', 'mdy')).toBe('2025-10-03');
    expect(parseDate('2025-02-30', 'ymd')).toBeNull();
    expect(parseDate('soon', 'ymd')).toBeNull();
  });
});

describe('amounts', () => {
  it.each([
    ['-86.42', -8642],
    ['$1,234.56', 123456],
    ['(12.50)', -1250],
    ['12.50 DR', -1250],
    ['2,640.00 CR', 264000],
    ['−40', -4000],
    ['12,50', 1250],
    ['', null],
    ['abc', null],
  ])('%s → %s', (input, out) => expect(parseAmount(input)).toBe(out));
});

describe('merchants and categories', () => {
  it('normalises bank descriptions', () => {
    expect(merchantKey('LOBLAWS #1234 TORONTO ON')).toBe('loblaws');
    expect(displayMerchant('POS PURCHASE PRESTO FARE/1234')).toBe('Presto Fare');
    expect(displayMerchant('NETFLIX.COM')).toBe('Netflix');
  });
  it('prefers merchant history, then keywords', () => {
    const history = merchantHistory(data.transactions);
    expect(suggestCategory('LOBLAWS #88', history, data.categories)).toBe('groceries');
    expect(suggestCategory('NETFLIX.COM', new Map(), data.categories)).toBe('subscriptions');
    expect(suggestCategory('Some Shop', new Map(), data.categories, 'Dining')).toBe('dining');
    expect(suggestCategory('Mystery', new Map(), data.categories)).toBeUndefined();
  });
});

describe('rows', () => {
  const csv = `Date,Description,Amount
2025-10-03,LOBLAWS #1234 TORONTO ON,-86.42
2025-10-04,TIM HORTONS #22,-4.25
2025-10-04,TIM HORTONS #22,-4.25
2025-10-05,NORTHWIND LTD PAYROLL,2640.00
bad,Thing,-1`;
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  const mapping = detectColumns(parsed.meta.fields!);
  const rows = buildRows(parsed.data, mapping, { accountId: 'spending', existing: data.transactions, categories: data.categories });

  it('flags duplicates against existing data and within the file', () => {
    expect(rows[0]).toMatchObject({ date: '2025-10-03', merchant: 'Loblaws', amount: -8642, duplicate: true, include: false });
    expect(rows[1]).toMatchObject({ duplicate: false, include: true, categoryId: 'dining' });
    expect(rows[2]).toMatchObject({ duplicate: true, include: false });
  });
  it('income gets no category; bad rows get an error', () => {
    expect(rows[3]).toMatchObject({ amount: 264000, categoryId: undefined, include: true });
    expect(rows[4]).toMatchObject({ error: 'Unreadable date', include: false, line: 6 });
  });
  it('converts included rows', () => {
    let n = 0;
    const txs = rowsToTransactions(rows, 'spending', () => `x${++n}`);
    expect(txs.map((t) => t.merchant)).toEqual(['Tim Hortons', 'Northwind Ltd Payroll']);
    expect(txs[0]).toMatchObject({ id: 'x1', accountId: 'spending', amount: -425 });
  });
});

it('exports transactions as CSV', () => {
  const csv = transactionsCsv(data.transactions.slice(0, 2), data.categories, data.accounts);
  expect(csv.split('\n')[0]).toBe('Date,Merchant,Amount,Category,Account');
  expect(csv.split('\n')).toHaveLength(3);
});
