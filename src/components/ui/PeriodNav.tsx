/** ‹ label › navigator used by Paycheques and Budget. */
export function PeriodNav({ label, onPrev, onNext }: { label: string; onPrev?: () => void; onNext?: () => void }) {
  const arrow = 'grid size-7 place-items-center rounded-[8px] text-mute hover:bg-panel2 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <div className="flex items-center gap-1 text-[13px]">
      <button type="button" className={arrow} onClick={onPrev} disabled={!onPrev} aria-label="Previous">‹</button>
      <span className="min-w-[132px] text-center font-medium">{label}</span>
      <button type="button" className={arrow} onClick={onNext} disabled={!onNext} aria-label="Next">›</button>
    </div>
  );
}
