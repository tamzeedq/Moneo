import type { ReactNode } from 'react';
import type { Tone } from '@/domain/wizard';

export const toneColor: Record<Tone, string> = { pos: 'var(--pos)', acc: 'var(--acc)', ink: 'var(--ink)', mute: 'var(--mute)' };

/** Sticky footer card: back/cancel on the left, status line and primary action(s) on the right. */
export function WizardFooter({ left, status, tone = 'mute', children }: { left: ReactNode; status?: ReactNode; tone?: Tone; children: ReactNode }) {
  return (
    <footer className="sticky bottom-[22px] z-10 mt-auto flex items-center justify-between gap-4 rounded-[16px] border border-line bg-panel px-[18px] py-3.5">
      {left}
      <div className="flex items-center gap-3.5">
        {status && (
          <span className="text-[12px]" style={{ color: toneColor[tone] }}>
            {status}
          </span>
        )}
        <div className="flex items-center gap-2.5">{children}</div>
      </div>
    </footer>
  );
}
