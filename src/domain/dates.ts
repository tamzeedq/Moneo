import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { ISODate } from './types';

let pinned: ISODate | null = null;

/** Pins "today" to a fixed date (the demo workspace and tests), or null for the real clock. */
export function setClock(date: ISODate | null) {
  pinned = date;
}

export function today(): ISODate {
  return pinned ?? toISO(new Date());
}

export const toISO = (d: Date): ISODate => format(d, 'yyyy-MM-dd');
export const parse = (d: ISODate): Date => parseISO(d);

export const addDaysISO = (d: ISODate, n: number): ISODate => toISO(addDays(parse(d), n));
export const daysBetween = (from: ISODate, to: ISODate): number => differenceInCalendarDays(parse(to), parse(from));

/** "Oct 3" */
export const shortDate = (d: ISODate) => format(parse(d), 'MMM d');
/** "Fri, Oct 10" */
export const dayShortDate = (d: ISODate) => format(parse(d), 'EEE, MMM d');
/** "Saturday, Oct 4" */
export const longDay = (d: ISODate) => format(parse(d), 'EEEE, MMM d');
/** "May 2027" */
export const monthYear = (d: ISODate) => format(parse(d), 'MMM yyyy');

export function greeting(hour = new Date().getHours()): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
