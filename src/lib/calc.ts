import type {
  RatePlan,
  RateConfig,
  PlanId,
  Window,
  FlatRes,
  RTou,
  RTouD,
  RTouCpp,
  RTouEv,
} from './rates/types';
import { classifyTou, classifyEv, seasonOf } from './tou';
import { billingKeyForSec, zonedParts } from './billing';
import type { Intervals } from './espi';

export interface MonthlyRow {
  ym: string;
  kwh: number;
  customer: number;
  energyCost: number;
  riderCost: number;
  demandOnPeakCost?: number;
  demandMaxCost?: number;
  onPeakKw?: number;
  onPeakAtSec?: number;
  maxKw?: number;
  maxAtSec?: number;
  cppHoursAdded?: number;
  cppCost?: number;
  preTax: number;
  tax: number;
  total: number;
}

export interface PlanResult {
  planId: PlanId;
  totalCost: number;
  totalKwh: number;
  perInterval: Float64Array;
  byWindow: Partial<Record<Window, { kwh: number; cost: number }>>;
  monthly: MonthlyRow[];
  cppDetail?: {
    perYear: { year: number; addedCost: number; intervalsSelected: number; kwhSelected: number }[];
    selectedIntervalIndices: Set<number>;
  };
}

interface MonthAccum {
  ym: string;
  kwh: number;
  byWindow: Map<Window, { kwh: number; cost: number }>;
  energyCost: number;
  onPeakMaxKwh: number;
  onPeakMaxAtSec: number;
  globalMaxKwh: number;
  globalMaxAtSec: number;
  intervalIdxs: number[];
}

function newMonth(ym: string): MonthAccum {
  return {
    ym,
    kwh: 0,
    byWindow: new Map(),
    energyCost: 0,
    onPeakMaxKwh: -Infinity,
    onPeakMaxAtSec: 0,
    globalMaxKwh: -Infinity,
    globalMaxAtSec: 0,
    intervalIdxs: [],
  };
}

function bumpWindow(m: MonthAccum, w: Window, kwh: number, cost: number) {
  const cur = m.byWindow.get(w);
  if (cur) {
    cur.kwh += kwh;
    cur.cost += cost;
  } else {
    m.byWindow.set(w, { kwh, cost });
  }
}

function finalizeMonths<P extends RatePlan>(
  plan: P,
  months: Map<string, MonthAccum>,
  perInterval: Float64Array,
  extras: (m: MonthAccum) => Pick<MonthlyRow, 'demandOnPeakCost' | 'demandMaxCost' | 'onPeakKw' | 'onPeakAtSec' | 'maxKw' | 'maxAtSec'>,
): { totalCost: number; rows: MonthlyRow[] } {
  const rows: MonthlyRow[] = [];
  let total = 0;

  const sorted = [...months.values()].sort((a, b) => (a.ym < b.ym ? -1 : 1));
  for (const m of sorted) {
    const ext = extras(m);
    const customer = plan.customerCharge;
    const riderCost = m.kwh * plan.ridersPerKwh;
    const demandTotal = (ext.demandOnPeakCost ?? 0) + (ext.demandMaxCost ?? 0);
    const preTax = customer + m.energyCost + demandTotal + riderCost;
    const tax = preTax * plan.salesTaxRate;
    const monthTotal = preTax + tax;
    const monthMultiplier = preTax === 0 ? 0 : monthTotal / preTax;

    for (const idx of m.intervalIdxs) {
      perInterval[idx] *= monthMultiplier;
    }
    const fixedShare = (customer + demandTotal) / Math.max(m.intervalIdxs.length, 1);
    for (const idx of m.intervalIdxs) {
      perInterval[idx] += fixedShare * monthMultiplier;
    }

    rows.push({
      ym: m.ym,
      kwh: m.kwh,
      customer,
      energyCost: m.energyCost,
      riderCost,
      demandOnPeakCost: ext.demandOnPeakCost,
      demandMaxCost: ext.demandMaxCost,
      onPeakKw: ext.onPeakKw,
      onPeakAtSec: ext.onPeakAtSec,
      maxKw: ext.maxKw,
      maxAtSec: ext.maxAtSec,
      preTax,
      tax,
      total: monthTotal,
    });
    total += monthTotal;
  }
  return { totalCost: total, rows };
}

