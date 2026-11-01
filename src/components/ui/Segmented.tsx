import * as ToggleGroup from '@radix-ui/react-toggle-group';

interface Props<T extends string> {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  label: string;
  /** 'seg': grey track with raised active pill (header). 'plain': no track, panel2 active (chart range). */
  variant?: 'seg' | 'plain';
  className?: string;
}

export function Segmented<T extends string>({ value, options, onChange, label, variant = 'seg', className = '' }: Props<T>) {
  const seg = variant === 'seg';
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      className={
        seg ? `flex gap-0.5 rounded-[11px] bg-seg p-[3px] text-[12px] ${className}` : `flex gap-0.5 text-[11px] text-mute ${className}`
      }
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o}
          value={o}
          className={
            seg
              ? 'rounded-[8px] px-2.5 py-1.5 text-mute data-[state=on]:bg-nav-on data-[state=on]:font-medium data-[state=on]:text-ink data-[state=on]:shadow-tok'
              : 'rounded-[7px] px-2 py-1 data-[state=on]:bg-panel2 data-[state=on]:font-medium data-[state=on]:text-ink'
          }
        >
          {o}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
