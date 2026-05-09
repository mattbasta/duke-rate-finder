import { useState } from 'react';
import type { RateConfig, PlanId } from '../lib/rates/types';
import { PLAN_IDS } from '../lib/rates';

interface Props {
  config: RateConfig;
  onChange: (next: RateConfig) => void;
}

function NumberField({
  label,
  value,
  step = 0.0001,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-700">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const v = e.currentTarget.valueAsNumber;
            if (Number.isFinite(v)) onChange(v);
          }}
          className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-sm focus:border-sky-500 focus:outline-none"
        />
        {unit && <span className="text-xs text-slate-500">{unit}</span>}
      </div>
    </label>
  );
}

export default function RateConfigPanel({ config, onChange }: Props) {
  const [active, setActive] = useState<PlanId>('RES');
  const [open, setOpen] = useState(true);

  const setPlan = (id: PlanId, mut: (p: any) => void) => {
    const next: RateConfig = JSON.parse(JSON.stringify(config));
    mut(next.plans[id]);
    onChange(next);
  };

  const setGlobal = (mut: (g: RateConfig['global']) => void) => {
    const next: RateConfig = JSON.parse(JSON.stringify(config));
    mut(next.global);
    onChange(next);
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="font-semibold text-slate-800">Rate configuration</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Defaults transcribed from Duke Progress NC tariff Leaf Nos. 500–504 (eff. Oct 1, 2025;
            504 eff. Jan 1, 2026). Riders and sales tax are <em>estimates</em> — verify against
            your actual bill.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </header>

      {open && (
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-3 rounded bg-slate-50 p-3 sm:grid-cols-3">
            <NumberField
              label="Billing cycle day (1–28)"
              value={config.global.billingCycleDay}
              step={1}
              min={1}
              max={28}
              onChange={(v) => setGlobal((g) => (g.billingCycleDay = Math.max(1, Math.min(28, Math.round(v)))))}
            />
            <p className="col-span-1 self-center text-xs text-slate-500 sm:col-span-2">
              Day of the month your meter is read. The bill labeled "October" covers the period
              from this day in September through the day before this day in October. Affects the
              winter inverted block (RES first 800 kWh) and the R-TOUD monthly demand peaks.
            </p>
          </div>

          <div className="flex flex-wrap gap-1 border-b border-slate-200">
            {PLAN_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setActive(id)}
                className={`rounded-t px-3 py-1.5 text-sm ${
                  active === id
                    ? 'bg-slate-100 font-semibold text-slate-900'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {id}
              </button>
            ))}
          </div>

          {active === 'RES' && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <NumberField
                label="Customer charge"
                value={config.plans.RES.customerCharge}
                step={0.01}
                unit="$/mo"
                onChange={(v) => setPlan('RES', (p) => (p.customerCharge = v))}
              />
              <NumberField
                label="Summer rate (May–Sep)"
                value={config.plans.RES.summerRate}
                step={0.0001}
                unit="$/kWh"
                onChange={(v) => setPlan('RES', (p) => (p.summerRate = v))}
              />
              <NumberField
                label="Winter tier 1"
                value={config.plans.RES.winterTier1Rate}
                step={0.0001}
                unit="$/kWh"
                onChange={(v) => setPlan('RES', (p) => (p.winterTier1Rate = v))}
              />
              <NumberField
                label="Winter tier 1 limit"
                value={config.plans.RES.winterTier1Limit}
                step={1}
                unit="kWh / mo"
                onChange={(v) => setPlan('RES', (p) => (p.winterTier1Limit = v))}
              />
              <NumberField
                label="Winter tier 2"
                value={config.plans.RES.winterTier2Rate}
                step={0.0001}
                unit="$/kWh"
                onChange={(v) => setPlan('RES', (p) => (p.winterTier2Rate = v))}
              />
              <NumberField
                label="Riders (estimate)"
                value={config.plans.RES.ridersPerKwh}
                step={0.0005}
                unit="$/kWh"
                onChange={(v) => setPlan('RES', (p) => (p.ridersPerKwh = v))}
              />
              <NumberField
                label="NC sales tax (estimate)"
                value={config.plans.RES.salesTaxRate}
                step={0.001}
                unit="fraction"
                onChange={(v) => setPlan('RES', (p) => (p.salesTaxRate = v))}
              />
            </div>
          )}

          {active === 'R-TOU' && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <NumberField
                label="Customer charge"
                value={config.plans['R-TOU'].customerCharge}
                step={0.01}
                unit="$/mo"
                onChange={(v) => setPlan('R-TOU', (p) => (p.customerCharge = v))}
              />
              <NumberField
                label="On-peak energy"
                value={config.plans['R-TOU'].energy.on_peak}
                unit="$/kWh"
                onChange={(v) => setPlan('R-TOU', (p) => (p.energy.on_peak = v))}
              />
              <NumberField
                label="Off-peak energy"
                value={config.plans['R-TOU'].energy.off_peak}
                unit="$/kWh"
                onChange={(v) => setPlan('R-TOU', (p) => (p.energy.off_peak = v))}
              />
              <NumberField
                label="Discount energy"
                value={config.plans['R-TOU'].energy.discount}
                unit="$/kWh"
                onChange={(v) => setPlan('R-TOU', (p) => (p.energy.discount = v))}
              />
              <NumberField
                label="Riders (estimate)"
                value={config.plans['R-TOU'].ridersPerKwh}
                step={0.0005}
                unit="$/kWh"
                onChange={(v) => setPlan('R-TOU', (p) => (p.ridersPerKwh = v))}
              />
              <NumberField
                label="NC sales tax (estimate)"
                value={config.plans['R-TOU'].salesTaxRate}
                step={0.001}
                unit="fraction"
                onChange={(v) => setPlan('R-TOU', (p) => (p.salesTaxRate = v))}
              />
            </div>
          )}

          {active === 'R-TOUD' && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <NumberField
                label="Customer charge"
                value={config.plans['R-TOUD'].customerCharge}
                step={0.01}
                unit="$/mo"
                onChange={(v) => setPlan('R-TOUD', (p) => (p.customerCharge = v))}
              />
              <NumberField
                label="On-peak demand"
                value={config.plans['R-TOUD'].demandOnPeak}
                step={0.01}
                unit="$/kW"
                onChange={(v) => setPlan('R-TOUD', (p) => (p.demandOnPeak = v))}
              />
              <NumberField
                label="Max demand"
                value={config.plans['R-TOUD'].demandMax}
                step={0.01}
                unit="$/kW"
                onChange={(v) => setPlan('R-TOUD', (p) => (p.demandMax = v))}
              />
              <NumberField
                label="On-peak energy"
                value={config.plans['R-TOUD'].energy.on_peak}
                unit="$/kWh"
                onChange={(v) => setPlan('R-TOUD', (p) => (p.energy.on_peak = v))}
              />
              <NumberField
                label="Off-peak energy"
                value={config.plans['R-TOUD'].energy.off_peak}
                unit="$/kWh"
                onChange={(v) => setPlan('R-TOUD', (p) => (p.energy.off_peak = v))}
              />
              <NumberField
                label="Discount energy"
                value={config.plans['R-TOUD'].energy.discount}
                unit="$/kWh"
                onChange={(v) => setPlan('R-TOUD', (p) => (p.energy.discount = v))}
              />
              <NumberField
                label="Riders (estimate)"
                value={config.plans['R-TOUD'].ridersPerKwh}
                step={0.0005}
                unit="$/kWh"
                onChange={(v) => setPlan('R-TOUD', (p) => (p.ridersPerKwh = v))}
              />
              <NumberField
                label="NC sales tax (estimate)"
                value={config.plans['R-TOUD'].salesTaxRate}
                step={0.001}
                unit="fraction"
                onChange={(v) => setPlan('R-TOUD', (p) => (p.salesTaxRate = v))}
              />
            </div>
          )}

          {active === 'R-TOU-CPP' && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <NumberField
                label="Customer charge"
                value={config.plans['R-TOU-CPP'].customerCharge}
                step={0.01}
                unit="$/mo"
                onChange={(v) => setPlan('R-TOU-CPP', (p) => (p.customerCharge = v))}
              />
              <NumberField
                label="Critical peak energy"
                value={config.plans['R-TOU-CPP'].energy.critical_peak}
                unit="$/kWh"
                onChange={(v) => setPlan('R-TOU-CPP', (p) => (p.energy.critical_peak = v))}
              />
              <NumberField
                label="On-peak energy"
                value={config.plans['R-TOU-CPP'].energy.on_peak}
                unit="$/kWh"
                onChange={(v) => setPlan('R-TOU-CPP', (p) => (p.energy.on_peak = v))}
              />
              <NumberField
                label="Off-peak energy"
                value={config.plans['R-TOU-CPP'].energy.off_peak}
                unit="$/kWh"
                onChange={(v) => setPlan('R-TOU-CPP', (p) => (p.energy.off_peak = v))}
              />
              <NumberField
                label="Discount energy"
                value={config.plans['R-TOU-CPP'].energy.discount}
                unit="$/kWh"
                onChange={(v) => setPlan('R-TOU-CPP', (p) => (p.energy.discount = v))}
              />
              <NumberField
                label="CPP events / year (max 20)"
                value={config.plans['R-TOU-CPP'].cppEventsPerYear}
                step={1}
                min={0}
                max={20}
                unit="events"
                onChange={(v) =>
                  setPlan('R-TOU-CPP', (p) => (p.cppEventsPerYear = Math.max(0, Math.min(20, Math.round(v)))))
                }
              />
              <NumberField
                label="Hours per event"
                value={config.plans['R-TOU-CPP'].cppHoursPerEvent}
                step={1}
                min={1}
                max={6}
                unit="hours"
                onChange={(v) => setPlan('R-TOU-CPP', (p) => (p.cppHoursPerEvent = Math.max(1, Math.round(v))))}
              />
              <NumberField
                label="Riders (estimate)"
                value={config.plans['R-TOU-CPP'].ridersPerKwh}
                step={0.0005}
                unit="$/kWh"
                onChange={(v) => setPlan('R-TOU-CPP', (p) => (p.ridersPerKwh = v))}
              />
              <NumberField
                label="NC sales tax (estimate)"
                value={config.plans['R-TOU-CPP'].salesTaxRate}
                step={0.001}
                unit="fraction"
                onChange={(v) => setPlan('R-TOU-CPP', (p) => (p.salesTaxRate = v))}
              />
            </div>
          )}

          {active === 'R-TOU-EV' && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <NumberField
                label="Customer charge"
                value={config.plans['R-TOU-EV'].customerCharge}
                step={0.01}
                unit="$/mo"
                onChange={(v) => setPlan('R-TOU-EV', (p) => (p.customerCharge = v))}
              />
              <NumberField
                label="Standard energy"
                value={config.plans['R-TOU-EV'].energy.standard}
                unit="$/kWh"
                onChange={(v) => setPlan('R-TOU-EV', (p) => (p.energy.standard = v))}
              />
              <NumberField
                label="Discount energy (11pm–5am)"
                value={config.plans['R-TOU-EV'].energy.discount}
                unit="$/kWh"
                onChange={(v) => setPlan('R-TOU-EV', (p) => (p.energy.discount = v))}
              />
              <NumberField
                label="Riders (estimate)"
                value={config.plans['R-TOU-EV'].ridersPerKwh}
                step={0.0005}
                unit="$/kWh"
                onChange={(v) => setPlan('R-TOU-EV', (p) => (p.ridersPerKwh = v))}
              />
              <NumberField
                label="NC sales tax (estimate)"
                value={config.plans['R-TOU-EV'].salesTaxRate}
                step={0.001}
                unit="fraction"
                onChange={(v) => setPlan('R-TOU-EV', (p) => (p.salesTaxRate = v))}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
