# Duke Rate Finder

Static, all-client-side SPA that compares Duke Energy Progress NC residential rate plans against
your real interval-usage data.

Drop in your `Energy_Usage.xml` (NAESB ESPI export from Duke's portal) and it computes the bill
under all five residential schedules — RES, R-TOU, R-TOUD, R-TOU-CPP, R-TOU-EV — with charts and
breakdowns.

## Plans modeled

Defaults transcribed verbatim from NCUC Docket E-2 Sub 1300 (and Sub 1334 for R-TOU-EV) tariff
leaves 500–504, effective Oct 1, 2025 (R-TOU-EV pilot effective Jan 1, 2026):

| Schedule  | Customer | Energy ($/kWh)                                        | Demand ($/kW)        |
| --------- | -------- | ----------------------------------------------------- | -------------------- |
| RES       | $14.00   | summer 0.12623; winter 0.12623 first 800 / 0.11623    | —                    |
| R-TOU     | $14.00   | on 0.29905 / off 0.11321 / discount 0.07372           | —                    |
| R-TOUD    | $14.00   | on 0.15638 / off 0.06633 / discount 0.04347           | $1.99 on / $3.91 max |
| R-TOU-CPP | $14.00   | CPP 0.41002 / on 0.21952 / off 0.11000 / disc 0.08274 | —                    |
| R-TOU-EV  | $14.00   | std 0.13096 / discount (11pm–5am) 0.06548             | —                    |

TOU windows (Eastern Prevailing Time):

- **On-peak**: Mon–Fri excluding holidays — summer 6–9 PM, winter 6–9 AM.
- **Discount**: all days incl. holidays — summer 1–6 AM, winter 1–3 AM and 11 AM–4 PM.
- **Off-peak**: everything else.

Holidays follow the tariff: NYD, Good Friday, Memorial Day, Independence Day, Labor Day,
Thanksgiving and the day after, Christmas (Sat→prior Fri, Sun→following Mon).

Per-kWh riders and NC sales tax are **editable estimates** (defaults: 3.0¢/kWh and 7.0%);
override them in the rate panel to match your latest bill.

## Home battery simulation

Enable the "Home battery simulation" panel to model a battery doing rate arbitrage — buying
energy in each plan's cheapest windows and discharging to offset home load in the expensive
ones. Inputs: usable capacity (kWh), max charge/discharge rate (kW), round-trip efficiency (%),
and installed system cost ($, for payback). The panel shows, per plan, the cost with and without
the battery, the savings over the uploaded data, annualized savings, and years to pay off the
system.

How the dispatch works:

- Within each calendar day, profitable charge→discharge interval pairs are filled greedily
  (largest price spread first) subject to power limits, capacity, and round-trip losses. The
  battery starts and ends each day empty, and dispatch assumes perfect knowledge of the day's
  prices — an upper bound on what real control software achieves.
- Discharge only offsets home load; there is **no grid export** (no net metering).
- **RES** prices energy the same all hours, so arbitrage saves $0 there by construction.
- **R-TOUD**: charging is capped so the total draw never exceeds the month's original peak
  (the battery can't *increase* the max-demand charge), and discharge targets the highest-load
  on-peak intervals first, which also shaves on-peak demand.
- **R-TOU-CPP**: the battery discharges through on-peak windows, so the worst-case CPP events
  (re-selected on the modified load) are mitigated too.
- Degradation, maintenance, and standby losses are not modeled.

### Perfect battery ceiling

Below the realistic table, a second table shows what an idealized battery — unlimited capacity,
unlimited charge/discharge power — could save under each plan, plus what fraction of that
ceiling the configured battery captures. Per plan:

- **RES**: zero by construction (energy costs the same at every hour).
- **Energy-only TOU plans** (R-TOU, R-TOU-CPP, R-TOU-EV): every kWh whose window price exceeds
  the cost of battery-serving it — cheapest rate divided by round-trip efficiency — is instead
  purchased during the billing month's cheapest-rate hours. With 100% efficiency this reduces to
  "all energy bought at the lowest price". CPP events, re-selected on the shifted load, cost
  nothing since on-peak grid draw is zero.
- **R-TOUD**: energy shifting alone isn't optimal because of the demand charges. Grid purchasing
  is flattened to a constant draw across the charge window, eliminating the on-peak demand
  charge and minimizing the max-demand charge. Two charge windows are evaluated — discount hours
  only, and discount + off-peak — and the cheaper wins (the monthly cost is linear in the peak
  between those two endpoints, so the optimum is always one of them).

The configured round-trip efficiency still applies to the perfect battery; set it to 100% for
the absolute theoretical bound. Cycling is confined within each billing month.

## Assumptions and limitations

- **Billing cycle**: bill labeled month X covers the period from "billing cycle day" of month X-1
  through the day before "billing cycle day" of month X. Configurable in the UI (1–28). This
  matters for the RES winter inverted-block (first 800 kWh per billing month) and for monthly
  demand peaks on R-TOUD.
- **R-TOU-CPP**: the XML doesn't include which days Duke called critical-peak events. This tool
  estimates the **worst case** — assumes events landed on the highest-load weekday on-peak hours
  in each year. The event count (default 15, max 20 per tariff) and hours-per-event (default 3)
  are editable.
- **R-TOUD demand**: matches the tariff's 15-minute interval definition exactly, since the XML is
  also 15-minute. On-peak demand = max kW during on-peak hours; max demand = max kW anywhere in
  the billing month.
- **Service**: assumed single-phase; the +$9/mo three-phase adder is not applied.
- **Net metering / solar export**: not handled. ESPI delivered-only feeds are accepted.

## Local development

```bash
npm install
npm run dev      # Astro dev server on :4321
npm run build    # static site → dist/
npm run preview  # serve dist/ locally
```

Requires Node 18+.

## Deploying to S3 + CloudFront

The build is fully static (`output: 'static'` in `astro.config.mjs`):

```bash
npm run build
aws s3 sync dist/ s3://YOUR-BUCKET/ --delete
aws cloudfront create-invalidation --distribution-id YOUR-DIST-ID --paths "/*"
```

A few S3 + CloudFront notes:

- The site is a single page at `/index.html`; no client-side routing, so no need for the typical
  SPA "rewrite 404 → index.html" CloudFront function.
- The Web Worker is bundled as a separate ES module under `/_astro/`. Make sure your bucket /
  CloudFront forwards `Content-Type: text/javascript` for `.js` and serves `.worker.js` files
  with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`
  *only* if you ever add SharedArrayBuffer use; for this app, default headers are fine.
- All processing happens client-side; no S3 events / Lambda needed.

## Project layout

```
src/
├── pages/index.astro           # shell mounting <App client:only="react" />
├── components/                 # React UI islands
│   ├── App.tsx                 # state container
│   ├── FileDrop.tsx
│   ├── PlanCards.tsx
│   ├── RateConfigPanel.tsx     # billing cycle day + per-plan numbers
│   ├── BatteryPanel.tsx        # battery params + per-plan savings/payback table
│   ├── CostChart.tsx
│   ├── TouTable.tsx
│   ├── DemandPanel.tsx
│   └── CppPanel.tsx
└── lib/
    ├── espi.ts                 # NAESB ESPI XML → Float64Array intervals
    ├── espi.worker.ts          # off-thread parsing
    ├── billing.ts              # America/New_York wall-clock + billing-cycle math
    ├── tou.ts                  # season + holiday + window classifier
    ├── aggregate.ts            # resample to hour/day/week/month
    ├── calc.ts                 # cost engine, one function per plan kind
    ├── battery.ts              # battery arbitrage dispatch simulation
    └── rates/
        ├── types.ts
        └── index.ts            # default RateConfig with the tariff numbers
```
