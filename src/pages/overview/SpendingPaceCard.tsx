import type { ISODate, MoneoData } from '@/domain/types';
import { money } from '@/domain/money';
import { addDaysISO, shortDate } from '@/domain/dates';
import { currentPaycheque, spendingPace } from '@/domain/selectors';
import { Card, CardHeader } from '@/components/ui/Card';
import { PaceChart } from '@/components/charts/PaceChart';

export function SpendingPaceCard({ data, today }: { data: MoneoData; today: ISODate }) {
  const pay = currentPaycheque(data.paycheques, today);
  const pace = spendingPace(data, today, 3);

  return (
    <Card className="flex flex-col gap-2.5">
      <CardHeader title="Spending pace" meta="vs. 3-paycheque avg" />
      {pace && pay ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-[26px] font-medium tracking-[-0.04em]">{money(pace.spent)}</span>
            <span className="text-[12px] text-acc">on track for {money(pace.projected, { decimals: 0 })}</span>
          </div>
          <PaceChart pace={pace} />
          <div className="flex justify-between text-[11px] text-faint">
            <span>{shortDate(pay.periodStart)}</span>
            <span>Today</span>
            <span>{shortDate(addDaysISO(pay.periodStart, pace.length - 1))}</span>
          </div>
        </>
      ) : (
        <div className="text-[13px] text-mute">Add a paycheque to track spending pace.</div>
      )}
    </Card>
  );
}
