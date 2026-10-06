import type { ISODate, MoneoData } from '@/domain/types';
import { money, sum } from '@/domain/money';
import { currentPaycheque, spendByCategory } from '@/domain/selectors';
import { Card, CardHeader } from '@/components/ui/Card';
import { Swatch } from '@/components/ui/Avatar';
import { HalfRing } from '@/components/charts/HalfRing';

export function CategoryCard({ data, today }: { data: MoneoData; today: ISODate }) {
  const pay = currentPaycheque(data.paycheques, today);
  const cats = pay ? spendByCategory(data.transactions, data.categories, pay.periodStart, today) : [];
  const total = sum(cats.map((c) => c.spent));

  return (
    <Card className="flex flex-col gap-2.5">
      <CardHeader title="By category" meta={`${cats.length} categories`} />
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
