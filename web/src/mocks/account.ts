/**
 * 로그인한 계정의 가짜 자산(장부·계좌·자산 기록)을 연다.
 * 데모 계정은 21일치 이력으로, 새로 가입한 계정은 가입 지원금 1,000,000P만 있는 빈 계좌로 시작한다.
 * 같은 탭에서 다시 로그인하면 그 계정의 상태가 그대로 돌아온다. 새로고침하면 처음으로 돌아간다.
 * 계정별 상태: 장부(ledger) · 계좌와 주문(market) · 자산 기록(portfolio) · 알림(notifications). 새로 추가하면 아래 두 함수에 모두 넣는다.
 */
import Decimal from "decimal.js-light";
import { DEMO_BUY, INITIAL_GRANT, openBook, record, seedDemoLedger } from "./ledger";
import { openTradingAccount } from "./market";
import { openNotifications } from "./notifications";
import { openHistory } from "./portfolio";

export const DEMO_EMAIL = "demo@campus.ac.kr";
export { INITIAL_GRANT };

/** 로그아웃 상태. 시세 mock이 이전 사용자 주문을 계속 체결하거나 알림을 쌓지 않게 빈 계정으로 바꾼다 */
const NOBODY = "";

export function activateAccount(email: string, joinedAt: number) {
  const demo = email === DEMO_EMAIL;
  // 장부를 먼저 연다 — 계좌 예수금이 장부 잔액에서 시작한다
  openBook(email, () =>
    demo
      ? seedDemoLedger()
      : record("WALLET", "AIRDROP", new Decimal(INITIAL_GRANT), null, new Date(joinedAt).toISOString()),
  );
  openTradingAccount(email, demo ? [DEMO_BUY] : []);
  openHistory(email, joinedAt, demo);
  openNotifications(email);
}

export function deactivateAccount() {
  openBook(NOBODY, () => {});
  openTradingAccount(NOBODY, []);
  openHistory(NOBODY, Date.now(), false);
  openNotifications(NOBODY);
}
