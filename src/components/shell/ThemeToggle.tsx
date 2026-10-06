import { useUI } from '@/stores/ui';

export function ThemeToggle() {
  const { theme, toggleTheme } = useUI();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-[11px] border border-line px-3 py-2 text-[12px] text-mute hover:text-ink"
    >
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  );
}
