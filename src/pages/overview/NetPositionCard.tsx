import { useMemo, useState } from 'react';
import type { ISODate, MoneoData } from '@/domain/types';
import { money } from '@/domain/money';
import { netDelta, netHistory, netPosition, spentBetween, trailingSavingsRate, type NetRange } from '@/domain/selectors';
import { incomeIn, throughToday, type TimeWindow } from '@/domain/periods';
import { AreaLineChart } from '@/components/charts/AreaLineChart';
import { axisLabels } from '@/components/charts/axisLabels';
import { HeroMoney } from '@/components/ui/Money';
import { Segmented } from '@/components/ui/Segmented';

const RANGES: NetRange[] = ['1M', '6M', '1Y', 'All'];

export function NetPositionCard({ data, today, window: w }: { data: MoneoData; today: ISODate; window?: TimeWindow }) {
  const [range, setRange] = useState<NetRange>('6M');
  const net = netPosition(data.accounts);
  const delta = w ? netDelta(data.accounts, data.balanceSnapshots, w.start) : { delta: 0, pct: 0 };
  const spent = w ? spentBetween(data.transactions, w.start, throughToday(w, today)) : 0;
  const income = w ? incomeIn(data, w) : { count: 0, net: 0, savingsRate: null };
  // Per paycheque, the rate is smoothed over the last three; for calendar periods it's the paycheques paid inside.
  const rate = w?.kind === 'Paycheque' ? trailingSavingsRate(data, today) : income.savingsRate;

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
          <Stat
            label={w?.kind === 'Paycheque' || income.count === 1 ? 'Paycheque in' : `Paycheques in (${income.count})`}
            value={money(income.net)}
            className="pr-4"
          />
          <Stat label={w?.current === false ? 'Spent' : 'Spent so far'} value={money(spent)} className="border-l border-line px-4" />
          <Stat
            label="Savings rate"
            value={rate === null ? '—' : `${Math.round(rate * 100)}%`}
            title={w?.kind === 'Paycheque' ? 'Average of your last 3 paycheques' : undefined}
            className="border-l border-line pl-4"
          />
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

function Stat({ label, value, className = '', title }: { label: string; value: string; className?: string; title?: string }) {
  return (
    <div className={className} title={title}>
      <div className="text-[12px] text-mute">{label}</div>
      <div className="mt-1 text-[20px] font-medium tracking-[-0.03em]">{value}</div>
    </div>
  );
}
