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
import { switchWorkspace, workspace } from '@/data/workspace';

const demo = workspace.id === 'demo';

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
            <input
              id="name"
              className={field}
              value={name}
              placeholder="Shown in the Overview greeting"
              onChange={(e) => setName(e.target.value)}
            />
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
            {demo
              ? `You’re in the demo: sample data with “today” pinned to ${longDay(today())}. Your own workspace is kept separately.`
              : 'Your workspace, stored on this device until accounts and sync arrive. Back it up regularly.'}{' '}
            <Link to="/import" className="text-acc">
              Back up or import →
            </Link>
          </p>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <div className="text-[13px]">
              <div className="font-medium">{demo ? 'Back to my data' : 'Explore the demo'}</div>
              <div className="text-[11px] text-mute">
                {demo ? 'Leave the sample data.' : 'A year of sample data. Your data stays untouched.'}
              </div>
            </div>
            <button type="button" className={btn.secondary} onClick={() => switchWorkspace(demo ? 'mine' : 'demo')}>
              {demo ? 'Switch' : 'Open demo'}
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <div className="text-[13px]">
              <div className="font-medium">{demo ? 'Reset demo data' : 'Erase my data'}</div>
              <div className="text-[11px] text-mute">
                {demo ? 'Restores the sample accounts, paycheques and charts.' : 'Deletes every account, paycheque, transaction and chart.'}
              </div>
            </div>
            <button type="button" className={`${btn.secondary} text-acc!`} onClick={() => setConfirm(true)}>
              {demo ? 'Reset…' : 'Erase…'}
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
        title={demo ? 'Reset demo data?' : 'Erase all your data?'}
        description={
          demo
            ? 'Everything you’ve changed in the demo is replaced with the sample data.'
            : 'Every account, paycheque, transaction, budget and chart in this workspace is deleted. Download a backup first if you might want it back. This can’t be undone.'
        }
        submitLabel={demo ? 'Reset data' : 'Erase everything'}
        canSubmit
        onSubmit={async () => {
          await repo.reset();
          resetWizard();
          setConfirm(false);
          toast(demo ? 'Demo data restored' : 'Workspace erased');
          navigate('/');
        }}
      >
        <span />
      </ModalForm>
    </>
  );
}
