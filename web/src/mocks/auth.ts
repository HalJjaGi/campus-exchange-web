/**
 * 개발용 가짜 인증. 메일은 실제로 보내지 않고 인증번호를 화면 구석 "개발용 메일함"과 콘솔에 보여 준다.
 * 가입한 계정과 로그인 상태는 새로고침해도 유지되도록 localStorage에 둔다(개발 모드 전용).
 *
 * 데모 계정: demo@campus.ac.kr / campus2026
 */
import type {
  MyProfile,
  EmailSendResult,
  EmailVerifyResult,
  SessionUser,
  SignupRequest,
  SignupResult,
  Title,
} from "@/shared/types/api";
import { closeMail, showMail } from "./devMailbox";
import { JOINED_DAYS_AGO } from "./ledger";
import { MockError, getIndex, marketHeadline, policy } from "./market";

const CODE_TTL_MS = 3 * 60_000;
const LOCK_MS = 5 * 60_000;
const MAX_ATTEMPTS = 3;

export const titles: Title[] = [
  { id: "t-freshman", name: "새내기" },
  { id: "t-top", name: "과탑 지망생" },
  { id: "t-cafeteria", name: "학식 미식가" },
  { id: "t-library", name: "도서관 지박령" },
  { id: "t-festival", name: "축제 기획단" },
];

interface StoredUser {
  password: string;
  nickname: string;
  titleId: string;
  /** 예전에 저장된 mock 계정에는 없다. 없으면 데모 이력의 가입일로 본다 */
  joinedAt?: string;
}

const USERS_KEY = "mock.users";
const SESSION_KEY = "mock.session";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장이 막힌 환경(시크릿 창 등)에서는 새로고침 때 상태가 사라질 뿐이다
  }
}

const users: Record<string, StoredUser> = load(USERS_KEY, {
  "demo@campus.ac.kr": { password: "campus2026", nickname: "데모", titleId: "t-freshman" },
});
let sessionEmail: string | null = load<string | null>(SESSION_KEY, null);

const setSession = (email: string | null) => {
  sessionEmail = email;
  save(SESSION_KEY, email);
};

const toSessionUser = (u: StoredUser): SessionUser => ({
  nickname: u.nickname,
  title: titles.find((t) => t.id === u.titleId)?.name ?? null,
});

/* ───────── 메일 인증 ───────── */

interface Pending {
  code: string;
  expiresAt: number;
  attempts: number;
  lockedUntil: number | null;
}

const pending = new Map<string, Pending>();
const tokens = new Map<string, string>(); // verificationToken → email

const normalize = (email: string) => email.trim().toLowerCase();

function assertNotLocked(p: Pending | undefined) {
  if (p?.lockedUntil && p.lockedUntil > Date.now()) {
    throw new MockError(423, "EMAIL_LOCKED", { lockedUntil: new Date(p.lockedUntil).toISOString() });
  }
}

export function sendCode(rawEmail: string): EmailSendResult {
  const email = normalize(rawEmail);
  if (!/^[^\s@]+@[^\s@]+\.ac\.kr$/.test(email)) throw new MockError(400, "EMAIL_DOMAIN_NOT_ALLOWED");
  if (users[email]) throw new MockError(409, "EMAIL_ALREADY_REGISTERED");
  const prev = pending.get(email);
  assertNotLocked(prev);

  const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  const expiresAt = Date.now() + CODE_TTL_MS;
  // 재발송하면 이전 번호는 무효(UC-01). 잠금이 풀린 뒤에는 시도 횟수도 새로 센다
  pending.set(email, { code, expiresAt, attempts: 0, lockedUntil: null });
  console.info(`[mock] ${email} 인증번호: ${code}`);
  showMail(email, code);
  return { expiresAt: new Date(expiresAt).toISOString() };
}

