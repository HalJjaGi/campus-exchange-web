/** 가짜 API 오류. handlers가 { code, detail } 응답으로 바꾼다(백엔드 에러 형식과 같게) */
export class MockError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(code);
  }
}
