import { describe, expect, it } from "vitest";
import { Decimal } from "@/shared/lib/decimal";
import type { Holding, HoldingsSnapshot, StockQuote } from "@/shared/types/api";
import {
  applyQuote,
  composition,
  dailySeries,
  dayChange,
  evaluate,
  keepNewerQuotes,
  kstDate,
  quotedAt,
  segmentsOf,
  sortHoldings,
  totalsOf,
} from "./valuation";

const holding = (over: Partial<Holding> = {}): Holding => ({
  code: "CSE",
  name: "컴퓨터공학과",
  quantity: 30,
  avgPrice: "12000",
  price: "12400",
  prevClose: "12350",
  quoteVersion: 10,
  quoteUpdatedAt: "2026-11-16T05:00:00.000Z",
  ...over,
});

const snap = (items: Holding[]): HoldingsSnapshot => ({ items, updatedAt: "2026-11-16T05:00:01.000Z" });

const quote = (over: Partial<StockQuote>): StockQuote =>
  ({
    code: "CSE",
    price: "12500",
    prevClose: "12350",
    version: 11,
    updatedAt: "2026-11-16T05:00:02.000Z",
    ...over,
  }) as StockQuote;

describe("evaluate", () => {
  it("평가금액·평가손익·수익률을 계산한다(SCR-06 §3)", () => {
    const r = evaluate(holding());
    expect(r.value.toString()).toBe("372000");
    expect(r.pnl.toString()).toBe("12000"); // (12400 − 12000) × 30
    expect(r.returnRate.toFixed(4)).toBe("0.0333");
  });

  it("손실도 부호를 유지하고 소수점 오차가 없다", () => {
    const r = evaluate(holding({ avgPrice: "1000.1", price: "999.9", quantity: 3 }));
    expect(r.pnl.toString()).toBe("-0.6");
  });
});

describe("applyQuote", () => {
  it("보유 종목의 현재가만 바꾸고 수량은 그대로 둔다", () => {
    const next = applyQuote(snap([holding()]), quote({}));
    expect(next.items[0]).toMatchObject({ price: "12500", quantity: 30, quoteVersion: 11 });
  });

  it("이미 반영한 버전 이하의 이벤트는 버린다", () => {
    const s = snap([holding()]);
    expect(applyQuote(s, quote({ version: 10, price: "1" }))).toBe(s);
  });

  it("보유하지 않은 종목 이벤트는 무시한다", () => {
    const s = snap([holding()]);
    expect(applyQuote(s, quote({ code: "BIZ" }))).toBe(s);
  });
});

describe("keepNewerQuotes", () => {
  it("늦게 온 REST 응답이 더 새 시세를 덮지 않는다. 수량은 응답을 따른다", () => {
    const cached = snap([holding({ price: "12600", quoteVersion: 20 })]);
    const fetched = snap([holding({ price: "12400", quoteVersion: 15, quantity: 40 })]);
    expect(keepNewerQuotes(cached, fetched).items[0]).toMatchObject({ price: "12600", quoteVersion: 20, quantity: 40 });
  });

  it("응답이 더 새 버전이면 응답을 쓴다", () => {
    const cached = snap([holding({ price: "12600", quoteVersion: 5 })]);
    expect(keepNewerQuotes(cached, snap([holding()])).items[0]?.price).toBe("12400");
  });
});

describe("quotedAt", () => {
  it("가장 늦은 시세 시각, 보유 종목이 없으면 조회 시각", () => {
    expect(quotedAt(snap([holding(), holding({ code: "BIZ", quoteUpdatedAt: "2026-11-16T05:00:09.000Z" })]))).toBe(
      "2026-11-16T05:00:09.000Z",
    );
    expect(quotedAt(snap([]))).toBe("2026-11-16T05:00:01.000Z");
  });
});

