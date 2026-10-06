import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PaychequeDraft } from '@/domain/wizard';

interface WizardState {
  draft: PaychequeDraft | null;
  start: (d: PaychequeDraft) => void;
  update: (patch: Partial<PaychequeDraft> | ((d: PaychequeDraft) => Partial<PaychequeDraft>)) => void;
  reset: () => void;
}

/** The add-paycheque draft. Persisted so Back/Forward and reloads never lose input. */
export const useWizard = create<WizardState>()(
  persist(
    (set) => ({
      draft: null,
      start: (draft) => set({ draft }),
      update: (patch) =>
        set((s) => (s.draft ? { draft: { ...s.draft, ...(typeof patch === 'function' ? patch(s.draft) : patch) } } : s)),
      reset: () => set({ draft: null }),
    }),
    { name: 'moneo-wizard', version: 1 },
  ),
);
