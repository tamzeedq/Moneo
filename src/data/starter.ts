/**
 * Starting point for a real ("My data") workspace: default categories and a blank split template.
 * Accounts are chosen by the user on the welcome screen (see STARTER_ACCOUNTS).
 */
import type { Account, AccountKind, Category, MoneoData } from '@/domain/types';
import { newId } from '@/lib/id';

const CATEGORY_DEFAULTS: [name: string, color: string, fundedBy: AccountKind][] = [
  ['Housing', '#d9825f', 'chequing'],
  ['Groceries', '#d8b67a', 'spending'],
  ['Dining', '#8fae8f', 'spending'],
  ['Transport', '#7f95ab', 'spending'],
  ['Utilities', '#a88aa6', 'chequing'],
  ['Shopping', '#c99a8e', 'spending'],
  ['Health', '#a8a29a', 'spending'],
  ['Subscriptions', '#6f8f86', 'chequing'],
];

export function buildStarter(): MoneoData {
  return {
    accounts: [],
    paycheques: [],
    allocations: [],
    // fundedFrom is filled in once accounts exist (assignFunding).
    categories: CATEGORY_DEFAULTS.map(([name, color], order) => ({ id: newId(), name, color, fundedFrom: '', order })),
    budgetLines: [],
    transactions: [],
    goals: [],
    templates: [{ id: newId(), name: 'Start blank', description: 'Allocate from $0', amounts: {}, order: 99 }],
    bills: [],
    balanceSnapshots: [],
    netSnapshots: [],
    charts: [],
  };
}

export interface StarterAccount {
  kind: AccountKind;
  name: string;
  shortName?: string;
  purpose: string;
  color: string;
  /** Pre-ticked on the welcome screen. */
  suggested: boolean;
}

/** Offered on the welcome screen, in paycheque-split order. Credit cards aren't split targets. */
export const STARTER_ACCOUNTS: StarterAccount[] = [
  { kind: 'chequing', name: 'Chequing', purpose: 'Bills & fixed costs', color: 'var(--inv)', suggested: true },
  { kind: 'tfsa', name: 'TFSA', purpose: 'Investing', color: 'var(--acc)', suggested: true },
  { kind: 'spending', name: 'Spending', purpose: 'Day-to-day spending', color: '#d8b67a', suggested: true },
  { kind: 'emergency', name: 'Emergency fund', shortName: 'Emergency', purpose: 'Savings goal', color: '#8fae8f', suggested: true },
  { kind: 'rrsp', name: 'RRSP', purpose: 'Retirement', color: '#7f95ab', suggested: false },
  { kind: 'credit', name: 'Credit card', purpose: 'Credit card', color: '#a8a29a', suggested: false },
];

/** Accounts from the chosen starters. Balances in cents; credit card balances are stored as negative. */
export function starterAccounts(chosen: { starter: StarterAccount; balance: number }[], existing: Account[] = []): Account[] {
  let order = Math.max(-1, ...existing.map((a) => a.order));
  let split = Math.max(-1, ...existing.map((a) => a.splitOrder ?? -1));
  return chosen.map(({ starter: s, balance }) => ({
    id: newId(),
    name: s.name,
    shortName: s.shortName,
    purpose: s.purpose,
    kind: s.kind,
    color: s.color,
    balance: s.kind === 'credit' ? -Math.abs(balance) : balance,
    order: ++order,
    splitOrder: s.kind === 'credit' ? undefined : ++split,
  }));
}

/**
 * Points each category at the account that should fund it: bills come from Chequing,
 * day-to-day spending from Spending, falling back to whichever of the two exists.
 */
export function assignFunding(categories: Category[], accounts: Account[]): Category[] {
  const byKind = (k: AccountKind) => accounts.find((a) => a.kind === k)?.id;
  const chequing = byKind('chequing') ?? byKind('spending') ?? accounts[0]?.id ?? '';
  const spending = byKind('spending') ?? chequing;
  const fundedBy = new Map(CATEGORY_DEFAULTS.map(([name, , kind]) => [name, kind]));
  return categories.map((c) => {
    if (c.fundedFrom && accounts.some((a) => a.id === c.fundedFrom)) return c;
    return { ...c, fundedFrom: fundedBy.get(c.name) === 'chequing' ? chequing : spending };
  });
}
