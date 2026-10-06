import type { ReactNode } from 'react';

export interface RingSegment {
  value: number;
  color: string;
}

interface Props {
  segments: RingSegment[];
  /** Amount a full half ring represents. Defaults to the sum of segments; anything uncovered shows `track`. */
  total?: number;
  height?: number;
  thickness?: number;
  /** Gap between segments, in % of the half ring. */
  gap?: number;
  center?: ReactNode;
}

/** Half-ring gauge drawn as dashed circles on a 200-unit path (the visible half = 100 units). */
export function HalfRing({ segments, total, height = 104, thickness = 26, gap = 1.2, center }: Props) {
  const sum = total ?? segments.reduce((a, s) => a + s.value, 0);
  let offset = 0;
  return (
    <div className="relative" style={{ height }}>
      <svg viewBox="0 0 260 140" className="block w-full" style={{ height }} aria-hidden>
        <g transform="rotate(180 130 128)">
          {total !== undefined && (
            <circle cx={130} cy={128} r={100} fill="none" style={{ stroke: 'var(--track)' }} strokeWidth={thickness} pathLength={200} strokeDasharray="100 100" />
          )}
          {segments.map((s, i) => {
            const pct = sum ? (s.value / sum) * 100 : 0;
            const dash = `${Math.max(pct - gap, 0.6)} ${200 - pct + gap}`;
            const el = (
              <circle
                key={i}
                cx={130}
                cy={128}
                r={100}
                fill="none"
                style={{ stroke: s.color }}
                strokeWidth={thickness}
                pathLength={200}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
              />
            );
            offset += pct;
            return el;
          })}
        </g>
      </svg>
      {center && <div className="absolute inset-x-0 bottom-0 text-center">{center}</div>}
    </div>
  );
}
