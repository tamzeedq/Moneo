import { useState } from 'react';
import { money } from '@/domain/money';
import type { Cents } from '@/domain/types';

interface Props {
  value: Cents;
  step: Cents;
  onChange: (v: Cents) => void;
  label: string;
}

/** − amount + control. Clicking the amount turns it into a numeric input for exact entry. Floor is $0. */
export function Stepper({ value, step, onChange, label }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const commit = () => {
    if (editing === null) return;
    const dollars = Number(editing.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(dollars)) onChange(Math.max(0, Math.round(dollars * 100)));
    setEditing(null);
  };
  const btnCls = 'w-7 flex-none py-[7px] text-center text-mute hover:text-ink disabled:opacity-40';
  return (
    <div className="flex items-center rounded-[10px] border border-line bg-bg" role="group" aria-label={label}>
      <button
        type="button"
        className={btnCls}
        aria-label={`Decrease ${label}`}
        disabled={value <= 0}
        onClick={() => onChange(Math.max(0, value - step))}
      >
        −
      </button>
      {editing === null ? (
        <button
          type="button"
          className="min-w-0 flex-1 text-center font-medium"
          title="Click to type an exact amount"
          onClick={() => setEditing((value / 100).toFixed(value % 100 ? 2 : 0))}
        >
          {money(value, { decimals: value % 100 ? 2 : 0 })}
        </button>
      ) : (
        <input
          autoFocus
          inputMode="decimal"
          aria-label={label}
          className="w-full min-w-0 flex-1 bg-transparent text-center font-medium outline-none"
          value={editing}
          onChange={(e) => setEditing(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(null);
          }}
        />
      )}
      <button type="button" className={btnCls} aria-label={`Increase ${label}`} onClick={() => onChange(value + step)}>
        +
      </button>
    </div>
  );
}
