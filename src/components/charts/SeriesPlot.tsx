import { useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import type { ChartDef } from '@/domain/types';
import { formatValue, placeNotes, xTicks, type Point, type Unit } from '@/domain/charts';
import { money } from '@/domain/money';

interface Props {
  def: ChartDef;
  points: Point[];
  unit: Unit;
  height?: number;
}

const W = 700;

const axisLabel = (v: number, unit: Unit) =>
  unit === 'percent' ? `${Math.round(v)}%` : Math.abs(v) >= 1_000_000 ? `$${Math.round(v / 100_000)}k` : money(v, { decimals: 0 });

/**
 * Editor plot (6c): y gridlines, series as line/area/bars, dashed target, notes with label chips,
 * highlighted latest point, and a dark tooltip (pinned to the latest point until you hover).
 */
export function SeriesPlot({ def, points, unit, height = 300 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;
  if (!n) return <div className="grid place-items-center text-[13px] text-mute" style={{ height }}>No data in this range yet</div>;

  const vals = points.map((p) => p.value);
  const target = def.showTarget ? def.target : undefined;
  const max = Math.max(...vals, target ?? -Infinity);
  const min = Math.min(...vals, target ?? Infinity);
  const zeroBased = unit === 'percent' || def.kind === 'bars' || def.measure === 'spending';
  const lo = zeroBased ? 0 : min - (max - min) * 0.25;
  const hi = zeroBased ? max * 1.15 : max + (max - min) * 0.2;
  const y = scaleLinear().domain([lo, hi || 1]);
  const ticks = y.ticks(4).filter((t) => t >= lo && t <= hi);
  const pct = (v: number) => y(v) * 100; // % from the bottom
  const X = (i: number) => ((i + 0.5) / n) * W;
  const Y = (v: number) => height - (y(v) * height);
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  const bw = (W / n) * 0.56;
  const notes = def.showNotes ? placeNotes(def.notes, points) : [];
  const active = hover ?? n - 1;
  const p = points[active];
  const leftPct = (X(active) / W) * 100;

  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-2">
      <div className="relative text-[11px] text-faint" style={{ height }}>
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: `${pct(t)}%` }}>
            {axisLabel(t, unit)}
          </span>
        ))}
      </div>
      <div
        ref={ref}
        className="relative"
        style={{ height }}
        onMouseMove={(e) => {
          const r = ref.current!.getBoundingClientRect();
          setHover(Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n))));
        }}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${pct(t)}%` }} />
        ))}
        <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
          {def.kind === 'area' && <path d={`${d} L${X(n - 1)} ${height} L${X(0)} ${height} Z`} style={{ fill: def.color }} fillOpacity={0.16} />}
          {def.kind === 'bars' &&
            vals.map((v, i) => (
              <rect
                key={i}
                x={X(i) - bw / 2}
                y={Y(v)}
                width={bw}
                height={height - Y(v)}
                style={{ fill: def.color }}
                fillOpacity={i === n - 1 || i === hover ? 1 : target !== undefined && v < target ? 0.35 : 0.7}
              />
            ))}
          {def.kind !== 'bars' && (
            <path d={d} fill="none" style={{ stroke: def.color }} strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          )}
        </svg>
        {target !== undefined && (
          <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-ink opacity-45" style={{ bottom: `${pct(target)}%` }} />
        )}
        {notes.map((a) => (
          <div key={a.label + a.date} className="pointer-events-none">
            <div
              className="absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-ink bg-panel"
              style={{ left: `${(X(a.index) / W) * 100}%`, bottom: `${pct(vals[a.index])}%` }}
            />
            <div
              className="absolute -translate-x-1/2 -translate-y-[14px] rounded-[6px] border border-line bg-panel2 px-2 py-[3px] text-[11px] whitespace-nowrap text-ink"
              style={{ left: `${(X(a.index) / W) * 100}%`, bottom: `${pct(vals[a.index])}%` }}
            >
              {a.label}
            </div>
          </div>
        ))}
        <div
          className="pointer-events-none absolute size-3 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-panel"
          style={{ left: `${leftPct}%`, bottom: `${pct(p.value)}%`, background: def.color, boxShadow: `0 0 0 1px ${def.color}` }}
        />
        <div
          className="pointer-events-none absolute rounded-[10px] bg-inv px-3 py-[9px] text-[12px] leading-[1.45] whitespace-nowrap text-inv-ink"
          style={
            hover === null
              ? { right: 0, bottom: '8%' }
              : {
                  left: `${leftPct}%`,
                  bottom: `${pct(p.value)}%`,
                  transform: `translate(${leftPct > 60 ? 'calc(-100% - 12px)' : '12px'}, 50%)`,
                }
          }
        >
          <div className="text-inv-mute">{p.title}</div>
          <div>
            <span className="font-medium">{formatValue(p.value, unit)}</span>
            {p.detail && ` · ${p.detail}`}
          </div>
        </div>
      </div>
      <span />
      <div className="relative h-4 text-[11px] text-faint">
        {xTicks(n).map((i) => (
          <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(X(i) / W) * 100}%` }}>
            {points[i].label}
          </span>
        ))}
      </div>
    </div>
  );
}
