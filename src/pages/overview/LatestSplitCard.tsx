import { Link } from 'react-router-dom';
import type { ISODate, MoneoData } from '@/domain/types';
import { money } from '@/domain/money';
import { shortDate } from '@/domain/dates';
import { currentPaycheque, splitRows } from '@/domain/selectors';
import { Card, CardHeader } from '@/components/ui/Card';
import { Swatch } from '@/components/ui/Avatar';
import { TickBar } from '@/components/charts/TickBar';

export function LatestSplitCard({ data, today }: { data: MoneoData; today: ISODate }) {
  const pay = currentPaycheque(data.paycheques, today);
  if (!pay) {
    return (
      <Card className="flex flex-col gap-3">
        <CardHeader title="Latest paycheque" />
        <div className="text-[13px] text-mute">No paycheques yet.</div>
      </Card>
    );
  }

  const rows = splitRows(pay, data.allocations, data.accounts);
  const unallocated = rows.find((r) => r.accountId === null)?.amount ?? 0;

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader
        title={`${shortDate(pay.payDate)} paycheque`}
        meta={
          unallocated > 0 ? (
            <span className="font-medium text-acc">{money(unallocated, { decimals: 0 })} unallocated</span>
          ) : (
            <span className="font-medium text-pos">Every dollar has a job</span>
          )
        }
      />
      <TickBar total={pay.net} segments={rows.filter((r) => r.accountId !== null).map((r) => ({ amount: r.amount, color: r.color }))} />
      <div className="flex flex-col rounded-[12px] border border-line px-3 py-0.5">
        {rows.map((r) => (
          <div
            key={r.accountId ?? 'unallocated'}
            className="flex items-center gap-2 py-[7px] text-[13px]"
            style={{ color: r.accountId === null ? 'var(--acc)' : undefined }}
          >
            <Swatch color={r.color} />
            {r.name}
            <span className="ml-auto">{money(r.amount)}</span>
            <span className="w-[34px] text-right text-mute">{Math.round(r.share * 100)}%</span>
          </div>
        ))}
      </div>
      {unallocated > 0 && (
        <Link
          to={`/paycheques?id=${pay.id}`}
          className="rounded-[10px] border border-acc p-2 text-center text-[12px] font-medium text-acc hover:bg-[color-mix(in_srgb,var(--acc)_8%,transparent)]"
        >
          Finish allocating
        </Link>
      )}
    </Card>
  );
}
