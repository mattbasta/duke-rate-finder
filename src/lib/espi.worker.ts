import { parseEspiXml } from './espi';

self.addEventListener('message', (e: MessageEvent<{ xml: string }>) => {
  try {
    const result = parseEspiXml(e.data.xml);
    const transfer = [
      result.intervals.startSec.buffer,
      result.intervals.kwh.buffer,
    ] as Transferable[];
    (self as unknown as Worker).postMessage({ ok: true, result }, transfer);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
