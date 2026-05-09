import type { PlanResult } from '../lib/calc';
import type { PlanId, Window } from '../lib/rates/types';
import { fmtMoney } from '../lib/calc';

interface Props {
  results: Record<PlanId, PlanResult>;
  planIds: PlanId[];
}

const WINDOW_LABEL: Record<Window, string> = {
  on_peak: 'On-peak',
  off_peak: 'Off-peak',
  discount: 'Discount',
  critical_peak: 'Critical peak',
  standard: 'Standard',
};

const WINDOW_ORDER: Window[] = ['critical_peak', 'on_peak', 'standard', 'off_peak', 'discount'];

export default function TouTable({ results, planIds }: Props) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-800">Energy & cost by TOU window</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        How much energy fell in each tariff window over the loaded period.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {planIds.map((id) => {
          const r = results[id];
          const totalKwh = r.totalKwh;
          const rows = WINDOW_ORDER.filter((w) => r.byWindow[w]);
          if (rows.length === 0) return null;
          return (
            <div key={id} className="rounded border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800">
                {id}
              </div>
              <table className="w-full text-sm">
                <thead className="text-slate-600">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Window</th>
                    <th className="px-3 py-1.5 text-right font-medium">kWh</th>
                    <th className="px-3 py-1.5 text-right font-medium">% of kWh</th>
                    <th className="px-3 py-1.5 text-right font-medium">Energy cost (pre-tax)</th>
                    <th className="px-3 py-1.5 text-right font-medium">Avg ¢/kWh</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((w) => {
                    const v = r.byWindow[w]!;
                    const pct = totalKwh > 0 ? (v.kwh / totalKwh) * 100 : 0;
                    const avg = v.kwh > 0 ? (v.cost / v.kwh) * 100 : 0;
                    return (
                      <tr key={w} className="border-t border-slate-100">
                        <td className="px-3 py-1.5">{WINDOW_LABEL[w]}</td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          {v.kwh.toLocaleString('en-US', { maximumFractionDigits: 1 })}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono">{pct.toFixed(1)}%</td>
                        <td className="px-3 py-1.5 text-right font-mono">{fmtMoney(v.cost)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{avg.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </section>
  );
}
