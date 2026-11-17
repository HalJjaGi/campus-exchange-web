/**
 * 쉼표가 붙은 숫자 입력창용 순수 함수.
 * 입력 중에도 쉼표를 유지하고, 커서 위치는 "커서 앞 숫자 개수"로 복원한다.
 */

/** 숫자(와 소수점 하나)만 남기고 앞쪽 0을 지운다. "12,350P" → "12350" */
export function sanitizeNumber(input: string, decimal: boolean, maxDigits: number): string {
  let v = input.replace(decimal ? /[^\d.]/g : /\D/g, "");
  if (decimal) {
    const [a = "", ...rest] = v.split(".");
    v = rest.length ? `${a}.${rest.join("")}` : a;
  }
  v = v.replace(/^0+(?=\d)/, "");
  const digits = v.replace(".", "");
  if (digits.length > maxDigits) v = v.slice(0, v.length - (digits.length - maxDigits));
  return v;
}

/** "12350.5" → "12,350.5" */
export function groupNumber(raw: string): string {
  const [int = "", frac] = raw.split(".");
  const g = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac === undefined ? g : `${g}.${frac}`;
}

/** 쉼표를 뺀 문자(숫자·소수점)의 개수 */
export const countSignificant = (s: string) => s.replace(/[^\d.]/g, "").length;

/** 포맷된 문자열에서 앞에서부터 significant개 문자를 지난 위치 */
export function caretFor(formatted: string, significant: number): number {
  if (significant <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/[\d.]/.test(formatted[i] ?? "")) seen++;
    if (seen === significant) return i + 1;
  }
  return formatted.length;
}
