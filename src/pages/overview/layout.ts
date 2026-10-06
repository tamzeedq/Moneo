import type { ChartDef, PinSize } from '@/domain/types';

/** Overview cards that a pinned chart can be placed after, with their width in a 12-column map. */
export const OVERVIEW_CARDS = [
  { id: 'net', label: 'Net position', span: 12 },
  { id: 'accounts', label: 'Accounts', span: 9 },
  { id: 'next', label: 'Next paycheque', span: 3 },
  { id: 'pace', label: 'Spending pace', span: 4 },
  { id: 'categories', label: 'By category', span: 4 },
  { id: 'split', label: 'Latest paycheque', span: 4 },
  { id: 'transactions', label: 'Recent transactions', span: 6 },
  { id: 'budget', label: 'Budget watch', span: 3 },
  { id: 'goals', label: 'Goals', span: 3 },
] as const;

export type OverviewCardId = (typeof OVERVIEW_CARDS)[number]['id'];

/** Rows as they appear on the Overview, with their height in map rows. */
export const OVERVIEW_ROWS: { cards: OverviewCardId[]; height: number }[] = [
  { cards: ['net'], height: 1 },
  { cards: ['accounts', 'next'], height: 2 },
  { cards: ['pace', 'categories', 'split'], height: 1 },
  { cards: ['transactions', 'budget', 'goals'], height: 2 },
];

export const cardLabel = (id: string) => OVERVIEW_CARDS.find((c) => c.id === id)?.label ?? 'Goals';

/** Pinned charts land after the row that contains their `after` card (unknown → the end). */
export function rowOfCard(id: string): number {
  const i = OVERVIEW_ROWS.findIndex((r) => (r.cards as string[]).includes(id));
  return i === -1 ? OVERVIEW_ROWS.length - 1 : i;
}

/** Pinned charts grouped by the Overview row they follow, in the order they were pinned. */
export function pinnedByRow(charts: ChartDef[]): ChartDef[][] {
  const rows: ChartDef[][] = OVERVIEW_ROWS.map(() => []);
  charts
    .filter((c) => c.status === 'pinned' && c.pin)
    .sort((a, b) => (a.pin!.pinnedAt ?? '').localeCompare(b.pin!.pinnedAt ?? '') || a.id.localeCompare(b.id))
    .forEach((c) => rows[rowOfCard(c.pin!.after)].push(c));
  return rows;
}

/** Columns out of 4 on the Overview, and rows of map height. */
export const PIN_SPAN: Record<PinSize, { cols: number; rows: number }> = { S: { cols: 1, rows: 1 }, M: { cols: 2, rows: 1 }, L: { cols: 4, rows: 2 } };
