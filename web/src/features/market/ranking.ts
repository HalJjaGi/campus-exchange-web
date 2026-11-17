import { toDecimal } from "@/shared/lib/decimal";
import type { StockCategory, StockQuote } from "@/shared/types/api";

export type CategoryFilter = "ALL" | StockCategory;
export type RankingSort = "RISE" | "FALL" | "VOLUME";

/** 변동 사유 태그를 붙이는 상위 종목 수(UC-02 §5) */
export const REASON_TOP_N = 5;

const byRate = (a: StockQuote, b: StockQuote) => toDecimal(b.changeRate).comparedTo(toDecimal(a.changeRate));

/** 동률이면 종목 코드로 고정해 순위가 매초 흔들리지 않게 한다 */
export function rankStocks(items: StockQuote[], category: CategoryFilter, sort: RankingSort): StockQuote[] {
  const list = category === "ALL" ? [...items] : items.filter((q) => q.category === category);
  const cmp =
    sort === "RISE"
      ? byRate
      : sort === "FALL"
        ? (a: StockQuote, b: StockQuote) => -byRate(a, b)
        : (a: StockQuote, b: StockQuote) => b.volume - a.volume;
  return list.sort((a, b) => cmp(a, b) || a.code.localeCompare(b.code));
}

/**
 * 변동 사유를 보여줄 종목: 전체 시장에서 등락률(절댓값 아님) 상위 N개 중 서버가 사유를 붙인 것.
 * 근거 없는 사유는 만들지 않으므로 서버의 moveReason이 null이면 태그도 없다.
 */
export function reasonTagCodes(items: StockQuote[]): Set<string> {
  return new Set(
    rankStocks(items, "ALL", "RISE")
      .slice(0, REASON_TOP_N)
      .filter((q) => q.moveReason !== null)
      .map((q) => q.code),
  );
}
