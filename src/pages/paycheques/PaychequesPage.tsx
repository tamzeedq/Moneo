import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMoneoData } from '@/data/hooks';
import { repo } from '@/data/repository';
import type { Cents, MoneoData, Paycheque } from '@/domain/types';
import { money } from '@/domain/money';
import { dayShortDate, shortDate, today } from '@/domain/dates';
import { splitAccounts, splitStatus, SPLIT_STEP, templateAllocations } from '@/domain/wizard';
import { allocationMap, byPayDateDesc, paychequeHistory, sameAllocations } from '@/domain/views';
import { PageHeader } from '@/components/shell/PageHeader';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { Card, CardHeader } from '@/components/ui/Card';
import { HeroMoney } from '@/components/ui/Money';
import { PeriodNav } from '@/components/ui/PeriodNav';
import { Stepper } from '@/components/ui/Stepper';
import { Swatch } from '@/components/ui/Avatar';
import { btn, chip } from '@/components/ui/styles';
import { SaveTemplateDialog } from '@/components/SaveTemplateDialog';
import { AllocationBar } from '@/pages/wizard/AllocationBar';
import { toneColor } from '@/pages/wizard/WizardFooter';
import { PinnedRow } from '@/pages/overview/PinnedCharts';
import { toast } from '@/stores/toast';

export function PaychequesPage() {
  const data = useMoneoData();
  const [params, setParams] = useSearchParams();
  const now = today();
  if (!data) return null;

  const list = byPayDateDesc(data.paycheques);
  const selected = list.find((p) => p.id === params.get('id')) ?? list[0];
  const select = (p: Paycheque) => setParams({ id: p.id }, { replace: true });
  const i = selected ? list.indexOf(selected) : -1;

  return (
    <>
      <PageHeader
        title="Paycheques"
        actions={
          <>
            {selected && (
              <PeriodNav
                label={dayShortDate(selected.payDate) + ', ' + selected.payDate.slice(0, 4)}
                onPrev={i < list.length - 1 ? () => select(list[i + 1]) : undefined}
                onNext={i > 0 ? () => select(list[i - 1]) : undefined}
              />
            )}
            <ThemeToggle />
            <Link to="/paycheques/new/details" className="rounded-[11px] bg-inv px-3.5 py-[9px] text-[12px] font-medium text-inv-ink">
              + Add paycheque
            </Link>
          </>
        }
      />
      {selected ? (
        <Allocate key={selected.id} data={data} paycheque={selected} today={now} onSelect={select} />
      ) : (
        <Card className="flex items-center justify-between text-[13px] text-mute">
          No paycheques yet.
          <Link to="/paycheques/new/details" className={btn.primary}>Add your first paycheque</Link>
        </Card>
      )}
    </>
  );
}

