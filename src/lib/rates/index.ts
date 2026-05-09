import type { RateConfig, PlanId } from './types';

export const PLAN_IDS: PlanId[] = ['RES', 'R-TOU', 'R-TOUD', 'R-TOU-CPP', 'R-TOU-EV'];

export const PLAN_COLORS: Record<PlanId, string> = {
  'RES': '#0ea5e9',
  'R-TOU': '#eab308',
  'R-TOUD': '#22c55e',
  'R-TOU-CPP': '#ef4444',
  'R-TOU-EV': '#a855f7',
};

export const DEFAULT_CONFIG: RateConfig = {
  global: {
    billingCycleDay: 1,
  },
  plans: {
    'RES': {
      kind: 'res',
      id: 'RES',
      name: 'Schedule RES',
      customerCharge: 14.0,
      ridersPerKwh: 0.03,
      salesTaxRate: 0.07,
      summerRate: 0.12623,
      winterTier1Rate: 0.12623,
      winterTier2Rate: 0.11623,
      winterTier1Limit: 800,
    },
    'R-TOU': {
      kind: 'tou',
      id: 'R-TOU',
      name: 'Schedule R-TOU',
      customerCharge: 14.0,
      ridersPerKwh: 0.03,
      salesTaxRate: 0.07,
      energy: { on_peak: 0.29905, off_peak: 0.11321, discount: 0.07372 },
    },
    'R-TOUD': {
      kind: 'tou_d',
      id: 'R-TOUD',
      name: 'Schedule R-TOUD',
      customerCharge: 14.0,
      ridersPerKwh: 0.03,
      salesTaxRate: 0.07,
      energy: { on_peak: 0.15638, off_peak: 0.06633, discount: 0.04347 },
      demandOnPeak: 1.99,
      demandMax: 3.91,
    },
    'R-TOU-CPP': {
      kind: 'tou_cpp',
      id: 'R-TOU-CPP',
      name: 'Schedule R-TOU-CPP',
      customerCharge: 14.0,
      ridersPerKwh: 0.03,
      salesTaxRate: 0.07,
      energy: {
        critical_peak: 0.41002,
        on_peak: 0.21952,
        off_peak: 0.11000,
        discount: 0.08274,
      },
      cppEventsPerYear: 15,
      cppHoursPerEvent: 3,
    },
    'R-TOU-EV': {
      kind: 'tou_ev',
      id: 'R-TOU-EV',
      name: 'Schedule R-TOU-EV',
      customerCharge: 14.0,
      ridersPerKwh: 0.03,
      salesTaxRate: 0.07,
      energy: { standard: 0.13096, discount: 0.06548 },
    },
  },
};

export type { RateConfig, RatePlan, PlanId, Window, Season } from './types';
