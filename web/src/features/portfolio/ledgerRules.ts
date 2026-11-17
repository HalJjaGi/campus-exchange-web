import { formatPrice, formatQuantity } from "@/shared/lib/format";
import type { LedgerEntry, LedgerTxType } from "@/shared/types/api";
import { kstDate } from "./valuation";

/** 거래 내역 유형 필터. 확장 기능 유형(입찰·대차 수수료 등)은 "전체"에서만 보인다 */
export type LedgerGroup = "all" | "trade" | "bank" | "grant";
export type LedgerPeriod = "1w" | "1m" | "3m" | "all";

export const GROUP_TYPES: Record<LedgerGroup, LedgerTxType[]> = {
  all: [],
  trade: ["TRADE", "FEE"],
  bank: ["INTEREST", "DIVIDEND"],
  grant: ["REWARD", "AIRDROP"],
};

const PERIOD_DAYS: Record<Exclude<LedgerPeriod, "all">, number> = { "1w": 7, "1m": 30, "3m": 90 };

/** 기간 시작일(한국 시간, 포함). 오늘을 1일째로 센다 */
export function periodFrom(period: LedgerPeriod, nowMs: number): string | null {
  if (period === "all") return null;
  return kstDate(nowMs - (PERIOD_DAYS[period] - 1) * 86_400_000);
}

export function ledgerQuery(group: LedgerGroup, from: string | null, cursor: string | null): string {
  const p = new URLSearchParams();
  const types = GROUP_TYPES[group];
  if (types.length) p.set("types", types.join(","));
  if (from) p.set("from", from);
  if (cursor) p.set("cursor", cursor);
  const qs = p.toString();
  return `/api/me/ledger${qs ? `?${qs}` : ""}`;
}

export const TX_LABEL: Record<LedgerTxType, string> = {
  TRADE: "매매",
  FEE: "수수료",
  BURN: "소각",
  INTEREST: "이자",
  DIVIDEND: "배당",
  REWARD: "보상",
  AIRDROP: "지원금",
  BID: "입찰",
  BORROW_FEE: "대차 수수료",
};

const PLAIN: Partial<Record<LedgerTxType, string>> = {
  BURN: "포인트 소각",
  INTEREST: "중앙은행 예금 이자",
  DIVIDEND: "배당금 입금",
  REWARD: "오락실 보상",
  AIRDROP: "가입 지원금",
  BID: "전광판 입찰 정산",
  BORROW_FEE: "공매도 대차 수수료",
};

/** 내역 한 줄 설명. 체결 기록은 종목·수량·체결가를 쓴다 */
export function describeEntry(e: LedgerEntry): string {
  const t = e.trade;
  if (t) {
    const side = t.side === "BUY" ? "매수" : "매도";
    if (e.txType === "FEE") return `${t.name} ${side} 수수료`;
    return `${t.name} ${formatQuantity(t.quantity)} ${side} · ${formatPrice(t.price)}`;
  }
  return PLAIN[e.txType] ?? TX_LABEL[e.txType];
}
