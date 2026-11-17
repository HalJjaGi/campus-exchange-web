import { estimateOrder, maxBuyQuantity, ratioOfQuantity } from "./decimal";

describe("estimateOrder", () => {
  it("매수: 금액 + 수수료 0.1%", () => {
    const r = estimateOrder({ side: "BUY", price: "12350", quantity: 10, feeRate: "0.001" });
    expect(r.gross.toString()).toBe("123500");
    expect(r.fee.toString()).toBe("123.5");
    expect(r.settlement.toString()).toBe("123623.5");
  });

  it("매도: 금액 − 수수료", () => {
    const r = estimateOrder({ side: "SELL", price: "333", quantity: 3, feeRate: "0.001" });
    expect(r.fee.toString()).toBe("1"); // 0.999 → 1.00
    expect(r.settlement.toString()).toBe("998");
  });

  it("부동소수 오차가 없다", () => {
    const r = estimateOrder({ side: "BUY", price: "0.1", quantity: 3, feeRate: "0" });
    expect(r.gross.toString()).toBe("0.3");
  });
});

describe("maxBuyQuantity", () => {
  it("수수료 포함 정산액이 예수금을 넘지 않는 최대 수량", () => {
    expect(maxBuyQuantity("1000000", "10000", "0.001")).toBe(99);
    expect(maxBuyQuantity("1001000", "10000", "0.001")).toBe(100);
    expect(maxBuyQuantity("0", "10000", "0.001")).toBe(0);
  });

  it("가격이 0 이하면 0", () => {
    expect(maxBuyQuantity("1000", "0", "0.001")).toBe(0);
  });
});

it("비율 수량은 내림", () => {
  expect(ratioOfQuantity(7, 25)).toBe(1);
  expect(ratioOfQuantity(7, 100)).toBe(7);
});
