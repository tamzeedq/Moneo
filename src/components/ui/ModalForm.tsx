import * as Dialog from '@radix-ui/react-dialog';
import { btn } from './styles';

/** Small form dialog: title, description, fields, Cancel + submit. `trigger` is optional for controlled use. */
export function ModalForm({
  open, onOpenChange, trigger, title, description, submitLabel, canSubmit, onSubmit, children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  trigger?: React.ReactNode;
  title: string;
  description: string;
  submitLabel: string;
  canSubmit: boolean;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[400px] overflow-y-auto -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-[18px] border border-line bg-panel p-[22px] text-ink">
          <Dialog.Title className="m-0 text-[16px] font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="m-0 text-[13px] text-mute">{description}</Dialog.Description>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) onSubmit();
            }}
          >
            {children}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className={btn.secondary}>Cancel</button>
              </Dialog.Close>
              <button type="submit" className={btn.primary} disabled={!canSubmit}>
                {submitLabel}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
