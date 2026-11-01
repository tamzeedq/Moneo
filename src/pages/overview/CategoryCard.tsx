import type { ISODate, MoneoData } from '@/domain/types';
import { money, sum } from '@/domain/money';
import { spendByCategory } from '@/domain/selectors';
import { throughToday, type TimeWindow } from '@/domain/periods';
import { Card, CardHeader } from '@/components/ui/Card';
import { Swatch } from '@/components/ui/Avatar';
import { HalfRing } from '@/components/charts/HalfRing';

export function CategoryCard({ data, today, window: w }: { data: MoneoData; today: ISODate; window?: TimeWindow }) {
  const cats = w ? spendByCategory(data.transactions, data.categories, w.start, throughToday(w, today)) : [];
  const total = sum(cats.map((c) => c.spent));

  return (
    <Card className="flex flex-col gap-2.5">
      <CardHeader title="By category" meta={`${cats.length} categories`} />
      {cats.length === 0 && <div className="text-[13px] text-mute">No spending in this period yet.</div>}
      <HalfRing
        segments={cats.map((c) => ({ value: c.spent, color: c.category.color }))}
        center={<span className="text-[17px] font-medium tracking-[-0.03em]">{money(total)}</span>}
      />
      <div className="flex flex-col gap-[7px] text-[13px]">
        {cats.slice(0, 5).map((c) => (
          <div key={c.category.id} className="flex items-center gap-2">
            <Swatch color={c.category.color} round />
            {c.category.name}
            <span className="ml-auto">{money(c.spent)}</span>
            <span className="w-[34px] text-right text-mute">{Math.round(c.share * 100)}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
