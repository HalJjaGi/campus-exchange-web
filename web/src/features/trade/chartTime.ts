import type { Candle, CandleInterval } from "@/shared/types/api";

/**
 * lightweight-charts는 시각을 UTC로 그린다. 한국 시간으로 보이도록
 * 로컬 시간대 차이만큼 밀어서 넘긴다(차트 표시 전용 값).
 */
export function toChartTime(ms: number): number {
  const offset = new Date(ms).getTimezoneOffset() * 60_000;
  return Math.floor((ms - offset) / 1000);
}

const INTERVAL_MS: Record<Exclude<CandleInterval, "1d">, number> = { "1m": 60_000, "5m": 300_000 };

/** 체결 시각이 속한 봉의 시작 시각(ms). 일봉은 로컬 자정 기준 */
export function bucketStart(ms: number, interval: CandleInterval): number {
  if (interval === "1d") {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  const step = INTERVAL_MS[interval];
  return Math.floor(ms / step) * step;
}

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** 마지막 봉에 체결을 반영한다. 같은 봉이면 고가·저가·종가 갱신, 다음 봉이면 새 봉 */
export function applyTrade(last: Bar | null, time: number, price: number): Bar {
  if (!last || time > last.time) return { time, open: price, high: price, low: price, close: price };
  if (time < last.time) return last; // 이미 지난 봉의 늦은 체결은 차트에 다시 그리지 않는다
  return { ...last, high: Math.max(last.high, price), low: Math.min(last.low, price), close: price };
}

/** 차트가 체결 이벤트로 직접 그린 봉. ms는 봉 시작 시각(차트 표시용으로 밀기 전) */
export interface LiveCandle {
  ms: number;
  bar: Bar;
  /** 이 봉에 이벤트로 더해진 거래량 */
  addedVolume: number;
}

/**
 * 실시간으로 그린 봉을 캐시의 봉 목록에 되돌려 쓴다. 같은 시작 시각이면 바꾸고, 더 뒤면 붙인다.
 * 차트를 다시 그릴 때(캔들↔선, 주기 전환, 화면 재방문) 최근 봉이 빠지지 않게 하려는 것이다
 */
export function mergeLiveCandles(candles: Candle[], live: Iterable<LiveCandle>): Candle[] {
  const out = [...candles];
  for (const l of [...live].sort((a, b) => a.ms - b.ms)) {
    const values = { o: String(l.bar.open), h: String(l.bar.high), l: String(l.bar.low), c: String(l.bar.close) };
    const i = out.findIndex((c) => Date.parse(c.t) === l.ms);
    const existing = out[i];
    if (existing) out[i] = { ...existing, ...values, v: existing.v + l.addedVolume };
    else if (out.length === 0 || l.ms > Date.parse(out[out.length - 1]?.t ?? ""))
      out.push({ t: new Date(l.ms).toISOString(), ...values, v: l.addedVolume });
  }
  return out;
}
