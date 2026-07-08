import type { RatePlan } from './rates/types';
import type { Intervals } from './espi';
import { classifyTou, classifyEv } from './tou';
import { zonedParts, billingKeyForSec } from './billing';

export interface BatteryConfig {
  enabled: boolean;
  capacityKwh: number;
  chargeKw: number;
  dischargeKw: number;
  roundTripEfficiencyPct: number;
  systemCost: number;
}

export const DEFAULT_BATTERY: BatteryConfig = {
  enabled: false,
  capacityKwh: 13.5,
  chargeKw: 5,
  dischargeKw: 5,
  roundTripEfficiencyPct: 90,
  systemCost: 15000,
};

export interface BatterySimResult {
  intervals: Intervals;
  kwhCharged: number;
  kwhDischarged: number;
  equivalentFullCycles: number;
}

/** Marginal energy rate for every interval under a plan, or null when the
 *  plan has no time-varying price (nothing to arbitrage). */
function planIntervalRates(plan: RatePlan, intervals: Intervals): Float64Array | null {
  if (plan.kind === 'res') return null;
  const n = intervals.startSec.length;
  const rates = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const sec = intervals.startSec[i]!;
    if (plan.kind === 'tou_ev') {
      rates[i] =
        classifyEv(sec).window === 'discount' ? plan.energy.discount : plan.energy.standard;
    } else {
      const w = classifyTou(sec).window;
      rates[i] = (plan.energy as Record<string, number>)[w] ?? 0;
    }
  }
  return rates;
}

/**
 * Simulate a home battery doing rate arbitrage against a plan's energy prices.
 *
 * Dispatch model: within each calendar day (with perfect knowledge of that
 * day's prices), profitable charge→discharge interval pairs are filled
 * greedily, highest price spread first, subject to the charge/discharge power
 * limits, usable capacity, and round-trip efficiency. Discharge only offsets
 * home load (no grid export), so savings come purely from shifting purchases
 * from expensive windows to cheap ones. The battery starts and ends each day
 * empty.
 *
 * For R-TOUD, charging is additionally capped so the total grid draw never
 * exceeds the month's original peak, ensuring the battery cannot increase the
 * max-demand charge (it still reduces on-peak demand as a side effect of
 * discharging into the highest-load on-peak intervals first).
 */
export function simulateBattery(
  plan: RatePlan,
  intervals: Intervals,
  battery: BatteryConfig,
  billingCycleDay: number,
): BatterySimResult {
  const n = intervals.startSec.length;
  const eff = battery.roundTripEfficiencyPct / 100;
  const noop: BatterySimResult = {
    intervals,
    kwhCharged: 0,
    kwhDischarged: 0,
    equivalentFullCycles: 0,
  };
  if (
    n === 0 ||
    eff <= 0 ||
    eff > 1 ||
    battery.capacityKwh <= 0 ||
    battery.chargeKw <= 0 ||
    battery.dischargeKw <= 0
  ) {
    return noop;
  }

  const rates = planIntervalRates(plan, intervals);
  if (!rates) return noop;

  // For the demand plan, never let charging push an interval above the
  // month's original peak draw — that would add max-demand cost.
  let maxDrawByMonth: Map<string, number> | null = null;
  if (plan.kind === 'tou_d') {
    maxDrawByMonth = new Map();
    for (let i = 0; i < n; i++) {
      const ym = billingKeyForSec(intervals.startSec[i]!, billingCycleDay);
      const cur = maxDrawByMonth.get(ym) ?? 0;
      if (intervals.kwh[i]! > cur) maxDrawByMonth.set(ym, intervals.kwh[i]!);
    }
  }

  const dtH = intervals.secondsPerInterval / 3600;
  const chargeCapKwh = battery.chargeKw * dtH;
  const dischargeCapKwh = battery.dischargeKw * dtH;
  const riders = plan.ridersPerKwh;

  const newKwh = new Float64Array(intervals.kwh);
  let totCharged = 0;
  let totDischarged = 0;

  let dayStart = 0;
  while (dayStart < n) {
    const p0 = zonedParts(intervals.startSec[dayStart]!);
    let dayEnd = dayStart + 1;
    while (dayEnd < n) {
      const p = zonedParts(intervals.startSec[dayEnd]!);
      if (p.year !== p0.year || p.month !== p0.month || p.day !== p0.day) break;
      dayEnd++;
    }
    const len = dayEnd - dayStart;

    const pairs: Array<{ s: number; t: number; profit: number }> = [];
    for (let t = 1; t < len; t++) {
      const rt = rates[dayStart + t]!;
      if (intervals.kwh[dayStart + t]! <= 0) continue;
      for (let s = 0; s < t; s++) {
        const profit = rt + riders - (rates[dayStart + s]! + riders) / eff;
        if (profit > 1e-9) pairs.push({ s, t, profit });
      }
    }
    pairs.sort(
      (a, b) =>
        b.profit - a.profit ||
        intervals.kwh[dayStart + b.t]! - intervals.kwh[dayStart + a.t]!,
    );

    const soc = new Float64Array(len);
    const charged = new Float64Array(len);
    const discharged = new Float64Array(len);

    for (const { s, t } of pairs) {
      const si = dayStart + s;
      const ti = dayStart + t;
      const dRemain = Math.min(dischargeCapKwh, intervals.kwh[ti]!) - discharged[t]!;
      if (dRemain <= 1e-9) continue;
      let cRemainGrid = chargeCapKwh - charged[s]!;
      if (maxDrawByMonth) {
        const cap = maxDrawByMonth.get(billingKeyForSec(intervals.startSec[si]!, billingCycleDay))!;
        cRemainGrid = Math.min(cRemainGrid, cap - intervals.kwh[si]! - charged[s]!);
      }
      if (cRemainGrid <= 1e-9) continue;
      let maxSoc = 0;
      for (let j = s; j < t; j++) if (soc[j]! > maxSoc) maxSoc = soc[j]!;
      const headroom = battery.capacityKwh - maxSoc;
      if (headroom <= 1e-9) continue;
      const e = Math.min(dRemain, cRemainGrid * eff, headroom);
      charged[s] += e / eff;
      discharged[t] += e;
      for (let j = s; j < t; j++) soc[j] += e;
    }

    for (let j = 0; j < len; j++) {
      newKwh[dayStart + j] = intervals.kwh[dayStart + j]! + charged[j]! - discharged[j]!;
      totCharged += charged[j]!;
      totDischarged += discharged[j]!;
    }
    dayStart = dayEnd;
  }

  if (totDischarged <= 0) return noop;

  return {
    intervals: {
      startSec: intervals.startSec,
      kwh: newKwh,
      secondsPerInterval: intervals.secondsPerInterval,
    },
    kwhCharged: totCharged,
    kwhDischarged: totDischarged,
    equivalentFullCycles: totDischarged / battery.capacityKwh,
  };
}

