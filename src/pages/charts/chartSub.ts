import type { ChartDef } from '@/domain/types';
import { KIND_LABELS, rangeLabel } from '@/domain/charts';

/** "Line · 12 paycheques" */
export const chartSub = (def: ChartDef) => `${KIND_LABELS[def.kind]} · ${rangeLabel(def)}`;
