import { applyTrade, bucketStart, mergeLiveCandles } from "./chartTime";

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

describe("mergeLiveCandles", () => {
  const c = (t: string, close: string, v = 10) => ({ t, o: "100", h: "110", l: "90", c: close, v });
  const bar = (close: number) => ({ time: 0, open: 100, high: 120, low: 90, close });

  it("같은 봉은 실시간 값으로 바꾸고, 뒤에 생긴 봉은 붙인다", () => {
    const out = mergeLiveCandles(
      [c("2026-11-16T10:00:00.000Z", "105"), c("2026-11-16T10:01:00.000Z", "106")],
      [
        { ms: Date.parse("2026-11-16T10:01:00.000Z"), bar: bar(112), addedVolume: 3 },
        { ms: Date.parse("2026-11-16T10:02:00.000Z"), bar: bar(113), addedVolume: 2 },
      ],
    );
    expect(out.map((x) => [x.t.slice(11, 16), x.c, x.v])).toEqual([
      ["10:00", "105", 10],
      ["10:01", "112", 13],
      ["10:02", "113", 2],
    ]);
  });

  it("캐시보다 오래된 시각의 봉은 끼워 넣지 않는다", () => {
    const base = [c("2026-11-16T10:05:00.000Z", "105")];
    expect(
      mergeLiveCandles(base, [{ ms: Date.parse("2026-11-16T10:00:00.000Z"), bar: bar(1), addedVolume: 1 }]),
    ).toEqual(base);
  });
});
