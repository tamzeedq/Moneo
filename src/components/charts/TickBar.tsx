import { distributeTicks } from '@/domain/selectors';

export interface TickSegment {
  amount: number;
  color: string;
}

interface Props {
  segments: TickSegment[];
  /** Amount the full bar represents. Anything not covered by segments renders as `track`. */
  total: number;
  count?: number;
  height?: number;
}

/** Bar of N ticks, each 1/N of the total, coloured by segment in order. */
export function TickBar({ segments, total, count = 60, height = 26 }: Props) {
  const counts = distributeTicks(
    segments.map((s) => s.amount),
    total,
    count,
  );
  const ticks: string[] = [];
  segments.forEach((s, i) => {
    for (let k = 0; k < counts[i]; k++) ticks.push(s.color);
  });
  while (ticks.length < count) ticks.push('var(--track)');
  return (
    <div className="flex gap-0.5" style={{ height }} aria-hidden>
      {ticks.slice(0, count).map((c, i) => (
        <div key={i} className="flex-1 rounded-[2px]" style={{ background: c }} />
      ))}
    </div>
  );
}