function aggregateByWindow(months: Map<string, MonthAccum>): Partial<Record<Window, { kwh: number; cost: number }>> {
  const out: Partial<Record<Window, { kwh: number; cost: number }>> = {};
  for (const m of months.values()) {
    for (const [w, v] of m.byWindow.entries()) {
      const cur = out[w];
      if (cur) {
        cur.kwh += v.kwh;
        cur.cost += v.cost;
      } else {
        out[w] = { kwh: v.kwh, cost: v.cost };
      }
    }
  }
  return out;
}

export function calcRes(plan: FlatRes, intervals: Intervals, billingCycleDay: number): PlanResult {
  const n = intervals.startSec.length;
  const perInterval = new Float64Array(n);
  const months = new Map<string, MonthAccum>();

  for (let i = 0; i < n; i++) {
    const sec = intervals.startSec[i]!;
    const kwh = intervals.kwh[i]!;
    const ym = billingKeyForSec(sec, billingCycleDay);
    let m = months.get(ym);
    if (!m) {
      m = newMonth(ym);
      months.set(ym, m);
    }
    m.kwh += kwh;
    m.intervalIdxs.push(i);
    perInterval[i] = kwh;
  }

  for (const m of months.values()) {
    const [, mm] = m.ym.split('-').map(Number);
    const isSummer = mm! >= 5 && mm! <= 9;
    let cost = 0;
    if (isSummer) {
      cost = m.kwh * plan.summerRate;
    } else {
      const tier1 = Math.min(m.kwh, plan.winterTier1Limit);
      const tier2 = Math.max(0, m.kwh - plan.winterTier1Limit);
      cost = tier1 * plan.winterTier1Rate + tier2 * plan.winterTier2Rate;
    }
    m.energyCost = cost;
    const energyPerKwh = m.kwh > 0 ? cost / m.kwh : 0;
    for (const idx of m.intervalIdxs) {
      perInterval[idx] = intervals.kwh[idx]! * energyPerKwh + intervals.kwh[idx]! * plan.ridersPerKwh;
    }
    bumpWindow(m, 'standard', m.kwh, cost);
  }

  const { totalCost, rows } = finalizeMonths(plan, months, perInterval, () => ({}));
  return {
    planId: 'RES',
    totalCost,
    totalKwh: rows.reduce((s, r) => s + r.kwh, 0),
    perInterval,
    byWindow: aggregateByWindow(months),
    monthly: rows,
  };
}

function calcTouLike(
  plan: RTou | RTouD | RTouCpp,
  intervals: Intervals,
  billingCycleDay: number,
): { months: Map<string, MonthAccum>; perInterval: Float64Array } {
  const n = intervals.startSec.length;
  const perInterval = new Float64Array(n);
  const months = new Map<string, MonthAccum>();
  const energy = plan.energy as Record<Window, number>;

  for (let i = 0; i < n; i++) {
    const sec = intervals.startSec[i]!;
    const kwh = intervals.kwh[i]!;
    const c = classifyTou(sec);
    const rate = energy[c.window] ?? 0;
    const cost = kwh * rate;
    const ym = billingKeyForSec(sec, billingCycleDay);
    let m = months.get(ym);
    if (!m) {
      m = newMonth(ym);
      months.set(ym, m);
    }
    m.kwh += kwh;
    m.energyCost += cost;
    m.intervalIdxs.push(i);
    bumpWindow(m, c.window, kwh, cost);
    perInterval[i] = cost + kwh * plan.ridersPerKwh;

    if (plan.kind === 'tou_d') {
      if (c.window === 'on_peak' && kwh > m.onPeakMaxKwh) {
        m.onPeakMaxKwh = kwh;
        m.onPeakMaxAtSec = sec;
      }
      if (kwh > m.globalMaxKwh) {
        m.globalMaxKwh = kwh;
        m.globalMaxAtSec = sec;
      }
    }
  }
  return { months, perInterval };
}

