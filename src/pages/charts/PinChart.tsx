import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { useMoneoData } from '@/data/hooks';
import { repo } from '@/data/repository';
import { today } from '@/domain/dates';
import type { PinSize } from '@/domain/types';
import { computeChart, MEASURES, PIN_SIZES, seriesOf } from '@/domain/charts';
import { PageHeader } from '@/components/shell/PageHeader';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { btn } from '@/components/ui/styles';
import { toast } from '@/stores/toast';
import { WizardFooter } from '@/pages/wizard/WizardFooter';
import { cardLabel, OVERVIEW_CARDS, OVERVIEW_ROWS, PIN_SPAN, pinnedByRow, rowOfCard } from '@/pages/overview/layout';

const SPAN_CLASS: Record<number, string> = { 3: 'col-span-3', 4: 'col-span-4', 6: 'col-span-6', 9: 'col-span-9', 12: 'col-span-12' };
const ROW_CLASS: Record<number, string> = { 1: 'row-span-1', 2: 'row-span-2' };

/** Animates map items from their previous position (FLIP) whenever `layoutKey` changes. */
function useFlip(container: React.RefObject<HTMLElement | null>, layoutKey: string) {
  const prev = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const els = container.current?.querySelectorAll<HTMLElement>('[data-flip]') ?? [];
    const next = new Map<string, DOMRect>();
    els.forEach((el) => {
      const key = el.dataset.flip!;
      const r = el.getBoundingClientRect();
      next.set(key, r);
      const p = prev.current.get(key);
      if (p && (p.left !== r.left || p.top !== r.top || p.width !== r.width)) {
        el.animate(
          [{ transformOrigin: 'top left', transform: `translate(${p.left - r.left}px, ${p.top - r.top}px) scale(${p.width / r.width}, ${p.height / r.height})` }, { transformOrigin: 'top left', transform: 'none' }],
          { duration: 250, easing: 'ease' },
        );
      }
    });
    prev.current = next;
  }, [container, layoutKey]);
}

