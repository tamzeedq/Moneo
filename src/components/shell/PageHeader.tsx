import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  /** 12px breadcrumb above the title */
  crumb?: ReactNode;
  /** 13px line below the title */
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, crumb, subtitle, actions }: Props) {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        {crumb && <div className="mb-0.5 text-[12px] text-mute">{crumb}</div>}
        <h1 className="m-0 text-[22px] font-semibold tracking-[-0.025em]">{title}</h1>
        {subtitle && <div className="mt-0.5 text-[13px] text-mute">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
