/**
 * Chart Studio engine: turns a ChartDef + the user's data into chart-ready numbers.
 * Everything here is pure; components only draw what this returns.
 */
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import type { ChartBucket, ChartDef, ChartKind, ChartMeasure, Cents, ISODate, MoneoData, PinSize } from './types';
import { addDaysISO, parse, shortDate, toISO } from './dates';
import { money, sum } from './money';
import { allocationsFor, inRange, isSpend, splitRows } from './selectors';
import { latestPaycheque } from './wizard';

// ─── Measure metadata ────────────────────────────────────────────────────────

export type Unit = 'percent' | 'money';
export type Topic = 'Spending' | 'Saving' | 'Accounts';

interface MeasureMeta {
  label: string;
  formula: string;
  kinds: ChartKind[];
  buckets: ChartBucket[];
  topic: Topic;
  /** Measures with a time series get range, target and notes. */
  series: boolean;
  updates: string;
}

export const MEASURES: Record<ChartMeasure, MeasureMeta> = {
  savingsRate: {
    label: 'Savings rate',
    formula: 'TFSA + Emergency + RRSP ÷ net pay',
    kinds: ['line', 'area', 'bars'],
    buckets: ['paycheque', 'month'],
    topic: 'Saving',
    series: true,
    updates: 'Each paycheque',
  },
  netPosition: {
    label: 'Net position',
    formula: 'All accounts, credit cards subtracted',
    kinds: ['line', 'area', 'bars'],
    buckets: ['month', 'week'],
    topic: 'Accounts',
    series: true,
    updates: 'Daily',
  },
  spending: {
    label: 'Spending',
    formula: 'Categorised spending across all accounts',
    kinds: ['stackedBars', 'bars', 'line'],
    buckets: ['month', 'paycheque'],
    topic: 'Spending',
    series: true,
    updates: 'Daily',
  },
  categoryVsPlan: {
    label: 'Category vs. plan',
    formula: 'One category’s spend against its budget',
    kinds: ['barsVsPlan'],
    buckets: ['month', 'paycheque'],
    topic: 'Spending',
    series: false,
    updates: 'Daily',
  },
  allocation: {
    label: 'Paycheque split',
    formula: 'Latest paycheque, by account',
    kinds: ['allocationTicks'],
    buckets: ['paycheque'],
    topic: 'Saving',
    series: false,
    updates: 'Each paycheque',
  },
  merchantSpend: {
    label: 'Merchant spend',
    formula: 'Spend per merchant, ranked',
    kinds: ['ranked'],
    buckets: ['month'],
    topic: 'Spending',
    series: false,
    updates: 'Daily',
  },
};

export const KIND_LABELS: Record<ChartKind, string> = {
  line: 'Line',
  area: 'Area',
  bars: 'Bars',
  stackedBars: 'Stacked bars',
  barsVsPlan: 'Bars vs. plan',
  allocationTicks: 'Allocation',
  ranked: 'Ranked',
};

export const BUCKET_LABELS: Record<ChartBucket, string> = { paycheque: 'Paycheque', week: 'Week', month: 'Month' };

/** The editor's Range control: 3 mo / 6 mo / 1 yr, expressed in the bucket's unit. */
export function rangeOptions(def: Pick<ChartDef, 'measure' | 'bucket'>): { label: string; value: number }[] {
  const labels = ['3 mo', '6 mo', '1 yr'];
  const values =
    def.measure === 'merchantSpend'
      ? [91, 182, 365]
      : def.bucket === 'paycheque'
        ? [6, 12, 26]
        : def.bucket === 'week'
          ? [13, 26, 52]
          : [3, 6, 12];
  return labels.map((label, i) => ({ label, value: values[i] }));
}

export function rangeLabel(def: Pick<ChartDef, 'measure' | 'bucket' | 'range'>): string {
  if (def.measure === 'allocation') return 'latest paycheque';
  if (def.measure === 'merchantSpend') return def.range >= 365 ? 'last year' : `last ${Math.round(def.range / 30.4)} months`;
  const unit = def.bucket === 'paycheque' ? 'paycheque' : def.bucket;
  return `${def.range} ${unit}${def.range === 1 ? '' : 's'}`;
}

