import { useMemo } from 'react';

interface Props {
  values: number[];
  color: string;
  width?: number;
  height?: number;
  pad?: number;
  strokeWidth?: number;
}

/** Tiny min–max-normalised line with evenly spaced points. */
export function Sparkline({ values, color, width = 64, height = 24, pad = 3, strokeWidth = 1.5 }: Props) {
  const d = useMemo(() => {
    if (values.length < 2) return '';
    const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    return (
      'M' +
      values
        .map((v, i) => {
          const x = (i / (values.length - 1)) * width;
          const y = height - pad - ((v - min) / span) * (height - pad * 2);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' L')
    );
  }, [values, width, height, pad]);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="flex-none" style={{ width, height }} aria-hidden>
      <path d={d} fill="none" style={{ stroke: color }} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </svg>
  );
}
