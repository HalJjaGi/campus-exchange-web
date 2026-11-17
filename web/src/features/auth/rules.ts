/**
 * 가입 입력 규칙(UC-01). 화면 안내용이며 서버가 최종 검증한다.
 * 비밀번호 정책은 SDS에 "정책"으로만 적혀 있어 초안이다 — 백엔드와 합의 후 맞춘다.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 이메일 형식·학교 도메인 검사. 문제 없으면 null */
export function emailIssue(email: string): string | null {
  const v = email.trim();
  if (!v) return null;
  if (!EMAIL.test(v)) return "이메일 형식이 아니에요.";
  if (!v.toLowerCase().endsWith(".ac.kr")) return "학교 메일(.ac.kr)로만 가입할 수 있어요.";
  return null;
}

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 12;

/** 한글 한 글자도 1자로 센다 */
export const nicknameLength = (v: string) => [...v.trim()].length;

export function nicknameIssue(nickname: string): string | null {
  const v = nickname.trim();
  if (!v) return null;
  if (/\s/.test(v)) return "닉네임에 공백은 쓸 수 없어요.";
  const n = nicknameLength(v);
  if (n < NICKNAME_MIN || n > NICKNAME_MAX) return `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 정해 주세요.`;
  return null;
}

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;

export function passwordIssue(password: string): string | null {
  if (!password) return null;
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX)
    return `비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자로 정해 주세요.`;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "영문과 숫자를 모두 넣어 주세요.";
  return null;
}

/** 6자리 숫자 */
export const isCompleteCode = (code: string) => /^\d{6}$/.test(code);