export const unitOf = (def: Pick<ChartDef, 'measure' | 'yAxis'>): Unit =>
  def.measure === 'savingsRate' && def.yAxis !== 'dollars' ? 'percent' : 'money';

export const SWATCHES = ['var(--acc)', '#7f95ab', '#8fae8f', 'var(--ink)'];

// ─── Results ─────────────────────────────────────────────────────────────────

export interface Point {
  date: ISODate;
  /** Axis label, e.g. "Sep 26" or "Sep". */
  label: string;
  /** Tooltip title, e.g. "Sep 26 paycheque". */
  title: string;
  value: number;
  detail?: string;
}

export interface Segment {
  key: string;
  label: string;
  color: string;
  value: Cents;
}

export type ChartResult =
  | { type: 'series'; unit: Unit; points: Point[] }
  | { type: 'stacked'; unit: 'money'; buckets: (Point & { segments: Segment[] })[]; legend: Omit<Segment, 'value'>[] }
  | { type: 'vsPlan'; unit: 'money'; buckets: (Point & { plan: Cents })[] }
  | { type: 'allocation'; total: Cents; segments: Segment[]; unallocated: Cents; date?: ISODate }
  | { type: 'ranked'; rows: { label: string; value: Cents }[] };

// ─── Buckets ─────────────────────────────────────────────────────────────────

interface Bucket {
  start: ISODate;
  end: ISODate;
  label: string;
  title: string;
}

const sortedPaycheques = (data: MoneoData) => [...data.paycheques].sort((a, b) => a.payDate.localeCompare(b.payDate));

function buckets(data: MoneoData, bucket: ChartBucket, range: number, today: ISODate): Bucket[] {
  if (bucket === 'paycheque') {
    return sortedPaycheques(data)
      .slice(-range)
      .map((p) => ({ start: p.periodStart, end: p.periodEnd, label: shortDate(p.payDate), title: `${shortDate(p.payDate)} paycheque` }));
  }
  if (bucket === 'week') {
    return Array.from({ length: range }, (_, i) => {
      const end = addDaysISO(today, -7 * (range - 1 - i));
      return { start: addDaysISO(end, -6), end, label: shortDate(end), title: `Week of ${shortDate(addDaysISO(end, -6))}` };
    });
  }
  const now = parse(today);
  return Array.from({ length: range }, (_, i) => {
    const m = addMonths(startOfMonth(now), -(range - 1 - i));
    const end = toISO(endOfMonth(m));
    const current = end >= today;
    return {
      start: toISO(m),
      end: current ? today : end,
      label: format(m, 'MMM'),
      title: format(m, 'MMMM yyyy') + (current ? ' (to date)' : ''),
    };
  });
}

const spendIn = (data: MoneoData, start: ISODate, end: ISODate, categoryId?: string) =>
  -sum(
    data.transactions
      .filter((t) => isSpend(t) && inRange(t, start, end) && (!categoryId || t.categoryId === categoryId))
      .map((t) => t.amount),
  );

const SAVINGS = (data: MoneoData) => new Set(data.accounts.filter((a) => ['tfsa', 'emergency', 'rrsp'].includes(a.kind)).map((a) => a.id));

// ─── Compute ─────────────────────────────────────────────────────────────────

