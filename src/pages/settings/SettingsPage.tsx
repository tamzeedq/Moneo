import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMoneoData } from '@/data/hooks';
import { repo } from '@/data/repository';
import { longDay, today } from '@/domain/dates';
import { PageHeader } from '@/components/shell/PageHeader';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { ModalForm } from '@/components/ui/ModalForm';
import { btn, chip, field } from '@/components/ui/styles';
import { useUI, type Theme } from '@/stores/ui';
import { useWizard } from '@/stores/wizard';
import { toast } from '@/stores/toast';
import { paletteShortcut } from '@/lib/platform';

export function SettingsPage() {
  const data = useMoneoData();
  const { name, setName, theme, setTheme } = useUI();
  const resetWizard = useWizard((s) => s.reset);
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <PageHeader title="Settings" actions={<ThemeToggle />} />
      <div className="grid max-w-[880px] grid-cols-2 items-start gap-[14px] max-lg:grid-cols-1">
        <Card className="flex flex-col gap-4">
          <CardHeader title="Profile" />
          <Field label="Your name" htmlFor="name">
            <input id="name" className={field} value={name} placeholder="Shown in the Overview greeting" onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Appearance">
            <div className="flex gap-1.5">
              {(['light', 'dark'] as Theme[]).map((t) => (
                <button key={t} type="button" className={chip(theme === t)} onClick={() => setTheme(t)}>
                  {t === 'light' ? 'Light' : 'Dark'}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-mute">The first visit follows your system setting.</span>
          </Field>
        </Card>

        <Card className="flex flex-col gap-3">
          <CardHeader title="Data" meta="Stored on this device" />
          {data && (
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              {[
                ['Accounts', data.accounts.length],
                ['Paycheques', data.paycheques.length],
                ['Transactions', data.transactions.length],
                ['Charts', data.charts.length],
              ].map(([k, v]) => (
                <div key={k} className="rounded-[10px] bg-panel2 px-3 py-2">
                  <div className="text-[11px] text-mute">{k}</div>
                  <div className="font-medium">{v}</div>
                </div>
              ))}
            </div>
          )}
          <p className="m-0 text-[12px] text-mute">
            This POC runs on sample data with “today” pinned to {longDay(today())}, so the screens match the designs.{' '}
            <Link to="/import" className="text-acc">Back up or import →</Link>
          </p>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <div className="text-[13px]">
              <div className="font-medium">Reset demo data</div>
              <div className="text-[11px] text-mute">Restores the sample accounts, paycheques and charts.</div>
            </div>
            <button type="button" className={`${btn.secondary} text-acc!`} onClick={() => setConfirm(true)}>
              Reset…
            </button>
          </div>
        </Card>

        <Card className="flex flex-col gap-2 text-[13px]">
          <CardHeader title="Shortcuts" className="pb-1" />
          {[
            [paletteShortcut(), 'Search and jump anywhere'],
            ['← →', 'Move a split divider by $10 (Shift: $100)'],
            ['↑ ↓ ↵', 'Move through search results'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-t border-line pt-2">
              <span className="text-mute">{v}</span>
              <kbd className="rounded-[6px] border border-line bg-panel2 px-1.5 py-0.5 font-sans text-[11px]">{k}</kbd>
            </div>
          ))}
        </Card>
      </div>

      <ModalForm
        open={confirm}
        onOpenChange={setConfirm}
        title="Reset demo data?"
        description="Everything you’ve added or changed (paycheques, transactions, charts, balances) is replaced with the sample data. It can’t be undone."
        submitLabel="Reset data"
        canSubmit
        onSubmit={async () => {
          await repo.resetToSeed();
          resetWizard();
          setConfirm(false);
          toast('Demo data restored');
          navigate('/');
        }}
      >
        <span />
      </ModalForm>
    </>
  );
}