export function verifyCode(rawEmail: string, code: string): EmailVerifyResult {
  const email = normalize(rawEmail);
  const p = pending.get(email);
  assertNotLocked(p);
  if (!p || p.expiresAt < Date.now()) throw new MockError(410, "CODE_EXPIRED");

  if (p.code !== code) {
    p.attempts += 1;
    if (p.attempts >= MAX_ATTEMPTS) {
      p.lockedUntil = Date.now() + LOCK_MS;
      p.code = "";
      throw new MockError(423, "EMAIL_LOCKED", { lockedUntil: new Date(p.lockedUntil).toISOString() });
    }
    throw new MockError(400, "CODE_MISMATCH", { remainingAttempts: MAX_ATTEMPTS - p.attempts });
  }

  pending.delete(email);
  closeMail();
  const token = crypto.randomUUID();
  tokens.set(token, email);
  return { verificationToken: token };
}

export const isNicknameAvailable = (nickname: string) =>
  !Object.values(users).some((u) => u.nickname === nickname.trim());

/* ───────── 가입·로그인 ───────── */

const signups = new Map<string, SignupResult>();

export function signup(req: SignupRequest, idempotencyKey: string | null): SignupResult {
  if (!idempotencyKey) throw new MockError(400, "IDEMPOTENCY_KEY_REQUIRED");
  const prev = signups.get(idempotencyKey);
  if (prev) return prev; // 다중 클릭·재시도: 기존 결과 반환, 이중 지급 없음(SD-01)

  const email = tokens.get(req.verificationToken);
  if (!email) throw new MockError(410, "VERIFICATION_EXPIRED");
  if (!isNicknameAvailable(req.nickname)) throw new MockError(409, "NICKNAME_TAKEN");
  if (!titles.some((t) => t.id === req.titleId)) throw new MockError(400, "INVALID_TITLE");

  const user: StoredUser = {
    password: req.password,
    nickname: req.nickname.trim(),
    titleId: req.titleId,
    joinedAt: new Date().toISOString(),
  };
  users[email] = user;
  save(USERS_KEY, users);
  tokens.delete(req.verificationToken);
  setSession(email);

  const index = getIndex();
  const result: SignupResult = {
    user: toSessionUser(user),
    initialGrant: "1000000",
    welcome: {
      policy: { baseRate: policy.baseRate, depositRate: policy.depositRate },
      index: { value: index.value, changeRate: index.changeRate, intraday: index.intraday },
      headline: marketHeadline(),
    },
  };
  signups.set(idempotencyKey, result);
  return result;
}

export function login(rawEmail: string, password: string): SessionUser {
  const email = normalize(rawEmail);
  const u = users[email];
  if (!u || u.password !== password) throw new MockError(401, "INVALID_CREDENTIALS");
  setSession(email);
  return toSessionUser(u);
}

export function logout() {
  setSession(null);
}

export function me(): SessionUser {
  const u = sessionEmail ? users[sessionEmail] : undefined;
  if (!u) throw new MockError(401, "UNAUTHORIZED");
  return toSessionUser(u);
}

/* ───────── 프로필 (SCR-06 §2) ───────── */

function sessionUser(): [string, StoredUser] {
  const u = sessionEmail ? users[sessionEmail] : undefined;
  if (!sessionEmail || !u) throw new MockError(401, "UNAUTHORIZED");
  return [sessionEmail, u];
}

export function getProfile(): MyProfile {
  const [email, u] = sessionUser();
  return {
    ...toSessionUser(u),
    schoolDomain: email.split("@")[1] ?? "",
    joinedAt: u.joinedAt ?? new Date(Date.now() - JOINED_DAYS_AGO * 86_400_000).toISOString(),
    status: "ACTIVE",
  };
}

export function updateNickname(raw: string): MyProfile {
  const [, u] = sessionUser();
  const nickname = raw.trim();
  const n = [...nickname].length;
  if (n < 2 || n > 12 || /\s/.test(nickname)) throw new MockError(400, "INVALID_NICKNAME");
  if (nickname !== u.nickname && !isNicknameAvailable(nickname)) throw new MockError(409, "NICKNAME_TAKEN");
  u.nickname = nickname;
  save(USERS_KEY, users);
  return getProfile();
}
