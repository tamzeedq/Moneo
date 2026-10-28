import { useSvgId } from './useSvgId';
import type { PaceSeries } from '@/domain/selectors';

const W = 700,
  H = 230,
  TOP = 48,
  BASE = 214;

/** Cumulative spend this period vs. the average of previous periods, with a dashed projection. */
export function PaceChart({ pace }: { pace: PaceSeries }) {
  const id = useSvgId();
  const { actual, average, projected, length, elapsed } = pace;
  const max = Math.max(average[average.length - 1] ?? 0, projected, 1);
  const x = (i: number) => (i / length) * W;
  const y = (v: number) => BASE - (v / max) * (BASE - TOP);
  const pts = (arr: number[]) => arr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' L');
  const actualD = 'M' + pts(actual);
  const tx = x(elapsed),
    ty = y(actual[actual.length - 1]);
  const hasAverage = average.some((v) => v > 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-auto block h-auto w-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--acc)', stopOpacity: 0.22 }} />
          <stop offset="1" style={{ stopColor: 'var(--acc)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      {hasAverage && <path d={'M' + pts(average)} fill="none" style={{ stroke: 'var(--faint)' }} strokeWidth={3} strokeLinejoin="round" />}
      <path d={`${actualD} L${tx},${H} L0,${H} Z`} fill={`url(#${id})`} />
      <path d={actualD} fill="none" style={{ stroke: 'var(--acc)' }} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
      {elapsed < length && (
        <path
          d={`M${tx},${ty} L${W},${y(projected)}`}
          fill="none"
          style={{ stroke: 'var(--acc)' }}
          strokeOpacity={0.5}
          strokeWidth={3}
          strokeDasharray="6 9"
        />
      )}
      <circle cx={tx} cy={ty} r={9} style={{ fill: 'var(--acc)' }} />
    </svg>
  );
}
