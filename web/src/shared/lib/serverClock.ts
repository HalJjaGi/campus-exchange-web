/**
 * 서버 시각과 로컬 시각의 차이. 카운트다운(인증번호·VI·입찰 마감)은
 * 로컬 시계가 틀려도 서버 기준으로 끝나야 하므로 이 값을 보정해서 쓴다.
 */
let offsetMs = 0;

export function syncFromDateHeader(dateHeader: string | null, receivedAt = Date.now()) {
  if (!dateHeader) return;
  const serverMs = Date.parse(dateHeader);
  if (Number.isNaN(serverMs)) return;
  offsetMs = serverMs - receivedAt;
}

export const serverNow = () => Date.now() + offsetMs;

export const msUntil = (iso: string) => Date.parse(iso) - serverNow();

/** 테스트 전용 */
export const __setOffset = (ms: number) => {
  offsetMs = ms;
};
