import { eachMonthOfInterval, format } from 'date-fns';
import { parse } from '@/domain/dates';

/** Up to 6 x-axis labels: month names for long ranges, dates for short ones. */
export function axisLabels(points: { date: string }[]): string[] {
  if (points.length < 2) return [];
  const start = parse(points[0].date),
    end = parse(points[points.length - 1].date);
  const months = eachMonthOfInterval({ start, end }).slice(1);
  if (months.length >= 3) {
    const step = Math.ceil(months.length / 6);
    return months.filter((_, i) => (months.length - 1 - i) % step === 0).map((m) => format(m, 'MMM'));
  }
  const n = 5;
  return Array.from({ length: n }, (_, i) => format(parse(points[Math.round((i / (n - 1)) * (points.length - 1))].date), 'MMM d'));
}
