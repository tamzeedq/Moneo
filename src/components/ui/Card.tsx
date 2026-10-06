import type { HTMLAttributes, ReactNode } from 'react';

/** Panel card: 18px radius, 1px line border, 18×20 padding. */
export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-[18px] border border-line bg-panel px-5 py-[18px] ${className}`} {...rest} />;
}

/** Card title row: 14/500 title on the left, 12px muted meta on the right. */
export function CardHeader({ title, meta, className = '' }: { title: ReactNode; meta?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <span className="text-[14px] font-medium">{title}</span>
      {meta && <span className="text-[12px] text-mute">{meta}</span>}
    </div>
  );
}
