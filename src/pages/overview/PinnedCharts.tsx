import { Link } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import type { ChartDef, ISODate, MoneoData } from '@/domain/types';
import { computeChart, headline } from '@/domain/charts';
import { repo } from '@/data/repository';
import { Card } from '@/components/ui/Card';
import { MiniChart } from '@/components/charts/MiniChart';
import { toast } from '@/stores/toast';
import { toneVar } from '@/pages/charts/shared';
import { PIN_SPAN } from './layout';

const HEIGHT = { S: 56, M: 140, L: 220 } as const;
const COLS = { 1: 'col-span-1', 2: 'col-span-2', 4: 'col-span-4' } as const;

/** A row of pinned charts on the Overview (4-column grid). */
export function PinnedRow({ charts, data, today }: { charts: ChartDef[]; data: MoneoData; today: ISODate }) {
  if (!charts.length) return null;
  return (
    <div className="grid grid-cols-4 gap-[14px] max-lg:grid-cols-1">
      {charts.map((c) => (
        <PinnedChartCard key={c.id} def={c} data={data} today={today} />
      ))}
    </div>
  );
}

function PinnedChartCard({ def, data, today }: { def: ChartDef; data: MoneoData; today: ISODate }) {
  const size = def.pin?.size ?? 'M';
  const result = computeChart(def, data, today);
  const h = headline(def, result);
  const unpin = async () => {
    await repo.saveChart({ ...def, status: 'saved', pin: def.pin?.alsoOn?.length ? { ...def.pin, after: '' } : undefined, editedAt: today });
    toast(`Unpinned “${def.title}”`);
  };
  return (
    <Card className={`flex flex-col gap-2.5 ${COLS[PIN_SPAN[size].cols as 1 | 2 | 4]} max-lg:col-span-1`}>
      <div className="flex items-center justify-between gap-2">
        <Link to={`/charts/${def.id}`} className="truncate text-[14px] font-medium hover:underline">
          {def.title}
        </Link>
        <Popover.Root>
          <Popover.Trigger asChild>
            <button type="button" aria-label={`Options for ${def.title}`} className="rounded-[6px] px-1.5 text-[14px] leading-none text-mute hover:bg-panel2 hover:text-ink">
              ···
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="end" sideOffset={4} className="z-50 flex min-w-36 flex-col rounded-[12px] border border-line bg-panel p-1 text-[13px] text-ink shadow-lg">
              <Link to={`/charts/${def.id}`} className="rounded-[8px] px-2.5 py-2 hover:bg-panel2">Edit chart</Link>
              <Link to={`/charts/${def.id}/pin`} className="rounded-[8px] px-2.5 py-2 hover:bg-panel2">Move or resize</Link>
              <Popover.Close asChild>
                <button type="button" onClick={unpin} className="rounded-[8px] px-2.5 py-2 text-left text-acc hover:bg-panel2">
                  Unpin
                </button>
              </Popover.Close>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`${size === 'S' ? 'text-[20px]' : 'text-[22px]'} font-medium tracking-[-0.035em]`}>{h.big}</span>
        <span className="truncate text-[12px]" style={{ color: toneVar[h.tone] }}>
          {h.delta}
        </span>
      </div>
      <MiniChart def={def} result={result} height={HEIGHT[size]} size={size === 'L' ? 'lg' : 'sm'} />
    </Card>
  );
}
