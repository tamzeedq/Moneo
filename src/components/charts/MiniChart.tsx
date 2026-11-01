import type { ChartDef } from '@/domain/types';
import type { ChartResult } from '@/domain/charts';
import { money } from '@/domain/money';
import { distributeTicks } from '@/domain/selectors';

interface Props {
  def: Pick<ChartDef, 'kind' | 'color'>;
  result: ChartResult;
  height?: number;
  /** 'lg' is the 6b preview: wider gaps, bigger labels. */
  size?: 'sm' | 'lg';
}

const W = 300,
  H = 100;

/** One component for every library card / preview chart. */
export function MiniChart({ def, result, height = 110, size = 'sm' }: Props) {
  const lg = size === 'lg';
  return (
    <div className="relative" style={{ height }}>
      {result.type === 'series' && <SeriesMini values={result.points.map((p) => p.value)} kind={def.kind} color={def.color} lg={lg} />}
      {result.type === 'stacked' && <Stacked result={result} lg={lg} />}
      {result.type === 'vsPlan' && <VsPlan result={result} lg={lg} />}
      {result.type === 'allocation' && <Ticks result={result} lg={lg} />}
      {result.type === 'ranked' && <Ranked result={result} lg={lg} />}
    </div>
  );
}

function SeriesMini({ values, kind, color, lg }: { values: number[]; kind: ChartDef['kind']; color: string; lg: boolean }) {
  if (!values.length) return <Empty />;
  const n = values.length;
  const x = (i: number) => ((i + 0.5) / n) * W;
  if (kind === 'bars') {
    const max = Math.max(...values, 1);
    const bw = (W / n) * 0.56;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        {values.map((v, i) => (
          <rect
            key={i}
            x={x(i) - bw / 2}
            y={H - (v / max) * H * 0.9}
            width={bw}
            height={(v / max) * H * 0.9}
            rx={1.5}
            style={{ fill: color }}
            opacity={i === n - 1 ? 1 : 0.7}
          />
        ))}
      </svg>
    );
  }
  const min = Math.min(...values),
    max = Math.max(...values),
    span = max - min || Math.abs(max) || 1;
  const lo = min - span * 0.35,
    hi = max + span * 0.3;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${d} L${x(n - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
      <path d={area} style={{ fill: `color-mix(in srgb, ${color} ${kind === 'area' ? 20 : 13}%, transparent)` }} />
      <path
        d={d}
        fill="none"
        style={{ stroke: color }}
        strokeWidth={lg ? 2.5 : 2}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Stacked({ result, lg }: { result: Extract<ChartResult, { type: 'stacked' }>; lg: boolean }) {
  const max = Math.max(...result.buckets.map((b) => b.value), 1);
  return (
    <div className={`absolute inset-0 flex items-end ${lg ? 'gap-7 px-3' : 'gap-2'}`}>
      {result.buckets.map((b) => (
        <div key={b.date} className="flex h-full flex-1 flex-col-reverse gap-0.5" title={`${b.title} · ${money(b.value, { decimals: 0 })}`}>
          {b.segments.map((s) => (
            <div
              key={s.key}
              className={lg ? 'rounded-[4px]' : 'rounded-[3px]'}
              style={{ height: `${(s.value / max) * 100}%`, background: s.color }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function VsPlan({ result, lg }: { result: Extract<ChartResult, { type: 'vsPlan' }>; lg: boolean }) {
  const max = Math.max(...result.buckets.map((b) => Math.max(b.value, b.plan)), 1) * 1.08;
  const plan = result.buckets.at(-1)?.plan ?? 0;
  return (
    <>
      <div className={`absolute inset-0 flex items-end ${lg ? 'gap-7 px-3' : 'gap-2'}`}>
        {result.buckets.map((b) => (
          <div
            key={b.date}
            className={`flex-1 ${lg ? 'rounded-[4px]' : 'rounded-[3px]'}`}
            title={`${b.title} · ${money(b.value, { decimals: 0 })} of ${money(b.plan, { decimals: 0 })}`}
            style={{ height: `${(b.value / max) * 100}%`, background: b.value > b.plan ? 'var(--acc)' : '#d8b67a' }}
          />
        ))}
      </div>
      {plan > 0 && (
        <div
          className="absolute inset-x-0 border-t-[1.5px] border-dashed border-ink opacity-50"
          style={{ bottom: `${(plan / max) * 100}%` }}
        />
      )}
    </>
  );
}

function Ticks({ result, lg }: { result: Extract<ChartResult, { type: 'allocation' }>; lg: boolean }) {
  if (!result.total) return <Empty />;
  const counts = distributeTicks(
    result.segments.map((s) => s.value),
    result.total,
    48,
  );
  const ticks: string[] = [];
  result.segments.forEach((s, i) => {
    for (let k = 0; k < counts[i]; k++) ticks.push(s.color);
  });
  while (ticks.length < 48) ticks.push('var(--track)');
  return (
    <div className={`absolute inset-x-0 flex ${lg ? 'top-[35%] h-[30%] gap-[3px]' : 'top-[30%] h-[40%] gap-0.5'}`}>
      {ticks.map((c, i) => (
        <div key={i} className={`flex-1 ${lg ? 'rounded-[3px]' : 'rounded-[2px]'}`} style={{ background: c }} />
      ))}
    </div>
  );
}

function Ranked({ result, lg }: { result: Extract<ChartResult, { type: 'ranked' }>; lg: boolean }) {
  if (!result.rows.length) return <Empty />;
  const max = result.rows[0].value || 1;
  return (
    <div className={`absolute inset-0 flex flex-col justify-around ${lg ? 'text-[13px]' : 'text-[11px]'}`}>
      {result.rows.map((r, i) => (
        <div key={r.label} className={`flex items-center ${lg ? 'gap-3' : 'gap-2'}`}>
          <span className={`truncate whitespace-nowrap text-mute ${lg ? 'w-[110px]' : 'w-[62px]'}`}>{r.label}</span>
          <div className={`flex-1 bg-track ${lg ? 'h-3.5 rounded-[7px]' : 'h-2 rounded-[4px]'}`}>
            <div
              className={`h-full ${lg ? 'rounded-[7px]' : 'rounded-[4px]'}`}
              style={{ width: `${(r.value / max) * 100}%`, background: i ? '#d8b67a' : 'var(--acc)' }}
            />
          </div>
          <span className={`text-right ${lg ? 'w-14' : 'w-[38px]'}`}>{money(r.value, { decimals: 0 })}</span>
        </div>
      ))}
    </div>
  );
}

const Empty = () => <div className="absolute inset-0 grid place-items-center text-[12px] text-mute">No data yet</div>;
