import type { ISODate, MoneoData } from '@/domain/types';
import { money } from '@/domain/money';
import { shortDate } from '@/domain/dates';
import { paceFor, PERIOD_NOUN, previousWindows, type TimeWindow } from '@/domain/periods';
import { Card, CardHeader } from '@/components/ui/Card';
import { PaceChart } from '@/components/charts/PaceChart';

const COMPARE = 3;

export function SpendingPaceCard({ data, today, window: w }: { data: MoneoData; today: ISODate; window?: TimeWindow }) {
  if (!w) {
    return (
      <Card className="flex flex-col gap-2.5">
        <CardHeader title="Spending pace" />
        <div className="text-[13px] text-mute">Add a paycheque to track spending pace.</div>
      </Card>
    );
  }
  const pace = paceFor(data.transactions, w, previousWindows(w, COMPARE, data.paycheques, today));
  const noun = PERIOD_NOUN[w.kind];
  return (
    <Card className="flex flex-col gap-2.5">
      <CardHeader title="Spending pace" meta={pace.compared ? `vs. ${pace.compared}-${noun} avg` : `no earlier ${noun}s yet`} />
      <div className="flex items-baseline gap-2">
        <span className="text-[26px] font-medium tracking-[-0.04em]">{money(pace.spent)}</span>
        {w.current && pace.compared > 0 && (
          <span className="text-[12px] text-acc">on track for {money(pace.projected, { decimals: 0 })}</span>
        )}
        {!w.current && <span className="text-[12px] text-mute">spent in {w.label}</span>}
      </div>
      <PaceChart pace={pace} />
      <div className="flex justify-between text-[11px] text-faint">
        <span>{shortDate(w.start)}</span>
        {w.current && <span>Today</span>}
        <span>{shortDate(w.end)}</span>
      </div>
    </Card>
  );
}
