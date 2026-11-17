import { caretFor, countSignificant, groupNumber, sanitizeNumber } from "./numberInput";

describe("sanitizeNumber", () => {
  it("숫자만 남기고 앞 0 제거", () => {
    expect(sanitizeNumber("12,350P", false, 12)).toBe("12350");
    expect(sanitizeNumber("007", false, 12)).toBe("7");
    expect(sanitizeNumber("0", false, 12)).toBe("0");
  });

  it("소수점은 하나만", () => {
    expect(sanitizeNumber("1.2.3", true, 12)).toBe("1.23");
    expect(sanitizeNumber("1.5", false, 12)).toBe("15");
  });

  it("자릿수 상한", () => {
    expect(sanitizeNumber("1234567", false, 4)).toBe("1234");
  });
});

it("groupNumber", () => {
  expect(groupNumber("12350")).toBe("12,350");
  expect(groupNumber("1234567.25")).toBe("1,234,567.25");
  expect(groupNumber("")).toBe("");
});

describe("커서 복원", () => {
  it("쉼표가 생겨도 같은 숫자 뒤에 커서", () => {
    // "1,235|" 에서 0을 입력 → "12,350|"
    const typed = "1,2350";
    const sig = countSignificant(typed.slice(0, 6));
    expect(caretFor(groupNumber("12350"), sig)).toBe(6);
  });

  it("가운데 숫자를 지워도 커서가 제자리", () => {
    // "12,3|50" 에서 Backspace → "12|50" → 포맷 "1,250", 커서는 '2' 뒤
    const afterDelete = "12,50";
    const sig = countSignificant(afterDelete.slice(0, 2));
    expect(caretFor(groupNumber("1250"), sig)).toBe(3);
  });

  it("맨 앞", () => {
    expect(caretFor("12,350", 0)).toBe(0);
  });
});
