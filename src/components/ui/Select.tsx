import * as RSelect from '@radix-ui/react-select';
import type { ReactNode } from 'react';

export interface SelectOption {
  value: string;
  label: ReactNode;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  label: string;
  id?: string;
  className?: string;
}

/** Field-styled select with the design's ▾ glyph. */
export function Select({ value, onChange, options, label, id, className = '' }: Props) {
  return (
    <RSelect.Root value={value} onValueChange={onChange}>
      <RSelect.Trigger
        id={id}
        aria-label={label}
        className={`flex w-full items-center justify-between gap-2 rounded-[10px] border border-line bg-bg px-3 py-2.5 text-left text-[14px] outline-none focus-visible:border-acc ${className}`}
      >
        <RSelect.Value />
        <RSelect.Icon className="text-[11px] text-faint">▾</RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[12px] border border-line bg-panel p-1 text-[13px] text-ink shadow-lg"
        >
          <RSelect.Viewport>
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={o.value}
                className="flex cursor-pointer items-center rounded-[8px] px-2.5 py-2 outline-none data-[highlighted]:bg-panel2 data-[state=checked]:font-medium"
              >
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
