import { Link } from 'react-router-dom';
import { useMoneoData } from '@/data/hooks';
import { PROFILE } from '@/data/seed';
import { greeting, longDay, today } from '@/domain/dates';
import { currentPaycheque, periodInfo } from '@/domain/selectors';
import { PageHeader } from '@/components/shell/PageHeader';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { Segmented } from '@/components/ui/Segmented';
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

export function OverviewPage() {
  const data = useMoneoData();
  const { period, setPeriod } = useUI();
  const now = today();
  const pay = data && currentPaycheque(data.paycheques, now);
  const info = pay && periodInfo(pay, now);

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${PROFILE.name}`}
        subtitle={
          <>
            {longDay(now)}
            {info && ` · day ${info.elapsed} of ${info.length} this paycheque`}
          </>
        }
        actions={
          <>
            <Segmented label="Period" value={period} options={PERIODS} onChange={setPeriod} />
            <ThemeToggle />
            <Link
              to="/paycheques/new/details"
              className="rounded-[11px] bg-inv px-3.5 py-[9px] text-[12px] font-medium text-inv-ink"
            >
              + Add paycheque
            </Link>
          </>
        }
      />

      {!data ? null : (
        <>
          <NetPositionCard data={data} today={now} />

          <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-[14px] max-lg:grid-cols-1">
            <AccountsCard data={data} today={now} />
            <div className="flex flex-col gap-[14px]">
              <NextPaychequeCard data={data} today={now} />
              <QuickActions />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-[14px] max-lg:grid-cols-1">
            <SpendingPaceCard data={data} today={now} />
            <CategoryCard data={data} today={now} />
            <LatestSplitCard data={data} today={now} />
          </div>

          <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)] gap-[14px] max-lg:grid-cols-1">
            <RecentTransactionsCard data={data} today={now} />
            <BudgetWatchCard data={data} today={now} />
            <GoalsCard data={data} />
          </div>
        </>
      )}
    </>
  );
}
