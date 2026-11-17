import { toDecimal, type DecimalInput } from "./decimal";

/** U+2212. 하이픈(-)보다 폭이 숫자와 맞는다. */
const MINUS = "−";

const groupInt = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** 천 단위 쉼표. 소수부는 0이 아닐 때만 표시. */
function grouped(value: DecimalInput, maxFraction: number): string {
  const d = toDecimal(value);
  const abs = d.abs().toFixed(maxFraction);
  const [int = "0", frac = ""] = abs.split(".");
  const trimmed = frac.replace(/0+$/, "");
  const body = trimmed ? `${groupInt(int)}.${trimmed}` : groupInt(int);
  return d.isNegative() && !d.isZero() ? `${MINUS}${body}` : body;
}

/** 1,000,000P */
export const formatPoints = (v: DecimalInput) => `${grouped(v, 2)}P`;

/** 부호 붙은 포인트 변동: +12,400P / −3,000P / 0P */
export function formatSignedPoints(v: DecimalInput): string {
  const d = toDecimal(v);
  const body = `${grouped(d.abs(), 2)}P`;
  if (d.isZero()) return body;
  return d.isPositive() ? `+${body}` : `${MINUS}${body}`;
}

/** 12,350 (단위 없음) */
export const formatPrice = (v: DecimalInput) => grouped(v, 2);

/** 지수: 소수 2자리 고정. 1,000.00 */
export function formatIndex(v: DecimalInput): string {
  const d = toDecimal(v);
  const [int = "0", frac = "00"] = d.abs().toFixed(2).split(".");
  return `${d.isNegative() ? MINUS : ""}${groupInt(int)}.${frac}`;
}

/** 등락 금액: ▲ 350 / ▼ 1,200 / 0 */
export function formatPriceChange(v: DecimalInput): string {
  const d = toDecimal(v);
  if (d.isZero()) return "0";
  return `${d.isPositive() ? "▲" : "▼"} ${grouped(d.abs(), 2)}`;
}

/** 비율(0.0321) → +3.21%. 서버의 모든 비율 필드는 소수 비율이다. */
export function formatChangeRate(ratio: DecimalInput): string {
  const pct = toDecimal(ratio).times(100).toDecimalPlaces(2);
  const body = `${pct.abs().toFixed(2)}%`;
  if (pct.isZero()) return body;
  return pct.isPositive() ? `+${body}` : `${MINUS}${body}`;
}

/** 금리 비율(0.035) → 연 3.50% */
export const formatAnnualRate = (ratio: DecimalInput) => `연 ${toDecimal(ratio).times(100).toFixed(2)}%`;

/** 일반 비율(0.001) → 0.1% / 담보 유지비율(1.12) → 112% */
export function formatPercent(ratio: DecimalInput, fraction = 2): string {
  const s = toDecimal(ratio)
    .times(100)
    .toFixed(fraction)
    .replace(/\.?0+$/, "");
  return `${s}%`;
}

/** 1,200주 */
export const formatQuantity = (n: number, unit = true) => `${groupInt(String(Math.trunc(n)))}${unit ? "주" : ""}`;

/** 99+ 처럼 상한을 둔 개수 */
export const formatCount = (n: number, cap = 99) => (n > cap ? `${cap}+` : String(n));

const pad = (n: number) => String(n).padStart(2, "0");

/** 오늘이면 HH:mm:ss, 아니면 MM.DD HH:mm */
export function formatTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso);
  const sameDay =
    t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth() && t.getDate() === now.getDate();
  if (sameDay) return `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
  return `${pad(t.getMonth() + 1)}.${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
}

/** 03:00 */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** 스크린리더용: "상승 3.21퍼센트" */
export function describeChangeRate(ratio: DecimalInput): string {
  const pct = toDecimal(ratio).times(100).toDecimalPlaces(2);
  if (pct.isZero()) return "보합";
  return `${pct.isPositive() ? "상승" : "하락"} ${pct.abs().toFixed(2)}퍼센트`;
}

export type Direction = "up" | "down" | "flat";

export function directionOf(v: DecimalInput): Direction {
  const d = toDecimal(v);
  if (d.isZero()) return "flat";
  return d.isPositive() ? "up" : "down";
}