export function PinChart() {
  const { id } = useParams();
  const data = useMoneoData();
  const navigate = useNavigate();
  const def = data?.charts.find((c) => c.id === id);
  // Choices made on this page, over the chart's current pin (or the defaults for a new pin).
  const [choice, setChoice] = useState<{ size?: PinSize; after?: string; alsoOn?: boolean }>({});
  const size = choice.size ?? def?.pin?.size ?? 'M';
  const after = choice.after ?? (def?.status === 'pinned' && def.pin?.after ? def.pin.after : 'pace');
  const alsoOn = choice.alsoOn ?? !!def?.pin?.alsoOn?.includes('paycheques');
  const setSize = (v: PinSize) => setChoice((c) => ({ ...c, size: v }));
  const setAfter = (v: string) => setChoice((c) => ({ ...c, after: v }));
  const setAlsoOn = (v: boolean) => setChoice((c) => ({ ...c, alsoOn: v }));
  const mapRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));
  useFlip(mapRef, `${size}|${after}|${!!def}`);

  if (!data) return null;
  if (!def) {
    return (
      <>
        <PageHeader crumb="Chart Studio" title="Chart not found" actions={<ThemeToggle />} />
        <Link to="/charts" className="text-[13px] text-acc">Back to Chart Studio →</Link>
      </>
    );
  }

  const others = data.charts.filter((c) => c.id !== def.id);
  const byRow = pinnedByRow(others);
  const myRow = rowOfCard(after);
  const sparkline = seriesOf(computeChart(def, data, today())).map((p) => p.value);
  const sizeMeta = PIN_SIZES.find((s) => s.size === size)!;
  const total = others.filter((c) => c.status === 'pinned').length + 1;

  const onDragEnd = (e: DragEndEvent) => {
    const over = e.over?.id ? String(e.over.id) : null;
    if (!over) return;
    // Dropping on another pinned chart lands in the same slot as it.
    setAfter(over.startsWith('pin:') ? others.find((c) => c.id === over.slice(4))?.pin?.after ?? after : over);
  };

  const pin = async () => {
    await repo.saveChart({ ...def, status: 'pinned', pin: { size, after, alsoOn: alsoOn ? ['paycheques'] : [], pinnedAt: def.status === 'pinned' && def.pin?.pinnedAt ? def.pin.pinnedAt : new Date().toISOString() }, editedAt: today() });
    toast(`Pinned “${def.title}” after ${cardLabel(after)}`);
    navigate('/');
  };

  return (
    <>
      <PageHeader crumb={`Chart Studio / ${def.title}`} title="Pin to Overview" actions={<ThemeToggle />} />
      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-[14px] max-lg:grid-cols-1">
        <Card className="flex flex-col gap-3">
          <CardHeader title="Overview layout" meta="Drag the new card to move it" />
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div ref={mapRef} className="grid auto-rows-[64px] grid-cols-12 gap-2 rounded-[14px] bg-bg p-3">
              {OVERVIEW_ROWS.map((row, r) => (
                <Fragment key={r}>
                  {row.cards.map((cid, i) => {
                    const card = OVERVIEW_CARDS.find((c) => c.id === cid)!;
                    return <Skeleton key={cid} id={cid} label={card.label} span={card.span} rows={row.height} newLine={i === 0} />;
                  })}
                  {/* Pinned charts get their own line after the row, as on the Overview. */}
                  {byRow[r].map((c, i) => (
                    <Skeleton
                      key={c.id}
                      id={`pin:${c.id}`}
                      label={c.title}
                      span={PIN_SPAN[c.pin!.size].cols * 3}
                      rows={PIN_SPAN[c.pin!.size].rows}
                      pinned
                      newLine={i === 0}
                    />
                  ))}
                  {r === myRow && (
                    <NewCard
                      title={def.title}
                      size={sizeMeta.label}
                      span={PIN_SPAN[size].cols * 3}
                      rows={PIN_SPAN[size].rows}
                      color={def.color}
                      values={sparkline}
                      newLine={byRow[r].length === 0}
                    />
                  )}
                </Fragment>
              ))}
            </div>
          </DndContext>
        </Card>

        <div className="flex flex-col gap-[14px]">
          <Card className="flex flex-col gap-4 text-[13px]">
            <Field label="Card size">
              <div role="radiogroup" aria-label="Card size" className="flex flex-col gap-1.5">
                {PIN_SIZES.map((o) => {
                  const on = o.size === size;
                  return (
                    <button
                      key={o.size}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setSize(o.size)}
                      className={`flex items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left ${on ? 'border-acc bg-panel2' : 'border-line hover:border-faint'}`}
                    >
                      <span className="grid h-[26px] w-11 flex-none grid-cols-4 gap-0.5" aria-hidden>
                        {Array.from({ length: 8 }, (_, k) => (
                          <span
                            key={k}
                            className="rounded-[2px]"
                            style={{ background: k % 4 < o.cols && Math.floor(k / 4) < o.rows ? (on ? 'var(--acc)' : 'var(--faint)') : 'var(--track)' }}
                          />
                        ))}
                      </span>
                      <span className="flex-1">
                        <span className="block font-medium">{o.label}</span>
                        <span className="block text-[11px] text-mute">{o.sub}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Place after">
              <Select
                label="Place after"
                className="py-[9px]! text-[13px]!"
                value={after}
                onChange={setAfter}
                options={OVERVIEW_CARDS.map((c) => ({ value: c.id, label: c.label }))}
              />
            </Field>
            <div className="flex items-center justify-between gap-2 border-t border-line pt-3.5">
              <div>
                <div>Also show on Paycheques</div>
                <div className="text-[11px] text-mute">Under the split bar</div>
              </div>
              <Switch checked={alsoOn} onChange={setAlsoOn} label="Also show on Paycheques" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div>Refresh</div>
                <div className="text-[11px] text-mute">
                  {MEASURES[def.measure].updates === 'Each paycheque' ? 'When a paycheque is saved' : 'When transactions change'}
                </div>
              </div>
              <span className="text-mute">Auto</span>
            </div>
          </Card>
          <div className="flex flex-col gap-1.5 rounded-[18px] bg-inv px-5 py-[18px] text-inv-ink">
            <div className="text-[12px] text-inv-mute">Overview will have</div>
            <div className="text-[22px] font-medium tracking-[-0.03em]">
              {total} pinned chart{total === 1 ? '' : 's'}
            </div>
            <div className="text-[12px] text-inv-mute">Unpin any of them from the card menu</div>
          </div>
        </div>
      </div>

      <WizardFooter
        left={<Link to={`/charts/${def.id}`} className={btn.secondary}>← Back to editor</Link>}
        status={`Lands after ${cardLabel(after)} · ${sizeMeta.label.toLowerCase()} card`}
      >
        <button type="button" className={btn.accent} onClick={pin}>
          {def.status === 'pinned' ? 'Update pin' : 'Pin chart'}
        </button>
      </WizardFooter>
    </>
  );
}

function Skeleton({ id, label, span, rows, pinned, newLine }: { id: string; label: string; span: number; rows: number; pinned?: boolean; newLine?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      data-flip={id}
      className={`${SPAN_CLASS[span]} ${ROW_CLASS[rows]} ${newLine ? 'col-start-1' : ''} flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-[10px] border bg-panel px-[11px] py-[9px] transition-colors ${
        isOver ? 'border-acc' : 'border-line'
      }`}
    >
      <span className={`truncate text-[11px] ${pinned ? 'text-ink' : 'text-mute'}`}>{label}</span>
      <div className="flex flex-1 flex-col justify-end gap-[5px]">
        <div className="h-[5px] w-[70%] rounded-[3px] bg-track" />
        <div className="h-[5px] w-[45%] rounded-[3px] bg-track" />
      </div>
    </div>
  );
}

function NewCard({ title, size, span, rows, color, values, newLine }: { title: string; size: string; span: number; rows: number; color: string; values: number[]; newLine?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: 'new' });
  const min = Math.min(...values), max = Math.max(...values), s = max - min || 1;
  const d = values.length > 1 ? values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * 300).toFixed(1)} ${(90 - ((v - min) / s) * 80).toFixed(1)}`).join(' ') : '';
  return (
    <div
      ref={setNodeRef}
      data-flip={isDragging ? undefined : 'new'}
      {...attributes}
      {...listeners}
      aria-label={`${title}, ${size} card. Drag onto a card to place it after that card.`}
      className={`${SPAN_CLASS[span]} ${ROW_CLASS[rows]} ${newLine ? 'col-start-1' : ''} relative z-10 flex min-w-0 cursor-grab touch-none flex-col gap-1.5 overflow-hidden rounded-[10px] border-[1.5px] border-dashed border-acc bg-panel px-[11px] py-[9px] active:cursor-grabbing`}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,.15)' : undefined }}
    >
      <div className="flex justify-between gap-2 text-[11px] font-medium text-acc">
        <span className="truncate">{title}</span>
        <span>{size}</span>
      </div>
      {d && (
        <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="min-h-0 w-full flex-1" aria-hidden>
          <path d={d} fill="none" style={{ stroke: color }} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}
