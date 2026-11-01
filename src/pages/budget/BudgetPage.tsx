import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { useMoneoData } from '@/data/hooks';
import { repo } from '@/data/repository';
import type { Cents, MoneoData, Paycheque } from '@/domain/types';
import { money, sum } from '@/domain/money';
import { shortDate, today } from '@/domain/dates';
import { currentPaycheque, spendByCategory } from '@/domain/selectors';
import { BUDGET_STEP, periodLabel } from '@/domain/wizard';
import { budgetedPaycheques, budgetSummary, needsAttention } from '@/domain/views';
import { PageHeader } from '@/components/shell/PageHeader';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { Card, CardHeader } from '@/components/ui/Card';
import { PeriodNav } from '@/components/ui/PeriodNav';
import { Stepper } from '@/components/ui/Stepper';
import { Swatch } from '@/components/ui/Avatar';
import { HalfRing } from '@/components/charts/HalfRing';
import { btn } from '@/components/ui/styles';
import { toneColor } from '@/components/ui/tone';
import { toast } from '@/stores/toast';

export function BudgetPage() {
  const data = useMoneoData();
  const [params, setParams] = useSearchParams();
  const now = today();
  if (!data) return null;

  const list = budgetedPaycheques(data);
  const cur = currentPaycheque(data.paycheques, now);
  const selected = list.find((p) => p.id === params.get('id')) ?? list.find((p) => p.id === cur?.id) ?? list.at(-1);
  const i = selected ? list.indexOf(selected) : -1;
  const select = (p: Paycheque) => setParams({ id: p.id }, { replace: true });

  if (!selected) {
    return (
      <>
        <PageHeader title="Budget" actions={<ThemeToggle />} />
        <Card className="flex items-center justify-between text-[13px] text-mute">
          Budgets are planned per paycheque.
          <Link to="/paycheques/new/details" className={btn.primary}>
            Add a paycheque
          </Link>
        </Card>
      </>
    );
  }

  return (
    <BudgetView
      key={selected.id}
      data={data}
      p={selected}
      today={now}
      nav={
        <PeriodNav
          label={`${periodLabel(selected.periodStart, selected.periodEnd)}, ${selected.periodEnd.slice(0, 4)}`}
          onPrev={i > 0 ? () => select(list[i - 1]) : undefined}
          onNext={i < list.length - 1 ? () => select(list[i + 1]) : undefined}
        />
      }
    />
  );
}

const cols = 'grid grid-cols-[12px_minmax(0,1fr)_minmax(80px,140px)_90px_var(--plan-col)_96px] items-center gap-3';

