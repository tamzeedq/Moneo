import type { ISODate, MoneoData } from '@/domain/types';
import { money } from '@/domain/money';
import { shortDate } from '@/domain/dates';
import { recentTransactions } from '@/domain/selectors';
import { Card, CardHeader } from '@/components/ui/Card';
import { InitialAvatar } from '@/components/ui/Avatar';

const cols = 'grid grid-cols-[minmax(0,1fr)_70px_82px] gap-2.5';
/** Avatar colour for income rows (the dark-theme `pos`, which reads in both themes). */
const INCOME = '#8fbf9f';

export function RecentTransactionsCard({ data, today }: { data: MoneoData; today: ISODate }) {
  const txs = recentTransactions(data.transactions, today, 6);
  const cats = new Map(data.categories.map((c) => [c.id, c]));
  const accts = new Map(data.accounts.map((a) => [a.id, a]));

  return (
    <Card className="flex flex-col">
      <CardHeader title="Recent transactions" meta="View all →" className="pb-2.5" />
      <div className={`${cols} rounded-[8px] bg-panel2 px-2.5 py-[7px] text-[11px] text-mute`}>
        <span>Merchant</span>
        <span>Account</span>
        <span className="text-right">Amount</span>
      </div>
      {txs.length === 0 && (
        <div className="px-2.5 py-6 text-center text-[13px] text-mute">No transactions yet. Add one or import a CSV.</div>
      )}
      {txs.map((t) => {
        const cat = t.categoryId ? cats.get(t.categoryId) : undefined;
        const income = t.amount > 0;
        return (
          <div key={t.id} className={`${cols} items-center border-b border-line px-2.5 py-2 text-[13px]`}>
            <div className="flex min-w-0 items-center gap-2.5">
              <InitialAvatar label={t.merchant} color={cat?.color ?? (income ? INCOME : 'var(--mute)')} />
              <div className="min-w-0">
                <div className="truncate font-medium">{t.merchant}</div>
                <div className="text-[11px] text-mute">
                  {cat?.name ?? (t.paychequeId ? 'Paycheque' : 'Uncategorised')} · {shortDate(t.date)}
                </div>
              </div>
            </div>
            <span className="truncate text-mute">{accts.get(t.accountId)?.name}</span>
            <span className="text-right font-medium" style={{ color: income ? 'var(--pos)' : undefined }}>
              {money(t.amount, { signed: true })}
            </span>
          </div>
        );
      })}
    </Card>
  );
}
