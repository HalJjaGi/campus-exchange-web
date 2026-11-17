import { applyTrade, bucketStart } from "./chartTime";

it("1분·5분 봉 시작 시각", () => {
  const ms = Date.UTC(2026, 10, 16, 5, 7, 42);
  expect(bucketStart(ms, "1m")).toBe(Date.UTC(2026, 10, 16, 5, 7, 0));
  expect(bucketStart(ms, "5m")).toBe(Date.UTC(2026, 10, 16, 5, 5, 0));
});

it("일봉은 로컬 자정", () => {
  const ms = new Date(2026, 10, 16, 14, 30).getTime();
  expect(bucketStart(ms, "1d")).toBe(new Date(2026, 10, 16).getTime());
});

describe("applyTrade", () => {
  const bar = { time: 100, open: 10, high: 12, low: 9, close: 11 };

  it("같은 봉은 고가·저가·종가 갱신", () => {
    expect(applyTrade(bar, 100, 13)).toEqual({ time: 100, open: 10, high: 13, low: 9, close: 13 });
    expect(applyTrade(bar, 100, 8)).toEqual({ time: 100, open: 10, high: 12, low: 8, close: 8 });
  });

  it("다음 봉은 새로 시작", () => {
    expect(applyTrade(bar, 160, 11.5)).toEqual({ time: 160, open: 11.5, high: 11.5, low: 11.5, close: 11.5 });
  });

  it("지난 봉의 늦은 체결은 무시", () => {
    expect(applyTrade(bar, 40, 99)).toBe(bar);
  });
});
