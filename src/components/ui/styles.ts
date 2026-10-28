/** Shared class strings for the design's buttons, chips and inputs. */
export const btn = {
  secondary: 'rounded-[11px] border border-line px-3.5 py-[9px] text-[13px] hover:border-faint disabled:opacity-50',
  primary: 'rounded-[11px] bg-inv px-[18px] py-2.5 text-[13px] font-medium text-inv-ink disabled:cursor-not-allowed disabled:opacity-40',
  accent: 'rounded-[11px] bg-acc px-[18px] py-2.5 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40',
};

export const chip = (on: boolean, muted = false) =>
  `rounded-full px-3 py-1.5 text-[12px] ${on ? 'bg-inv text-inv-ink' : `border border-line ${muted ? 'text-mute' : ''} hover:border-faint`}`;

export const field =
  'w-full rounded-[10px] border border-line bg-bg px-3 py-2.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-[1.5px] focus:border-acc focus:px-[11.5px] focus:py-[9.5px]';
