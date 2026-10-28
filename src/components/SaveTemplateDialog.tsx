import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { Cents, MoneoData } from '@/domain/types';
import { shortDate, today } from '@/domain/dates';
import { repo } from '@/data/repository';
import { btn, field } from '@/components/ui/styles';
import { toast } from '@/stores/toast';
import { newId } from '@/lib/id';

/** Saves a split as a reusable template ("Start the split from" in the wizard, chips on Paycheques). */
export function SaveTemplateDialog({
  data, amounts, from, triggerClassName = btn.secondary + ' py-2.5', triggerLabel = 'Save as template',
}: { data: MoneoData; amounts: Record<string, Cents>; from: string; triggerClassName?: string; triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const save = async () => {
    await repo.saveTemplate({
      id: newId(),
      name: name.trim(),
      description: `Saved ${shortDate(today())} from ${from}`,
      amounts: { ...amounts },
      order: Math.max(0, ...data.templates.filter((t) => t.id !== 'blank').map((t) => t.order)) + 0.5,
    });
    toast(`Template “${name.trim()}” saved`);
    setOpen(false);
    setName('');
  };
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={triggerClassName}>
          {triggerLabel}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[380px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-[18px] border border-line bg-panel p-[22px] text-ink">
          <Dialog.Title className="m-0 text-[16px] font-semibold">Save split as a template</Dialog.Title>
          <Dialog.Description className="m-0 text-[13px] text-mute">It will appear under “Start the split from” next time.</Dialog.Description>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) void save();
            }}
          >
            <input autoFocus className={field} placeholder="Template name" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className={btn.secondary}>
                  Cancel
                </button>
              </Dialog.Close>
              <button type="submit" className={btn.primary} disabled={!name.trim()}>
                Save template
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
