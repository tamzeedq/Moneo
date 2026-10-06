import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { useMoneoData } from '@/data/hooks';
import { repo } from '@/data/repository';
import { today } from '@/domain/dates';
import type { ChartDef, ChartMeasure, MoneoData } from '@/domain/types';
import {
  BUCKET_LABELS, chartCsv, computeChart, defaultsFor, formatValue, KIND_LABELS, MEASURES, QUESTIONS, rangeOptions,
  seriesOf, seriesStats, SWATCHES, unitOf,
} from '@/domain/charts';
import { PageHeader } from '@/components/shell/PageHeader';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { MiniChart } from '@/components/charts/MiniChart';
import { SeriesPlot } from '@/components/charts/SeriesPlot';
import { btn, chip, field } from '@/components/ui/styles';
import { toast } from '@/stores/toast';
import { toneVar } from './shared';

const inputCls = `${field} py-[9px]! text-[13px]!`;

/** Loads a chart into local state and writes every change straight back ("autosaved"). */
function useChartDraft(data: MoneoData | undefined, id: string | undefined) {
  const [def, setDef] = useState<ChartDef | null>(null);
  useEffect(() => {
    if (data && id && def?.id !== id) setDef(data.charts.find((c) => c.id === id) ?? null);
  }, [data, id, def?.id]);
  const update = (patch: Partial<ChartDef>) => {
    if (!def) return;
    const next = { ...def, ...patch, editedAt: today() };
    setDef(next);
    void repo.saveChart(next);
  };
  return [def, update] as const;
}

