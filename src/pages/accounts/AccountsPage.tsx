import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { useMoneoData } from '@/data/hooks';
import { repo } from '@/data/repository';
import type { Account, AccountKind, MoneoData } from '@/domain/types';
import { money } from '@/domain/money';
import { shortDate, today } from '@/domain/dates';
import { accountDelta, currentPaycheque, netDelta, netPosition, snapshotsFor } from '@/domain/selectors';
import { accountActivity, balanceHistory, composition, type BalanceRange } from '@/domain/views';
import { PageHeader } from '@/components/shell/PageHeader';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { HeroMoney } from '@/components/ui/Money';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { Swatch } from '@/components/ui/Avatar';
import { Sparkline } from '@/components/charts/Sparkline';
import { AreaLineChart } from '@/components/charts/AreaLineChart';
import { btn, field } from '@/components/ui/styles';
import { axisLabels } from '@/pages/overview/NetPositionCard';
import { toast } from '@/stores/toast';

const RANGES: BalanceRange[] = ['1M', '6M', '1Y', 'All'];
const KINDS: { value: AccountKind; label: string; purpose: string }[] = [
  { value: 'chequing', label: 'Chequing', purpose: 'Everyday' },
  { value: 'spending', label: 'Spending', purpose: 'Day-to-day' },
  { value: 'emergency', label: 'Savings', purpose: 'Savings' },
  { value: 'tfsa', label: 'TFSA', purpose: 'Investing' },
  { value: 'rrsp', label: 'RRSP', purpose: 'Retirement' },
  { value: 'credit', label: 'Credit card', purpose: 'Credit card' },
];
const NEW_COLORS = ['#a88aa6', '#c99a8e', '#6f8f86', '#d9825f', '#7f95ab'];

const sub = (a: Account) => `${a.purpose ?? KINDS.find((k) => k.value === a.kind)?.purpose} · ${a.institution ?? 'manual'}`;

