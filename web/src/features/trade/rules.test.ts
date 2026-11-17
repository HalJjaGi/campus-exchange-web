import type { OrderbookLevel, TickRule, TradingAccount } from "@/shared/types/api";
import {
  checkOrder,
  floorToTick,
  isOnTick,
  maxMarketBuyQuantity,
  parsePrice,
  quickQuantity,
  stepPrice,
  tickFor,
  walkBook,
  type OrderContext,
} from "./rules";

const RULES: TickRule[] = [
  { upTo: "1000", tick: "1" },
  { upTo: "5000", tick: "5" },
  { upTo: null, tick: "10" },
];

const lv = (price: string, quantity: number): OrderbookLevel => ({ price, quantity, lpQuantity: 0 });

const account = (over: Partial<TradingAccount> = {}): TradingAccount => ({
  code: "CSE",
  available: "1000000",
  reserved: "0",
  sellableQuantity: 30,
  holdingQuantity: 30,
  avgPrice: "12000",
  updatedAt: "2026-11-16T00:00:00Z",
  ...over,
});

const ctx = (over: Partial<OrderContext> = {}): OrderContext => ({
  account: account(),
  feeRate: "0.001",
  tickRules: RULES,
  quantityLimits: { min: 1, max: 10000 },
  opposite: [lv("12360", 5), lv("12370", 10)],
  ...over,
});

describe("호가 단위", () => {
  it("가격대별 단위", () => {
    expect(tickFor("999", RULES).toString()).toBe("1");
    expect(tickFor("1000", RULES).toString()).toBe("5");
    expect(tickFor("5000", RULES).toString()).toBe("10");
  });

  it("단위 일치 여부", () => {
    expect(isOnTick("12350", RULES)).toBe(true);
    expect(isOnTick("12355", RULES)).toBe(false);
    expect(isOnTick("4995", RULES)).toBe(true);
  });

  it("내림", () => {
    expect(floorToTick("12357", RULES).toString()).toBe("12350");
  });

  it("± 스텝은 구간 경계를 지킨다", () => {
    expect(stepPrice("1000", -1, RULES).toString()).toBe("999");
    expect(stepPrice("999", 1, RULES).toString()).toBe("1000");
    expect(stepPrice("5000", -1, RULES).toString()).toBe("4995");
    expect(stepPrice("12350", 1, RULES).toString()).toBe("12360");
    expect(stepPrice("1", -1, RULES).toString()).toBe("1");
  });
});

describe("시장가 추정", () => {
  it("최우선 호가부터 소진", () => {
    const w = walkBook([lv("100", 2), lv("110", 3)], 4);
    expect(w.gross.toString()).toBe("420");
    expect(w.avgPrice?.toString()).toBe("105");
    expect(w.insufficient).toBe(false);
  });

  it("잔량 부족 표시", () => {
    const w = walkBook([lv("100", 2)], 5);
    expect(w.filledQuantity).toBe(2);
    expect(w.insufficient).toBe(true);
  });

  it("시장가 최대 매수 수량은 예산과 잔량 둘 다 넘지 않는다", () => {
    expect(maxMarketBuyQuantity([lv("100", 2), lv("110", 3)], "1000", "0")).toBe(5);
    expect(maxMarketBuyQuantity([lv("100", 2), lv("110", 3)], "400", "0")).toBe(3);
  });
});

describe("checkOrder", () => {
  it("정상 지정가 매수 미리보기", () => {
    const r = checkOrder({ side: "BUY", kind: "LIMIT", price: "12,350", quantity: 10 }, ctx());
    expect(r.issues).toEqual([]);
    expect(r.preview?.settlement.toString()).toBe("123623.5");
    expect(r.preview?.estimated).toBe(false);
  });

  it("호가 단위 위반", () => {
    const r = checkOrder({ side: "BUY", kind: "LIMIT", price: "12355", quantity: 1 }, ctx());
    expect(r.issues[0]).toEqual({ field: "price", message: "이 가격대는 10 단위로 주문할 수 있어요." });
  });

  it("예수금 부족은 부족 금액을 알려준다", () => {
    const r = checkOrder(
      { side: "BUY", kind: "LIMIT", price: "10000", quantity: 10 },
      ctx({ account: account({ available: "50000" }) }),
    );
    expect(r.issues).toEqual([{ field: "funds", message: "예수금이 부족해요 (부족 50,100P)." }]);
  });

  it("매도 가능 수량 초과", () => {
    const r = checkOrder({ side: "SELL", kind: "LIMIT", price: "12350", quantity: 31 }, ctx());
    expect(r.issues[0]?.field).toBe("quantity");
  });

  it("수량 범위", () => {
    const r = checkOrder(
      { side: "BUY", kind: "LIMIT", price: "12350", quantity: 20 },
      ctx({ quantityLimits: { min: 1, max: 10 } }),
    );
    expect(r.issues[0]?.message).toBe("한 번에 1주부터 10주까지 주문할 수 있어요.");
  });

  it("시장가는 추정치이며 호가 부족을 알린다", () => {
    const r = checkOrder({ side: "BUY", kind: "MARKET", price: "", quantity: 20 }, ctx());
    expect(r.preview?.estimated).toBe(true);
    expect(r.preview?.insufficientBook).toBe(true);
  });

  it("반대 호가가 없으면 시장가 불가", () => {
    const r = checkOrder({ side: "BUY", kind: "MARKET", price: "", quantity: 1 }, ctx({ opposite: [] }));
    expect(r.preview).toBeNull();
    expect(r.issues[0]?.field).toBe("quantity");
  });
});

describe("quickQuantity", () => {
  it("매도는 매도 가능 수량 기준", () => {
    expect(quickQuantity(50, { side: "SELL", kind: "LIMIT", price: "12350", quantity: 0 }, ctx())).toBe(15);
  });

  it("지정가 매수 MAX는 수수료 포함", () => {
    expect(
      quickQuantity(
        100,
        { side: "BUY", kind: "LIMIT", price: "10000", quantity: 0 },
        ctx({ account: account({ available: "1001000" }) }),
      ),
    ).toBe(100);
  });

  it("가격이 없으면 0", () => {
    expect(quickQuantity(100, { side: "BUY", kind: "LIMIT", price: "", quantity: 0 }, ctx())).toBe(0);
  });
});

it("parsePrice", () => {
  expect(parsePrice("12,350")?.toString()).toBe("12350");
  expect(parsePrice("")).toBeNull();
  expect(parsePrice("0")).toBeNull();
  expect(parsePrice("abc")).toBeNull();
});
