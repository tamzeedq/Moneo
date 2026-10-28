import { Link } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { useMoneoData } from '@/data/hooks';
import { workspace } from '@/data/workspace';
import { greeting, longDay, shortDate, today } from '@/domain/dates';
import { periodWindow, type TimeWindow } from '@/domain/periods';
import type { ISODate } from '@/domain/types';
import { PageHeader } from '@/components/shell/PageHeader';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { Segmented } from '@/components/ui/Segmented';
import { Field } from '@/components/ui/Field';
import { field } from '@/components/ui/styles';
import { PERIODS, useUI } from '@/stores/ui';
import { NetPositionCard } from './NetPositionCard';
import { AccountsCard } from './AccountsCard';
import { NextPaychequeCard, QuickActions } from './NextPaychequeCard';
import { SpendingPaceCard } from './SpendingPaceCard';
import { CategoryCard } from './CategoryCard';
import { LatestSplitCard } from './LatestSplitCard';
import { RecentTransactionsCard } from './RecentTransactionsCard';
import { BudgetWatchCard } from './BudgetWatchCard';
import { GoalsCard } from './GoalsCard';
import { PinnedRow } from './PinnedCharts';
import { pinnedByRow } from './layout';
import { Welcome } from './Welcome';

/** "day 8 of 14 this paycheque", "day 3 of 31 in October 2025", or "last paycheque Sep 26" once it has ended. */
function windowSubtitle(w: TimeWindow) {
  if (w.kind === 'Paycheque') return w.current ? `day ${w.elapsed} of ${w.length} this paycheque` : `last paycheque ${shortDate(w.start)}`;
  if (w.kind === 'Custom') return w.label;
  return w.current ? `day ${w.elapsed} of ${w.length} in ${w.label}` : w.label;
}

export function OverviewPage() {
  const data = useMoneoData();
  const { period, setPeriod, name, customRange } = useUI();
  const now = today();
  const w = data && periodWindow(period, now, data.paycheques, customRange);
  const pinned = pinnedByRow(data?.charts ?? []);
  const setUp = !!data?.accounts.length;
  // The demo matches the design's greeting; a real workspace uses the name from Settings, if any.
  const who = name.trim() || (workspace.id === 'demo' ? 'Sam' : '');

  return (
    <>
      <PageHeader
        title={who ? `${greeting()}, ${who}` : greeting()}
        subtitle={
          <>
            {longDay(now)}
            {setUp && w && ` · ${windowSubtitle(w)}`}
          </>
        }
        actions={
          <>
            {/* Nothing to scope or add to until the workspace has accounts. */}
            {setUp && period === 'Custom' && <CustomRange />}
            {setUp && <Segmented label="Period" value={period} options={PERIODS} onChange={setPeriod} />}
            <ThemeToggle />
            {setUp && (
              <Link to="/paycheques/new/details" className="rounded-[11px] bg-inv px-3.5 py-[9px] text-[12px] font-medium text-inv-ink">
                + Add paycheque
              </Link>
            )}
          </>
        }
      />

      {!data ? null : data.accounts.length === 0 ? (
        <Welcome data={data} />
      ) : (
        <>
          <NetPositionCard data={data} today={now} window={w} />
          <PinnedRow charts={pinned[0]} data={data} today={now} />

          <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-[14px] max-lg:grid-cols-1">
            <AccountsCard data={data} today={now} />
            <div className="flex flex-col gap-[14px]">
              <NextPaychequeCard data={data} today={now} />
              <QuickActions />
            </div>
          </div>
          <PinnedRow charts={pinned[1]} data={data} today={now} />

          <div className="grid grid-cols-3 gap-[14px] max-lg:grid-cols-1">
            <SpendingPaceCard data={data} today={now} window={w} />
            <CategoryCard data={data} today={now} window={w} />
            {/* Splits and budgets are planned per paycheque, so these two always show the latest paycheque. */}
            <LatestSplitCard data={data} today={now} />
          </div>
          <PinnedRow charts={pinned[2]} data={data} today={now} />

          <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)] gap-[14px] max-lg:grid-cols-1">
            <RecentTransactionsCard data={data} today={now} />
            <BudgetWatchCard data={data} today={now} />
            <GoalsCard data={data} />
          </div>
          <PinnedRow charts={pinned[3]} data={data} today={now} />
        </>
      )}
    </>
  );
}

/** Date range for the Custom period. */
function CustomRange() {
  const { customRange, setCustomRange } = useUI();
  const now = today();
  const w = periodWindow('Custom', now, [], customRange)!;
  const set = (patch: Partial<{ start: ISODate; end: ISODate }>) => setCustomRange({ start: w.start, end: w.end, ...patch });
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="rounded-[11px] border border-line px-3 py-2 text-[12px] hover:border-faint">
          {w.label} ▾
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 flex w-64 flex-col gap-3 rounded-[14px] border border-line bg-panel p-4 text-ink shadow-lg"
        >
          <Field label="From" htmlFor="range-start">
            <input
              id="range-start"
              type="date"
              className={field}
              value={w.start}
              max={w.end}
              onChange={(e) => e.target.value && set({ start: e.target.value })}
            />
          </Field>
          <Field label="To" htmlFor="range-end">
            <input
              id="range-end"
              type="date"
              className={field}
              value={w.end}
              min={w.start}
              onChange={(e) => e.target.value && set({ end: e.target.value })}
            />
          </Field>
          <button type="button" className="self-start text-[12px] text-mute hover:text-ink" onClick={() => setCustomRange(null)}>
            Reset to last 30 days
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
