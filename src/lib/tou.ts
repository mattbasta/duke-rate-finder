import type { Season, Window } from './rates/types';
import { zonedParts, type ZonedParts } from './billing';

const observed = new Map<number, Set<string>>();

function easter(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function dowOf(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function shiftObserved(y: number, m: number, d: number): { m: number; d: number } {
  const dow = dowOf(y, m, d);
  if (dow === 6) {
    if (d === 1) {
      const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
      const lastDay = new Date(Date.UTC(prev.y, prev.m, 0)).getUTCDate();
      return { m: prev.m, d: lastDay };
    }
    return { m, d: d - 1 };
  }
  if (dow === 0) {
    const monthDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (d === monthDays) {
      const next = m === 12 ? { m: 1 } : { m: m + 1 };
      return { m: next.m, d: 1 };
    }
    return { m, d: d + 1 };
  }
  return { m, d };
}

function thanksgiving(year: number): { month: number; day: number } {
  const firstDow = dowOf(year, 11, 1);
  const day = 1 + ((4 - firstDow + 7) % 7) + 21;
  return { month: 11, day };
}

function holidaysFor(year: number): Set<string> {
  const cached = observed.get(year);
  if (cached) return cached;
  const fixed: Array<[number, number]> = [
    [1, 1],
    [7, 4],
    [12, 25],
  ];
  const set = new Set<string>();
  for (const [m, d] of fixed) {
    const o = shiftObserved(year, m, d);
    set.add(fmt(year, o.m, o.d));
  }
  const e = easter(year);
  const easterDate = new Date(Date.UTC(year, e.month - 1, e.day));
  const goodFriday = new Date(easterDate);
  goodFriday.setUTCDate(easterDate.getUTCDate() - 2);
  set.add(fmt(year, goodFriday.getUTCMonth() + 1, goodFriday.getUTCDate()));
  const memDow = dowOf(year, 5, 31);
  set.add(fmt(year, 5, 31 - ((memDow + 6) % 7)));
  const labDow = dowOf(year, 9, 1);
  set.add(fmt(year, 9, 1 + ((1 - labDow + 7) % 7)));
  const thx = thanksgiving(year);
  set.add(fmt(year, thx.month, thx.day));
  const dayAfter = new Date(Date.UTC(year, thx.month - 1, thx.day + 1));
  set.add(fmt(year, dayAfter.getUTCMonth() + 1, dayAfter.getUTCDate()));
  observed.set(year, set);
  return set;
}

export function isHoliday(parts: ZonedParts): boolean {
  return holidaysFor(parts.year).has(fmt(parts.year, parts.month, parts.day));
}

export function seasonOf(parts: ZonedParts): Season {
  return parts.month >= 5 && parts.month <= 9 ? 'summer' : 'winter';
}

export interface TouClass {
  season: Season;
  window: Window;
  isWeekdayNonHoliday: boolean;
}

export function classifyTou(unixSec: number): TouClass {
  const p = zonedParts(unixSec);
  const season = seasonOf(p);
  const isWeekdayNonHoliday = p.dow >= 1 && p.dow <= 5 && !isHoliday(p);
  let window: Window = 'off_peak';

  if (season === 'summer') {
    if (p.hour >= 1 && p.hour < 6) window = 'discount';
    else if (isWeekdayNonHoliday && p.hour >= 18 && p.hour < 21) window = 'on_peak';
  } else {
    if ((p.hour >= 1 && p.hour < 3) || (p.hour >= 11 && p.hour < 16)) window = 'discount';
    else if (isWeekdayNonHoliday && p.hour >= 6 && p.hour < 9) window = 'on_peak';
  }
  return { season, window, isWeekdayNonHoliday };
}

export interface EvClass {
  window: 'standard' | 'discount';
}

export function classifyEv(unixSec: number): EvClass {
  const p = zonedParts(unixSec);
  if (p.hour >= 23 || p.hour < 5) return { window: 'discount' };
  return { window: 'standard' };
}
