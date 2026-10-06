import { Link, useNavigate } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import type { MoneoData } from '@/domain/types';
import { money, sum } from '@/domain/money';
import { addDaysISO, shortDate, today } from '@/domain/dates';
import { currentPaycheque } from '@/domain/selectors';
import {
  averagePlan, BUDGET_STEP, budgetStatus, draftPool, lastPlan, lastSpent, payPeriod, periodLabel, type PaychequeDraft,
} from '@/domain/wizard';
import { Card, CardHeader } from '@/components/ui/Card';
import { InitialAvatar } from '@/components/ui/Avatar';
import { Stepper } from '@/components/ui/Stepper';
import { HalfRing } from '@/components/charts/HalfRing';
import { btn, chip } from '@/components/ui/styles';
import { useWizard } from '@/stores/wizard';
import { toneColor, WizardFooter } from './WizardFooter';

const cols = 'grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_96px_132px] gap-3.5';
/** Plan bars share one scale so rows compare; $720 unless a plan or last spend is bigger. */
const MIN_SCALE = 72000;

export function BudgetStep({ data, draft }: { data: MoneoData; draft: PaychequeDraft }) {
  const { update } = useWizard();
  const navigate = useNavigate();
  const now = today();
  const cats = new Map(data.categories.map((c) => [c.id, c]));
  const accounts = new Map(data.accounts.map((a) => [a.id, a]));
  const period = payPeriod(draft.payDate, draft.repeats);
  const pool = draftPool(data.accounts, draft.allocations);
  const plans = draft.budget.map((b) => b.plan);
  const status = budgetStatus(pool, plans);
  const last = lastSpent(data, now);
  const lastPay = currentPaycheque(data.paycheques, now);
  const scale = Math.max(MIN_SCALE, ...plans, ...Object.values(last));
  const rollover = lastPay
    ? sum(data.budgetLines.filter((l) => l.paychequeId === lastPay.id).map((l) => l.plan)) - sum(Object.values(last))
    : 0;
  const missing = data.categories.filter((c) => !draft.budget.some((b) => b.categoryId === c.id)).sort((a, b) => a.order - b.order);
  const bills = data.bills.filter((b) => b.due >= draft.payDate && b.due <= addDaysISO(draft.payDate, 30)).sort((a, b) => a.due.localeCompare(b.due));

  const setPlan = (categoryId: string, plan: number) =>
    update((d) => ({ budgetMode: 'custom', budget: d.budget.map((b) => (b.categoryId === categoryId ? { ...b, plan } : b)) }));

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-[14px] max-lg:grid-cols-1">
        <Card className="flex flex-col">
          <div className="flex items-center justify-between gap-3 pb-3">
            <div>
              <span className="text-[14px] font-medium">{periodLabel(period.start, period.end)}</span>
              <span className="ml-2 text-[12px] text-mute">{period.days} days</span>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                className={chip(draft.budgetMode === 'copy')}
                onClick={() => update({ budgetMode: 'copy', budget: lastPlan(data) })}
              >
                Copy last plan
              </button>
              <button
                type="button"
                className={chip(draft.budgetMode === 'average')}
                onClick={() => update({ budgetMode: 'average', budget: averagePlan(data, now, draft.budget.map((b) => b.categoryId)) })}
              >
                3-paycheque average
              </button>
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button type="button" className={chip(false, true)} disabled={!missing.length}>
                    + Category
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content align="end" sideOffset={6} className="z-50 flex min-w-44 flex-col rounded-[12px] border border-line bg-panel p-1 text-[13px] text-ink shadow-lg">
                    {missing.map((c) => (
                      <Popover.Close asChild key={c.id}>
                        <button
                          type="button"
                          className="flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-left hover:bg-panel2"
                          onClick={() => update((d) => ({ budget: [...d.budget, { categoryId: c.id, plan: 0 }] }))}
                        >
                          <span className="size-2 rounded-full" style={{ background: c.color }} />
                          {c.name}
                        </button>
                      </Popover.Close>
                    ))}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>
          </div>
          <div className={`${cols} rounded-[8px] bg-panel2 px-2.5 py-[7px] text-[11px] text-mute`}>
            <span>Category</span>
            <span>Plan vs. last period</span>
            <span className="text-right">Last spent</span>
            <span className="text-center">Plan</span>
          </div>
          {draft.budget.map((b) => {
            const c = cats.get(b.categoryId);
            if (!c) return null;
            const spent = last[c.id] ?? 0;
            const over = spent - b.plan;
            return (
              <div key={c.id} className={`${cols} items-center border-b border-line p-2.5 text-[13px]`}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <InitialAvatar label={c.name} color={c.color} />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="text-[11px] text-mute">from {accounts.get(c.fundedFrom)?.name}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="relative h-2 rounded-[4px] bg-track">
                    <div className="h-full rounded-[4px] transition-[width] duration-200" style={{ width: `${Math.min(b.plan / scale, 1) * 100}%`, background: c.color }} />
                    <div
                      className="absolute -top-[3px] -bottom-[3px] w-0.5 bg-ink opacity-55"
                      style={{ left: `${Math.min(spent / scale, 1) * 100}%` }}
                      title={`Last period: ${money(spent)}`}
                    />
                  </div>
                  <span className="text-[11px]" style={{ color: over > 50 ? 'var(--acc)' : 'var(--mute)' }}>
                    {over > 50
                      ? `Last period ran ${money(over, { decimals: 0 })} over this plan`
                      : `${money(-over, { decimals: 0 })} cushion vs. last period`}
                  </span>
                </div>
                <span className="text-right text-mute">{money(spent)}</span>
                <Stepper value={b.plan} step={BUDGET_STEP} label={`${c.name} plan`} onChange={(v) => setPlan(c.id, v)} />
              </div>
            );
          })}
          <div className="flex justify-between px-2.5 pt-3 pb-0.5 text-[12px] text-mute">
            <span>Marker shows what you spent last period</span>
            <span>Steppers move $10</span>
          </div>
        </Card>

        <div className="flex flex-col gap-[14px]">
          <Card className="flex flex-col gap-2.5">
            <CardHeader title="Budget pool" meta="from step 2" />
            <HalfRing
              height={112}
              thickness={22}
              gap={0.8}
              total={Math.max(pool, sum(plans), 1)}
              segments={draft.budget.map((b) => ({ value: b.plan, color: cats.get(b.categoryId)?.color ?? 'var(--faint)' }))}
              center={
                <>
                  <div className="text-[11px] text-mute">Left to budget</div>
                  <div className="text-[20px] font-medium tracking-[-0.03em]" style={{ color: toneColor[status.tone] }}>
                    {money(status.left)}
                  </div>
                </>
              }
            />
            <div className="flex flex-col border-t border-line text-[13px]">
              <div className="flex justify-between border-b border-line py-2">
                <span className="text-mute">Pool</span>
                <span>{money(pool)}</span>
              </div>
              <div className="flex justify-between border-b border-line py-2">
                <span className="text-mute">Budgeted</span>
                <span>{money(sum(plans))}</span>
              </div>
              {lastPay && (
                <div className="flex justify-between py-2">
                  <span className="text-mute">Rolled over from {shortDate(lastPay.payDate)}</span>
                  <span style={{ color: rollover >= 0 ? 'var(--pos)' : 'var(--acc)' }}>{money(rollover, { signed: true })}</span>
                </div>
              )}
            </div>
          </Card>
          <Card className="flex flex-col gap-2.5">
            <CardHeader title="Upcoming bills" meta={String(bills.length)} />
            {bills.length === 0 && <div className="text-[12px] text-mute">Nothing due in the next 30 days.</div>}
            {bills.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-0.5 text-[13px]">
                <div>
                  <div>{b.name}</div>
                  <div className="text-[11px] text-mute">
                    {shortDate(b.due)} · {accounts.get(b.accountId)?.name}
                  </div>
                </div>
                <span>{money(b.amount)}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <WizardFooter left={<Link to="/paycheques/new/split" className={btn.secondary}>← Back</Link>} status={status.label} tone={status.tone}>
        <button type="button" className={btn.primary} onClick={() => navigate('/paycheques/new/review')}>
          Review →
        </button>
      </WizardFooter>
    </>
  );
}
