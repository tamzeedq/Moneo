/** Pure view models for the Paycheques, Budget and Accounts screens. */
import type { Account, Cents, ISODate, MoneoData, Paycheque } from './types';
import { addDaysISO } from './dates';
import { money, sum } from './money';
import { allocationsFor, budgetWatch, leftToAllocate, periodInfo, snapshotsFor, spentBetween } from './selectors';
import { spendingPace } from './periods';
import type { Tone } from './wizard';

// ─── Paycheques ──────────────────────────────────────────────────────────────

export const byPayDateDesc = (paycheques: Paycheque[]) => [...paycheques].sort((a, b) => b.payDate.localeCompare(a.payDate));

export interface HistoryRow {
  paycheque: Paycheque;
  status: string;
  tone: Tone;
}

/** Paycheque history with a status line: upcoming / unallocated / fully allocated (+ note). */
export function paychequeHistory(data: MoneoData, today: ISODate): HistoryRow[] {
  const templates = new Map(data.templates.map((t) => [t.id, t.name]));
  return byPayDateDesc(data.paycheques).map((p) => {
    const left = leftToAllocate(
      p.net,
      allocationsFor(data.allocations, p.id).map((a) => a.amount),
    );
    const note = p.note ? ` · ${p.note.charAt(0).toLowerCase()}${p.note.slice(1)}` : '';
    if (p.payDate > today) {
      const t = p.templateId && templates.get(p.templateId);
      return { paycheque: p, status: `Upcoming${t ? ` · ${t}` : ''}`, tone: 'mute' };
    }
    if (left > 0) return { paycheque: p, status: `${money(left)} unallocated${note}`, tone: 'acc' };
    if (left < 0) return { paycheque: p, status: `${money(-left)} over-allocated${note}`, tone: 'acc' };
    return { paycheque: p, status: `Fully allocated${note}`, tone: 'pos' };
  });
}

/** Allocation amounts for a paycheque keyed by account (0 for split accounts it didn't fund). */
export function allocationMap(data: MoneoData, paychequeId: string): Record<string, Cents> {
  const out: Record<string, Cents> = {};
  for (const a of data.accounts) if (a.splitOrder !== undefined) out[a.id] = 0;
  for (const a of allocationsFor(data.allocations, paychequeId)) out[a.accountId] = (out[a.accountId] ?? 0) + a.amount;
  return out;
}

export const sameAllocations = (a: Record<string, Cents>, b: Record<string, Cents>) =>
  Object.keys({ ...a, ...b }).every((k) => (a[k] ?? 0) === (b[k] ?? 0));

// ─── Budget ──────────────────────────────────────────────────────────────────

export interface BudgetSummary {
  plan: Cents;
  spent: Cents;
  used: number;
  left: Cents;
  daysLeft: number;
  length: number;
  /** Where you should be by today (0–1); 1 for finished periods. */
  pace: number;
  projected: Cents;
  state: 'past' | 'current' | 'future';
}

export function budgetSummary(data: MoneoData, p: Paycheque, today: ISODate): BudgetSummary {
  const plan = sum(data.budgetLines.filter((l) => l.paychequeId === p.id).map((l) => l.plan));
  const spent = spentBetween(data.transactions, p.periodStart, p.periodEnd);
  const info = periodInfo(p, today);
  const state = p.periodEnd < today ? 'past' : p.periodStart > today ? 'future' : 'current';
  const pace = state === 'past' ? 1 : state === 'future' ? 0 : info.fraction;
  const current = state === 'current' ? spendingPace(data, today) : undefined;
  return {
    plan,
    spent,
    used: plan ? spent / plan : 0,
    left: plan - spent,
    daysLeft: state === 'past' ? 0 : state === 'future' ? info.length : info.length - info.elapsed,
    length: info.length,
    pace,
    projected: state === 'current' && current ? current.projected : state === 'future' ? plan : spent,
    state,
  };
}

export interface AttentionRow {
  name: string;
  note: string;
  tone: Tone;
}

/** Categories at 85%+ of plan, most used first (max 4). */
export function needsAttention(data: MoneoData, p: Paycheque): AttentionRow[] {
  return budgetWatch(data.budgetLines, data.categories, data.transactions, p)
    .filter((r) => r.used >= 0.85)
    .slice(0, 4)
    .map((r) =>
      r.remaining < 0
        ? { name: r.category.name, note: `${money(-r.remaining)} over plan`, tone: 'acc' as const }
        : { name: r.category.name, note: `${Math.round(r.used * 100)}% used · ${money(r.remaining)} left`, tone: 'mute' as const },
    );
}

/** Paycheques that have a budget, oldest first, for the period navigator. */
export const budgetedPaycheques = (data: MoneoData) =>
  [...data.paycheques]
    .filter((p) => data.budgetLines.some((l) => l.paychequeId === p.id))
    .sort((a, b) => a.payDate.localeCompare(b.payDate));

// ─── Accounts ────────────────────────────────────────────────────────────────

export function composition(accounts: Account[]) {
  const assets = accounts.filter((a) => a.balance > 0);
  const liabilities = accounts.filter((a) => a.balance < 0);
  return {
    assets: sum(assets.map((a) => a.balance)),
    liabilities: sum(liabilities.map((a) => a.balance)),
    segments: [...assets, ...liabilities].map((a) => ({ id: a.id, color: a.color, value: Math.abs(a.balance) })),
  };
}

export interface ActivityRow {
  date: ISODate;
  label: string;
  amount: Cents;
}

/** Transactions on the account plus paycheque allocations into it, newest first. */
export function accountActivity(data: MoneoData, accountId: string, today: ISODate, n = 6): ActivityRow[] {
  const rows: ActivityRow[] = data.transactions
    .filter((t) => t.accountId === accountId && t.date <= today)
    .map((t) => ({ date: t.date, label: t.paychequeId ? `Paycheque · ${t.merchant}` : t.merchant, amount: t.amount }));
  for (const p of data.paycheques) {
    if (p.payDate > today || p.depositAccountId === accountId) continue;
    const amount = sum(
      allocationsFor(data.allocations, p.id)
        .filter((a) => a.accountId === accountId)
        .map((a) => a.amount),
    );
    if (amount) rows.push({ date: p.payDate, label: 'Paycheque allocation', amount });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.label.localeCompare(b.label)).slice(0, n);
}

export type BalanceRange = '1M' | '6M' | '1Y' | 'All';

export function balanceHistory(data: MoneoData, accountId: string, range: BalanceRange, today: ISODate) {
  const all = snapshotsFor(data.balanceSnapshots, accountId).filter((s) => s.date <= today);
  const days = { '1M': 31, '6M': 183, '1Y': 365, All: Infinity }[range];
  return days === Infinity ? all : all.filter((s) => s.date >= addDaysISO(today, -days));
}
