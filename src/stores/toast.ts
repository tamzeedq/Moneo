import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string) => void;
  dismiss: (id: number) => void;
}

let next = 1;

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (message) => {
    const id = next++;
    set({ toasts: [...get().toasts, { id, message }] });
    setTimeout(() => get().dismiss(id), 4000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = (message: string) => useToasts.getState().push(message);
