/**
 * Add-paycheque wizard: the draft shape and the pure maths behind steps 1–4.
 * The draft lives in a persisted Zustand store (stores/wizard.ts); this file never touches storage.
 */
import { addDays, addMonths, endOfMonth, getDate, setDate } from 'date-fns';
import type {
  Account, Allocation, BudgetLine, Category, Cents, Goal, ISODate, MoneoData, Paycheque, Repeats, SplitTemplate,
} from './types';
import { addDaysISO, parse, shortDate, toISO } from './dates';
import { newId } from '@/lib/id';
import { money, sum } from './money';
import {
  allocationsFor, budgetPool, currentPaycheque, leftToAllocate, leftToBudget, pastPaycheques, spendByCategory,
} from './selectors';

export const WIZARD_STEPS = ['details', 'split', 'budget', 'review'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];
export const STEP_LABELS: Record<WizardStep, string> = { details: 'Details', split: 'Split', budget: 'Budget', review: 'Review' };

/** Accounts move by $20 per stepper click, categories by $10. */
export const SPLIT_STEP: Cents = 2000;
export const BUDGET_STEP: Cents = 1000;

/** Which preset the plan came from; 'custom' once a stepper has been touched. */
export type BudgetMode = 'copy' | 'average' | 'custom';

export interface PaychequeDraft {
  /** Paycheque the draft was prefilled from. */
  basedOn?: string;
  net: Cents;
  payDate: ISODate;
  source: string;
  depositAccountId: string;
  repeats: Repeats;
  note: string;
  gross: Cents | null;
  deductions: { label: string; amount: Cents }[];
  templateId: string;
  allocations: Record<string, Cents>;
  budgetMode: BudgetMode;
  budget: { categoryId: string; plan: Cents }[];
  transfersDone: Record<string, boolean>;
  remind: boolean;
}

// ─── Dates ───────────────────────────────────────────────────────────────────

/** The pay date after `payDate` under a repeat rule. Semi-monthly pays on the 15th and the last day. */
export function nextPayDate(payDate: ISODate, repeats: Repeats): ISODate {
  const d = parse(payDate);
  switch (repeats) {
    case 'biweekly':
    case 'once':
      return toISO(addDays(d, 14));
    case 'monthly':
      return toISO(addMonths(d, 1));
    case 'semimonthly': {
      const last = getDate(endOfMonth(d));
      if (getDate(d) < 15) return toISO(setDate(d, 15));
      if (getDate(d) < last) return toISO(endOfMonth(d));
      return toISO(setDate(addMonths(d, 1), 15));
    }
  }
}

/** The budget period a paycheque funds: its pay date up to the day before the next one. */
export function payPeriod(payDate: ISODate, repeats: Repeats) {
  const end = addDaysISO(nextPayDate(payDate, repeats), -1);
  return { start: payDate, end, days: Math.round((parse(end).getTime() - parse(payDate).getTime()) / 864e5) + 1 };
}

export const periodLabel = (start: ISODate, end: ISODate) => `${shortDate(start)} – ${shortDate(end)}`;

// ─── Templates & split ───────────────────────────────────────────────────────

export const splitAccounts = (accounts: Account[]) =>
  accounts.filter((a) => a.splitOrder !== undefined).sort((a, b) => a.splitOrder! - b.splitOrder!);

export function templateAllocations(t: SplitTemplate | undefined, accounts: Account[]): Record<string, Cents> {
  return Object.fromEntries(splitAccounts(accounts).map((a) => [a.id, t?.amounts[a.id] ?? 0]));
}

export type Tone = 'pos' | 'acc' | 'ink' | 'mute';

export interface SplitStatus {
  left: Cents;
  tone: Tone;
  label: string;
  /** Continue is blocked only when the split is over the paycheque. */
  canContinue: boolean;
}

export function splitStatus(net: Cents, allocations: Record<string, Cents>): SplitStatus {
  const left = leftToAllocate(net, Object.values(allocations));
  if (left === 0) return { left, tone: 'pos', label: 'Every dollar has a job', canContinue: true };
  if (left > 0) return { left, tone: 'acc', label: `${money(left)} still unassigned`, canContinue: true };
  return { left, tone: 'acc', label: `${money(-left)} over the paycheque`, canContinue: false };
}

