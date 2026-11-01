/** Integer cents. Never store floats for money. */
export type Cents = number;
/** ISO calendar date, `yyyy-MM-dd`. */
export type ISODate = string;

export type AccountKind = 'chequing' | 'tfsa' | 'spending' | 'emergency' | 'rrsp' | 'credit';

export interface Account {
  id: string;
  name: string;
  /** Shorter label used in split tables ("Emergency" vs "Emergency fund"). */
  shortName?: string;
  /** What the account is for, shown under its name in split tables. */
  purpose?: string;
  kind: AccountKind;
  institution?: string;
  /** Any CSS colour, including token references like `var(--acc)`. */
  color: string;
  balance: Cents;
  /** Display order on the Overview / Accounts screens. */
  order: number;
  /** Position in a paycheque split. Undefined = not a split target (e.g. credit cards). */
  splitOrder?: number;
}

export type Repeats = 'biweekly' | 'semimonthly' | 'monthly' | 'once';

export interface Paycheque {
  id: string;
  source: string;
  payDate: ISODate;
  periodStart: ISODate;
  periodEnd: ISODate;
  net: Cents;
  gross?: Cents;
  deductions?: { label: string; amount: Cents }[];
  depositAccountId: string;
  repeats: Repeats;
  note?: string;
  templateId?: string;
}

export interface Allocation {
  paychequeId: string;
  accountId: string;
  amount: Cents;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  /** accountId the category is funded from */
  fundedFrom: string;
  order: number;
}

export interface BudgetLine {
  paychequeId: string;
  categoryId: string;
  plan: Cents;
}

export interface Transaction {
  id: string;
  date: ISODate;
  merchant: string;
  categoryId?: string;
  accountId: string;
  /** Negative = money out, positive = money in. */
  amount: Cents;
  /** Set when the transaction is a paycheque deposit. */
  paychequeId?: string;
}

export interface Goal {
  id: string;
  name: string;
  target: Cents;
  current: Cents;
  accountId?: string;
  color: string;
  due?: ISODate;
  /** 'room' goals track contribution room (e.g. TFSA) rather than a balance to reach. */
  kind?: 'balance' | 'room';
  /** Typical contribution per paycheque, used for "About N paycheques to go". */
  contributionPerPaycheque?: Cents;
  order: number;
}

export interface SplitTemplate {
  id: string;
  name: string;
  description: string;
  amounts: Record<string, Cents>;
  order: number;
}

export interface Bill {
  id: string;
  name: string;
  amount: Cents;
  due: ISODate;
  accountId: string;
}

export interface BalanceSnapshot {
  accountId: string;
  date: ISODate;
  balance: Cents;
}

export interface NetSnapshot {
  date: ISODate;
  value: Cents;
}

export type ChartMeasure = 'savingsRate' | 'spending' | 'netPosition' | 'allocation' | 'merchantSpend' | 'categoryVsPlan';
export type ChartBucket = 'paycheque' | 'week' | 'month';
export type ChartKind = 'line' | 'area' | 'bars' | 'stackedBars' | 'barsVsPlan' | 'allocationTicks' | 'ranked';
export type PinSize = 'S' | 'M' | 'L';

export interface ChartDef {
  id: string;
  title: string;
  question?: string;
  measure: ChartMeasure;
  bucket: ChartBucket;
  /** Number of buckets (paycheques / weeks / months); days for merchant rankings. */
  range: number;
  kind: ChartKind;
  color: string;
  /** Category for categoryVsPlan / merchantSpend. */
  categoryId?: string;
  /** Savings rate can be shown as a percent of net pay or as dollars saved. */
  yAxis?: 'percent' | 'dollars';
  /** In the series' unit: percentage points, or cents. */
  target?: number;
  showTarget: boolean;
  showNotes: boolean;
  notes: { date: ISODate; label: string }[];
  status: 'draft' | 'saved' | 'pinned';
  /** `after` is an Overview card id (see pages/overview/layout.ts). */
  pin?: {
    size: PinSize;
    after: string;
    alsoOn?: string[];
    /** When it was first pinned; keeps Overview order stable. */ pinnedAt?: string;
  };
  editedAt: ISODate;
}

/** Everything the UI reads, loaded in one go from the repository. */
export interface MoneoData {
  accounts: Account[];
  paycheques: Paycheque[];
  allocations: Allocation[];
  categories: Category[];
  budgetLines: BudgetLine[];
  transactions: Transaction[];
  goals: Goal[];
  templates: SplitTemplate[];
  bills: Bill[];
  balanceSnapshots: BalanceSnapshot[];
  netSnapshots: NetSnapshot[];
  charts: ChartDef[];
}
