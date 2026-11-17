import {
  formatAnnualRate,
  formatChangeRate,
  formatCount,
  formatIndex,
  formatPercent,
  formatPoints,
  formatPrice,
  formatPriceChange,
  formatQuantity,
  formatRemaining,
  formatSignedPoints,
  formatTime,
  describeChangeRate,
} from "./format";

describe("format", () => {
  it("포인트는 천 단위 쉼표와 P, 소수는 0이 아닐 때만", () => {
    expect(formatPoints("1000000")).toBe("1,000,000P");
    expect(formatPoints("1000000.00")).toBe("1,000,000P");
    expect(formatPoints("1234.5")).toBe("1,234.5P");
    expect(formatPoints("0")).toBe("0P");
  });

  it("부호 있는 포인트", () => {
    expect(formatSignedPoints("12400")).toBe("+12,400P");
    expect(formatSignedPoints("-3000")).toBe("−3,000P");
    expect(formatSignedPoints("0")).toBe("0P");
  });

  it("등락률은 비율을 받아 부호와 소수 2자리", () => {
    expect(formatChangeRate("0.0321")).toBe("+3.21%");
    expect(formatChangeRate("-0.01049")).toBe("−1.05%");
    expect(formatChangeRate("0")).toBe("0.00%");
    expect(formatChangeRate("-0.00001")).toBe("0.00%");
  });

  it("가격·등락 금액", () => {
    expect(formatPrice("12350")).toBe("12,350");
    expect(formatPriceChange("350")).toBe("▲ 350");
    expect(formatPriceChange("-1200")).toBe("▼ 1,200");
    expect(formatPriceChange("0")).toBe("0");
  });

  it("지수는 소수 2자리 고정", () => {
    expect(formatIndex("1000")).toBe("1,000.00");
    expect(formatIndex("1234.5")).toBe("1,234.50");
  });

  it("금리·퍼센트", () => {
    expect(formatAnnualRate("0.035")).toBe("연 3.50%");
    expect(formatPercent("0.001")).toBe("0.1%");
    expect(formatPercent("1.12")).toBe("112%");
  });

  it("수량·개수", () => {
    expect(formatQuantity(1200)).toBe("1,200주");
    expect(formatQuantity(1200, false)).toBe("1,200");
    expect(formatCount(120)).toBe("99+");
    expect(formatCount(3)).toBe("3");
  });

  it("시각: 오늘이면 HH:mm:ss", () => {
    const now = new Date(2026, 10, 16, 15, 0, 0);
    expect(formatTime(new Date(2026, 10, 16, 14, 3, 27).toISOString(), now)).toBe("14:03:27");
    expect(formatTime(new Date(2026, 10, 15, 9, 5, 0).toISOString(), now)).toBe("11.15 09:05");
  });

  it("남은 시간은 올림, 음수는 0", () => {
    expect(formatRemaining(180_000)).toBe("03:00");
    expect(formatRemaining(59_001)).toBe("01:00");
    expect(formatRemaining(-5)).toBe("00:00");
  });

  it("스크린리더 문구", () => {
    expect(describeChangeRate("0.0321")).toBe("상승 3.21퍼센트");
    expect(describeChangeRate("0")).toBe("보합");
  });
});
