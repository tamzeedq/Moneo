import { useMemo } from 'react';
import { useSvgId } from './useSvgId';
import { scaleLinear } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';

interface Props {
  values: number[];
  color?: string;
  height?: number;
  /** ViewBox width; the chart stretches to its container width. */
  width?: number;
  /** Fraction of the viewBox height kept clear above/below the line. */
  padTop?: number;
  padBottom?: number;
  gridLines?: number;
  fillOpacity?: number;
}

const H = 130;

/** Smooth line with a gradient fill fading to transparent (Overview net position). */
export function AreaLineChart({
  values,
  color = 'var(--acc)',
  height = 118,
  width = 760,
  padTop = 0.17,
  padBottom = 0.11,
  gridLines = 2,
  fillOpacity = 0.16,
}: Props) {
  const id = useSvgId();
  const { linePath, areaPath } = useMemo(() => {
    if (values.length < 2) return { linePath: '', areaPath: '' };
    const x = scaleLinear().domain([0, values.length - 1]).range([0, width]);
    const min = Math.min(...values), max = Math.max(...values);
    const y = scaleLinear().domain([min, max === min ? min + 1 : max]).range([H * (1 - padBottom), H * padTop]);
    const l = line<number>().x((_, i) => x(i)).y((v) => y(v)).curve(curveMonotoneX);
    const a = area<number>().x((_, i) => x(i)).y0(H).y1((v) => y(v)).curve(curveMonotoneX);
    return { linePath: l(values) ?? '', areaPath: a(values) ?? '' };
  }, [values, width, padTop, padBottom]);

  return (
    <svg viewBox={`0 0 ${width} ${H}`} preserveAspectRatio="none" className="block w-full" style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: color, stopOpacity: fillOpacity }} />
          <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      {Array.from({ length: gridLines }, (_, i) => {
        const gy = (H / (gridLines + 1)) * (i + 1);
        return (
          <line key={i} x1={0} x2={width} y1={gy} y2={gy} style={{ stroke: 'var(--line)' }} strokeDasharray="2 4" />
        );
      })}
      <path d={areaPath} fill={`url(#${id})`} />
      <path d={linePath} fill="none" style={{ stroke: color }} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
