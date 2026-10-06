import { Link } from 'react-router-dom';
import type { ISODate, MoneoData } from '@/domain/types';
import { money } from '@/domain/money';
import { accountDelta, currentPaycheque, snapshotsFor } from '@/domain/selectors';
import { Card, CardHeader } from '@/components/ui/Card';
import { Swatch } from '@/components/ui/Avatar';
import { Sparkline } from '@/components/charts/Sparkline';

export function AccountsCard({ data, today }: { data: MoneoData; today: ISODate }) {
  const pay = currentPaycheque(data.paycheques, today);
  const accounts = [...data.accounts].sort((a, b) => a.order - b.order);

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader
        title="Accounts"
        meta={
          <Link to="/accounts" className="hover:text-ink">
            {accounts.length} accounts · View all →
          </Link>
        }
      />
      <div className="grid grid-cols-3 gap-2.5 max-md:grid-cols-2">
        {accounts.map((a) => {
          const delta = pay ? accountDelta(a, data.balanceSnapshots, pay.periodStart) : 0;
          const color = delta >= 0 ? 'var(--pos)' : 'var(--acc)';
          const series = snapshotsFor(data.balanceSnapshots, a.id).filter((s) => s.date <= today).map((s) => s.balance);
          return (
            <div key={a.id} className="flex flex-col gap-2 rounded-[14px] border border-line px-3.5 py-3">
              <div className="flex items-center gap-2 text-[13px]">
                <Swatch color={a.color} />
                <span className="font-medium">{a.name}</span>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[18px] font-medium tracking-[-0.03em]">{money(a.balance)}</div>
                  <div className="mt-0.5 text-[12px]" style={{ color }}>
                    {money(delta, { signed: true })}
                  </div>
                </div>
                <Sparkline values={series} color={color} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
