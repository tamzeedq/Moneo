import { NavLink } from 'react-router-dom';
import { useDialogs } from '@/stores/ui';
import { paletteShortcut } from '@/lib/platform';

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/paycheques', label: 'Paycheques' },
  { to: '/budget', label: 'Budget' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/charts', label: 'Chart Studio' },
];

const FOOT = [
  { to: '/import', label: 'Import / Export' },
  { to: '/settings', label: 'Settings' },
];

const item = 'rounded-[10px] px-3 py-[9px]';
const linkClass = ({ isActive }: { isActive: boolean }) =>
  `${item} ${isActive ? 'bg-nav-on font-medium text-ink shadow-tok' : 'text-mute hover:text-ink'}`;

export function Sidebar() {
  const openDialog = useDialogs((s) => s.open);
  return (
    <aside className="sticky top-0 flex h-screen flex-col gap-6 border-r border-line px-4 py-6">
      <div className="flex items-center gap-2.5 px-2.5">
        <div className="size-[22px] rounded-[7px] bg-acc" />
        <span className="text-[18px] font-semibold tracking-[-0.02em]">moneo</span>
      </div>
      <button
        type="button"
        onClick={() => openDialog('palette')}
        className="flex items-center justify-between rounded-[10px] border border-line bg-panel px-3 py-[9px] text-left text-[13px] text-mute hover:border-faint"
      >
        <span>Search</span>
        <span className="text-[11px] text-faint">{paletteShortcut()}</span>
      </button>
      <nav className="flex flex-col gap-0.5 text-[14px]">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <nav className="mt-auto flex flex-col gap-0.5 text-[14px]" aria-label="More">
        {FOOT.map((n) => (
          <NavLink key={n.to} to={n.to} className={linkClass}>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
