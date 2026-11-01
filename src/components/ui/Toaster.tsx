import { useToasts } from '@/stores/toast';

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed right-6 bottom-28 z-50 flex flex-col items-end gap-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className="pointer-events-auto flex items-center gap-2.5 rounded-[12px] bg-inv px-4 py-3 text-[13px] text-inv-ink shadow-lg"
        >
          <span className="grid size-[18px] place-items-center rounded-full bg-pos text-[10px] font-semibold text-white">✓</span>
          {t.message}
        </button>
      ))}
    </div>
  );
}
