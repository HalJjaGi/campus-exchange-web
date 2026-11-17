/**
 * 로그인한 계정의 가짜 자산(장부·계좌·자산 기록)을 연다.
 * 데모 계정은 21일치 이력으로, 새로 가입한 계정은 가입 지원금 1,000,000P만 있는 빈 계좌로 시작한다.
 * 같은 탭에서 다시 로그인하면 그 계정의 상태가 그대로 돌아온다. 새로고침하면 처음으로 돌아간다.
 */
import Decimal from "decimal.js-light";
import { openBook, record, seedDemoLedger } from "./ledger";
import { openTradingAccount } from "./market";
import { openHistory } from "./portfolio";

export const DEMO_EMAIL = "demo@campus.ac.kr";
/** 가입 지원금(SD-01). 가입 완료 모달의 initialGrant와 같다 */
export const INITIAL_GRANT = "1000000";

export function activateAccount(email: string, joinedAt: number) {
  const demo = email === DEMO_EMAIL;
  // 장부를 먼저 연다 — 계좌 예수금이 장부 잔액에서 시작한다
  openBook(email, () =>
    demo
      ? seedDemoLedger()
      : record("WALLET", "AIRDROP", new Decimal(INITIAL_GRANT), null, new Date(joinedAt).toISOString()),
  );
  openTradingAccount(email, demo ? [{ code: "CSE", qty: 30, avg: 12000 }] : []);
  openHistory(email, joinedAt, demo);
}
