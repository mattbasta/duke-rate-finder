import type { PlanId } from './rates/types';
import type { PlanResult } from './calc';
import type { Intervals } from './espi';
import { toZonedTime } from 'date-fns-tz';
import { TZ } from './billing';



export type Granularity = 'hour' | 'day' | 'week' | 'month';

export interface AggregatedPoint {
  bucketStartSec: number;
  costsByPlan: Record<PlanId, number>;
  kwh: number;
}

function bucketStartSec(unixSec: number, grain: Granularity): number {
  const z = toZonedTime(unixSec * 1000, TZ);
  let y = z.getFullYear();
  let m = z.getMonth();
  let d = z.getDate();
  let h = z.getHours();
  if (grain === 'hour') {
    // keep as-is
  } else if (grain === 'day') {
    h = 0;
  } else if (grain === 'week') {
    const dow = z.getDay();
    const offset = dow === 0 ? -6 : 1 - dow;
    const start = new Date(y, m, d + offset, 0, 0, 0, 0);
    y = start.getFullYear();
    m = start.getMonth();
    d = start.getDate();
    h = 0;
  } else if (grain === 'month') {
    d = 1;
    h = 0;
  }
  const wallEpoch = Date.UTC(y, m, d, h, 0, 0, 0);
  const tzAtBucket = toZonedTime(wallEpoch, TZ);
  const offsetMs = tzAtBucket.getTime() - wallEpoch;
  return Math.floor((wallEpoch - offsetMs) / 1000);
}

export function aggregate(
  intervals: Intervals,
  results: Record<PlanId, PlanResult>,
  grain: Granularity,
  rangeStartSec: number | null,
  rangeEndSec: number | null,
): AggregatedPoint[] {
  const n = intervals.startSec.length;
  const buckets = new Map<number, AggregatedPoint>();

  const planIds = Object.keys(results) as PlanId[];

  for (let i = 0; i < n; i++) {
    const sec = intervals.startSec[i]!;
    if (rangeStartSec !== null && sec < rangeStartSec) continue;
    if (rangeEndSec !== null && sec > rangeEndSec) continue;
    const bs = bucketStartSec(sec, grain);
    let p = buckets.get(bs);
    if (!p) {
      const empty: Record<PlanId, number> = {
        'RES': 0,
        'R-TOU': 0,
        'R-TOUD': 0,
        'R-TOU-CPP': 0,
        'R-TOU-EV': 0,
      };
      p = { bucketStartSec: bs, costsByPlan: empty, kwh: 0 };
      buckets.set(bs, p);
    }
    p.kwh += intervals.kwh[i]!;
    for (const id of planIds) {
      p.costsByPlan[id] += results[id].perInterval[i]!;
    }
  }

  return [...buckets.values()].sort((a, b) => a.bucketStartSec - b.bucketStartSec);
}