export interface PerfectCandidate {
  intervals: Intervals;
  kwhShifted: number;
}

/**
 * Idealized load profiles for a battery with unlimited capacity and unlimited
 * charge/discharge power (round-trip efficiency still applies). Each returned
 * candidate should be run through the plan's cost calculator; the cheapest is
 * the "perfect battery" cost. Battery cycling stays within each billing month.
 *
 * Energy-only plans get one candidate: every interval whose price makes
 * battery-serving profitable is zeroed out and its energy (grossed up for
 * efficiency loss) is repurchased evenly across the month's cheapest-rate
 * intervals.
 *
 * The demand plan (R-TOUD) gets two candidates, since minimizing the
 * max-demand charge means flattening the grid draw across the charge window:
 * one flattens all purchasing across the month's cheapest price tier, the
 * other across the cheapest two tiers (wider window → lower peak kW but more
 * energy bought at the higher rate — the cost function is linear in the peak
 * between these two endpoints, so the optimum is one of them). On-peak draw is
 * zero in both, eliminating the on-peak demand charge.
 */
export function perfectBatteryProfiles(
  plan: RatePlan,
  intervals: Intervals,
  roundTripEfficiencyPct: number,
  billingCycleDay: number,
): PerfectCandidate[] {
  const n = intervals.startSec.length;
  const eff = roundTripEfficiencyPct / 100;
  if (n === 0 || eff <= 0 || eff > 1) return [];
  const rates = planIntervalRates(plan, intervals);
  if (!rates) return [];

  const months = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const ym = billingKeyForSec(intervals.startSec[i]!, billingCycleDay);
    let arr = months.get(ym);
    if (!arr) {
      arr = [];
      months.set(ym, arr);
    }
    arr.push(i);
  }

  if (plan.kind === 'tou_d') {
    const candidates: PerfectCandidate[] = [];
    for (const tierCount of [1, 2]) {
      const kwh = new Float64Array(n);
      let shifted = 0;
      for (const idxs of months.values()) {
        const tiers = [...new Set(idxs.map((i) => rates[i]!))].sort((a, b) => a - b);
        const allowed = new Set(tiers.slice(0, tierCount));
        const windowIdxs: number[] = [];
        let gridKwh = 0;
        for (const i of idxs) {
          if (allowed.has(rates[i]!)) {
            windowIdxs.push(i);
            gridKwh += intervals.kwh[i]!;
          } else {
            gridKwh += intervals.kwh[i]! / eff;
            shifted += intervals.kwh[i]!;
          }
        }
        if (windowIdxs.length === 0) continue;
        const per = gridKwh / windowIdxs.length;
        for (const i of windowIdxs) kwh[i] = per;
      }
      candidates.push({
        intervals: { startSec: intervals.startSec, kwh, secondsPerInterval: intervals.secondsPerInterval },
        kwhShifted: shifted,
      });
    }
    return candidates;
  }

  const riders = plan.ridersPerKwh;
  const kwh = new Float64Array(intervals.kwh);
  let shifted = 0;
  for (const idxs of months.values()) {
    let minRate = Infinity;
    for (const i of idxs) if (rates[i]! < minRate) minRate = rates[i]!;
    const batteryCostPerKwh = (minRate + riders) / eff;
    const minIdxs = idxs.filter((i) => rates[i]! === minRate);
    if (minIdxs.length === 0) continue;
    let pool = 0;
    for (const i of idxs) {
      if (rates[i]! > minRate && rates[i]! + riders > batteryCostPerKwh + 1e-12 && intervals.kwh[i]! > 0) {
        pool += intervals.kwh[i]! / eff;
        shifted += intervals.kwh[i]!;
        kwh[i] = 0;
      }
    }
    const per = pool / minIdxs.length;
    for (const i of minIdxs) kwh[i] += per;
  }
  if (shifted <= 0) return [];
  return [
    {
      intervals: { startSec: intervals.startSec, kwh, secondsPerInterval: intervals.secondsPerInterval },
      kwhShifted: shifted,
    },
  ];
}
