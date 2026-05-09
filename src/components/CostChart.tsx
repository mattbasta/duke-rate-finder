import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import type { Granularity, AggregatedPoint } from '../lib/aggregate';
import type { PlanId } from '../lib/rates/types';
import { PLAN_COLORS, PLAN_IDS } from '../lib/rates';

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Tooltip, Legend, Filler);

interface Props {
  points: AggregatedPoint[];
  grain: Granularity;
  onGrainChange: (g: Granularity) => void;
  rangeStart: string;
  rangeEnd: string;
  rangeMin: string;
  rangeMax: string;
  onRangeStartChange: (v: string) => void;
  onRangeEndChange: (v: string) => void;
  visiblePlans: Set<PlanId>;
  onTogglePlan: (id: PlanId) => void;
}

const grainUnit: Record<Granularity, 'hour' | 'day' | 'week' | 'month'> = {
  hour: 'hour',
  day: 'day',
  week: 'week',
  month: 'month',
};

export default function CostChart({
  points,
  grain,
  onGrainChange,
  rangeStart,
  rangeEnd,
  rangeMin,
  rangeMax,
  onRangeStartChange,
  onRangeEndChange,
  visiblePlans,
  onTogglePlan,
}: Props) {
  const data = useMemo(() => {
    const datasets = PLAN_IDS.filter((id) => visiblePlans.has(id)).map((id) => ({
      label: id,
      data: points.map((p) => ({ x: p.bucketStartSec * 1000, y: p.costsByPlan[id] })),
      borderColor: PLAN_COLORS[id],
      backgroundColor: PLAN_COLORS[id] + '33',
      tension: 0.15,
      pointRadius: points.length > 200 ? 0 : 2,
      borderWidth: 1.75,
    }));
    return { datasets };
  }, [points, visiblePlans]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-4 border-b border-slate-100 pb-3">
        <div>
          <h2 className="font-semibold text-slate-800">Cost over time</h2>
          <p className="text-xs text-slate-500">One series per plan. All five lines should sum-preserve when switching granularity.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-600">Granularity</label>
            <div className="mt-0.5 inline-flex overflow-hidden rounded border border-slate-300">
              {(['hour', 'day', 'week', 'month'] as Granularity[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onGrainChange(g)}
                  className={`px-2.5 py-1 text-xs ${
                    grain === g ? 'bg-sky-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col text-xs text-slate-600">
            From
            <input
              type="date"
              value={rangeStart}
              min={rangeMin}
              max={rangeMax}
              onChange={(e) => onRangeStartChange(e.currentTarget.value)}
              className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-600">
            To
            <input
              type="date"
              value={rangeEnd}
              min={rangeMin}
              max={rangeMax}
              onChange={(e) => onRangeEndChange(e.currentTarget.value)}
              className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {PLAN_IDS.map((id) => {
          const active = visiblePlans.has(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTogglePlan(id)}
              className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${
                active ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-100 text-slate-400 line-through'
              }`}
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PLAN_COLORS[id] }} />
              {id}
            </button>
          );
        })}
      </div>

      <div className="mt-3 h-80 w-full">
        <Line
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', intersect: false },
            scales: {
              x: {
                type: 'time',
                time: { unit: grainUnit[grain] },
                ticks: { autoSkip: true, maxTicksLimit: 10 },
              },
              y: {
                ticks: {
                  callback: (v) => `$${Number(v).toFixed(0)}`,
                },
              },
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) =>
                    `${ctx.dataset.label}: $${Number(ctx.parsed.y).toFixed(2)}`,
                },
              },
            },
          }}
        />
      </div>
    </section>
  );
}
