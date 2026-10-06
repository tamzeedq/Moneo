import type { ChartDef } from '@/domain/types';
import { KIND_LABELS, QUESTIONS, rangeLabel } from '@/domain/charts';

export const toneVar = { pos: 'var(--pos)', acc: 'var(--acc)', mute: 'var(--mute)' } as const;

export function chartSub(def: ChartDef) {
  return `${KIND_LABELS[def.kind]} · ${rangeLabel(def)}`;
}

export function StatusBadge({ status }: { status: ChartDef['status'] }) {
  const pinned = status === 'pinned';
  return (
    <span
      className={`flex-none rounded-[6px] px-2 py-[3px] text-[11px] ${pinned ? 'text-acc' : 'bg-panel2 text-mute'}`}
      style={pinned ? { background: 'color-mix(in srgb, var(--acc) 13%, transparent)' } : undefined}
    >
      {status === 'pinned' ? 'Pinned' : status === 'draft' ? 'Draft' : 'Saved'}
    </span>
  );
}

export const newChartId = () => 'c-' + Date.now().toString(36);

export function QuestionList({ selected, onPick }: { selected?: string; onPick: (id: string) => void }) {
  return (
    <div role="listbox" aria-label="Questions" className="flex flex-col gap-2">
      {QUESTIONS.map((q, i) => {
        const on = q.id === selected;
        return (
          <button
            key={q.id}
            type="button"
            role="option"
            aria-selected={on}
            onClick={() => onPick(q.id)}
            className={`flex items-center gap-3 rounded-[14px] border px-3.5 py-[13px] text-left ${on ? 'border-acc bg-panel' : 'border-line hover:border-faint'}`}
          >
            <span className={`grid size-8 flex-none place-items-center rounded-[9px] text-[12px] font-semibold ${on ? 'bg-acc text-white' : 'bg-panel2 text-mute'}`}>{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium">{q.question}</span>
              <span className="mt-0.5 block text-[12px] text-mute">{q.sub}</span>
            </span>
            <span className={on ? 'text-acc' : 'text-faint'}>→</span>
          </button>
        );
      })}
    </div>
  );
}

