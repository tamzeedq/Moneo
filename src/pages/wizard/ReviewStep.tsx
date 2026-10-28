import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { MoneoData } from '@/domain/types';
import { money, sum } from '@/domain/money';
import { dayShortDate, shortDate } from '@/domain/dates';
import {
  draftPool, draftToRecords, payPeriod, savingsOf, splitAccounts, splitStatus, type PaychequeDraft,
} from '@/domain/wizard';
import { repo } from '@/data/repository';
import { Card, CardHeader } from '@/components/ui/Card';
import { Swatch } from '@/components/ui/Avatar';
import { Switch } from '@/components/ui/Switch';
import { btn } from '@/components/ui/styles';
import { SaveTemplateDialog } from '@/components/SaveTemplateDialog';
import { useWizard } from '@/stores/wizard';
import { toast } from '@/stores/toast';
import { WizardFooter } from './WizardFooter';
import { toneColor } from '@/components/ui/tone';

export function ReviewStep({ data, draft }: { data: MoneoData; draft: PaychequeDraft }) {
  const { update, reset } = useWizard();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const accounts = splitAccounts(data.accounts);
  const cats = new Map(data.categories.map((c) => [c.id, c]));
  const deposit = data.accounts.find((a) => a.id === draft.depositAccountId);
  const status = splitStatus(draft.net, draft.allocations);
  const saved = savingsOf(data.accounts, draft.allocations);
  const budget = draft.budget.filter((b) => b.plan > 0);
  const budgeted = sum(budget.map((b) => b.plan));
  const period = payPeriod(draft.payDate, draft.repeats);
  const transfers = accounts.filter((a) => a.id !== draft.depositAccountId && (draft.allocations[a.id] ?? 0) > 0);
  const funded = accounts.filter((a) => (draft.allocations[a.id] ?? 0) > 0);
  const pool = draftPool(data.accounts, draft.allocations);

  const save = async () => {
    setSaving(true);
    try {
      await repo.savePaycheque(draftToRecords(draft));
      reset();
      toast(`Paycheque saved · ${dayShortDate(draft.payDate)} · ${money(draft.net)}`);
      navigate('/');
    } catch (e) {
      console.error(e);
      toast('Couldn’t save the paycheque. Try again.');
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="grid grid-cols-4 px-[22px]! max-md:grid-cols-2 max-md:gap-y-4">
        <Summary label="Paycheque in" value={money(draft.net)} sub={`${draft.source} · ${shortDate(draft.payDate)}`} className="pr-[18px]" />
        <Summary
          label="Moved to savings"
          value={money(saved)}
          sub={`${draft.net ? Math.round((saved / draft.net) * 100) : 0}% savings rate`}
          subColor="var(--pos)"
          className="border-l border-line px-[18px]"
        />
        <Summary
          label="Budgeted"
          value={money(budgeted)}
          sub={budgeted > pool ? `${money(budgeted - pool)} over the pool` : `${budget.length} categories · ${period.days} days`}
          subColor={budgeted > pool ? 'var(--acc)' : undefined}
          className="border-l border-line px-[18px]"
        />
        <Summary
          label="Unallocated"
          value={money(status.left)}
          valueColor={toneColor[status.tone]}
          sub={status.label}
          subColor={toneColor[status.tone]}
          className="border-l border-line pl-[18px]"
        />
      </Card>

      <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)] items-start gap-[14px] max-lg:grid-cols-1">
        <Card className="flex flex-col">
          <CardHeader title="Transfers to make" meta={`from ${deposit?.name} · ${shortDate(draft.payDate)}`} className="pb-2.5" />
          {transfers.length === 0 && <div className="border-t border-line py-2.5 text-[12px] text-mute">Nothing to move. It all stays in {deposit?.name}.</div>}
          {transfers.map((a) => {
            const done = !!draft.transfersDone[a.id];
            const name = a.shortName ?? a.name;
            return (
              <label key={a.id} className="flex cursor-pointer items-center gap-2.5 border-t border-line py-2.5 text-[13px]">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={`Moved ${name}`}
                  onClick={() => update((d) => ({ transfersDone: { ...d.transfersDone, [a.id]: !done } }))}
                  className={`grid size-4 flex-none place-items-center rounded-[5px] border-[1.5px] text-[10px] font-semibold text-white ${
                    done ? 'border-pos bg-pos' : 'border-faint'
                  }`}
                >
                  {done && '✓'}
                </button>
                <Swatch color={a.color} />
                <div className={`min-w-0 flex-1 ${done ? 'text-mute line-through' : ''}`}>
                  <div className="font-medium">
                    {deposit?.name} → {name}
                  </div>
                  <div className="text-[11px] text-mute no-underline">{a.purpose}</div>
                </div>
                <span className="font-medium">{money(draft.allocations[a.id])}</span>
              </label>
            );
          })}
          {transfers.length > 0 && (
            <div className="mt-1.5 flex items-center gap-2.5 rounded-[12px] bg-panel2 p-3 text-[12px]">
              <Switch checked={draft.remind} onChange={(remind) => update({ remind })} label="Remind me to tick these off" />
              Remind me on {shortDate(draft.payDate)} to tick these off
            </div>
          )}
        </Card>

        <Card className="flex flex-col">
          <CardHeader
            title="Balances after"
            meta={<span className="text-pos">{money(draft.net, { signed: true })} net position</span>}
            className="pb-2.5"
          />
          {funded.map((a) => {
            const amt = draft.allocations[a.id] ?? 0;
            return (
              <div key={a.id} className="flex items-center gap-2.5 border-t border-line py-2.5 text-[13px]">
                <Swatch color={a.color} />
                <span className="flex-1">{a.shortName ?? a.name}</span>
                <span className="font-medium">{money(a.balance + amt)}</span>
                <span className="w-[58px] text-right text-[12px] text-pos">+{money(amt, { decimals: 0 })}</span>
              </div>
            );
          })}
        </Card>

        <Card className="flex flex-col gap-[11px]">
          <CardHeader title="Budget" meta={compactRange(period.start, period.end)} />
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-[4px]">
            {budget.map((b) => (
              <div key={b.categoryId} style={{ flex: b.plan, background: cats.get(b.categoryId)?.color }} />
            ))}
          </div>
          {budget.map((b) => (
            <div key={b.categoryId} className="flex items-center gap-2 text-[13px]">
              <Swatch color={cats.get(b.categoryId)?.color ?? 'var(--faint)'} round />
              {cats.get(b.categoryId)?.name}
              <span className="ml-auto">{money(b.plan, { decimals: 0 })}</span>
            </div>
          ))}
        </Card>
      </div>

      <WizardFooter left={<Link to="/paycheques/new/budget" className={btn.secondary}>← Back</Link>}>
        <SaveTemplateDialog data={data} amounts={draft.allocations} from={`the ${shortDate(draft.payDate)} paycheque`} />
        <button type="button" className={btn.accent} onClick={save} disabled={saving || !status.canContinue}>
          {saving ? 'Saving…' : 'Save paycheque'}
        </button>
      </WizardFooter>
    </>
  );
}

/** "Oct 10 – 23", or "Oct 24 – Nov 6" across months. */
const compactRange = (start: string, end: string) =>
  start.slice(0, 7) === end.slice(0, 7) ? `${shortDate(start)} – ${Number(end.slice(8))}` : `${shortDate(start)} – ${shortDate(end)}`;

function Summary({
  label, value, sub, className, valueColor, subColor = 'var(--mute)',
}: { label: string; value: string; sub: string; className: string; valueColor?: string; subColor?: string }) {
  return (
    <div className={className}>
      <div className="text-[12px] text-mute">{label}</div>
      <div className="mt-1 text-[24px] font-medium tracking-[-0.035em]" style={{ color: valueColor }}>
        {value}
      </div>
      <div className="mt-0.5 text-[12px]" style={{ color: subColor }}>
        {sub}
      </div>
    </div>
  );
}
