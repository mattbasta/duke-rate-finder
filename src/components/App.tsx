import { useMemo, useState } from 'react';
import FileDrop from './FileDrop';
import PlanCards from './PlanCards';
import RateConfigPanel from './RateConfigPanel';
import CostChart from './CostChart';
import TouTable from './TouTable';
import DemandPanel from './DemandPanel';
import CppPanel from './CppPanel';
import type { Intervals, ParseResult } from '../lib/espi';
import { calcAll, type PlanResult } from '../lib/calc';
import { aggregate, type Granularity } from '../lib/aggregate';
import { DEFAULT_CONFIG, PLAN_IDS } from '../lib/rates';
import type { PlanId, RateConfig } from '../lib/rates/types';
import { toZonedTime, format as fmtTz } from 'date-fns-tz';
import { TZ } from '../lib/billing';

function isoDateInTz(unixSec: number): string {
  const d = toZonedTime(unixSec * 1000, TZ);
  return fmtTz(d, 'yyyy-MM-dd', { timeZone: TZ });
}

function parseDateInTz(yyyyMmDd: string, endOfDay: boolean): number {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const wallEpoch = Date.UTC(y!, m! - 1, d!, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
  const tzAt = toZonedTime(wallEpoch, TZ);
  const offsetMs = tzAt.getTime() - wallEpoch;
  return Math.floor((wallEpoch - offsetMs) / 1000);
}

export default function App() {
  const [config, setConfig] = useState<RateConfig>(DEFAULT_CONFIG);
  const [intervals, setIntervals] = useState<Intervals | null>(null);
  const [meta, setMeta] = useState<ParseResult['meta'] | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const [grain, setGrain] = useState<Granularity>('month');
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');
  const [visiblePlans, setVisiblePlans] = useState<Set<PlanId>>(new Set(PLAN_IDS));

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setBusyLabel(`Reading ${file.name}…`);
    try {
      const text = await file.text();
      setBusyLabel('Parsing intervals…');
      const result = await parseInWorker(text);
      setIntervals(result.intervals);
      setMeta(result.meta);
      const n = result.intervals.startSec.length;
      if (n > 0) {
        const first = result.intervals.startSec[0]!;
        const last = result.intervals.startSec[n - 1]!;
        setRangeStart(isoDateInTz(first));
        setRangeEnd(isoDateInTz(last));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setBusyLabel('');
    }
  };

  const results = useMemo<Record<PlanId, PlanResult> | null>(() => {
    if (!intervals) return null;
    return calcAll(intervals, config);
  }, [intervals, config]);

  const dataMin = useMemo(() => {
    if (!intervals || intervals.startSec.length === 0) return '';
    return isoDateInTz(intervals.startSec[0]!);
  }, [intervals]);
  const dataMax = useMemo(() => {
    if (!intervals || intervals.startSec.length === 0) return '';
    return isoDateInTz(intervals.startSec[intervals.startSec.length - 1]!);
  }, [intervals]);

  const aggregated = useMemo(() => {
    if (!intervals || !results) return [];
    const start = rangeStart ? parseDateInTz(rangeStart, false) : null;
    const end = rangeEnd ? parseDateInTz(rangeEnd, true) : null;
    return aggregate(intervals, results, grain, start, end);
  }, [intervals, results, grain, rangeStart, rangeEnd]);

  const togglePlan = (id: PlanId) => {
    setVisiblePlans((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Duke Rate Finder</h1>
        <p className="mt-1 text-sm text-slate-600">
          Drop your Duke Energy Progress NC interval-usage XML and see what each residential rate
          schedule would have cost. Everything runs in your browser.
        </p>
      </header>

      <FileDrop onFile={handleFile} busy={busy} busyLabel={busyLabel} />

      {error && (
        <div className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {meta && intervals && (
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          {intervals.startSec.length.toLocaleString()} intervals @{' '}
          {meta.secondsPerInterval}s · {meta.unitOfMeasure ?? 'kWh'}
          {meta.meterSerialNumber ? ` · meter ${meta.meterSerialNumber}` : ''}
          {dataMin && dataMax ? ` · ${dataMin} → ${dataMax}` : ''}
        </div>
      )}

      <RateConfigPanel config={config} onChange={setConfig} />

      {results && intervals && (
        <>
          <PlanCards results={results} config={config} />

          <CostChart
            points={aggregated}
            grain={grain}
            onGrainChange={setGrain}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            rangeMin={dataMin}
            rangeMax={dataMax}
            onRangeStartChange={setRangeStart}
            onRangeEndChange={setRangeEnd}
            visiblePlans={visiblePlans}
            onTogglePlan={togglePlan}
          />

          <TouTable results={results} planIds={['R-TOU', 'R-TOUD', 'R-TOU-CPP', 'R-TOU-EV']} />

          <DemandPanel result={results['R-TOUD']} />

          <CppPanel result={results['R-TOU-CPP']} config={config} />
        </>
      )}

      <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500">
        <p>
          Calendar months are used as a proxy for billing cycles; adjust the "Billing cycle day"
          in the rate panel to match your actual meter-read date. Sales tax and per-kWh riders are
          editable estimates — verify against your bill before relying on the totals.
        </p>
      </footer>
    </div>
  );
}

function parseInWorker(xml: string): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('../lib/espi.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      import('../lib/espi').then(({ parseEspiXml }) => {
        try {
          resolve(parseEspiXml(xml));
        } catch (e) {
          reject(e);
        }
      });
      return;
    }
    worker.onmessage = (e: MessageEvent<{ ok: true; result: ParseResult } | { ok: false; error: string }>) => {
      if (e.data.ok) {
        resolve(e.data.result);
      } else {
        reject(new Error(e.data.error));
      }
      worker.terminate();
    };
    worker.onerror = (e) => {
      reject(new Error(e.message));
      worker.terminate();
    };
    worker.postMessage({ xml });
  });
}
