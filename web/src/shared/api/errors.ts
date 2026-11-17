import type { ApiErrorBody } from "@/shared/types/api";

/**
 * 서버 에러 코드 → 화면 문구. 서버 message는 그대로 보여주지 않는다.
 * 코드 목록은 백엔드와 합의 후 채운다(계획 §6). 모르는 코드는 FALLBACK.
 */
const MESSAGES: Record<string, string> = {
  NETWORK: "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.",
  UNAUTHORIZED: "로그인이 필요해요.",
  FORBIDDEN: "이 작업을 할 권한이 없어요.",
  RATE_LIMITED: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
  INSUFFICIENT_FUNDS: "예수금이 부족해요.",
  INSUFFICIENT_QUANTITY: "매도 가능 수량이 부족해요.",
  INVALID_TICK: "호가 단위에 맞지 않는 가격이에요.",
  INVALID_QUANTITY: "주문 가능한 수량 범위를 벗어났어요.",
  VI_ACTIVE: "VI 발동 중이라 단일가 주문만 받을 수 있어요.",
  MARKET_CLOSED: "지금은 주문할 수 없는 시간이에요.",
  STOCK_NOT_FOUND: "없는 종목이에요.",
  ORDER_NOT_FOUND: "주문을 찾을 수 없어요.",
  ORDER_NOT_CANCELABLE: "이미 체결되었거나 취소된 주문이에요.",
  EMAIL_DOMAIN_NOT_ALLOWED: "학교 메일(.ac.kr)로만 가입할 수 있어요.",
  EMAIL_ALREADY_REGISTERED: "이미 가입된 메일이에요. 로그인해 주세요.",
  EMAIL_LOCKED: "인증을 여러 번 틀려서 잠시 잠겼어요.",
  CODE_MISMATCH: "인증번호가 맞지 않아요.",
  CODE_EXPIRED: "인증번호가 만료됐어요. 새로 받아 주세요.",
  VERIFICATION_EXPIRED: "이메일 인증이 만료됐어요. 처음부터 다시 진행해 주세요.",
  NICKNAME_TAKEN: "이미 쓰고 있는 닉네임이에요.",
  INVALID_NICKNAME: "닉네임은 공백 없이 2~12자로 정해 주세요.",
  INVALID_CREDENTIALS: "이메일 또는 비밀번호가 맞지 않아요.",
  EMPTY_CONTENT: "내용을 입력해 주세요.",
  CONTENT_TOO_LONG: "500자까지 쓸 수 있어요.",
  BANNED_WORD: "쓸 수 없는 표현이 들어 있어요. 고쳐서 다시 올려 주세요.",
  ALREADY_REPORTED: "이미 신고한 글이에요.",
  POST_NOT_FOUND: "삭제되었거나 볼 수 없는 글이에요.",
  DISCLOSURE_NOT_FOUND: "없는 공시예요.",
};

const FALLBACK = "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail?: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.code);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.detail = body.detail;
  }

  get userMessage(): string {
    return MESSAGES[this.code] ?? FALLBACK;
  }
}

export const userMessageOf = (err: unknown): string => (err instanceof ApiError ? err.userMessage : FALLBACK);
