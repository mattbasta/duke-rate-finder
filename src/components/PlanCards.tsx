import type { PlanResult } from '../lib/calc';
import type { PlanId, RateConfig } from '../lib/rates/types';
import { fmtMoney } from '../lib/calc';
import { PLAN_COLORS, PLAN_IDS } from '../lib/rates';

interface Props {
  results: Record<PlanId, PlanResult>;
  config: RateConfig;
}

export default function PlanCards({ results, config }: Props) {
  const totals = PLAN_IDS.map((id) => ({ id, total: results[id].totalCost, kwh: results[id].totalKwh }));
  const cheapest = totals.reduce((a, b) => (a.total <= b.total ? a : b));
  const cheapestId = cheapest.id;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {PLAN_IDS.map((id) => {
        const r = results[id];
        const isCheapest = id === cheapestId;
        const delta = r.totalCost - cheapest.total;
        const eff = r.totalKwh > 0 ? r.totalCost / r.totalKwh : 0;
        return (
          <div
            key={id}
            className={`rounded-lg border bg-white p-4 shadow-sm ${
              isCheapest ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: PLAN_COLORS[id] }}
                />
                <h3 className="font-semibold text-slate-800">{config.plans[id].name}</h3>
              </div>
              {isCheapest && (
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  Cheapest
                </span>
              )}
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-900">{fmtMoney(r.totalCost)}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {r.totalKwh.toLocaleString('en-US', { maximumFractionDigits: 0 })} kWh ·{' '}
              {(eff * 100).toFixed(2)}¢/kWh effective
            </div>
            {!isCheapest && (
              <div className="mt-2 text-xs text-rose-600">
                +{fmtMoney(delta)} vs cheapest
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