describe("totalsOf · composition", () => {
  const wallet = { available: "600000", reserved: "39640", bankBalance: "20000" };

  it("예수금은 사용 가능 + 주문 예약을 한 번만 센다", () => {
    const t = totalsOf(wallet, [evaluate(holding())]);
    expect(t.cash.toString()).toBe("639640");
    expect(t.total.toString()).toBe("1031640"); // 639,640 + 20,000 + 372,000
  });

  it("구성 비율의 합은 1이다", () => {
    const segs = composition(totalsOf(wallet, [evaluate(holding())]));
    expect(segs.map((s) => s.kind)).toEqual(["cash", "bank", "stock"]);
    expect(segs.reduce((s, x) => s.plus(x.ratio), new Decimal(0)).toFixed(10)).toBe("1.0000000000");
  });

  it("자산이 0이면 비율도 0(0으로 나누지 않는다)", () => {
    const segs = composition(totalsOf({ available: "0", reserved: "0", bankBalance: "0" }, []));
    expect(segs.every((s) => s.ratio.isZero())).toBe(true);
  });
});

describe("sortHoldings", () => {
  const rows = [
    evaluate(holding({ code: "A", name: "나", price: "13000" })),
    evaluate(holding({ code: "B", name: "가", price: "11000" })),
    evaluate(holding({ code: "C", name: "다", price: "12000", quantity: 100 })),
  ];
  it("평가금액·수익률·이름으로 정렬한다", () => {
    expect(sortHoldings(rows, "value", "desc").map((r) => r.code)).toEqual(["C", "A", "B"]);
    expect(sortHoldings(rows, "returnRate", "desc").map((r) => r.code)).toEqual(["A", "C", "B"]);
    expect(sortHoldings(rows, "name", "asc").map((r) => r.name)).toEqual(["가", "나", "다"]);
  });
});

describe("dayChange", () => {
  const snaps = [
    { date: "2026-11-13", totalAsset: "1000000", evaluatedAt: "" },
    { date: "2026-11-14", totalAsset: "1010000", evaluatedAt: "" },
    { date: "2026-11-16", totalAsset: "990000", evaluatedAt: "" },
  ];

  it("오늘 이전의 가장 최근 기록과 비교한다", () => {
    const c = dayChange(new Decimal(1_000_000), snaps, "2026-11-16");
    expect(c?.base.date).toBe("2026-11-14");
    expect(c?.amount.toString()).toBe("-10000");
  });

  it("비교할 기록이 없으면 null", () => {
    expect(dayChange(new Decimal(1), snaps, "2026-11-13")).toBeNull();
  });
});

describe("dailySeries", () => {
  it("구간의 모든 날을 만들고, 기록 없는 날은 null로 둔다(채우지 않는다)", () => {
    const pts = dailySeries({
      from: "2026-10-30",
      to: "2026-11-02",
      items: [
        { date: "2026-10-30", totalAsset: "100", evaluatedAt: "" },
        { date: "2026-11-02", totalAsset: "130", evaluatedAt: "" },
      ],
    });
    expect(pts).toEqual([
      { date: "2026-10-30", value: 100 },
      { date: "2026-10-31", value: null },
      { date: "2026-11-01", value: null },
      { date: "2026-11-02", value: 130 },
    ]);
  });
});

describe("kstDate", () => {
  it("UTC 15시 이후는 한국 날짜로 다음 날이다", () => {
    expect(kstDate(Date.parse("2026-11-16T14:59:59Z"))).toBe("2026-11-16");
    expect(kstDate(Date.parse("2026-11-16T15:00:00Z"))).toBe("2026-11-17");
  });
});

describe("segmentsOf", () => {
  it("빈 날에서 구간을 나눈다", () => {
    const v = (date: string, value: number | null) => ({ date, value });
    const segs = segmentsOf([v("a", 1), v("b", 2), v("c", null), v("d", null), v("e", 5), v("f", null), v("g", 7)]);
    expect(segs.map((s) => s.map((p) => p.date))).toEqual([["a", "b"], ["e"], ["g"]]);
  });
});
