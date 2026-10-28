import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMoneoData } from '@/data/hooks';
import { repo } from '@/data/repository';
import { today } from '@/domain/dates';
import type { ChartDef } from '@/domain/types';
import { computeChart, headline, MEASURES, QUESTIONS, seriesOf, type ChartResult } from '@/domain/charts';
import { money } from '@/domain/money';
import { PageHeader } from '@/components/shell/PageHeader';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { MiniChart } from '@/components/charts/MiniChart';
import { btn } from '@/components/ui/styles';
import { QuestionList } from './shared';
import { chartSub } from './chartSub';
import { toneColor } from '@/components/ui/tone';
import { newId } from '@/lib/id';

function xRange(r: ChartResult): [string, string] {
  if (r.type === 'allocation') return ['$0', money(r.total, { decimals: 0 })];
  if (r.type === 'ranked') return ['', ''];
  const pts = seriesOf(r);
  return [pts[0]?.label ?? '', pts.at(-1)?.label ?? ''];
}

export function NewChart() {
  const data = useMoneoData();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = QUESTIONS.find((x) => x.id === params.get('q')) ?? QUESTIONS[0];
  const now = today();
  const preview: ChartDef = useMemo(() => ({ ...q.def, id: 'preview', status: 'draft', editedAt: now }), [q, now]);
  if (!data) return null;
  const result = computeChart(preview, data, now);
  const h = headline(preview, result);
  const [x0, x1] = xRange(result);

  const create = async (status: ChartDef['status'], def: Omit<ChartDef, 'id' | 'status' | 'editedAt'> = q.def) => {
    const id = newId();
    await repo.saveChart({ ...def, id, status, editedAt: now });
    navigate(`/charts/${id}`);
  };

  return (
    <>
      <PageHeader
        crumb="Chart Studio / New"
        title="What do you want to see?"
        actions={
          <>
            <ThemeToggle />
            <button type="button" className={btn.secondary} onClick={() => create('draft', { ...QUESTIONS[0].def, title: 'Untitled chart', question: undefined })}>
              Blank chart
            </button>
          </>
        }
      />
      <div className="grid grid-cols-[380px_minmax(0,1fr)] items-start gap-[14px] max-lg:grid-cols-1">
        <QuestionList selected={q.id} onPick={(id) => setParams({ q: id }, { replace: true })} />
        <div className="flex flex-col gap-4 rounded-[18px] border border-line bg-panel px-6 py-[22px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[12px] text-mute">Preview with your data</div>
              <div className="mt-1 text-[18px] font-medium">{preview.title}</div>
            </div>
            <div className="text-right">
              <div className="text-[26px] font-medium tracking-[-0.04em]">{h.big}</div>
              <div className="text-[12px]" style={{ color: toneColor[h.tone] }}>
                {h.delta}
              </div>
            </div>
          </div>
          <div className="border-b border-line">
            <MiniChart def={preview} result={result} height={280} size="lg" />
          </div>
          <div className="flex justify-between text-[11px] text-faint">
            <span>{x0}</span>
            <span>{x1}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-[13px]">
            <Tile label="Data" value={MEASURES[preview.measure].formula} />
            <Tile label="Chart" value={chartSub(preview)} />
            <Tile label="Updates" value={MEASURES[preview.measure].updates} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={`${btn.secondary} py-2.5!`} onClick={() => create('draft')}>
              Customize
            </button>
            <button type="button" className={btn.primary} onClick={() => create('saved')}>
              Use this chart →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-panel2 p-3">
      <div className="text-[11px] text-mute">{label}</div>
      <div className="mt-[3px]">{value}</div>
    </div>
  );
}