export function calcRTou(plan: RTou, intervals: Intervals, billingCycleDay: number): PlanResult {
  const { months, perInterval } = calcTouLike(plan, intervals, billingCycleDay);
  const { totalCost, rows } = finalizeMonths(plan, months, perInterval, () => ({}));
  return {
    planId: 'R-TOU',
    totalCost,
    totalKwh: rows.reduce((s, r) => s + r.kwh, 0),
    perInterval,
    byWindow: aggregateByWindow(months),
    monthly: rows,
  };
}

export function calcRTouD(plan: RTouD, intervals: Intervals, billingCycleDay: number): PlanResult {
  const { months, perInterval } = calcTouLike(plan, intervals, billingCycleDay);
  const intervalsPerHour = 3600 / intervals.secondsPerInterval;
  const { totalCost, rows } = finalizeMonths(plan, months, perInterval, (m) => {
    const onPeakKw = m.onPeakMaxKwh > -Infinity ? m.onPeakMaxKwh * intervalsPerHour : 0;
    const maxKw = m.globalMaxKwh > -Infinity ? m.globalMaxKwh * intervalsPerHour : 0;
    return {
      onPeakKw,
      onPeakAtSec: m.onPeakMaxAtSec,
      maxKw,
      maxAtSec: m.globalMaxAtSec,
      demandOnPeakCost: onPeakKw * plan.demandOnPeak,
      demandMaxCost: maxKw * plan.demandMax,
    };
  });
  return {
    planId: 'R-TOUD',
    totalCost,
    totalKwh: rows.reduce((s, r) => s + r.kwh, 0),
    perInterval,
    byWindow: aggregateByWindow(months),
    monthly: rows,
  };
}

export function calcRTouCpp(plan: RTouCpp, intervals: Intervals, billingCycleDay: number): PlanResult {
  const { months, perInterval } = calcTouLike(plan, intervals, billingCycleDay);
  const intervalsPerHour = Math.round(3600 / intervals.secondsPerInterval);
  const cppDelta = plan.energy.critical_peak - plan.energy.on_peak;
  const intervalsPerEvent = plan.cppHoursPerEvent * intervalsPerHour;
  const intervalsPerYear = plan.cppEventsPerYear * intervalsPerEvent;

  const candidatesByYear = new Map<number, Array<{ idx: number; kwh: number }>>();
  for (let i = 0; i < intervals.startSec.length; i++) {
    const sec = intervals.startSec[i]!;
    const c = classifyTou(sec);
    if (c.window !== 'on_peak') continue;
    const year = zonedParts(sec).year;
    let arr = candidatesByYear.get(year);
    if (!arr) {
      arr = [];
      candidatesByYear.set(year, arr);
    }
    arr.push({ idx: i, kwh: intervals.kwh[i]! });
  }

  const selected = new Set<number>();
  const perYear: { year: number; addedCost: number; intervalsSelected: number; kwhSelected: number }[] = [];
  for (const [year, arr] of candidatesByYear.entries()) {
    arr.sort((a, b) => b.kwh - a.kwh);
    const take = Math.min(intervalsPerYear, arr.length);
    let kwhSel = 0;
    for (let i = 0; i < take; i++) {
      selected.add(arr[i]!.idx);
      kwhSel += arr[i]!.kwh;
    }
    const addedCost = kwhSel * cppDelta;
    perYear.push({ year, addedCost, intervalsSelected: take, kwhSelected: kwhSel });
  }
  perYear.sort((a, b) => a.year - b.year);

  let cppKwhTotal = 0;
  let cppCostTotal = 0;
  for (const idx of selected) {
    cppKwhTotal += intervals.kwh[idx]!;
    cppCostTotal += intervals.kwh[idx]! * plan.energy.critical_peak;
  }

  const monthCpp = new Map<string, { hours: number; cost: number; kwh: number }>();
  for (const idx of selected) {
    const sec = intervals.startSec[idx]!;
    const kwh = intervals.kwh[idx]!;
    const ym = billingKeyForSec(sec, billingCycleDay);
    const cur = monthCpp.get(ym) ?? { hours: 0, cost: 0, kwh: 0 };
    cur.hours += 1 / intervalsPerHour;
    cur.cost += kwh * plan.energy.critical_peak;
    cur.kwh += kwh;
    monthCpp.set(ym, cur);
    perInterval[idx] += kwh * cppDelta;
    const m = months.get(ym);
    if (m) m.energyCost += kwh * cppDelta;
  }

  const baseByWindow = aggregateByWindow(months);
  const byWindow: Partial<Record<Window, { kwh: number; cost: number }>> = { ...baseByWindow };
  if (baseByWindow.on_peak && cppKwhTotal > 0) {
    byWindow.on_peak = {
      kwh: baseByWindow.on_peak.kwh - cppKwhTotal,
      cost: baseByWindow.on_peak.cost - cppKwhTotal * plan.energy.on_peak,
    };
    byWindow.critical_peak = { kwh: cppKwhTotal, cost: cppCostTotal };
  }

  const { totalCost, rows } = finalizeMonths(plan, months, perInterval, () => ({}));
  for (const r of rows) {
    const cpp = monthCpp.get(r.ym);
    if (cpp) {
      r.cppHoursAdded = cpp.hours;
      r.cppCost = cpp.cost;
    }
  }

  return {
    planId: 'R-TOU-CPP',
    totalCost,
    totalKwh: rows.reduce((s, r) => s + r.kwh, 0),
    perInterval,
    byWindow,
    monthly: rows,
    cppDetail: { perYear, selectedIntervalIndices: selected },
  };
}

