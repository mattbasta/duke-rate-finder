import { NumberField } from './RateConfigPanel';
import type { BatteryConfig } from '../lib/battery';
import type { PlanId, RateConfig } from '../lib/rates/types';
import { fmtMoney } from '../lib/calc';
import { PLAN_COLORS } from '../lib/rates';

export interface BatteryPlanRow {
  planId: PlanId;
  baseCost: number;
  batteryCost: number;
  savings: number;
  annualSavings: number;
  kwhDischarged: number;
  equivalentFullCycles: number;
}

export interface PerfectPlanRow {
  planId: PlanId;
  perfectCost: number;
  savings: number;
  annualSavings: number;
}

interface Props {
  battery: BatteryConfig;
  onChange: (next: BatteryConfig) => void;
  rows: BatteryPlanRow[] | null;
  perfectRows: PerfectPlanRow[] | null;
  config: RateConfig;
  spanDays: number;
}

function fmtYears(y: number): string {
  if (!Number.isFinite(y) || y <= 0) return '—';
  if (y > 100) return '>100 yrs';
  return `${y.toFixed(1)} yrs`;
}

export default function BatteryPanel({
  battery,
  onChange,
  rows,
  perfectRows,
  config,
  spanDays,
}: Props) {
  const set = (mut: (b: BatteryConfig) => void) => {
    const next = { ...battery };
    mut(next);
    onChange(next);
  };

  const bestSavings = rows ? Math.max(...rows.map((r) => r.savings)) : 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="font-semibold text-slate-800">Home battery simulation</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Estimate how much a battery doing rate arbitrage (charge when cheap, discharge when
            expensive) would save under each plan, and how long it would take to pay off.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={battery.enabled}
            onChange={(e) => set((b) => (b.enabled = e.currentTarget.checked))}
            className="h-4 w-4 accent-sky-600"
          />
          Enable
        </label>
      </header>

      {battery.enabled && (
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <NumberField
              label="Usable capacity"
              value={battery.capacityKwh}
              step={0.5}
              min={0}
              unit="kWh"
              onChange={(v) => set((b) => (b.capacityKwh = Math.max(0, v)))}
            />
            <NumberField
              label="Max charge rate"
              value={battery.chargeKw}
              step={0.5}
              min={0}
              unit="kW"
              onChange={(v) => set((b) => (b.chargeKw = Math.max(0, v)))}
            />
            <NumberField
              label="Max discharge rate"
              value={battery.dischargeKw}
              step={0.5}
              min={0}
              unit="kW"
              onChange={(v) => set((b) => (b.dischargeKw = Math.max(0, v)))}
            />
            <NumberField
              label="Round-trip efficiency"
              value={battery.roundTripEfficiencyPct}
              step={1}
              min={1}
              max={100}
              unit="%"
              onChange={(v) => set((b) => (b.roundTripEfficiencyPct = Math.max(1, Math.min(100, v))))}
            />
            <NumberField
              label="Installed system cost"
              value={battery.systemCost}
              step={100}
              min={0}
              unit="$"
              onChange={(v) => set((b) => (b.systemCost = Math.max(0, v)))}
            />
          </div>

          {rows && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-2 pr-3 font-medium">Plan</th>
                    <th className="py-2 pr-3 text-right font-medium">Without battery</th>
                    <th className="py-2 pr-3 text-right font-medium">With battery</th>
                    <th className="py-2 pr-3 text-right font-medium">Savings</th>
                    <th className="py-2 pr-3 text-right font-medium">Savings / year</th>
                    <th className="py-2 pr-3 text-right font-medium">Payback</th>
                    <th className="py-2 text-right font-medium">Battery throughput</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const isBest = r.savings > 0 && r.savings === bestSavings;
                    const payback =
                      battery.systemCost > 0 && r.annualSavings > 0
                        ? battery.systemCost / r.annualSavings
                        : NaN;
                    return (
                      <tr
                        key={r.planId}
                        className={`border-b border-slate-100 ${isBest ? 'bg-emerald-50' : ''}`}
                      >
                        <td className="py-2 pr-3">
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: PLAN_COLORS[r.planId] }}
                            />
                            <span className="font-medium text-slate-800">
                              {config.plans[r.planId].name}
                            </span>
                            {isBest && (
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                                Best savings
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">{fmtMoney(r.baseCost)}</td>
                        <td className="py-2 pr-3 text-right font-mono">{fmtMoney(r.batteryCost)}</td>
                        <td
                          className={`py-2 pr-3 text-right font-mono ${
                            r.savings > 0.005 ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {fmtMoney(r.savings)}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">
                          {r.savings > 0.005 ? fmtMoney(r.annualSavings) : '—'}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">{fmtYears(payback)}</td>
                        <td className="py-2 text-right text-xs text-slate-500">
                          {r.kwhDischarged > 0
                            ? `${r.kwhDischarged.toLocaleString('en-US', { maximumFractionDigits: 0 })} kWh · ${r.equivalentFullCycles.toLocaleString('en-US', { maximumFractionDigits: 0 })} cycles`
                            : 'idle'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-slate-500">
                Savings cover the {Math.round(spanDays)} days of uploaded data; "savings / year"
                annualizes that. The simulation charges from the grid during each plan's cheapest
                hours and discharges to offset home load during expensive hours (one daily cycle
                horizon, no grid export, no net metering). Schedule RES prices energy the same all
                day, so arbitrage saves nothing there. For R-TOUD, charging is capped so it never
                raises the month's peak demand. Real-world results depend on the battery's control
                software; this assumes it dispatches optimally against known prices. Degradation
                and maintenance are not modeled.
              </p>
            </div>
          )}

          {perfectRows && (
            <div className="overflow-x-auto border-t border-slate-200 pt-4">
              <h3 className="font-semibold text-slate-800">Perfect battery (theoretical ceiling)</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                What an idealized battery — unlimited capacity, unlimited charge and discharge
                rates — could save under each plan. No real system reaches this; use it to judge
                how much of the opportunity your configured battery captures.
              </p>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-2 pr-3 font-medium">Plan</th>
                    <th className="py-2 pr-3 text-right font-medium">With perfect battery</th>
                    <th className="py-2 pr-3 text-right font-medium">Savings</th>
                    <th className="py-2 pr-3 text-right font-medium">Savings / year</th>
                    <th className="py-2 text-right font-medium">Your battery captures</th>
                  </tr>
                </thead>
                <tbody>
                  {perfectRows.map((r, i) => {
                    const realistic = rows?.[i];
                    const capture =
                      realistic && r.savings > 0.005 ? realistic.savings / r.savings : null;
                    return (
                      <tr key={r.planId} className="border-b border-slate-100">
                        <td className="py-2 pr-3">
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: PLAN_COLORS[r.planId] }}
                            />
                            <span className="font-medium text-slate-800">
                              {config.plans[r.planId].name}
                            </span>
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">{fmtMoney(r.perfectCost)}</td>
                        <td
                          className={`py-2 pr-3 text-right font-mono ${
                            r.savings > 0.005 ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {fmtMoney(r.savings)}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">
                          {r.savings > 0.005 ? fmtMoney(r.annualSavings) : '—'}
                        </td>
                        <td className="py-2 text-right font-mono">
                          {capture !== null ? `${(capture * 100).toFixed(0)}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-slate-500">
                For plans with fixed price windows, this buys every profitably-shiftable kWh
                during the month's cheapest hours. For R-TOUD it also flattens grid draw across
                the charge window so the on-peak demand charge disappears and the max-demand
                charge is minimized. The configured round-trip efficiency still applies — set it
                to 100% for the absolute ceiling. Schedule RES prices energy the same all day, so
                even a perfect battery saves nothing.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
