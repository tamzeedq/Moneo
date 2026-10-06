import type { MoneoData } from '@/domain/types';
import { buildSeed, SEED_VERSION } from './seed';
import { db, type MoneoDB } from './db';

/**
 * The only way the UI touches storage. The Dexie implementation below is local-first;
 * swap in a Supabase/Postgres implementation later without changing callers.
 */
export interface Repository {
  loadAll(): Promise<MoneoData>;
  resetToSeed(): Promise<void>;
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
