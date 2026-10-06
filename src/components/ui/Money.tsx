import { moneyParts } from '@/domain/money';
import type { Cents } from '@/domain/types';

/** Hero number with the cents in `faint`: $48,216<faint>.40</faint> */
export function HeroMoney({ cents, className = '' }: { cents: Cents; className?: string }) {
  const { whole, cents: c } = moneyParts(cents);
  return (
    <span className={className}>
      {whole}
      <span className="text-faint">{c}</span>
    </span>
  );
}
