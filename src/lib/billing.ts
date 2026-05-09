import { toZonedTime } from 'date-fns-tz';

export const TZ = 'America/New_York';

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dow: number;
}

const partsCache = new Map<number, ZonedParts>();
const MAX_CACHE = 200000;

export function zonedParts(unixSec: number): ZonedParts {
  const hit = partsCache.get(unixSec);
  if (hit) return hit;
  const d = toZonedTime(unixSec * 1000, TZ);
  const parts: ZonedParts = {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
    dow: d.getDay(),
  };
  if (partsCache.size > MAX_CACHE) partsCache.clear();
  partsCache.set(unixSec, parts);
  return parts;
}

export function billingKey(parts: ZonedParts, billingCycleDay: number): string {
  let y = parts.year;
  let m = parts.month;
  if (parts.day < billingCycleDay) {
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function billingKeyForSec(unixSec: number, billingCycleDay: number): string {
  return billingKey(zonedParts(unixSec), billingCycleDay);
}

export function ymLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[m! - 1]} ${y}`;
}