/** Moves an amount by `delta`, clamped at $0. */
export const stepAmount = (value: Cents, delta: Cents) => Math.max(0, value + delta);

/**
 * Drag a divider between two adjacent accounts in split order (3b/5b).
 * `boundary` is the cumulative amount at the divider; snaps to `snap`, never crosses its neighbours.
 */
export function moveDivider(
  order: string[],
  allocations: Record<string, Cents>,
  index: number,
  boundary: Cents,
  snap: Cents = 1000,
): Record<string, Cents> {
  const amounts = order.map((id) => allocations[id] ?? 0);
  const before = sum(amounts.slice(0, index));
  const pair = amounts[index] + amounts[index + 1];
  const snapped = Math.round(boundary / snap) * snap;
  const left = Math.min(Math.max(snapped - before, 0), pair);
  return { ...allocations, [order[index]]: left, [order[index + 1]]: pair - left };
}

export interface GoalImpact {
  goal: Goal;
  add: Cents;
  after: Cents;
}

/** A goal linked to an account grows by that account's allocation, capped at the target. */
export function goalImpact(goals: Goal[], allocations: Record<string, Cents>): GoalImpact[] {
  return [...goals]
    .sort((a, b) => a.order - b.order)
    .map((goal) => {
      const add = goal.accountId ? allocations[goal.accountId] ?? 0 : 0;
      return { goal, add, after: Math.min(goal.current + add, goal.target) };
    });
}

export function savingsOf(accounts: Account[], allocations: Record<string, Cents>): Cents {
  const savings = new Set(accounts.filter((a) => ['tfsa', 'emergency', 'rrsp'].includes(a.kind)).map((a) => a.id));
  return sum(Object.entries(allocations).filter(([id]) => savings.has(id)).map(([, v]) => v));
}

export function draftPool(accounts: Account[], allocations: Record<string, Cents>): Cents {
  return budgetPool(toAllocations('draft', allocations), accounts);
}

const toAllocations = (paychequeId: string, allocations: Record<string, Cents>): Allocation[] =>
  Object.entries(allocations).filter(([, amount]) => amount > 0).map(([accountId, amount]) => ({ paychequeId, accountId, amount }));

// ─── Budget ──────────────────────────────────────────────────────────────────

const byCategoryOrder = (categories: Category[]) => {
  const order = new Map(categories.map((c) => [c.id, c.order]));
  return (a: { categoryId: string }, b: { categoryId: string }) => (order.get(a.categoryId) ?? 99) - (order.get(b.categoryId) ?? 99);
};

/** The most recent paycheque on record, including ones planned ahead of their pay date. */
export const latestPaycheque = (paycheques: Paycheque[]) =>
  [...paycheques].sort((a, b) => a.payDate.localeCompare(b.payDate)).at(-1);

/** "Copy last plan": the latest paycheque's budget lines. */
export function lastPlan(data: MoneoData): { categoryId: string; plan: Cents }[] {
  const last = latestPaycheque(data.paycheques);
  if (!last) return [];
  return data.budgetLines
    .filter((l) => l.paychequeId === last.id)
    .map(({ categoryId, plan }) => ({ categoryId, plan }))
    .sort(byCategoryOrder(data.categories));
}

/** Spend per category in the latest paycheque's period so far ("Last spent"). */
export function lastSpent(data: MoneoData, today: ISODate): Record<string, Cents> {
  const last = currentPaycheque(data.paycheques, today);
  if (!last) return {};
  return Object.fromEntries(
    spendByCategory(data.transactions, data.categories, last.periodStart, last.periodEnd).map((c) => [c.category.id, c.spent]),
  );
}

/** "3-paycheque average": average spend of the last `n` completed periods, rounded to the nearest $10. */
export function averagePlan(data: MoneoData, today: ISODate, categoryIds: string[], n = 3) {
  const done = pastPaycheques(data.paycheques, today).filter((p) => p.periodEnd < today).slice(-n);
  return categoryIds.map((categoryId) => {
    const spent = done.map((p) =>
      spendByCategory(data.transactions, data.categories, p.periodStart, p.periodEnd).find((c) => c.category.id === categoryId)?.spent ?? 0,
    );
    const avg = done.length ? sum(spent) / done.length : 0;
    return { categoryId, plan: Math.round(avg / BUDGET_STEP) * BUDGET_STEP };
  });
}

