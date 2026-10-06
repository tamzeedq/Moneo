import { useRef } from 'react';
import type { Account, Cents } from '@/domain/types';
import { money, sum } from '@/domain/money';
import { moveDivider } from '@/domain/wizard';
import { TickBar } from '@/components/charts/TickBar';

interface Props {
  accounts: Account[];
  allocations: Record<string, Cents>;
  net: Cents;
  onChange: (a: Record<string, Cents>) => void;
  height?: number;
}

const SNAP = 1000; // $10

/**
 * 60-tick allocation bar with draggable dividers (from 3b). Each divider moves money between the two
 * accounts either side of it; the last one trades with the unallocated remainder. Arrow keys move $10.
 */
export function AllocationBar({ accounts, allocations, net, onChange, height = 34 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const order = accounts.map((a) => a.id);
  const amounts = order.map((id) => allocations[id] ?? 0);
  const total = Math.max(net, sum(amounts));
  const cumulative = amounts.map((_, i) => sum(amounts.slice(0, i + 1)));

  const setBoundary = (i: number, boundary: Cents) => {
    if (i < order.length - 1) return onChange(moveDivider(order, allocations, i, boundary, SNAP));
    const before = cumulative[i] - amounts[i];
    const snapped = Math.round(boundary / SNAP) * SNAP;
    onChange({ ...allocations, [order[i]]: Math.min(Math.max(snapped - before, 0), Math.max(net - before, 0)) });
  };

  const fromPointer = (i: number, clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    setBoundary(i, ((clientX - r.left) / r.width) * total);
  };

  return (
    <div ref={ref} className="relative">
      <TickBar total={total} height={height} segments={accounts.map((a, i) => ({ amount: amounts[i], color: a.color }))} />
      {cumulative.map((c, i) => (
        <div
          key={order[i]}
          role="slider"
          tabIndex={0}
          aria-label={`Divider after ${accounts[i].shortName ?? accounts[i].name}`}
          aria-valuemin={0}
          aria-valuemax={total / 100}
          aria-valuenow={c / 100}
          aria-valuetext={`${accounts[i].shortName ?? accounts[i].name} ${money(amounts[i], { decimals: 0 })}`}
          className="group absolute -top-1.5 -bottom-1.5 flex w-3 -translate-x-1/2 cursor-col-resize touch-none justify-center outline-none"
          style={{ left: `${(c / total) * 100}%` }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            e.currentTarget.focus();
          }}
          onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && fromPointer(i, e.clientX)}
          onKeyDown={(e) => {
            const d = e.key === 'ArrowRight' ? SNAP : e.key === 'ArrowLeft' ? -SNAP : 0;
            if (!d) return;
            e.preventDefault();
            setBoundary(i, c + d * (e.shiftKey ? 10 : 1));
          }}
        >
          <span className="h-full w-0.5 rounded-full bg-ink opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-100" />
        </div>
      ))}
    </div>
  );
}
