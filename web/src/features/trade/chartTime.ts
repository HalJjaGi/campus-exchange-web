import type { CandleInterval } from "@/shared/types/api";

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
