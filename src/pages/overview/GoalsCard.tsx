import type { MoneoData } from '@/domain/types';
import { money } from '@/domain/money';
import { goalNote } from '@/domain/selectors';
import { Card, CardHeader } from '@/components/ui/Card';

export function GoalsCard({ data }: { data: MoneoData }) {
  const goals = [...data.goals].sort((a, b) => a.order - b.order);
  return (
    <Card className="flex flex-col gap-3.5">
      <CardHeader title="Goals" meta="+ Add goal" />
      {goals.length === 0 && <div className="text-[13px] text-mute">No goals yet.</div>}
      {goals.map((g) => (
        <div key={g.id} className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-2 text-[13px]">
            <span className="font-medium">{g.name}</span>
            <span className="whitespace-nowrap">
              {money(g.current, { decimals: 0 })} <span className="text-faint">/ {money(g.target, { decimals: 0 })}</span>
            </span>
          </div>
          <div className="h-[7px] rounded-[4px] bg-track">
            <div className="h-full rounded-[4px]" style={{ width: `${Math.min(g.current / g.target, 1) * 100}%`, background: g.color }} />
          </div>
          <div className="text-[11px] text-mute">{goalNote(g)}</div>
        </div>
      ))}
    </Card>
  );
}