export interface BudgetStatus {
  left: Cents;
  tone: Tone;
  label: string;
}

/** Over the pool is allowed, with a warning. */
export function budgetStatus(pool: Cents, plans: Cents[]): BudgetStatus {
  const left = leftToBudget(pool, plans);
  if (left === 0) return { left, tone: 'pos', label: 'Pool fully budgeted' };
  if (left > 0) return { left, tone: 'ink', label: `${money(left)} left unbudgeted, stays in Spending` };
  return { left, tone: 'acc', label: `${money(-left)} over the pool` };
}

// ─── Draft lifecycle ─────────────────────────────────────────────────────────

/** A new draft prefilled from the latest paycheque (or empty if there is none). */
export function createDraft(data: MoneoData, today: ISODate): PaychequeDraft {
  const last = latestPaycheque(data.paycheques);
  const templates = [...data.templates].sort((a, b) => a.order - b.order);
  const template = templates.find((t) => t.id === last?.templateId) ?? templates[0];
  const budget = lastPlan(data);
  return {
    basedOn: last?.id,
    net: last?.net ?? 0,
    payDate: last ? nextPayDate(last.payDate, last.repeats) : today,
    source: last?.source ?? '',
    depositAccountId: last?.depositAccountId ?? splitAccounts(data.accounts)[0]?.id ?? '',
    repeats: last?.repeats ?? 'biweekly',
    note: '',
    gross: last?.gross ?? null,
    deductions: last?.deductions ?? [],
    templateId: template?.id ?? '',
    allocations: templateAllocations(template, data.accounts),
    budgetMode: 'copy',
    budget: budget.length ? budget : data.categories.map((c) => ({ categoryId: c.id, plan: 0 })),
    transfersDone: {},
    remind: true,
  };
}

/** How many of the last `n` paycheques had this net amount ("Same as last 5 of 6"). */
export function sameAmountCount(paycheques: Paycheque[], today: ISODate, net: Cents, n = 6) {
  const recent = pastPaycheques(paycheques, today).slice(-n);
  return { same: recent.filter((p) => p.net === net).length, of: recent.length };
}

export interface DraftErrors {
  net?: string;
  payDate?: string;
  split?: string;
}

export function validateDraft(d: PaychequeDraft): DraftErrors {
  const e: DraftErrors = {};
  if (!(d.net > 0)) e.net = 'Enter the amount that landed in your account';
  if (!d.payDate) e.payDate = 'Pick a pay date';
  if (leftToAllocate(d.net, Object.values(d.allocations)) < 0) e.split = 'The split is over the paycheque';
  return e;
}

/** First step with a blocking error, if any. */
export function firstInvalidStep(d: PaychequeDraft): WizardStep | undefined {
  const e = validateDraft(d);
  if (e.net || e.payDate) return 'details';
  if (e.split) return 'split';
  return undefined;
}

export interface PaychequeRecords {
  paycheque: Paycheque;
  allocations: Allocation[];
  budgetLines: BudgetLine[];
}

export function draftToRecords(d: PaychequeDraft, id = newId()): PaychequeRecords {
  const period = payPeriod(d.payDate, d.repeats);
  return {
    paycheque: {
      id,
      source: d.source.trim() || 'Paycheque',
      payDate: d.payDate,
      periodStart: period.start,
      periodEnd: period.end,
      net: d.net,
      gross: d.gross ?? undefined,
      deductions: d.gross ? d.deductions : undefined,
      depositAccountId: d.depositAccountId,
      repeats: d.repeats,
      note: d.note.trim() || undefined,
      templateId: d.templateId || undefined,
    },
    allocations: toAllocations(id, d.allocations),
    budgetLines: d.budget.filter((b) => b.plan > 0).map((b) => ({ paychequeId: id, categoryId: b.categoryId, plan: b.plan })),
  };
}

/** The previous paycheque's leftover, for the "Sep 26 left $320 unallocated" note. */
export function previousUnallocated(data: MoneoData, basedOn?: string) {
  const p = data.paycheques.find((x) => x.id === basedOn);
  if (!p) return undefined;
  return { paycheque: p, left: leftToAllocate(p.net, allocationsFor(data.allocations, p.id).map((a) => a.amount)) };
}