function Allocate({ data, paycheque: p, today, onSelect }: { data: MoneoData; paycheque: Paycheque; today: string; onSelect: (p: Paycheque) => void }) {
  const saved = allocationMap(data, p.id);
  const [amounts, setAmounts] = useState<Record<string, Cents>>(saved);
  // Pick up external changes (e.g. after saving) while there are no local edits.
  const savedKey = JSON.stringify(saved);
  const [base, setBase] = useState(savedKey);
  useEffect(() => {
    if (savedKey !== base) {
      setBase(savedKey);
      setAmounts(JSON.parse(savedKey));
    }
  }, [savedKey, base]);

  const accounts = splitAccounts(data.accounts);
  const status = splitStatus(p.net, amounts);
  const dirty = !sameAllocations(amounts, saved);
  const upcoming = p.payDate > today;
  const templates = [...data.templates].sort((a, b) => a.order - b.order).filter((t) => t.id !== 'blank');
  const goals = new Map(data.goals.filter((g) => g.accountId && g.kind !== 'room').map((g) => [g.accountId!, g]));
  const charts = data.charts.filter((c) => c.pin?.alsoOn?.includes('paycheques'));
  const history = paychequeHistory(data, today);
  const pct = (v: Cents) => (p.net ? Math.round((v / p.net) * 100) : 0);

  const save = async () => {
    await repo.setAllocations(p.id, amounts);
    toast(`Allocation saved · ${shortDate(p.payDate)} paycheque`);
  };

  return (
    <>
      <Card className="flex flex-col gap-4 px-[22px]! py-5!">
        <div className="flex items-start justify-between gap-5">
          <div>
            <div className="text-[13px] text-mute">
              Allocate paycheque · {dayShortDate(p.payDate)} · {p.source}
            </div>
            <HeroMoney cents={p.net} className="mt-1 block text-[46px] leading-none font-medium tracking-[-0.045em]" />
          </div>
          <div className="text-right">
            <div className="text-[13px] text-mute">Remaining to allocate</div>
            <div className="mt-1 text-[30px] font-medium tracking-[-0.04em]" style={{ color: toneColor[status.tone] }}>
              {money(status.left)}
            </div>
            <div className="text-[12px]" style={{ color: toneColor[status.tone] }}>
              {status.left > 0 ? `${pct(status.left)}% of this paycheque is unassigned` : status.label}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[13px] text-mute">Template</span>
          {templates.map((t) => {
            const amts = templateAllocations(t, data.accounts);
            return (
              <button key={t.id} type="button" className={chip(sameAllocations(amts, amounts))} onClick={() => setAmounts(amts)}>
                {t.name}
              </button>
            );
          })}
          <SaveTemplateDialog
            data={data}
            amounts={amounts}
            from={`the ${shortDate(p.payDate)} paycheque`}
            triggerLabel="+ Save as template"
            triggerClassName="rounded-full border border-dashed border-faint px-3 py-1.5 text-[12px] text-mute hover:text-ink"
          />
        </div>
        <AllocationBar variant="blocks" height={72} accounts={accounts} allocations={amounts} net={p.net} onChange={setAmounts} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
          {accounts.map((a) => (
            <span key={a.id} className="flex items-center gap-[7px]">
              <Swatch color={a.color} />
              {a.shortName ?? a.name}
              <span className="text-mute">{pct(amounts[a.id] ?? 0)}%</span>
            </span>
          ))}
          <span className="ml-auto text-[12px] text-mute">Drag the dividers · snaps to $10</span>
        </div>
      </Card>

      {charts.length > 0 && <PinnedRow charts={charts.map((c) => ({ ...c, pin: { ...c.pin!, size: 'M' } }))} data={data} today={today} />}

      <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-[14px] max-lg:grid-cols-1">
        <Card className="flex flex-col">
          <div className="grid grid-cols-[minmax(0,1fr)_100px_16px_110px_132px] items-center gap-3 border-b border-line px-1 pb-2.5 text-[11px] text-mute">
            <span>{upcoming ? 'After this paycheque' : 'Split'}</span>
            <span className="text-right">{upcoming ? 'Now' : ''}</span>
            <span />
            <span className="text-right">{upcoming ? 'After' : 'Share'}</span>
            <span className="text-center">This paycheque</span>
          </div>
          {accounts.map((a) => {
            const amt = amounts[a.id] ?? 0;
            const g = goals.get(a.id);
            const goalPct = (v: Cents) => Math.round((v / g!.target) * 100);
            const sub = !g
              ? a.purpose
              : upcoming
                ? `${goalPct(a.balance)}% → ${goalPct(a.balance + amt)}% of ${money(g.target, { decimals: 0 })} goal`
                : `${goalPct(a.balance)}% of ${money(g.target, { decimals: 0 })} goal`;
            return (
              <div key={a.id} className="grid grid-cols-[minmax(0,1fr)_100px_16px_110px_132px] items-center gap-3 border-b border-line px-1 py-2.5 text-[13px]">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Swatch color={a.color} size={10} />
                  <div className="min-w-0">
                    <div className="font-medium">{a.shortName ?? a.name}</div>
                    <div className="truncate text-[11px] text-mute">{sub}</div>
                  </div>
                </div>
                <span className="text-right text-mute">{upcoming ? money(a.balance) : ''}</span>
                <span className="text-faint">{upcoming ? '→' : ''}</span>
                <span className="text-right font-medium">{upcoming ? money(a.balance + amt) : `${pct(amt)}%`}</span>
                <Stepper value={amt} step={SPLIT_STEP} label={`${a.shortName ?? a.name} amount`} onChange={(v) => setAmounts({ ...amounts, [a.id]: v })} />
              </div>
            );
          })}
          <div className="flex items-center justify-end gap-2.5 pt-3.5">
            {dirty && <span className="mr-auto text-[12px]" style={{ color: toneColor[status.tone] }}>{status.label}</span>}
            <button type="button" className={btn.secondary} disabled={!dirty} onClick={() => setAmounts(saved)}>
              Cancel
            </button>
            <button type="button" className={btn.accent} disabled={!dirty || !status.canContinue} onClick={save}>
              Save allocation
            </button>
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="History" meta={`${history.length} paycheques`} className="pb-2" />
          <div className="-mx-2 flex max-h-[460px] flex-col overflow-y-auto">
            {history.map((h) => (
              <button
                key={h.paycheque.id}
                type="button"
                onClick={() => onSelect(h.paycheque)}
                aria-current={h.paycheque.id === p.id}
                className={`flex items-center justify-between gap-3 rounded-[10px] border-t border-line px-2 py-2.5 text-left text-[13px] first:border-t-0 ${
                  h.paycheque.id === p.id ? 'bg-panel2' : 'hover:bg-panel2/60'
                }`}
              >
                <span className="min-w-0">
                  <span className="block font-medium">{shortDate(h.paycheque.payDate)}</span>
                  <span className="block truncate text-[11px]" style={{ color: toneColor[h.tone] }}>
                    {h.status}
                  </span>
                </span>
                <span>{money(h.paycheque.net)}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
