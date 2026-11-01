import { buildSeed, SEED_TODAY } from '@/data/seed';
import { chartCsv, computeChart, headline, placeNotes, placementLabel, rangeOptions, seriesOf, seriesStats, xTicks } from './charts';
import type { ChartDef } from './types';

const data = buildSeed();
const today = SEED_TODAY;
const byId = (id: string) => data.charts.find((c) => c.id === id)!;

describe('savings rate', () => {
  const def = byId('savings-rate');
  const r = computeChart(def, data, today);
  it('one point per paycheque, latest last', () => {
    expect(r.type).toBe('series');
    const pts = seriesOf(r);
    expect(pts).toHaveLength(12);
    expect(pts.at(-1)!.label).toBe('Sep 26');
    expect(Math.round(pts.at(-1)!.value)).toBe(27); // $700 of $2,640 — $320 still unallocated
    expect(Math.round(pts.at(-2)!.value)).toBe(35);
  });
  it('range recalculates', () => {
    expect(seriesOf(computeChart({ ...def, range: 6 }, data, today))).toHaveLength(6);
    expect(seriesOf(computeChart({ ...def, range: 26 }, data, today))).toHaveLength(26);
  });
  it('dollars mode', () => {
    const d = seriesOf(computeChart({ ...def, yAxis: 'dollars' }, data, today));
    expect(d.at(-1)!.value).toBe(70000);
  });
  it('stats strip', () => {
    const pts = seriesOf(r);
    const stats = seriesStats(def, pts, 'percent');
    expect(stats.map((s) => s.label)).toEqual(['Average', 'Best', 'Change', 'At or above target']);
    expect(stats[3].value).toMatch(/^\d+ of 12$/);
    expect(seriesStats({ ...def, showTarget: false }, pts, 'percent')[3].label).toBe('Latest');
  });
  it('notes inside the range only', () => {
    const notes = placeNotes(def.notes, seriesOf(r));
    expect(notes.map((n) => n.label)).toEqual(['Bonus +$500', 'Raise · 4%']);
    expect(seriesOf(r)[notes[0].index].date).toBe('2025-08-15');
    expect(placeNotes(def.notes, seriesOf(computeChart({ ...def, range: 26 }, data, today)))).toHaveLength(3);
  });
});

describe('other measures', () => {
  it('stacked monthly spending ends with the current month to date', () => {
    const r = computeChart(byId('monthly-spending'), data, today);
    if (r.type !== 'stacked') throw new Error();
    expect(r.buckets.map((b) => b.label)).toEqual(['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']);
    expect(r.buckets.at(-1)!.title).toContain('to date');
    expect(r.legend).toHaveLength(5);
    for (const b of r.buckets) expect(b.segments.reduce((a, s) => a + s.value, 0)).toBe(b.value);
    expect(headline(byId('monthly-spending'), r).delta).toMatch(/vs\. Aug$/);
  });
  it('category vs plan uses a monthly plan', () => {
    const r = computeChart(byId('dining-plan'), data, today);
    if (r.type !== 'vsPlan') throw new Error();
    expect(r.buckets[0].plan).toBe(Math.round((18000 * 26) / 12));
  });
  it('net position ends at today', () => {
    const r = computeChart(byId('net-position'), data, today);
    expect(seriesOf(r).at(-1)!.value).toBe(4821640);
    expect(headline(byId('net-position'), r).big).toBe('$48.2k');
  });
  it('allocation and merchants', () => {
    const a = computeChart(byId('paycheque-split'), data, today);
    expect(a).toMatchObject({ type: 'allocation', total: 264000, unallocated: 32000 });
    expect(headline(byId('paycheque-split'), a).delta).toBe('$320 unallocated');
    const m = computeChart(byId('grocery-merchants'), data, today);
    if (m.type !== 'ranked') throw new Error();
    expect(m.rows[0].label).toBe('Loblaws');
    expect(m.rows.length).toBeLessThanOrEqual(5);
  });
});

describe('helpers', () => {
  it('range options follow the bucket', () => {
    expect(rangeOptions({ measure: 'savingsRate', bucket: 'paycheque' }).map((o) => o.value)).toEqual([6, 12, 26]);
    expect(rangeOptions({ measure: 'netPosition', bucket: 'month' }).map((o) => o.value)).toEqual([3, 6, 12]);
  });
  it('x ticks anchor on the latest point', () => {
    expect(xTicks(12)).toEqual([1, 3, 5, 7, 9, 11]);
    expect(xTicks(3)).toEqual([0, 1, 2]);
  });
  it('placement labels', () => {
    expect(placementLabel(byId('savings-rate'))).toBe('Overview · Medium');
    expect(placementLabel(byId('paycheque-split'))).toBe('Paycheques page');
    expect(placementLabel(byId('dining-plan'))).toBe('Not pinned');
  });
  it('csv export', () => {
    const def: ChartDef = byId('savings-rate');
    const csv = chartCsv(def, computeChart(def, data, today));
    expect(csv.split('\n')[1]).toBe('date,label,percent');
    expect(csv.split('\n')).toHaveLength(14);
  });
});
