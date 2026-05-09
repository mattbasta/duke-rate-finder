export interface Intervals {
  startSec: Float64Array;
  kwh: Float64Array;
  secondsPerInterval: number;
}

export interface ParseResult {
  intervals: Intervals;
  meta: {
    serviceType?: string;
    unitOfMeasure?: string;
    secondsPerInterval: number;
    blockStartSec: number;
    durationSec: number;
    meterSerialNumber?: string;
  };
}

const RE_BLOCK_META =
  /<\s*(?:[\w-]+:)?secondsPerInterval[^>]*>\s*([0-9]+)\s*<\/\s*(?:[\w-]+:)?secondsPerInterval\s*>/i;
const RE_INTERVAL_START =
  /<\s*(?:[\w-]+:)?duration[^>]*>\s*([0-9]+)\s*<\/\s*(?:[\w-]+:)?duration\s*>\s*<\s*(?:[\w-]+:)?start[^>]*>\s*([0-9]+)\s*<\/\s*(?:[\w-]+:)?start\s*>/i;
const RE_SERVICE_TYPE =
  /<\s*(?:[\w-]+:)?serviceType[^>]*>\s*([^<]+)\s*<\/\s*(?:[\w-]+:)?serviceType\s*>/i;
const RE_UOM =
  /<\s*(?:[\w-]+:)?unitOfMeasure[^>]*>\s*([^<]+)\s*<\/\s*(?:[\w-]+:)?unitOfMeasure\s*>/i;
const RE_METER =
  /<\s*(?:[\w-]+:)?meterSerialNumber[^>]*>\s*([^<\s]+)\s*<\/\s*(?:[\w-]+:)?meterSerialNumber\s*>/i;

const RE_READING = new RegExp(
  '<\\s*(?:[\\w-]+:)?IntervalReading[^>]*>([\\s\\S]*?)<\\/\\s*(?:[\\w-]+:)?IntervalReading\\s*>',
  'g',
);
const RE_READING_START =
  /<\s*(?:[\w-]+:)?start[^>]*>\s*([0-9]+)\s*<\/\s*(?:[\w-]+:)?start\s*>/;
const RE_READING_VALUE =
  /<\s*(?:[\w-]+:)?value[^>]*>\s*(-?[0-9.]+)\s*<\/\s*(?:[\w-]+:)?value\s*>/;

export function parseEspiXml(xml: string): ParseResult {
  const secondsMatch = xml.match(RE_BLOCK_META);
  const secondsPerInterval = secondsMatch ? Number(secondsMatch[1]) : 900;

  const blockHeaderMatch = xml.match(RE_INTERVAL_START);
  const durationSec = blockHeaderMatch ? Number(blockHeaderMatch[1]) : 0;
  const blockStartSec = blockHeaderMatch ? Number(blockHeaderMatch[2]) : 0;

  const serviceType = xml.match(RE_SERVICE_TYPE)?.[1];
  const unitOfMeasure = xml.match(RE_UOM)?.[1];
  const meterSerialNumber = xml.match(RE_METER)?.[1];

  const expected =
    durationSec > 0 && secondsPerInterval > 0
      ? Math.ceil(durationSec / secondsPerInterval)
      : 100000;

  let starts = new Float64Array(expected);
  let kwhs = new Float64Array(expected);
  let n = 0;

  RE_READING.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_READING.exec(xml)) !== null) {
    const inner = m[1];
    const sm = inner.match(RE_READING_START);
    const vm = inner.match(RE_READING_VALUE);
    if (!sm || !vm) continue;
    if (n >= starts.length) {
      const grown = Math.ceil(starts.length * 1.5) + 1024;
      const ns = new Float64Array(grown);
      ns.set(starts);
      starts = ns;
      const nk = new Float64Array(grown);
      nk.set(kwhs);
      kwhs = nk;
    }
    starts[n] = Number(sm[1]);
    kwhs[n] = Number(vm[1]);
    n++;
  }

  const startSec = starts.slice(0, n);
  const kwh = kwhs.slice(0, n);

  return {
    intervals: { startSec, kwh, secondsPerInterval },
    meta: {
      serviceType,
      unitOfMeasure,
      secondsPerInterval,
      blockStartSec,
      durationSec,
      meterSerialNumber,
    },
  };
}
