import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Toaster } from '@/components/ui/Toaster';
import { TransactionDialog } from '@/components/TransactionDialog';
import { CommandPalette } from '@/components/CommandPalette';

export function AppShell() {
  return (
    <div className="grid min-h-screen grid-cols-[220px_minmax(0,1fr)] bg-bg text-ink transition-colors duration-300">
      <Sidebar />
      <main className="flex min-w-0 flex-col gap-[14px] px-7 pt-[22px] pb-7">
        <Outlet />
      </main>
      <Toaster />
      <TransactionDialog />
      <CommandPalette />
    </div>
  );
}
