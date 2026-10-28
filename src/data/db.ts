import Dexie, { type Table } from 'dexie';
import type {
  Account,
  Allocation,
  BalanceSnapshot,
  Bill,
  BudgetLine,
  Category,
  ChartDef,
  Goal,
  MoneoData,
  NetSnapshot,
  Paycheque,
  SplitTemplate,
  Transaction,
} from '@/domain/types';
import { buildSeed } from './seed';

export class MoneoDB extends Dexie {
  accounts!: Table<Account, string>;
  paycheques!: Table<Paycheque, string>;
  allocations!: Table<Allocation, [string, string]>;
  categories!: Table<Category, string>;
  budgetLines!: Table<BudgetLine, [string, string]>;
  transactions!: Table<Transaction, string>;
  goals!: Table<Goal, string>;
  templates!: Table<SplitTemplate, string>;
  bills!: Table<Bill, string>;
  balanceSnapshots!: Table<BalanceSnapshot, [string, string]>;
  netSnapshots!: Table<NetSnapshot, string>;
  charts!: Table<ChartDef, string>;

  constructor(name = 'moneo') {
    super(name);
    this.version(1).stores({
      accounts: 'id, order',
      paycheques: 'id, payDate',
      allocations: '[paychequeId+accountId], paychequeId',
      categories: 'id, order',
      budgetLines: '[paychequeId+categoryId], paychequeId',
      transactions: 'id, date, accountId, categoryId',
      goals: 'id, order',
      templates: 'id, order',
      bills: 'id, due',
      balanceSnapshots: '[accountId+date], accountId',
      netSnapshots: 'date',
      charts: 'id, status',
    });
    this.on('populate', (tx) => {
      const seed = buildSeed();
      for (const key of Object.keys(seed) as (keyof MoneoData)[]) {
        void tx.table(key).bulkAdd(seed[key] as unknown[]);
      }
    });
  }
}

export const db = new MoneoDB();
