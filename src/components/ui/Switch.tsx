import * as RSwitch from '@radix-ui/react-switch';

/** 34×20 toggle: `acc` when on, `track` when off, 14px white knob. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <RSwitch.Root
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      className="relative h-5 w-[34px] flex-none rounded-full bg-track transition-colors duration-200 data-[state=checked]:bg-acc"
    >
      <RSwitch.Thumb className="block size-3.5 translate-x-[3px] rounded-full bg-white shadow-sm transition-transform duration-200 data-[state=checked]:translate-x-[17px]" />
    </RSwitch.Root>
  );
}
