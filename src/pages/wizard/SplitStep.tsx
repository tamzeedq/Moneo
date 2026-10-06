import { Link, useNavigate } from 'react-router-dom';
import type { MoneoData } from '@/domain/types';
import { money } from '@/domain/money';
import { shortDate } from '@/domain/dates';
import {
  draftPool, goalImpact, payPeriod, periodLabel, previousUnallocated, SPLIT_STEP, splitAccounts, splitStatus, templateAllocations,
  type PaychequeDraft,
} from '@/domain/wizard';
import { Card, CardHeader } from '@/components/ui/Card';
import { HeroMoney } from '@/components/ui/Money';
import { Stepper } from '@/components/ui/Stepper';
import { Swatch } from '@/components/ui/Avatar';
import { btn, chip } from '@/components/ui/styles';
import { useWizard } from '@/stores/wizard';
import { AllocationBar } from './AllocationBar';
import { toneColor, WizardFooter } from './WizardFooter';

/** Text colour that reads on each account colour (ink on light tints, white on terracotta, invInk on inv). */
const onColor = (color: string) => (color === 'var(--inv)' ? 'var(--inv-ink)' : color === 'var(--acc)' ? '#ffffff' : '#17181a');

const cols = 'grid grid-cols-[minmax(0,1fr)_110px_132px_110px] gap-3.5';

export function SplitStep({ data, draft }: { data: MoneoData; draft: PaychequeDraft }) {
  const { update } = useWizard();
  const navigate = useNavigate();
  const accounts = splitAccounts(data.accounts);
  const status = splitStatus(draft.net, draft.allocations);
  const template = data.templates.find((t) => t.id === draft.templateId);
  const pool = draftPool(data.accounts, draft.allocations);
  const period = payPeriod(draft.payDate, draft.repeats);
  const prev = previousUnallocated(data, draft.basedOn);
  const setAmount = (id: string, v: number) => update((d) => ({ allocations: { ...d.allocations, [id]: v } }));

  return (
    <>
      <Card className="flex flex-col gap-3.5 px-[22px]! py-5!">
        <div className="flex items-end justify-between gap-5">
          <div>
            <div className="text-[13px] text-mute">Paycheque · {draft.source || 'Paycheque'}</div>
            <HeroMoney cents={draft.net} className="mt-1 block text-[40px] leading-[1.05] font-medium tracking-[-0.045em]" />
          </div>
          <div className="flex gap-1.5">
            {template && <span className={chip(true)}>{template.name}</span>}
            <button
              type="button"
              className={chip(false, true)}
              onClick={() => update({ allocations: templateAllocations(template, data.accounts) })}
            >
              Reset
            </button>
          </div>
          <div className="text-right">
            <div className="text-[13px] text-mute">Left to allocate</div>
            <div className="mt-1 text-[30px] font-medium tracking-[-0.04em]" style={{ color: toneColor[status.tone] }}>
              {money(status.left)}
            </div>
          </div>
        </div>
        <AllocationBar accounts={accounts} allocations={draft.allocations} net={draft.net} onChange={(allocations) => update({ allocations })} />
        <div className="flex flex-wrap gap-5 text-[12px]">
          {accounts.map((a) => (
            <span key={a.id} className="flex items-center gap-[7px]">
              <Swatch color={a.color} />
              {a.shortName ?? a.name}
              <span className="text-mute">{draft.net ? Math.round(((draft.allocations[a.id] ?? 0) / draft.net) * 100) : 0}%</span>
            </span>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-[14px] max-lg:grid-cols-1">
        <Card className="flex flex-col">
          <div className={`${cols} rounded-[8px] bg-panel2 px-2.5 py-[7px] text-[11px] text-mute`}>
            <span>Account</span>
            <span className="text-right">Balance now</span>
            <span className="text-center">This paycheque</span>
            <span className="text-right">After</span>
          </div>
          {accounts.map((a) => {
            const amt = draft.allocations[a.id] ?? 0;
            const name = a.shortName ?? a.name;
            return (
              <div key={a.id} className={`${cols} items-center border-b border-line p-2.5 text-[13px]`}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="grid size-[26px] flex-none place-items-center rounded-[7px] text-[11px] font-semibold"
                    style={{ background: a.color, color: onColor(a.color) }}
                  >
                    {name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium">{name}</div>
                    <div className="text-[11px] text-mute">{a.purpose}</div>
                  </div>
                </div>
                <span className="text-right text-mute">{money(a.balance)}</span>
                <Stepper value={amt} step={SPLIT_STEP} label={`${name} amount`} onChange={(v) => setAmount(a.id, v)} />
                <span className="text-right font-medium">{money(a.balance + amt)}</span>
              </div>
            );
          })}
          <div className="flex justify-between px-2.5 pt-3 pb-0.5 text-[12px] text-mute">
            <span>Steppers move $20 · type to set exact</span>
            {prev && (
              <span>
                {shortDate(prev.paycheque.payDate)} {prev.left > 0 ? `left ${money(prev.left, { decimals: 0 })} unallocated` : 'was fully allocated'}
              </span>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-[14px]">
          <Card className="flex flex-col gap-3.5">
            <CardHeader title="Goal impact" meta="after this split" />
            {goalImpact(data.goals, draft.allocations).map(({ goal, add, after }) => (
              <div key={goal.id} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[13px]">
                  <span className="font-medium">{goal.name}</span>
                  <span style={{ color: add ? 'var(--pos)' : 'var(--mute)' }}>{add ? `+${money(add, { decimals: 0 })}` : 'No change'}</span>
                </div>
                <div className="flex h-[7px] overflow-hidden rounded-[4px] bg-track">
                  <div style={{ width: `${(goal.current / goal.target) * 100}%`, background: goal.color }} />
                  <div className="transition-[width] duration-200" style={{ width: `${((after - goal.current) / goal.target) * 100}%`, background: goal.color, opacity: 0.45 }} />
                </div>
                <div className="text-[11px] text-mute">
                  {money(after, { decimals: 0 })} of {money(goal.target, { decimals: 0 })} · {Math.round((after / goal.target) * 100)}%
                  {!add && ' · not funded this paycheque'}
                </div>
              </div>
            ))}
          </Card>
          <div className="flex flex-col gap-2 rounded-[18px] bg-inv px-5 py-[18px] text-inv-ink">
            <div className="text-[12px] text-inv-mute">Funds the budget in step 3</div>
            <div className="text-[26px] font-medium tracking-[-0.04em]">{money(pool)}</div>
            <div className="text-[12px] text-inv-mute">Chequing + Spending, for {periodLabel(period.start, period.end)}</div>
          </div>
        </div>
      </div>

      <WizardFooter left={<Link to="/paycheques/new/details" className={btn.secondary}>← Back</Link>} status={status.label} tone={status.tone}>
        <button type="button" className={btn.primary} disabled={!status.canContinue} onClick={() => navigate('/paycheques/new/budget')}>
          Continue →
        </button>
      </WizardFooter>
    </>
  );
}
