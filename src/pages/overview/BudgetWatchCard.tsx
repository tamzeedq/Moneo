import type { ISODate, MoneoData } from '@/domain/types';
import { money } from '@/domain/money';
import { budgetWatch, currentPaycheque, periodInfo } from '@/domain/selectors';
import { Card, CardHeader } from '@/components/ui/Card';

export function BudgetWatchCard({ data, today }: { data: MoneoData; today: ISODate }) {
  const pay = currentPaycheque(data.paycheques, today);
  const info = pay && periodInfo(pay, today);
  const rows = pay ? budgetWatch(data.budgetLines, data.categories, data.transactions, pay).slice(0, 4) : [];

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader title="Budget watch" meta={info && `${info.daysUntilNext} days left`} />
      {rows.map((r) => {
        const over = r.remaining < 0;
        const tone = over ? 'var(--acc)' : 'var(--mute)';
        return (
          <div key={r.category.id} className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[13px]">
              <span>{r.category.name}</span>
              <span style={{ color: tone }}>{Math.round(r.used * 100)}%</span>
            </div>
            <div className="relative h-[7px] rounded-[4px] bg-track">
              <div
                className="h-full rounded-[4px]"
                style={{ width: `${Math.min(r.used, 1) * 100}%`, background: over ? 'var(--acc)' : r.category.color }}
              />
              {info && (
                <div
                  className="absolute -top-[3px] -bottom-[3px] w-0.5 bg-ink opacity-50"
                  style={{ left: `${info.fraction * 100}%` }}
                  title="Where you should be by today"
                />
              )}
            </div>
            <div className="flex justify-between text-[11px] text-mute">
              <span>
                {money(r.spent)} of {money(r.plan, { decimals: 0 })}
              </span>
              <span style={{ color: tone }}>{over ? `${money(-r.remaining)} over` : money(r.remaining)}</span>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
