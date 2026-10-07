import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';
export type Period = 'Paycheque' | 'Week' | 'Month' | 'Quarter' | 'Year' | 'Custom';
export const PERIODS: Period[] = ['Paycheque', 'Week', 'Month', 'Quarter', 'Year', 'Custom'];

interface UIState {
  theme: Theme;
  period: Period;
  /** Shown in the Overview greeting. */
  name: string;
  setName: (n: string) => void;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setPeriod: (p: Period) => void;
}

const systemTheme = (): Theme =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export const useUI = create<UIState>()(
  persist(
    (set, get) => ({
      theme: systemTheme(),
      period: 'Paycheque',
      name: 'Sam',
      setName: (name) => set({ name }),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      setPeriod: (period) => set({ period }),
    }),
    { name: 'moneo-ui', partialize: (s) => ({ theme: s.theme, period: s.period, name: s.name }) },
  ),
);

/** Keep <html data-theme> in sync with the store. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

/** App-wide dialogs that can be opened from anywhere (quick actions, ⌘K). */
interface DialogState {
  transaction: boolean;
  palette: boolean;
  open: (d: 'transaction' | 'palette') => void;
  close: (d: 'transaction' | 'palette') => void;
}

export const useDialogs = create<DialogState>()((set) => ({
  transaction: false,
  palette: false,
  open: (d) => set({ transaction: false, palette: false, [d]: true }),
  close: (d) => set({ [d]: false }),
}));
