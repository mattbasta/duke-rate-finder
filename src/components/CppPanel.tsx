import type { PlanResult } from '../lib/calc';
import type { RateConfig } from '../lib/rates/types';
import { fmtMoney } from '../lib/calc';

interface Props {
  result: PlanResult;
  config: RateConfig;
}

export default function CppPanel({ result, config }: Props) {
  if (!result.cppDetail) return null;
  const plan = config.plans['R-TOU-CPP'];
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-800">R-TOU-CPP critical-peak detail</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Worst-case estimate: assumes Duke called {plan.cppEventsPerYear} critical-peak events per
        year on the {plan.cppEventsPerYear} weekday on-peak periods with the highest load —
        i.e. an upper bound on what CPP would have cost. Actual CPP days are dispatched at Duke's
        discretion (up to 20/year per the tariff).
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Year</th>
              <th className="px-3 py-1.5 text-right font-medium">Intervals at CPP rate</th>
              <th className="px-3 py-1.5 text-right font-medium">kWh re-priced</th>
              <th className="px-3 py-1.5 text-right font-medium">Δ vs on-peak (pre-tax)</th>
            </tr>
          </thead>
          <tbody>
            {result.cppDetail.perYear.map((y) => (
              <tr key={y.year} className="border-t border-slate-100">
                <td className="px-3 py-1.5">{y.year}</td>
                <td className="px-3 py-1.5 text-right font-mono">{y.intervalsSelected}</td>
                <td className="px-3 py-1.5 text-right font-mono">{y.kwhSelected.toFixed(1)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmtMoney(y.addedCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