export function computeChart(def: ChartDef, data: MoneoData, today: ISODate): ChartResult {
  switch (def.measure) {
    case 'savingsRate': {
      const savings = SAVINGS(data);
      const dollars = def.yAxis === 'dollars';
      const pays = sortedPaycheques(data);
      const points = buckets(data, def.bucket, def.range, today).map((b) => {
        const inB =
          def.bucket === 'paycheque'
            ? pays.filter((p) => p.periodStart === b.start)
            : pays.filter((p) => p.payDate >= b.start && p.payDate <= b.end);
        const net = sum(inB.map((p) => p.net));
        const saved = sum(
          inB
            .flatMap((p) => allocationsFor(data.allocations, p.id))
            .filter((a) => savings.has(a.accountId))
            .map((a) => a.amount),
        );
        const rate = net ? (saved / net) * 100 : 0;
        return {
          date: def.bucket === 'paycheque' ? (inB[0]?.payDate ?? b.start) : b.start,
          label: b.label,
          title: b.title,
          value: dollars ? saved : rate,
          detail: dollars ? `${Math.round(rate)}% of net pay` : `${money(saved, { decimals: 0 })} saved`,
        };
      });
      return { type: 'series', unit: dollars ? 'money' : 'percent', points };
    }
    case 'netPosition': {
      const snaps = [...data.netSnapshots].sort((a, b) => a.date.localeCompare(b.date));
      const at = (d: ISODate) => [...snaps].reverse().find((s) => s.date <= d)?.value;
      const points = buckets(data, def.bucket, def.range, today)
        .map((b) => ({ date: b.end, label: b.label, title: b.title, value: at(b.end) }))
        .filter((p): p is Point => p.value !== undefined);
      return { type: 'series', unit: 'money', points };
    }
    case 'spending': {
      const bs = buckets(data, def.bucket, def.range, today);
      if (def.kind !== 'stackedBars') {
        return {
          type: 'series',
          unit: 'money',
          points: bs.map((b) => ({ date: b.start, label: b.label, title: b.title, value: spendIn(data, b.start, b.end) })),
        };
      }
      const first = bs[0]?.start ?? today,
        last = bs.at(-1)?.end ?? today;
      const totals = data.categories.map((c) => ({ c, v: spendIn(data, first, last, c.id) })).sort((a, b) => b.v - a.v);
      const top = totals.slice(0, 4).map((t) => t.c);
      const legend = [
        ...top.map((c) => ({ key: c.id, label: c.name, color: c.color })),
        { key: 'other', label: 'Other', color: '#a8a29a' },
      ];
      return {
        type: 'stacked',
        unit: 'money',
        legend,
        buckets: bs.map((b) => {
          const segs = top.map((c) => ({ key: c.id, label: c.name, color: c.color, value: spendIn(data, b.start, b.end, c.id) }));
          const total = spendIn(data, b.start, b.end);
          segs.push({ key: 'other', label: 'Other', color: '#a8a29a', value: total - sum(segs.map((s) => s.value)) });
          return { date: b.start, label: b.label, title: b.title, value: total, segments: segs };
        }),
      };
    }
    case 'categoryVsPlan': {
      const categoryId = def.categoryId ?? data.categories[0]?.id;
      const lastPay = latestPaycheque(data.paycheques.filter((p) => p.payDate <= today));
      const perPay = data.budgetLines.find((l) => l.paychequeId === lastPay?.id && l.categoryId === categoryId)?.plan ?? 0;
      // Monthly plan = per-paycheque plan × 26 paycheques ÷ 12 months.
      const monthly = Math.round((perPay * 26) / 12);
      const pays = sortedPaycheques(data);
      return {
        type: 'vsPlan',
        unit: 'money',
        buckets: buckets(data, def.bucket, def.range, today).map((b) => {
          const plan =
            def.bucket === 'paycheque'
              ? (data.budgetLines.find(
                  (l) => l.categoryId === categoryId && pays.find((p) => p.id === l.paychequeId)?.periodStart === b.start,
                )?.plan ?? perPay)
              : monthly;
          return { date: b.start, label: b.label, title: b.title, value: spendIn(data, b.start, b.end, categoryId), plan };
        }),
      };
    }
    case 'allocation': {
      const p = latestPaycheque(data.paycheques.filter((x) => x.payDate <= today));
      if (!p) return { type: 'allocation', total: 0, segments: [], unallocated: 0 };
      const rows = splitRows(p, data.allocations, data.accounts);
      return {
        type: 'allocation',
        total: p.net,
        date: p.payDate,
        segments: rows.filter((r) => r.accountId).map((r) => ({ key: r.accountId!, label: r.name, color: r.color, value: r.amount })),
        unallocated: rows.find((r) => !r.accountId)?.amount ?? 0,
      };
    }
    case 'merchantSpend': {
      const from = addDaysISO(today, -def.range);
      const by = new Map<string, Cents>();
      for (const t of data.transactions) {
        if (!isSpend(t) || !inRange(t, from, today) || (def.categoryId && t.categoryId !== def.categoryId)) continue;
        by.set(t.merchant, (by.get(t.merchant) ?? 0) - t.amount);
      }
      return {
        type: 'ranked',
        rows: [...by]
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5),
      };
    }
  }
}

