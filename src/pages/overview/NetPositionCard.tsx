import { useMemo, useState } from 'react';
import { eachMonthOfInterval, format } from 'date-fns';
import type { ISODate, MoneoData, NetSnapshot } from '@/domain/types';
import { money } from '@/domain/money';
import { parse } from '@/domain/dates';
import {
  currentPaycheque, netDelta, netHistory, netPosition, spentBetween, trailingSavingsRate, type NetRange,
} from '@/domain/selectors';
import { AreaLineChart } from '@/components/charts/AreaLineChart';
import { HeroMoney } from '@/components/ui/Money';
import { Segmented } from '@/components/ui/Segmented';

const RANGES: NetRange[] = ['1M', '6M', '1Y', 'All'];

/** Up to 6 x-axis labels: month names for long ranges, dates for short ones. */
function axisLabels(points: NetSnapshot[]): string[] {
  if (points.length < 2) return [];
  const start = parse(points[0].date), end = parse(points[points.length - 1].date);
  const months = eachMonthOfInterval({ start, end }).slice(1);
  if (months.length >= 3) {
    const step = Math.ceil(months.length / 6);
    return months.filter((_, i) => (months.length - 1 - i) % step === 0).map((m) => format(m, 'MMM'));
  }
  const n = 5;
  return Array.from({ length: n }, (_, i) => format(parse(points[Math.round((i / (n - 1)) * (points.length - 1))].date), 'MMM d'));
}

export function NetPositionCard({ data, today }: { data: MoneoData; today: ISODate }) {
  const [range, setRange] = useState<NetRange>('6M');
  const pay = currentPaycheque(data.paycheques, today);
  const net = netPosition(data.accounts);
  const delta = pay ? netDelta(data.accounts, data.balanceSnapshots, pay.periodStart) : { delta: 0, pct: 0 };
  const spent = pay ? spentBetween(data.transactions, pay.periodStart, today) : 0;
  const rate = trailingSavingsRate(data, today);

  const points = useMemo(() => netHistory(data.netSnapshots, range, today), [data.netSnapshots, range, today]);
  const values = useMemo(() => points.map((p) => p.value), [points]);
  const labels = useMemo(() => axisLabels(points), [points]);
  const up = delta.delta >= 0;

  return (
    <section className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] gap-7 rounded-[18px] border border-line bg-panel px-[22px] py-5 max-lg:grid-cols-1">
      <div className="flex flex-col justify-between gap-[18px]">
        <div>
          <div className="text-[13px] text-mute">Net position</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
            <HeroMoney cents={net} className="text-[46px] leading-none font-medium tracking-[-0.045em]" />
            <span className="text-[13px] font-medium" style={{ color: up ? 'var(--pos)' : 'var(--acc)' }}>
              {up ? '▲' : '▼'} {money(Math.abs(delta.delta))} · {(Math.abs(delta.pct) * 100).toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3">
          <Stat label="Paycheque in" value={money(pay?.net ?? 0)} className="pr-4" />
          <Stat label="Spent so far" value={money(spent)} className="border-l border-line px-4" />
          <Stat label="Savings rate" value={`${Math.round(rate * 100)}%`} className="border-l border-line pl-4" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Segmented label="Net position range" variant="plain" value={range} options={RANGES} onChange={setRange} className="justify-end" />
        <AreaLineChart values={values} />
        <div className="flex justify-between text-[11px] text-faint">
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[12px] text-mute">{label}</div>
      <div className="mt-1 text-[20px] font-medium tracking-[-0.03em]">{value}</div>
    </div>
  );
}
