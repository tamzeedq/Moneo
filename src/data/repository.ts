import type { ChartDef, MoneoData, SplitTemplate } from '@/domain/types';
import type { PaychequeRecords } from '@/domain/wizard';
import { buildSeed, SEED_VERSION } from './seed';
import { db, type MoneoDB } from './db';

/**
 * The only way the UI touches storage. The Dexie implementation below is local-first;
 * swap in a Supabase/Postgres implementation later without changing callers.
 */
export interface Repository {
  loadAll(): Promise<MoneoData>;
  resetToSeed(): Promise<void>;
  /** Creates a paycheque with its allocations and budget lines, atomically. */
  savePaycheque(r: PaychequeRecords): Promise<void>;
  saveTemplate(t: SplitTemplate): Promise<void>;
  saveChart(c: ChartDef): Promise<void>;
  deleteChart(id: string): Promise<void>;
}

const TABLES: (keyof MoneoData)[] = [
  'accounts', 'paycheques', 'allocations', 'categories', 'budgetLines', 'transactions',
  'goals', 'templates', 'bills', 'balanceSnapshots', 'netSnapshots', 'charts',
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
    async resetToSeed() {
      const seed = buildSeed();
      await database.transaction('rw', TABLES.map((t) => database.table(t)), async () => {
        for (const t of TABLES) {
          await database.table(t).clear();
          await database.table(t).bulkAdd(seed[t] as unknown[]);
        }
      });
    },
  };
}

export const repo = dexieRepository();

const SEED_KEY = 'moneo-seed-version';

/** POC helper: reseed the local database when the bundled seed has changed. */
export async function ensureSeedVersion(r: Repository = repo) {
  try {
    if (localStorage.getItem(SEED_KEY) === String(SEED_VERSION)) return;
    await r.resetToSeed();
    localStorage.setItem(SEED_KEY, String(SEED_VERSION));
  } catch (e) {
    console.warn('Could not check seed version', e);
  }
}
