import type { Account, BudgetLine, Category, Cents, ChartDef, ISODate, MoneoData, SplitTemplate, Transaction } from '@/domain/types';
import type { PaychequeRecords } from '@/domain/wizard';
import { SEED_VERSION } from './seed';
import { workspace } from './workspace';
import { reportError } from '@/lib/report';
import { db, type MoneoDB } from './db';

/**
 * The only way the UI touches storage. The Dexie implementation below is local-first;
 * swap in a Supabase/Postgres implementation later without changing callers.
 */
export interface Repository {
  loadAll(): Promise<MoneoData>;
  /** Restores the workspace's starting data (sample data in the demo, an empty workspace otherwise). */
  reset(): Promise<void>;
  /** Creates a paycheque with its allocations and budget lines, atomically. */
  savePaycheque(r: PaychequeRecords): Promise<void>;
  saveTemplate(t: SplitTemplate): Promise<void>;
  saveChart(c: ChartDef): Promise<void>;
  deleteChart(id: string): Promise<void>;
  /** Replaces a paycheque's allocations. */
  setAllocations(paychequeId: string, amounts: Record<string, Cents>): Promise<void>;
  /** Replaces a paycheque's budget lines. */
  setBudget(paychequeId: string, lines: Omit<BudgetLine, 'paychequeId'>[]): Promise<void>;
  /** Sets an account's balance and records it as today's snapshot (and today's net position). */
  updateBalance(accountId: string, balance: Cents, date: ISODate): Promise<void>;
  /** Adds accounts with an opening balance snapshot on `date`. */
  addAccounts(accounts: Account[], date: ISODate): Promise<void>;
  saveCategories(categories: Category[]): Promise<void>;
  /** Adds transactions; optionally moves each account's balance by their total (recorded as `date`). */
  addTransactions(txs: Transaction[], opts: { adjustBalances: boolean; date: ISODate }): Promise<void>;
  /** Replaces everything with the given data (backup restore). */
  replaceAll(data: MoneoData): Promise<void>;
}

export const TABLES: (keyof MoneoData)[] = [
  'accounts',
  'paycheques',
  'allocations',
  'categories',
  'budgetLines',
  'transactions',
  'goals',
  'templates',
  'bills',
  'balanceSnapshots',
  'netSnapshots',
  'charts',
];

export function dexieRepository(database: MoneoDB = db): Repository {
  return {
    async loadAll() {
      const entries = await Promise.all(TABLES.map(async (t) => [t, await database.table(t).toArray()] as const));
      return Object.fromEntries(entries) as unknown as MoneoData;
    },
    async savePaycheque(r) {
      await database.transaction('rw', database.paycheques, database.allocations, database.budgetLines, async () => {
        await database.paycheques.add(r.paycheque);
        await database.allocations.bulkAdd(r.allocations);
        await database.budgetLines.bulkAdd(r.budgetLines);
      });
    },
    async saveTemplate(t) {
      await database.templates.put(t);
    },
    async saveChart(c) {
      await database.charts.put(c);
    },
    async deleteChart(id) {
      await database.charts.delete(id);
    },
    async setAllocations(paychequeId, amounts) {
      await database.transaction('rw', database.allocations, async () => {
        await database.allocations.where('paychequeId').equals(paychequeId).delete();
        await database.allocations.bulkAdd(
          Object.entries(amounts)
            .filter(([, amount]) => amount > 0)
            .map(([accountId, amount]) => ({ paychequeId, accountId, amount })),
        );
      });
    },
    async setBudget(paychequeId, lines) {
      await database.transaction('rw', database.budgetLines, async () => {
        await database.budgetLines.where('paychequeId').equals(paychequeId).delete();
        await database.budgetLines.bulkAdd(lines.filter((l) => l.plan > 0).map((l) => ({ ...l, paychequeId })));
      });
    },
    async updateBalance(accountId, balance, date) {
      await database.transaction('rw', database.accounts, database.balanceSnapshots, database.netSnapshots, async () => {
        await database.accounts.update(accountId, { balance });
        await database.balanceSnapshots.put({ accountId, date, balance });
        const all = await database.accounts.toArray();
        await database.netSnapshots.put({ date, value: all.reduce((t, a) => t + a.balance, 0) });
      });
    },
    async addAccounts(accounts, date) {
      await database.transaction('rw', database.accounts, database.balanceSnapshots, database.netSnapshots, async () => {
        await database.accounts.bulkAdd(accounts);
        await database.balanceSnapshots.bulkPut(accounts.map((a) => ({ accountId: a.id, date, balance: a.balance })));
        const all = await database.accounts.toArray();
        await database.netSnapshots.put({ date, value: all.reduce((t, x) => t + x.balance, 0) });
      });
    },
    async addTransactions(txs, { adjustBalances, date }) {
      await database.transaction(
        'rw',
        [database.transactions, database.accounts, database.balanceSnapshots, database.netSnapshots],
        async () => {
          await database.transactions.bulkAdd(txs);
          if (!adjustBalances) return;
          const byAccount = new Map<string, Cents>();
          for (const t of txs) byAccount.set(t.accountId, (byAccount.get(t.accountId) ?? 0) + t.amount);
          for (const [accountId, delta] of byAccount) {
            const a = await database.accounts.get(accountId);
            if (!a) continue;
            await database.accounts.update(accountId, { balance: a.balance + delta });
            await database.balanceSnapshots.put({ accountId, date, balance: a.balance + delta });
          }
          const all = await database.accounts.toArray();
          await database.netSnapshots.put({ date, value: all.reduce((t, x) => t + x.balance, 0) });
        },
      );
    },
    async replaceAll(data) {
      await database.transaction(
        'rw',
        TABLES.map((t) => database.table(t)),
        async () => {
          for (const t of TABLES) {
            await database.table(t).clear();
            await database.table(t).bulkAdd((data[t] ?? []) as unknown[]);
          }
        },
      );
    },
    async saveCategories(categories) {
      await database.categories.bulkPut(categories);
    },
    async reset() {
      await this.replaceAll(workspace.initial());
    },
  };
}

export const repo = dexieRepository();

const SEED_KEY = 'moneo-seed-version';

/** Demo workspace only: reseed when the bundled sample data has changed. Real data is never touched. */
export async function ensureSeedVersion(r: Repository = repo) {
  if (workspace.id !== 'demo') return;
  try {
    if (localStorage.getItem(SEED_KEY) === String(SEED_VERSION)) return;
    await r.reset();
    localStorage.setItem(SEED_KEY, String(SEED_VERSION));
  } catch (e) {
    reportError(e, { action: 'ensureSeedVersion' });
  }
}