export function calcRTouEv(plan: RTouEv, intervals: Intervals, billingCycleDay: number): PlanResult {
  const n = intervals.startSec.length;
  const perInterval = new Float64Array(n);
  const months = new Map<string, MonthAccum>();
  const energy = plan.energy;

  for (let i = 0; i < n; i++) {
    const sec = intervals.startSec[i]!;
    const kwh = intervals.kwh[i]!;
    const w = classifyEv(sec).window;
    const rate = w === 'discount' ? energy.discount : energy.standard;
    const cost = kwh * rate;
    const ym = billingKeyForSec(sec, billingCycleDay);
    let m = months.get(ym);
    if (!m) {
      m = newMonth(ym);
      months.set(ym, m);
    }
    m.kwh += kwh;
    m.energyCost += cost;
    m.intervalIdxs.push(i);
    bumpWindow(m, w, kwh, cost);
    perInterval[i] = cost + kwh * plan.ridersPerKwh;
  }

  const { totalCost, rows } = finalizeMonths(plan, months, perInterval, () => ({}));
  return {
    planId: 'R-TOU-EV',
    totalCost,
    totalKwh: rows.reduce((s, r) => s + r.kwh, 0),
    perInterval,
    byWindow: aggregateByWindow(months),
    monthly: rows,
  };
}

export function calcPlan(planId: PlanId, config: RateConfig, intervals: Intervals): PlanResult {
  const cd = config.global.billingCycleDay;
  switch (planId) {
    case 'RES':
      return calcRes(config.plans['RES'], intervals, cd);
    case 'R-TOU':
      return calcRTou(config.plans['R-TOU'], intervals, cd);
    case 'R-TOUD':
      return calcRTouD(config.plans['R-TOUD'], intervals, cd);
    case 'R-TOU-CPP':
      return calcRTouCpp(config.plans['R-TOU-CPP'], intervals, cd);
    case 'R-TOU-EV':
      return calcRTouEv(config.plans['R-TOU-EV'], intervals, cd);
  }
}

export function calcAll(intervals: Intervals, config: RateConfig): Record<PlanId, PlanResult> {
  return {
    'RES': calcPlan('RES', config, intervals),
    'R-TOU': calcPlan('R-TOU', config, intervals),
    'R-TOUD': calcPlan('R-TOUD', config, intervals),
    'R-TOU-CPP': calcPlan('R-TOU-CPP', config, intervals),
    'R-TOU-EV': calcPlan('R-TOU-EV', config, intervals),
  };
}

export function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

export function fmtKwh(n: number): string {
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 1 })} kWh`;
}

export { seasonOf };
