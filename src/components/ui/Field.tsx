import type { ReactNode } from 'react';

/** 12px muted label above a control. */
export function Field({ label, children, className = '', htmlFor }: { label: ReactNode; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-[12px] text-mute">
        {label}
      </label>
      {children}
    </div>
  );
}
