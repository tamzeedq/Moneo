import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMoneoData } from '@/data/hooks';
import { today } from '@/domain/dates';
import { computeChart, editedLabel, headline, MEASURES, placementLabel, type Topic } from '@/domain/charts';
import { PageHeader } from '@/components/shell/PageHeader';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { MiniChart } from '@/components/charts/MiniChart';
import { btn, chip } from '@/components/ui/styles';
import { QuestionList, StatusBadge } from './shared';
import { chartSub } from './chartSub';
import { toneColor } from '@/components/ui/tone';

type Filter = 'all' | 'pinned' | 'drafts' | Topic;
const TOPICS: Topic[] = ['Spending', 'Saving', 'Accounts'];
export function ChartLibrary() {
  const data = useMoneoData();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const now = today();
  const charts = useMemo(() => [...(data?.charts ?? [])].sort((a, b) => b.editedAt.localeCompare(a.editedAt) || a.title.localeCompare(b.title)), [data]);
  if (!data) return null;

  const pinned = charts.filter((c) => c.status === 'pinned').length;
  const drafts = charts.filter((c) => c.status === 'draft').length;
  const shown = charts.filter((c) => {
    if (query && !c.title.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === 'pinned') return c.status === 'pinned';
    if (filter === 'drafts') return c.status === 'draft';
    if (filter !== 'all') return MEASURES[c.measure].topic === filter;
    return true;
  });

  return (
    <>
      <PageHeader
        crumb={`${charts.length} chart${charts.length === 1 ? '' : 's'} · ${pinned} pinned to Overview`}
        title="Chart Studio"
        actions={
          <>
            <input
              type="search"
              aria-label="Search charts"
              placeholder="Search charts"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-[220px] rounded-[11px] border border-line bg-panel px-3 py-[9px] text-[13px] outline-none placeholder:text-faint focus:border-acc"
            />
            <ThemeToggle />
            <Link to="/charts/new" className={`${btn.primary} px-4!`}>
              + New chart
            </Link>
          </>
        }
      />

      {charts.length === 0 ? (
        <div className="grid grid-cols-[380px_minmax(0,1fr)] items-start gap-[14px]">
          <QuestionList onPick={(q) => navigate(`/charts/new?q=${q}`)} />
          <div className="rounded-[18px] border border-dashed border-faint p-6 text-[13px] text-mute">
            No charts yet. Pick a question to start from your own data.
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Filter charts">
            <button type="button" className={chip(filter === 'all')} onClick={() => setFilter('all')}>All {charts.length}</button>
            <button type="button" className={chip(filter === 'pinned')} onClick={() => setFilter('pinned')}>Pinned {pinned}</button>
            <button type="button" className={chip(filter === 'drafts')} onClick={() => setFilter('drafts')}>Drafts {drafts}</button>
            {TOPICS.map((t) => (
              <button key={t} type="button" className={chip(filter === t, true)} onClick={() => setFilter(t)}>
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-[14px] max-lg:grid-cols-2 max-md:grid-cols-1">
            {shown.map((c) => {
              const result = computeChart(c, data, now);
              const h = headline(c, result);
              return (
                <Link
                  key={c.id}
                  to={`/charts/${c.id}`}
                  className="flex flex-col gap-3 rounded-[18px] border border-line bg-panel px-[18px] py-4 transition-colors hover:border-faint"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium">{c.title}</div>
                      <div className="mt-0.5 text-[11px] text-mute">{chartSub(c)}</div>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[22px] font-medium tracking-[-0.035em]">{h.big}</span>
                    <span className="truncate text-[12px]" style={{ color: toneColor[h.tone] }}>
                      {h.delta}
                    </span>
                  </div>
                  <MiniChart def={c} result={result} />
                  <div className="flex justify-between border-t border-line pt-2.5 text-[11px] text-mute">
                    <span>{editedLabel(c.editedAt, now)}</span>
                    <span>{placementLabel(c)}</span>
                  </div>
                </Link>
              );
            })}
            {shown.length === 0 && <div className="col-span-full py-8 text-center text-[13px] text-mute">No charts match.</div>}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 rounded-[16px] border border-dashed border-faint px-[18px] py-3.5 text-[13px]">
            <span className="text-mute">Start from a question instead of a blank chart: “Am I saving more?”, “Am I sticking to plan?”…</span>
            <Link to="/charts/new" className="rounded-[10px] border border-line bg-panel px-3.5 py-2 hover:border-faint">
              Browse templates
            </Link>
          </div>
        </>
      )}
    </>
  );
}