export function AccountsPage() {
  const data = useMoneoData();
  const [params, setParams] = useSearchParams();
  const now = today();
  if (!data) return null;
  const accounts = [...data.accounts].sort((a, b) => a.order - b.order);
  const selected = accounts.find((a) => a.id === params.get('id')) ?? accounts.find((a) => a.id === params.get('update')) ?? accounts[0];
  const pay = currentPaycheque(data.paycheques, now);
  const net = netPosition(accounts);
  const nd = pay ? netDelta(accounts, data.balanceSnapshots, pay.periodStart) : { delta: 0, pct: 0 };
  const comp = composition(accounts);
  const select = (a: Account) => setParams({ id: a.id }, { replace: true });

  return (
    <>
      <PageHeader title="Accounts" actions={<><ThemeToggle /><AddAccountDialog data={data} onAdded={select} /></>} />
      <div className="grid grid-cols-[380px_minmax(0,1fr)] items-start gap-[14px] max-lg:grid-cols-1">
        <Card className="flex flex-col gap-3 px-[22px]! py-5!">
          <div className="text-[13px] text-mute">Net position</div>
          <HeroMoney cents={net} className="text-[40px] leading-none font-medium tracking-[-0.045em]" />
          <div className="text-[13px] font-medium" style={{ color: nd.delta >= 0 ? 'var(--pos)' : 'var(--acc)' }}>
            {nd.delta >= 0 ? '▲' : '▼'} {money(Math.abs(nd.delta))} <span className="font-normal">this period</span>
          </div>
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-[4px]" aria-hidden>
            {comp.segments.map((s) => (
              <div key={s.id} style={{ flex: s.value, background: s.color }} />
            ))}
          </div>
          <div className="flex justify-between text-[12px] text-mute">
            <span>Assets {money(comp.assets)}</span>
            <span>Liabilities {money(comp.liabilities)}</span>
          </div>
          <div className="-mx-2.5 mt-1 flex flex-col">
            {accounts.map((a) => {
              const d = pay ? accountDelta(a, data.balanceSnapshots, pay.periodStart) : 0;
              const color = d >= 0 ? 'var(--pos)' : 'var(--acc)';
              const series = snapshotsFor(data.balanceSnapshots, a.id).filter((s) => s.date <= now).slice(-20).map((s) => s.balance);
              const on = a.id === selected?.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-current={on}
                  onClick={() => select(a)}
                  className={`flex items-center gap-2.5 rounded-[12px] px-2.5 py-2.5 text-left ${on ? 'bg-panel2' : 'hover:bg-panel2/60'}`}
                >
                  <Swatch color={a.color} size={9} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{a.name}</span>
                    <span className="block truncate text-[11px] text-mute">{sub(a)}</span>
                  </span>
                  <Sparkline values={series} color={color} />
                  <span className="w-[92px] text-right">
                    <span className="block text-[13px] font-medium">{money(a.balance)}</span>
                    <span className="block text-[11px]" style={{ color }}>
                      {money(d, { signed: true })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
        {selected && <Detail key={selected.id} data={data} account={selected} today={now} openUpdate={params.get('update') === selected.id} />}
      </div>
    </>
  );
}

function Detail({ data, account: a, today, openUpdate }: { data: MoneoData; account: Account; today: string; openUpdate: boolean }) {
  const [range, setRange] = useState<BalanceRange>('6M');
  const pay = currentPaycheque(data.paycheques, today);
  const d = pay ? accountDelta(a, data.balanceSnapshots, pay.periodStart) : 0;
  const points = useMemo(() => balanceHistory(data, a.id, range, today), [data, a.id, range, today]);
  const activity = accountActivity(data, a.id, today);
  const tone = d >= 0 ? 'var(--pos)' : 'var(--acc)';
  return (
    <Card className="flex flex-col gap-3 px-[22px]! py-5!">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 text-[13px] text-mute">
          <Swatch color={a.color} />
          <span className="text-ink">{a.name}</span> · {sub(a)}
        </div>
        <Segmented label="Balance range" variant="plain" value={range} options={RANGES} onChange={setRange} />
      </div>
      <HeroMoney cents={a.balance} className="text-[46px] leading-none font-medium tracking-[-0.045em]" />
      <div className="text-[13px]">
        <span className="font-medium" style={{ color: tone }}>
          {d >= 0 ? '▲' : '▼'} {money(Math.abs(d))}
        </span>
        <span className="ml-2 text-mute">this paycheque period</span>
      </div>
      <AreaLineChart values={points.map((p) => p.balance)} height={200} color={a.color === 'var(--inv)' ? 'var(--ink)' : a.color} />
      <div className="flex justify-between text-[11px] text-faint">
        {axisLabels(points).map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[14px] font-medium">Activity</span>
        <UpdateBalanceDialog account={a} today={today} defaultOpen={openUpdate} />
      </div>
      <div className="flex flex-col">
        {activity.length === 0 && <div className="border-t border-line py-3 text-[13px] text-mute">No activity yet.</div>}
        {activity.map((r, i) => (
          <div key={i} className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 border-t border-line py-2.5 text-[13px]">
            <span className="text-mute">{shortDate(r.date)}</span>
            <span className="truncate">{r.label}</span>
            <span className="font-medium" style={{ color: r.amount > 0 ? 'var(--pos)' : undefined }}>
              {money(r.amount, { signed: true })}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

const parseDollars = (s: string) => {
  const neg = /^\s*[-−]/.test(s);
  const v = Number(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(v) && s.trim() !== '' ? Math.round(v * 100) * (neg ? -1 : 1) : null;
};

function UpdateBalanceDialog({ account, today, defaultOpen }: { account: Account; today: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [text, setText] = useState('');
  const value = parseDollars(text);
  const save = async () => {
    if (value === null) return;
    await repo.updateBalance(account.id, value, today);
    toast(`${account.name} balance updated · ${money(value)}`);
    setOpen(false);
    setText('');
  };
  return (
    <ModalForm
      open={open}
      onOpenChange={setOpen}
      trigger={<button type="button" className="text-[12px] text-mute hover:text-ink">Update balance</button>}
      title={`Update ${account.name}`}
      description={`Currently ${money(account.balance)}. The new balance is recorded for ${shortDate(today)}.`}
      submitLabel="Update"
      canSubmit={value !== null}
      onSubmit={save}
    >
      <input autoFocus inputMode="decimal" className={field} placeholder={(account.balance / 100).toFixed(2)} value={text} onChange={(e) => setText(e.target.value)} />
      {value !== null && (
        <div className="text-[12px] text-mute">
          Change: <span style={{ color: value - account.balance >= 0 ? 'var(--pos)' : 'var(--acc)' }}>{money(value - account.balance, { signed: true })}</span>
        </div>
      )}
    </ModalForm>
  );
}

function AddAccountDialog({ data, onAdded }: { data: MoneoData; onAdded: (a: Account) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('emergency');
  const [text, setText] = useState('');
  const balance = parseDollars(text) ?? 0;
  const save = async () => {
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36).slice(-4);
    const used = new Set(data.accounts.map((a) => a.color));
    const a: Account = {
      id,
      name: name.trim(),
      kind,
      purpose: KINDS.find((k) => k.value === kind)!.purpose,
      color: NEW_COLORS.find((c) => !used.has(c)) ?? '#a8a29a',
      balance: kind === 'credit' ? -Math.abs(balance) : balance,
      order: Math.max(...data.accounts.map((x) => x.order), 0) + 1,
    };
    await repo.addAccount(a, today());
    toast(`${a.name} added`);
    setOpen(false);
    setName('');
    setText('');
    onAdded(a);
  };
  return (
    <ModalForm
      open={open}
      onOpenChange={setOpen}
      trigger={<button type="button" className={`${btn.primary} px-4!`}>+ Add account</button>}
      title="Add account"
      description="Tracked manually. Add it to a paycheque split from a template later."
      submitLabel="Add account"
      canSubmit={!!name.trim()}
      onSubmit={save}
    >
      <Field label="Name" htmlFor="acct-name">
        <input id="acct-name" autoFocus className={field} placeholder="e.g. Car fund" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Type">
        <Select label="Type" value={kind} onChange={(v) => setKind(v as AccountKind)} options={KINDS.map((k) => ({ value: k.value, label: k.label }))} />
      </Field>
      <Field label={kind === 'credit' ? 'Amount owing' : 'Current balance'} htmlFor="acct-bal">
        <input id="acct-bal" inputMode="decimal" className={field} placeholder="0.00" value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
    </ModalForm>
  );
}

function ModalForm({
  open, onOpenChange, trigger, title, description, submitLabel, canSubmit, onSubmit, children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  trigger: React.ReactNode;
  title: string;
  description: string;
  submitLabel: string;
  canSubmit: boolean;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[380px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-[18px] border border-line bg-panel p-[22px] text-ink">
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
