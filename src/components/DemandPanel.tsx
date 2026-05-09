import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import type { PlanResult } from '../lib/calc';
import { fmtMoney } from '../lib/calc';
import { ymLabel } from '../lib/billing';
import { toZonedTime, format as fmtTz } from 'date-fns-tz';
import { TZ } from '../lib/billing';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface Props {
  result: PlanResult;
}

function fmtSec(sec: number | undefined): string {
  if (!sec) return '—';
  const d = toZonedTime(sec * 1000, TZ);
  return fmtTz(d, 'MMM d yyyy, h:mm a', { timeZone: TZ });
}

export default function DemandPanel({ result }: Props) {
  const data = useMemo(() => {
    const labels = result.monthly.map((r) => ymLabel(r.ym));
    return {
      labels,
      datasets: [
        {
          label: 'On-peak demand $',
          data: result.monthly.map((r) => r.demandOnPeakCost ?? 0),
          backgroundColor: '#22c55e',
        },
        {
          label: 'Max demand $',
          data: result.monthly.map((r) => r.demandMaxCost ?? 0),
          backgroundColor: '#0ea5e9',
        },
      ],
    };
  }, [result]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-800">R-TOUD demand breakdown</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        On-peak demand: largest 15-minute kW during the month's on-peak hours × $
        {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */}
        . Max demand: largest 15-minute kW anywhere in the billing month. Demand $ is added before
        riders and tax.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Month</th>
              <th className="px-3 py-1.5 text-right font-medium">kWh</th>
              <th className="px-3 py-1.5 text-right font-medium">On-peak kW</th>
              <th className="px-3 py-1.5 text-left font-medium">…at</th>
              <th className="px-3 py-1.5 text-right font-medium">Max kW</th>
              <th className="px-3 py-1.5 text-left font-medium">…at</th>
              <th className="px-3 py-1.5 text-right font-medium">Demand $</th>
              <th className="px-3 py-1.5 text-right font-medium">% of bill</th>
              <th className="px-3 py-1.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {result.monthly.map((r) => {
              const dTotal = (r.demandOnPeakCost ?? 0) + (r.demandMaxCost ?? 0);
              const share = r.total > 0 ? (dTotal * (1 + (r.tax / Math.max(1, r.preTax)))) / r.total : 0;
              return (
                <tr key={r.ym} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">{ymLabel(r.ym)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{r.kwh.toFixed(0)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{(r.onPeakKw ?? 0).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-500">{fmtSec(r.onPeakAtSec)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{(r.maxKw ?? 0).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-500">{fmtSec(r.maxAtSec)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtMoney(dTotal)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{(share * 100).toFixed(0)}%</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtMoney(r.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 h-64">
        <Bar
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { stacked: true },
              y: { stacked: true, ticks: { callback: (v) => `$${Number(v).toFixed(0)}` } },
            },
            plugins: {
              legend: { position: 'bottom' },
              tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: $${Number(ctx.parsed.y).toFixed(2)}` } },
            },
          }}
        />
      </div>
    </section>
  );
}