function BudgetView({ data, p, today, nav }: { data: MoneoData; p: Paycheque; today: string; nav: React.ReactNode }) {
  const savedLines = data.budgetLines.filter((l) => l.paychequeId === p.id);
  const [edit, setEdit] = useState<{ categoryId: string; plan: Cents }[] | null>(null);
  const summary = budgetSummary(data, p, today);
  const attention = needsAttention(data, p);
  const spent = new Map(
    spendByCategory(data.transactions, data.categories, p.periodStart, p.periodEnd).map((c) => [c.category.id, c.spent]),
  );
  const cats = [...data.categories].sort((a, b) => a.order - b.order);
  const lines = (edit ?? savedLines.map(({ categoryId, plan }) => ({ categoryId, plan })))
    .slice()
    .sort((a, b) => cats.findIndex((c) => c.id === a.categoryId) - cats.findIndex((c) => c.id === b.categoryId));
  const missing = cats.filter((c) => !lines.some((l) => l.categoryId === c.id));
  const plan = sum(lines.map((l) => l.plan));
  const totalSpent = sum(lines.map((l) => spent.get(l.categoryId) ?? 0));

  const save = async () => {
    if (!edit) return;
    await repo.setBudget(p.id, edit);
    setEdit(null);
    toast(`Plan saved · ${shortDate(p.payDate)} paycheque`);
  };

  return (
    <>
      <PageHeader
        title="Budget"
        actions={
          <>
            {nav}
            <ThemeToggle />
            {edit ? (
              <>
                <button type="button" className={btn.secondary} onClick={() => setEdit(null)}>
                  Cancel
                </button>
                <button type="button" className={`${btn.accent} px-4!`} onClick={save}>
                  Save plan
                </button>
              </>
            ) : (
              <button
                type="button"
                className={`${btn.primary} px-4!`}
                onClick={() => setEdit(savedLines.map(({ categoryId, plan }) => ({ categoryId, plan })))}
              >
                Edit plan
              </button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-[320px_minmax(0,1fr)] items-start gap-[14px] max-lg:grid-cols-1">
        <div className="flex flex-col gap-[14px]">
          <Card className="flex flex-col gap-3">
            <div className="text-[13px] text-mute">Plan used · this paycheque</div>
            <HalfRing
              height={140}
              thickness={24}
              gap={0}
              total={Math.max(summary.plan, summary.spent, 1)}
              segments={[{ value: summary.spent, color: 'var(--acc)' }]}
              center={
                <>
                  <div className="text-[34px] leading-none font-medium tracking-[-0.04em]">{Math.round(summary.used * 100)}%</div>
                  <div className="mt-1 text-[12px] text-mute">
                    {money(summary.spent)} of {money(summary.plan)}
                  </div>
                </>
              }
            />
            <div className="flex flex-col text-[13px]">
              <Row label="Left to spend" value={money(summary.left)} color={summary.left < 0 ? 'var(--acc)' : undefined} />
              <Row label="Days left" value={`${summary.daysLeft} of ${summary.length}`} />
              <Row
                label={summary.state === 'past' ? 'Spent in the period' : 'Projected at this pace'}
                value={money(summary.projected)}
                color={summary.projected > summary.plan ? 'var(--acc)' : 'var(--pos)'}
              />
            </div>
          </Card>
          {attention.length > 0 && (
            <Card className="flex flex-col">
              <CardHeader title="Needs attention" className="pb-2" />
              {attention.map((a) => (
                <div key={a.name} className="flex justify-between border-t border-line py-2.5 text-[13px]">
                  <span>{a.name}</span>
                  <span className="text-[12px]" style={{ color: toneColor[a.tone] }}>
                    {a.note}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </div>

        <Card className="flex flex-col" style={{ ['--plan-col' as string]: edit ? '132px' : '70px' }}>
          <CardHeader
            title="Planned vs. actual"
            meta={
              summary.state === 'current' ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-0.5 bg-ink" />
                  Today’s pace · day {summary.length - summary.daysLeft} of {summary.length}
                </span>
              ) : summary.state === 'past' ? (
                'Finished period'
              ) : (
                'Upcoming period'
              )
            }
            className="pb-2"
          />
          <div className={`${cols} border-b border-line py-2 text-[11px] text-mute`}>
            <span />
            <span>Category</span>
            <span />
            <span className="text-right">Spent</span>
            <span className="text-right">Plan</span>
            <span className="text-right">Left</span>
          </div>
          {lines.map((l) => {
            const c = cats.find((x) => x.id === l.categoryId);
            if (!c) return null;
            const s = spent.get(c.id) ?? 0;
            const over = s > l.plan;
            return (
              <div key={c.id} className={`${cols} border-b border-line py-2.5 text-[13px]`}>
                <Swatch color={c.color} round />
                <span className="truncate font-medium">{c.name}</span>
                <div className="relative h-1.5 rounded-full bg-track">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(l.plan ? s / l.plan : s ? 1 : 0, 1) * 100}%`, background: over ? 'var(--acc)' : c.color }}
                  />
                  {summary.state === 'current' && (
                    <div className="absolute -top-[3px] -bottom-[3px] w-0.5 bg-ink opacity-60" style={{ left: `${summary.pace * 100}%` }} />
                  )}
                </div>
                <span className="text-right">{money(s)}</span>
                {edit ? (
                  <Stepper
                    value={l.plan}
                    step={BUDGET_STEP}
                    label={`${c.name} plan`}
                    onChange={(v) => setEdit(edit.map((x) => (x.categoryId === c.id ? { ...x, plan: v } : x)))}
                  />
                ) : (
                  <span className="text-right text-mute">{money(l.plan, { decimals: 0 })}</span>
                )}
                <span className="text-right" style={{ color: over ? 'var(--acc)' : 'var(--mute)' }}>
                  {over ? `${money(s - l.plan)} over` : money(l.plan - s)}
                </span>
              </div>
            );
          })}
          <div className={`${cols} border-t border-ink pt-3 text-[13px] font-medium`}>
            <span />
            <span>Total</span>
            {edit && missing.length > 0 ? (
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button type="button" className="text-left text-[12px] font-normal text-mute hover:text-ink">
                    + Add category
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    align="start"
                    sideOffset={6}
                    className="z-50 flex min-w-44 flex-col rounded-[12px] border border-line bg-panel p-1 text-[13px] text-ink shadow-lg"
                  >
                    {missing.map((c) => (
                      <Popover.Close asChild key={c.id}>
                        <button
                          type="button"
                          className="flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-left hover:bg-panel2"
                          onClick={() => setEdit([...edit, { categoryId: c.id, plan: 0 }])}
                        >
                          <Swatch color={c.color} round />
                          {c.name}
                        </button>
                      </Popover.Close>
                    ))}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            ) : (
              <span />
            )}
            <span className="text-right">{money(totalSpent)}</span>
            <span className="text-right text-mute">{money(plan, { decimals: 0 })}</span>
            <span className="text-right" style={{ color: totalSpent > plan ? 'var(--acc)' : undefined }}>
              {totalSpent > plan ? `${money(totalSpent - plan)} over` : money(plan - totalSpent)}
            </span>
          </div>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between border-t border-line py-2.5">
      <span className="text-mute">{label}</span>
      <span className="font-medium" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