export function ChartEditor() {
  const { id } = useParams();
  const data = useMoneoData();
  const navigate = useNavigate();
  const [def, update] = useChartDraft(data, id);
  if (!data) return null;
  if (!def) {
    return (
      <>
        <PageHeader crumb="Chart Studio" title="Chart not found" actions={<ThemeToggle />} />
        <Card className="text-[13px] text-mute">
          This chart doesn’t exist any more. <Link to="/charts" className="text-acc">Back to Chart Studio →</Link>
        </Card>
      </>
    );
  }

  const now = today();
  const meta = MEASURES[def.measure];
  const result = computeChart(def, data, now);
  const unit = unitOf(def);
  const points = seriesOf(result);
  const isSeries = result.type === 'series';
  const latest = points.at(-1);
  const stats = points.length ? seriesStats(def, points, result.type === 'series' ? result.unit : 'money') : [];
  const categories = [...data.categories].sort((a, b) => a.order - b.order);

  const setMeasure = (measure: ChartMeasure) => {
    const isDefaultTitle = QUESTIONS.some((q) => q.def.title === def.title) || def.title === 'Untitled chart';
    const q = QUESTIONS.find((x) => x.def.measure === measure)!;
    update({ ...defaultsFor(measure), measure, color: def.color, notes: def.notes, ...(isDefaultTitle ? { title: q.def.title, question: q.question } : {}) });
  };

  const exportCsv = () => {
    const blob = new Blob([chartCsv(def, result)], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: def.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.csv',
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const remove = async () => {
    if (!window.confirm(`Delete “${def.title}”? This can’t be undone.`)) return;
    await repo.deleteChart(def.id);
    toast('Chart deleted');
    navigate('/charts');
  };

  return (
    <>
      <PageHeader
        crumb={`Chart Studio / Edit · ${def.status === 'draft' ? 'draft, autosaved' : 'autosaved'}`}
        title={def.title || 'Untitled chart'}
        actions={
          <>
            <ThemeToggle />
            <button type="button" className={btn.secondary} onClick={exportCsv}>
              Export CSV
            </button>
            <Link to={`/charts/${def.id}/pin`} className={`${btn.accent} px-4!`}>
              {def.status === 'pinned' ? 'Edit pin' : 'Pin to Overview'}
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-[230px_minmax(0,1fr)_230px] items-start gap-[14px] max-xl:grid-cols-[230px_minmax(0,1fr)]">
        {/* Config */}
        <Card className="flex flex-col gap-[18px] p-[18px]! text-[13px]">
          <Field label="Measure">
            <Select
              label="Measure"
              className="py-[9px]! text-[13px]!"
              value={def.measure}
              onChange={(m) => setMeasure(m as ChartMeasure)}
              options={(Object.keys(MEASURES) as ChartMeasure[]).map((m) => ({ value: m, label: MEASURES[m].label }))}
            />
            <span className="text-[11px] text-mute">{meta.formula}</span>
          </Field>
          {(def.measure === 'categoryVsPlan' || def.measure === 'merchantSpend') && (
            <Field label="Category">
              <Select
                label="Category"
                className="py-[9px]! text-[13px]!"
                value={def.categoryId ?? 'all'}
                onChange={(v) => update({ categoryId: v === 'all' ? undefined : v })}
                options={[
                  ...(def.measure === 'merchantSpend' ? [{ value: 'all', label: 'All categories' }] : []),
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </Field>
          )}
          {def.measure !== 'merchantSpend' && (
            <Field label="Bucket by">
              <Select
                label="Bucket by"
                className="py-[9px]! text-[13px]!"
                value={def.bucket}
                onChange={(b) => {
                  const bucket = b as ChartDef['bucket'];
                  update({ bucket, range: rangeOptions({ measure: def.measure, bucket })[1].value });
                }}
                options={meta.buckets.map((b) => ({ value: b, label: BUCKET_LABELS[b] }))}
              />
            </Field>
          )}
          {def.measure !== 'allocation' && (
            <Field label="Range">
              <ToggleGroup.Root
                type="single"
                aria-label="Range"
                value={String(def.range)}
                onValueChange={(v) => v && update({ range: Number(v) })}
                className="flex gap-0.5 rounded-[10px] bg-seg p-[3px] text-[12px]"
              >
                {rangeOptions(def).map((o) => (
                  <ToggleGroup.Item
                    key={o.value}
                    value={String(o.value)}
                    className="flex-1 rounded-[8px] py-1.5 text-mute data-[state=on]:bg-nav-on data-[state=on]:text-ink data-[state=on]:shadow-tok"
                  >
                    {o.label}
                  </ToggleGroup.Item>
                ))}
              </ToggleGroup.Root>
            </Field>
          )}
          <Field label="Chart type">
            <div className="flex gap-1.5 text-[12px]" role="radiogroup" aria-label="Chart type">
              {meta.kinds.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={def.kind === k}
                  onClick={() => update({ kind: k })}
                  className={`flex-1 rounded-full border py-[7px] whitespace-nowrap ${def.kind === k ? 'border-inv bg-inv text-inv-ink' : 'border-line hover:border-faint'}`}
                >
                  {KIND_LABELS[k].replace('Stacked bars', 'Stacked')}
                </button>
              ))}
            </div>
          </Field>
          {isSeries && (
            <div className="flex flex-col gap-3 border-t border-line pt-3.5">
              <ToggleRow
                label="Compare to target"
                sub={def.target !== undefined ? `Dashed line at ${formatValue(def.target, unit)}` : 'Set a target first'}
                checked={def.showTarget}
                onChange={(showTarget) => update({ showTarget, target: def.target ?? (unit === 'percent' ? 30 : latest?.value) })}
              />
              <ToggleRow
                label="Show notes"
                sub={def.notes.length ? def.notes.map((n) => n.label.split(/[ ·+]/)[0].toLowerCase()).join(', ') : 'No notes yet'}
                checked={def.showNotes}
                onChange={(showNotes) => update({ showNotes })}
              />
            </div>
          )}
        </Card>

        {/* Plot */}
        <div className="flex min-w-0 flex-col gap-[14px]">
          <Card className="flex flex-col gap-3.5 px-[22px]! py-5!">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[12px] text-mute">{latest ? `Latest · ${latest.label}` : 'Latest'}</div>
                <div className="mt-0.5 text-[34px] leading-[1.05] font-medium tracking-[-0.045em]">
                  {latest ? formatValue(latest.value, result.type === 'series' ? result.unit : 'money') : '—'}
                </div>
              </div>
              {isSeries && (
                <div className="flex gap-4 text-[12px] text-mute">
                  <span className="flex items-center gap-1.5">
                    <span className="h-[3px] w-3.5 rounded-[2px]" style={{ background: def.color }} />
                    {unit === 'percent' || def.measure !== 'savingsRate' ? meta.label : 'Saved'}
                  </span>
                  {def.showTarget && def.target !== undefined && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 border-t-2 border-dashed border-ink opacity-60" />
                      Target {formatValue(def.target, unit)}
                    </span>
                  )}
                </div>
              )}
              {result.type === 'stacked' && (
                <div className="flex flex-wrap justify-end gap-3 text-[12px] text-mute">
                  {result.legend.map((l) => (
                    <span key={l.key} className="flex items-center gap-1.5">
                      <span className="size-2 rounded-[2px]" style={{ background: l.color }} />
                      {l.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {result.type === 'series' ? (
              <SeriesPlot def={def} points={result.points} unit={result.unit} />
            ) : (
              <>
                <MiniChart def={def} result={result} height={300} size="lg" />
                {points.length > 0 && (
                  <div className="flex justify-between px-3 text-[11px] text-faint">
                    {points.map((p) => (
                      <span key={p.date} className="flex-1 text-center">
                        {p.label}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>
          {stats.length > 0 && (
            <div className="grid grid-cols-4 rounded-[18px] border border-line bg-panel px-5 py-4">
              {stats.map((s, i) => (
                <div key={s.label} className={`px-3.5 ${i ? 'border-l border-line' : ''}`}>
                  <div className="text-[12px] text-mute">{s.label}</div>
                  <div className="mt-[3px] text-[20px] font-medium tracking-[-0.03em]">{s.value}</div>
                  <div className="mt-px text-[11px]" style={{ color: toneVar[s.tone] }}>
                    {s.sub}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Style */}
        <Card className="flex flex-col gap-[18px] p-[18px]! text-[13px] max-xl:col-span-2">
          <Field label="Title" htmlFor="title">
            <input id="title" className={inputCls} value={def.title} onChange={(e) => update({ title: e.target.value })} />
          </Field>
          <Field label="Colour">
            <div className="flex gap-2" role="radiogroup" aria-label="Colour">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={def.color === c}
                  aria-label={c}
                  onClick={() => update({ color: c })}
                  className="size-[30px] rounded-[9px]"
                  style={{ background: c, boxShadow: def.color === c ? `0 0 0 2px var(--panel), 0 0 0 4px ${c}` : 'none' }}
                />
              ))}
            </div>
          </Field>
          {def.measure === 'savingsRate' && (
            <Field label="Y axis">
              <div className="flex gap-1.5">
                {(['percent', 'dollars'] as const).map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={chip((def.yAxis ?? 'percent') === y)}
                    onClick={() => update({ yAxis: y, target: y === 'percent' ? 30 : 80000 })}
                  >
                    {y === 'percent' ? 'Percent' : 'Dollars'}
                  </button>
                ))}
              </div>
            </Field>
          )}
          {isSeries && <TargetField def={def} unit={unit} onChange={(target) => update({ target, showTarget: target !== undefined && def.showTarget })} />}
          {isSeries && <Notes def={def} points={points} onChange={(notes) => update({ notes })} />}
          <button type="button" onClick={remove} className="self-start text-[12px] text-mute hover:text-acc">
            Delete chart
          </button>
        </Card>
      </div>
    </>
  );
}

function ToggleRow({ label, sub, checked, onChange }: { label: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2.5">
      <div>
        <div>{label}</div>
        <div className="text-[11px] text-mute">{sub}</div>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function TargetField({ def, unit, onChange }: { def: ChartDef; unit: 'percent' | 'money'; onChange: (t: number | undefined) => void }) {
  const shown = def.target === undefined ? '' : unit === 'percent' ? String(def.target) : String(Math.round(def.target / 100));
  const [text, setText] = useState<string | null>(null);
  const suffix = unit === 'percent' ? 'of net pay' : def.bucket === 'paycheque' ? 'per paycheque' : `per ${def.bucket}`;
  return (
    <Field label="Target" htmlFor="target">
      <div className="flex items-center justify-between rounded-[10px] border border-line bg-bg px-3 py-[9px] focus-within:border-acc">
        <span className="flex items-center">
          {unit === 'money' && <span>$</span>}
          <input
            id="target"
            inputMode="decimal"
            className="bg-transparent outline-none"
            style={{ width: `${Math.max(1, (text ?? shown).length) + 0.4}ch` }}
            value={text ?? shown}
            placeholder="—"
            onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ''))}
            onBlur={() => {
              if (text !== null) onChange(text === '' ? undefined : unit === 'percent' ? Number(text) : Math.round(Number(text) * 100));
              setText(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          {unit === 'percent' && <span>%</span>}
        </span>
        <span className="text-faint">{suffix}</span>
      </div>
    </Field>
  );
}

function Notes({ def, points, onChange }: { def: ChartDef; points: ReturnType<typeof seriesOf>; onChange: (n: ChartDef['notes']) => void }) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(points.at(-1)?.date ?? '');
  const sorted = [...def.notes].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3.5">
      <span className="text-[12px] text-mute">Notes on chart</span>
      {sorted.length === 0 && <span className="text-[12px] text-mute">None yet</span>}
      {sorted.map((n) => (
        <div key={n.date + n.label} className="group flex justify-between gap-2 text-[12px]">
          <span className="truncate">{n.label}</span>
          <span className="flex flex-none items-center gap-1.5 text-mute">
            {points.find((p) => p.date === n.date)?.label ?? new Date(n.date + 'T00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
            <button
              type="button"
              aria-label={`Remove note ${n.label}`}
              className="text-faint opacity-0 group-hover:opacity-100 hover:text-acc focus:opacity-100"
              onClick={() => onChange(def.notes.filter((x) => x !== n))}
            >
              ×
            </button>
          </span>
        </div>
      ))}
      {adding ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim() || !date) return;
            onChange([...def.notes, { date, label: label.trim() }]);
            setLabel('');
            setAdding(false);
          }}
        >
          <input autoFocus className={inputCls} placeholder="e.g. Raise · 4%" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Select
            label="Note date"
            className="py-[9px]! text-[13px]!"
            value={date}
            onChange={setDate}
            options={[...points].reverse().map((p) => ({ value: p.date, label: p.title }))}
          />
          <div className="flex gap-2">
            <button type="submit" className={`${btn.primary} px-3! py-1.5! text-[12px]!`} disabled={!label.trim()}>
              Add
            </button>
            <button type="button" className={`${btn.secondary} px-3! py-1.5! text-[12px]!`} onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="self-start text-[12px] text-acc" onClick={() => setAdding(true)}>
          + Add note
        </button>
      )}
    </div>
  );
}
