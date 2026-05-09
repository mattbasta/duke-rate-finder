export type Window =
  | 'on_peak'
  | 'off_peak'
  | 'discount'
  | 'critical_peak'
  | 'standard';

export type Season = 'summer' | 'winter';

export type PlanId = 'RES' | 'R-TOU' | 'R-TOUD' | 'R-TOU-CPP' | 'R-TOU-EV';

export interface RateCommon {
  customerCharge: number;
  ridersPerKwh: number;
  salesTaxRate: number;
}

export interface FlatRes extends RateCommon {
  kind: 'res';
  id: 'RES';
  name: string;
  summerRate: number;
  winterTier1Rate: number;
  winterTier2Rate: number;
  winterTier1Limit: number;
}

export interface RTou extends RateCommon {
  kind: 'tou';
  id: 'R-TOU';
  name: string;
  energy: { on_peak: number; off_peak: number; discount: number };
}

export interface RTouD extends RateCommon {
  kind: 'tou_d';
  id: 'R-TOUD';
  name: string;
  energy: { on_peak: number; off_peak: number; discount: number };
  demandOnPeak: number;
  demandMax: number;
}

export interface RTouCpp extends RateCommon {
  kind: 'tou_cpp';
  id: 'R-TOU-CPP';
  name: string;
  energy: {
    critical_peak: number;
    on_peak: number;
    off_peak: number;
    discount: number;
  };
  cppEventsPerYear: number;
  cppHoursPerEvent: number;
}

export interface RTouEv extends RateCommon {
  kind: 'tou_ev';
  id: 'R-TOU-EV';
  name: string;
  energy: { standard: number; discount: number };
}

export type RatePlan = FlatRes | RTou | RTouD | RTouCpp | RTouEv;

export interface GlobalConfig {
  billingCycleDay: number;
}

export interface RateConfig {
  global: GlobalConfig;
  plans: { [K in PlanId]: Extract<RatePlan, { id: K }> };
}