/** The series a result plots over time (for stats, notes, CSV). */
export function seriesOf(r: ChartResult): Point[] {
  if (r.type === 'series') return r.points;
  if (r.type === 'stacked' || r.type === 'vsPlan') return r.buckets;
  return [];
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export function compactMoney(cents: Cents): string {
  const d = Math.abs(cents) / 100;
  const sign = cents < 0 ? '−' : '';
  if (d >= 1000) return `${sign}$${(d / 1000).toFixed(1)}k`;
  return sign + money(Math.abs(cents), { decimals: 0 });
}

export const formatValue = (v: number, unit: Unit) => (unit === 'percent' ? `${Math.round(v)}%` : money(Math.round(v), { decimals: 0 }));

export interface Headline {
  big: string;
  delta: string;
  tone: 'pos' | 'acc' | 'mute';
}

/** Headline number + delta shown on library cards, the preview and pinned cards. */
export function headline(def: ChartDef, r: ChartResult): Headline {
  switch (r.type) {
    case 'series': {
      const pts = r.points;
      if (!pts.length) return { big: '—', delta: 'No data yet', tone: 'mute' };
      const first = pts[0].value,
        last = pts[pts.length - 1].value,
        d = last - first;
      const span = rangeLabel(def);
      if (r.unit === 'percent') {
        const pts = Math.round(d);
        const sign = pts > 0 ? '+' : pts < 0 ? '−' : '';
        return { big: formatValue(last, 'percent'), delta: `${sign}${Math.abs(pts)} pts over ${span}`, tone: pts >= 0 ? 'pos' : 'acc' };
      }
      const big = def.measure === 'netPosition' ? compactMoney(last) : money(Math.round(last), { decimals: 0 });
      const deltaText = def.measure === 'netPosition' ? compactMoney(Math.abs(d)) : money(Math.abs(Math.round(d)), { decimals: 0 });
      const good = def.measure === 'spending' ? d <= 0 : d >= 0;
      return { big, delta: `${d >= 0 ? '+' : '−'}${deltaText.replace('−', '')} over ${span}`, tone: good ? 'pos' : 'acc' };
    }
    case 'stacked': {
      // Compare the last full bucket with the one before (the current month is usually partial).
      const full = r.buckets.filter((b) => !b.title.endsWith('(to date)'));
      const cur = full.at(-1),
        prev = full.at(-2);
      if (!cur) return { big: '—', delta: '', tone: 'mute' };
      if (!prev || !prev.value) return { big: money(cur.value, { decimals: 0 }), delta: cur.label, tone: 'mute' };
      const pct = Math.round(((cur.value - prev.value) / prev.value) * 100);
      return {
        big: money(cur.value, { decimals: 0 }),
        delta: `${pct >= 0 ? '+' : '−'}${Math.abs(pct)}% vs. ${prev.label}`,
        tone: pct <= 0 ? 'pos' : 'acc',
      };
    }
    case 'vsPlan': {
      const full = r.buckets.filter((b) => !b.title.endsWith('(to date)'));
      const cur = full.at(-1);
      if (!cur) return { big: '—', delta: '', tone: 'mute' };
      const d = cur.plan - cur.value;
      return {
        big: money(cur.value, { decimals: 0 }),
        delta: `${money(Math.abs(d), { decimals: 0 })} ${d >= 0 ? 'under' : 'over'} plan`,
        tone: d >= 0 ? 'pos' : 'acc',
      };
    }
    case 'allocation':
      return r.unallocated > 0
        ? { big: money(r.total, { decimals: 0 }), delta: `${money(r.unallocated, { decimals: 0 })} unallocated`, tone: 'acc' }
        : { big: money(r.total, { decimals: 0 }), delta: 'Fully allocated', tone: 'pos' };
    case 'ranked':
      return { big: money(sum(r.rows.map((x) => x.value)), { decimals: 0 }), delta: `${r.rows.length} merchants`, tone: 'mute' };
  }
}

export interface Stat {
  label: string;
  value: string;
  sub: string;
  tone: 'pos' | 'acc' | 'mute';
}

/** The 4-up stats strip under the editor plot. Recalculates with the range. */
export function seriesStats(def: ChartDef, points: Point[], unit: Unit): Stat[] {
  if (!points.length) return [];
  const vals = points.map((p) => p.value);
  const avg = sum(vals) / vals.length;
  const bestIdx = def.measure === 'spending' ? vals.indexOf(Math.min(...vals)) : vals.indexOf(Math.max(...vals));
  const change =
    unit === 'percent' ? Math.round(vals[vals.length - 1] - vals[0]) : Math.round((vals[vals.length - 1] - vals[0]) / 100) * 100;
  const sign = change > 0 ? '+' : change < 0 ? '−' : '';
  const fmtChange = unit === 'percent' ? `${sign}${Math.abs(change)} pts` : `${sign}${money(Math.abs(change), { decimals: 0 })}`;
  const unitName = def.bucket === 'paycheque' ? 'paycheques' : `${def.bucket}s`;
  const target = def.target ?? 0;
  const good = (v: number) => (def.measure === 'spending' ? v <= target : v >= target);
  const goodChange = def.measure === 'spending' ? change <= 0 : change >= 0;
  return [
    { label: 'Average', value: formatValue(avg, unit), sub: `over ${points.length} ${unitName}`, tone: 'mute' },
    {
      label: def.measure === 'spending' ? 'Lowest' : 'Best',
      value: formatValue(vals[bestIdx], unit),
      sub: points[bestIdx].label,
      tone: 'pos',
    },
    { label: 'Change', value: fmtChange, sub: `since ${points[0].label}`, tone: goodChange ? 'pos' : 'acc' },
    def.showTarget && def.target !== undefined
      ? {
          label: def.measure === 'spending' ? 'At or under target' : 'At or above target',
          value: `${vals.filter(good).length} of ${vals.length}`,
          sub: `target ${formatValue(target, unit)}`,
          tone: 'mute',
        }
      : { label: 'Latest', value: formatValue(vals[vals.length - 1], unit), sub: points[points.length - 1].label, tone: 'mute' },
  ];
}

/** Notes inside the plotted range, attached to the point whose bucket contains the note date. */
export function placeNotes(notes: ChartDef['notes'], points: Point[]): { index: number; label: string; date: ISODate }[] {
  if (!points.length) return [];
  return notes
    .map((n) => {
      let index = -1;
      for (let i = 0; i < points.length; i++) if (points[i].date <= n.date) index = i;
      return { index, label: n.label, date: n.date };
    })
    .filter((n) => n.index >= 0);
}

/** X-axis labels every ~1/6 of the range, anchored on the latest point. */
export function xTicks(n: number): number[] {
  const step = Math.max(1, Math.round(n / 6));
  return Array.from({ length: n }, (_, i) => i).filter((i) => (n - 1 - i) % step === 0);
}

export function chartCsv(def: ChartDef, r: ChartResult): string {
  const esc = (s: string | number) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
  const rows: (string | number)[][] = [];
  if (r.type === 'series') {
    rows.push(['date', 'label', r.unit === 'percent' ? 'percent' : 'dollars']);
    r.points.forEach((p) => rows.push([p.date, p.label, r.unit === 'percent' ? p.value.toFixed(1) : (p.value / 100).toFixed(2)]));
  } else if (r.type === 'stacked') {
    rows.push(['date', 'label', ...r.legend.map((l) => l.label), 'total']);
    r.buckets.forEach((b) =>
      rows.push([b.date, b.label, ...b.segments.map((s) => (s.value / 100).toFixed(2)), (b.value / 100).toFixed(2)]),
    );
  } else if (r.type === 'vsPlan') {
    rows.push(['date', 'label', 'spent', 'plan']);
    r.buckets.forEach((b) => rows.push([b.date, b.label, (b.value / 100).toFixed(2), (b.plan / 100).toFixed(2)]));
  } else if (r.type === 'allocation') {
    rows.push(['account', 'amount']);
    r.segments.forEach((s) => rows.push([s.label, (s.value / 100).toFixed(2)]));
    if (r.unallocated) rows.push(['Unallocated', (r.unallocated / 100).toFixed(2)]);
  } else {
    rows.push(['merchant', 'spent']);
    r.rows.forEach((x) => rows.push([x.label, (x.value / 100).toFixed(2)]));
  }
  return `# ${def.title}\n` + rows.map((row) => row.map(esc).join(',')).join('\n');
}

// ─── Questions (6b) ──────────────────────────────────────────────────────────

export interface Question {
  id: string;
  question: string;
  sub: string;
  def: Omit<ChartDef, 'id' | 'status' | 'editedAt'>;
}

const base = { color: 'var(--acc)', showTarget: false, showNotes: false, notes: [] as ChartDef['notes'] };

export const QUESTIONS: Question[] = [
  {
    id: 'saving',
    question: 'Am I saving more?',
    sub: 'Savings rate each paycheque',
    def: {
      ...base,
      title: 'Savings rate by paycheque',
      question: 'Am I saving more?',
      measure: 'savingsRate',
      bucket: 'paycheque',
      range: 12,
      kind: 'line',
      yAxis: 'percent',
      target: 30,
      showTarget: true,
    },
  },
  {
    id: 'where',
    question: 'Where does my money go?',
    sub: 'Spending split by category',
    def: {
      ...base,
      title: 'Monthly spending by category',
      question: 'Where does my money go?',
      measure: 'spending',
      bucket: 'month',
      range: 6,
      kind: 'stackedBars',
    },
  },
  {
    id: 'plan',
    question: 'Am I sticking to plan?',
    sub: 'One category against its budget',
    def: {
      ...base,
      title: 'Dining vs. plan',
      question: 'Am I sticking to plan?',
      measure: 'categoryVsPlan',
      categoryId: 'dining',
      bucket: 'month',
      range: 6,
      kind: 'barsVsPlan',
    },
  },
  {
    id: 'net',
    question: 'Is my net position growing?',
    sub: 'All accounts, month by month',
    def: {
      ...base,
      title: 'Net position',
      question: 'Is my net position growing?',
      measure: 'netPosition',
      bucket: 'month',
      range: 12,
      kind: 'area',
      color: '#8fae8f',
    },
  },
  {
    id: 'split',
    question: 'Where does each paycheque go?',
    sub: 'Split across accounts',
    def: {
      ...base,
      title: 'Where each paycheque goes',
      question: 'Where does each paycheque go?',
      measure: 'allocation',
      bucket: 'paycheque',
      range: 1,
      kind: 'allocationTicks',
    },
  },
  {
    id: 'shop',
    question: 'Where do I shop most?',
    sub: 'Merchants ranked by spend',
    def: {
      ...base,
      title: 'Top grocery merchants',
      question: 'Where do I shop most?',
      measure: 'merchantSpend',
      categoryId: 'groceries',
      bucket: 'month',
      range: 91,
      kind: 'ranked',
    },
  },
];

/** Sensible defaults when switching measure in the editor. */
export function defaultsFor(measure: ChartMeasure): Partial<ChartDef> {
  const rest: Partial<ChartDef> = { ...QUESTIONS.find((x) => x.def.measure === measure)!.def };
  delete rest.title;
  delete rest.question;
  return rest;
}

export const PIN_SIZES: { size: PinSize; label: string; sub: string; cols: number; rows: number }[] = [
  { size: 'S', label: 'Small', sub: '1 column · number + sparkline', cols: 1, rows: 1 },
  { size: 'M', label: 'Medium', sub: '2 columns · line chart', cols: 2, rows: 1 },
  { size: 'L', label: 'Large', sub: 'Full width · chart with notes', cols: 4, rows: 2 },
];

export function placementLabel(def: ChartDef): string {
  if (def.status === 'pinned' && def.pin) return `Overview · ${PIN_SIZES.find((s) => s.size === def.pin!.size)?.label}`;
  if (def.pin?.alsoOn?.includes('paycheques')) return 'Paycheques page';
  return 'Not pinned';
}

export function editedLabel(editedAt: ISODate, today: ISODate): string {
  return editedAt === today ? 'Edited today' : `Edited ${shortDate(editedAt)}`;
}
