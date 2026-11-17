/**
 * 마이페이지 평가 규칙(UC-14 §2~5). 서버 확정 값(잔액·수량·평균가)에 최신 시세만 얹어 다시 계산한다.
 * 확정 값은 여기서 바꾸지 않는다 — 바뀌었으면 서버에서 다시 받아 온다(SD-14).
 */
import { Decimal, toDecimal } from "@/shared/lib/decimal";
import type {
  AssetHistory,
  AssetSnapshot,
  Holding,
  HoldingsSnapshot,
  StockQuote,
  WalletSummary,
} from "@/shared/types/api";

export interface HoldingRow extends Holding {
  value: Decimal;
  pnl: Decimal;
  /** 평균 매입가 대비 비율(0.0321 = 3.21%) */
  returnRate: Decimal;
}

export function evaluate(h: Holding): HoldingRow {
  const price = toDecimal(h.price);
  const avg = toDecimal(h.avgPrice);
  return {
    ...h,
    value: price.times(h.quantity),
    pnl: price.minus(avg).times(h.quantity),
    returnRate: avg.isZero() ? new Decimal(0) : price.minus(avg).dividedBy(avg),
  };
}

/** 보유 종목 시세 이벤트를 반영한다. 이미 반영한 버전보다 오래된 이벤트는 버린다 */
export function applyQuote(snap: HoldingsSnapshot, q: StockQuote): HoldingsSnapshot {
  let changed = false;
  const items = snap.items.map((h) => {
    if (h.code !== q.code || q.version <= h.quoteVersion) return h;
    changed = true;
    return { ...h, price: q.price, prevClose: q.prevClose, quoteVersion: q.version, quoteUpdatedAt: q.updatedAt };
  });
  return changed ? { ...snap, items } : snap;
}

/**
 * REST 응답이 WS 이벤트보다 늦게 오면 화면의 시세가 뒤로 돌아간다.
 * 수량·평균가는 새 응답을 따르고, 시세만 더 새 버전을 남긴다.
 */
export function keepNewerQuotes(cached: HoldingsSnapshot | undefined, fetched: HoldingsSnapshot): HoldingsSnapshot {
  if (!cached) return fetched;
  const byCode = new Map(cached.items.map((h) => [h.code, h]));
  return {
    ...fetched,
    items: fetched.items.map((h) => {
      const c = byCode.get(h.code);
      return c && c.quoteVersion > h.quoteVersion
        ? {
            ...h,
            price: c.price,
            prevClose: c.prevClose,
            quoteVersion: c.quoteVersion,
            quoteUpdatedAt: c.quoteUpdatedAt,
          }
        : h;
    }),
  };
}

/** 평가에 쓴 시세 중 가장 늦은 시각. 보유 종목이 없으면 목록 조회 시각 */
export const quotedAt = (snap: HoldingsSnapshot): string =>
  snap.items.reduce((max, h) => (h.quoteUpdatedAt > max ? h.quoteUpdatedAt : max), "") || snap.updatedAt;

export type HoldingSortKey = "name" | "value" | "pnl" | "returnRate";
export type SortDir = "asc" | "desc";

export function sortHoldings(rows: HoldingRow[], key: HoldingSortKey, dir: SortDir): HoldingRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const c = key === "name" ? a.name.localeCompare(b.name, "ko") : a[key].comparedTo(b[key]);
    return c === 0 ? a.code.localeCompare(b.code) : c * sign;
  });
}

export interface Totals {
  /** 지갑 예수금 = 사용 가능 + 주문 예약(예약금은 아직 내 돈이다. 한 번만 센다) */
  cash: Decimal;
  bank: Decimal;
  stock: Decimal;
  total: Decimal;
  pnl: Decimal;
}

export function totalsOf(
  wallet: Pick<WalletSummary, "available" | "reserved" | "bankBalance">,
  rows: HoldingRow[],
): Totals {
  const cash = toDecimal(wallet.available).plus(wallet.reserved);
  const bank = toDecimal(wallet.bankBalance);
  const stock = rows.reduce((s, r) => s.plus(r.value), new Decimal(0));
  const pnl = rows.reduce((s, r) => s.plus(r.pnl), new Decimal(0));
  return { cash, bank, stock, total: cash.plus(bank).plus(stock), pnl };
}

export type AssetKind = "cash" | "bank" | "stock";

export interface Segment {
  kind: AssetKind;
  label: string;
  value: Decimal;
  /** 총자산 대비 비율. 총자산이 0이면 0 */
  ratio: Decimal;
}

const KIND_LABEL: Record<AssetKind, string> = { cash: "예수금", bank: "중앙은행 예금", stock: "주식" };

export function composition(t: Totals): Segment[] {
  return (["cash", "bank", "stock"] as const).map((kind) => ({
    kind,
    label: KIND_LABEL[kind],
    value: t[kind],
    ratio: t.total.isZero() ? new Decimal(0) : t[kind].dividedBy(t.total),
  }));
}

/** 한국 시간 기준 날짜(YYYY-MM-DD). 스냅샷 날짜가 한국 시간이다 */
export const kstDate = (ms: number): string => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 10);

export interface DayChange {
  /** 비교 기준 스냅샷. 어제 기록이 없으면 그 전 가장 최근 기록 */
  base: AssetSnapshot;
  amount: Decimal;
  ratio: Decimal;
}

/** 오늘 이전의 가장 최근 스냅샷 대비 변동. 비교할 기록이 없으면 null */
export function dayChange(total: Decimal, snapshots: AssetSnapshot[], today: string): DayChange | null {
  const base = snapshots
    .filter((s) => s.date < today)
    .reduce<AssetSnapshot | null>((latest, s) => (!latest || s.date > latest.date ? s : latest), null);
  if (!base) return null;
  const prev = toDecimal(base.totalAsset);
  const amount = total.minus(prev);
  return { base, amount, ratio: prev.isZero() ? new Decimal(0) : amount.dividedBy(prev) };
}

const DAY_MS = 86_400_000;
const dayMs = (date: string) => Date.parse(`${date}T00:00:00Z`);

export const previousDate = (date: string) => new Date(dayMs(date) - DAY_MS).toISOString().slice(0, 10);

export interface DailyPoint {
  date: string;
  /** 기록이 없는 날은 null — 선을 끊는다. 앞뒤 값으로 채우지 않는다(UC-14 §5) */
  value: number | null;
}

export function dailySeries(h: AssetHistory): DailyPoint[] {
  const byDate = new Map(h.items.map((s) => [s.date, s]));
  const out: DailyPoint[] = [];
  for (let t = dayMs(h.from), end = dayMs(h.to); t <= end; t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    const s = byDate.get(date);
    out.push({ date, value: s ? Number(s.totalAsset) : null });
  }
  return out;
}

/** 기록이 이어진 구간들. 빈 날에서 나뉜다 */
export function segmentsOf(points: DailyPoint[]): DailyPoint[][] {
  const out: DailyPoint[][] = [];
  let cur: DailyPoint[] = [];
  for (const p of points) {
    if (p.value === null) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push(p);
  }
  if (cur.length) out.push(cur);
  return out;
}
