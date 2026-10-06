/** Tinted initial avatar: palette colour at 20% alpha behind the initial in full colour. */
export function InitialAvatar({ label, color, size = 26 }: { label: string; color: string; size?: number }) {
  return (
    <span
      className="grid flex-none place-items-center rounded-[7px] text-[11px] font-semibold"
      style={{ width: size, height: size, color, background: `color-mix(in srgb, ${color} 20%, transparent)` }}
    >
      {label.charAt(0).toUpperCase()}
    </span>
  );
}

export const Swatch = ({ color, round = false, size = 8 }: { color: string; round?: boolean; size?: number }) => (
  <span className="flex-none" style={{ width: size, height: size, borderRadius: round ? '50%' : 2, background: color }} />
);
