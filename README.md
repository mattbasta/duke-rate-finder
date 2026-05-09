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
    └── rates/
        ├── types.ts
        └── index.ts            # default RateConfig with the tariff numbers
```
