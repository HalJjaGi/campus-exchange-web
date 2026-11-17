import type { StockQuote } from "@/shared/types/api";
import { rankStocks, reasonTagCodes } from "./ranking";

const q = (code: string, changeRate: string, volume = 0, over: Partial<StockQuote> = {}): StockQuote => ({
  code,
  name: code,
  category: "DEPT",
  price: "100",
  prevClose: "100",
  changeRate,
  volume,
  tradingState: "NORMAL",
  exDividendToday: false,
  moveReason: null,
  sparkline: [],
  version: 1,
  updatedAt: "2026-11-16T00:00:00Z",
  ...over,
});

it("상승률·하락률·거래량 정렬", () => {
  const items = [q("A", "0.01", 5), q("B", "0.05", 1), q("C", "-0.02", 9)];
  expect(rankStocks(items, "ALL", "RISE").map((x) => x.code)).toEqual(["B", "A", "C"]);
  expect(rankStocks(items, "ALL", "FALL").map((x) => x.code)).toEqual(["C", "A", "B"]);
  expect(rankStocks(items, "ALL", "VOLUME").map((x) => x.code)).toEqual(["C", "A", "B"]);
});

it("동률은 코드순으로 고정", () => {
  expect(rankStocks([q("B", "0"), q("A", "0")], "ALL", "RISE").map((x) => x.code)).toEqual(["A", "B"]);
});

it("카테고리 필터, 원본 배열은 건드리지 않는다", () => {
  const items = [q("A", "0.01"), q("M", "0.02", 0, { category: "MEME" })];
  expect(rankStocks(items, "MEME", "RISE").map((x) => x.code)).toEqual(["M"]);
  rankStocks(items, "ALL", "FALL");
  expect(items.map((x) => x.code)).toEqual(["A", "M"]);
});

it("변동 사유는 상승률 상위 5개 중 서버가 사유를 준 종목만", () => {
  const items = [
    q("A", "0.10", 0, { moveReason: "DISCLOSURE" }),
    q("B", "0.09"),
    q("C", "0.08"),
    q("D", "0.07"),
    q("E", "0.06"),
    q("F", "0.05", 0, { moveReason: "EVENT" }), // 6위라 제외
  ];
  expect([...reasonTagCodes(items)]).toEqual(["A"]);
});
