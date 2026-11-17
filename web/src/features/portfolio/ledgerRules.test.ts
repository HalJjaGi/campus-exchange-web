import { describe, expect, it } from "vitest";
import type { LedgerEntry } from "@/shared/types/api";
import { describeEntry, ledgerQuery, periodFrom } from "./ledgerRules";

const entry = (over: Partial<LedgerEntry>): LedgerEntry => ({
  id: "l-1",
  accountType: "WALLET",
  txType: "TRADE",
  amount: "-360000",
  balanceAfter: "640000",
  trade: { tradeId: "t-1", code: "CSE", name: "컴퓨터공학과", side: "BUY", quantity: 30, price: "12000" },
  createdAt: "2026-11-01T00:00:00.000Z",
  ...over,
});

describe("periodFrom", () => {
  const now = Date.parse("2026-11-16T03:00:00Z"); // 한국 시간 11/16 12:00
  it("오늘을 1일째로 센 시작일(한국 시간)", () => {
    expect(periodFrom("1w", now)).toBe("2026-11-10");
    expect(periodFrom("1m", now)).toBe("2026-10-18");
    expect(periodFrom("all", now)).toBeNull();
  });
});

describe("ledgerQuery", () => {
  it("유형 그룹과 기간을 쿼리로 바꾼다", () => {
    expect(ledgerQuery("trade", "2026-11-10", null)).toBe("/api/me/ledger?types=TRADE%2CFEE&from=2026-11-10");
    expect(ledgerQuery("all", null, "20")).toBe("/api/me/ledger?cursor=20");
    expect(ledgerQuery("all", null, null)).toBe("/api/me/ledger");
  });
});

describe("describeEntry", () => {
  it("체결 기록은 종목·수량·방향·체결가", () => {
    expect(describeEntry(entry({}))).toBe("컴퓨터공학과 30주 매수 · 12,000");
    expect(describeEntry(entry({ txType: "FEE", amount: "-360" }))).toBe("컴퓨터공학과 매수 수수료");
  });

  it("체결이 아닌 기록은 유형 설명", () => {
    expect(describeEntry(entry({ txType: "AIRDROP", trade: null }))).toBe("가입 지원금");
    expect(describeEntry(entry({ txType: "INTEREST", accountType: "BANK", trade: null }))).toBe("중앙은행 예금 이자");
  });
});
