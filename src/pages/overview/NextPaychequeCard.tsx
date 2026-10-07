import { Link } from 'react-router-dom';
import type { ISODate, MoneoData } from '@/domain/types';
import { money } from '@/domain/money';
import { dayShortDate } from '@/domain/dates';
import { currentPaycheque, periodInfo } from '@/domain/selectors';
import { useDialogs } from '@/stores/ui';

const invCard = 'flex flex-col gap-2.5 rounded-[18px] bg-inv px-5 py-[18px] text-inv-ink';
const accButton = 'rounded-[9px] bg-acc px-2.5 py-1.5 text-[12px] font-medium text-white';

/** Dark card forecasting the next paycheque from the latest one's repeat rule. */
export function NextPaychequeCard({ data, today }: { data: MoneoData; today: ISODate }) {
  const pay = currentPaycheque(data.paycheques, today);

  if (!pay) {
    return (
      <div className={invCard}>
        <div className="text-[12px] text-inv-mute">Next paycheque</div>
        <div className="text-[22px] font-medium tracking-[-0.03em]">Add your first paycheque</div>
        <div className="flex items-center justify-between text-[12px] text-inv-mute">
          <span>Split it across your accounts</span>
          <Link to="/paycheques/new/details" className={accButton}>Start →</Link>
        </div>
      </div>
    );
  }

  const info = periodInfo(pay, today);
  const days = info.daysUntilNext;
  const planned = data.paycheques.find((p) => p.payDate === info.nextPayDate);
  return (
    <div className={invCard}>
      <div className="flex justify-between text-[12px] text-inv-mute">
        <span>Next paycheque</span>
        <span>{days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}</span>
      </div>
      <div className="text-[28px] font-medium tracking-[-0.04em]">{money(planned?.net ?? pay.net)}</div>
      <div className="flex h-[5px] gap-[3px] overflow-hidden rounded-[3px]" aria-label={`Day ${info.elapsed} of ${info.length}`}>
        <div className="bg-acc" style={{ flex: info.elapsed }} />
        <div className="bg-inv-track" style={{ flex: info.length - info.elapsed }} />
      </div>
      <div className="flex items-center justify-between text-[12px] text-inv-mute">
        <span>
          {dayShortDate(info.nextPayDate)} · {planned?.source ?? pay.source}
        </span>
        {planned ? (
          <span className="rounded-[9px] px-2.5 py-1.5 text-[12px] font-medium text-inv-ink">Planned ✓</span>
        ) : (
          <Link to="/paycheques/new/details" className={accButton}>Plan →</Link>
        )}
      </div>
    </div>
  );
}

const action = 'rounded-[12px] border border-line bg-panel px-3 py-[11px] text-left hover:border-faint';

export function QuickActions() {
  const openDialog = useDialogs((s) => s.open);
  return (
    <div className="grid grid-cols-2 gap-2 text-[12px]">
      <button type="button" className={action} onClick={() => openDialog('transaction')}>+ Transaction</button>
      <Link to="/accounts?update=chequing" className={action}>Update balance</Link>
      <Link to="/import" className={action}>Import CSV</Link>
      <Link to="/charts/new" className={action}>New chart</Link>
    </div>
  );
}
