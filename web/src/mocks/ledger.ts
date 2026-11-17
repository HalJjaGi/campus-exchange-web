/**
 * 개발용 가짜 원장. 실제 서버처럼 모든 잔액 변동을 한 줄씩 쌓는다(수정·삭제 없음).
 * 지갑 잔액 = 사용 가능 + 주문 예약. 예약은 내 돈이 묶일 뿐이라 원장에 남기지 않는다.
 * 계정마다 장부가 따로 있고, 로그인한 계정의 장부가 열린다(account.ts).
 *
 * 데모 계정 이력: 21일 전 가입 지원금 → 다음 날 컴퓨터공학과 30주 매수 → 오락실 보상을 예금으로 → 매일 예금 이자
 */
import Decimal from "decimal.js-light";
import { kstDate } from "@/features/portfolio/valuation";
import type { LedgerAccount, LedgerEntry, LedgerPage, LedgerTrade, LedgerTxType } from "@/shared/types/api";
import { mockId } from "./bus";

const PAGE = 20;
const DAY = 86_400_000;

export const JOINED_DAYS_AGO = 21;
/** 가입 지원금(SD-01). 가입 완료 모달의 initialGrant와 같다 */
export const INITIAL_GRANT = "1000000";
/** 데모 계정이 가입 다음 날 산 종목. 계좌 보유 종목도 여기서 만든다 */
export const DEMO_BUY = { code: "CSE", name: "컴퓨터공학과", quantity: 30, price: "12000" } as const;

interface Book {
  entries: LedgerEntry[];
  balances: Record<LedgerAccount, Decimal>;
}

const newBook = (): Book => ({ entries: [], balances: { WALLET: new Decimal(0), BANK: new Decimal(0) } });
const books = new Map<string, Book>();
/** 로그인 전에도 시장 mock이 돌 수 있게 빈 장부를 하나 열어 둔다 */
let book: Book = newBook();

/** 계정 장부를 연다. 처음 여는 계정이면 init으로 이력을 채운다 */
export function openBook(key: string, init: () => void) {
  const existing = books.get(key);
  if (existing) {
    book = existing;
    return;
  }
  book = newBook();
  books.set(key, book);
  init();
}

export function record(
  accountType: LedgerAccount,
  txType: LedgerTxType,
  amount: Decimal,
  trade: LedgerTrade | null = null,
  at: string = new Date().toISOString(),
) {
  book.balances[accountType] = book.balances[accountType].plus(amount);
  book.entries.push({
    id: mockId("l"),
    accountType,
    txType,
    amount: amount.toString(),
    balanceAfter: book.balances[accountType].toString(),
    trade,
    createdAt: at,
  });
}

export const balanceOf = (a: LedgerAccount) => book.balances[a];

/** 오늘(한국 시간) 들어온 이자 합계 */
export function interestToday(): Decimal {
  const today = kstDate(Date.now());
  return book.entries
    .filter((e) => e.txType === "INTEREST" && kstDate(Date.parse(e.createdAt)) === today)
    .reduce((s, e) => s.plus(e.amount), new Decimal(0));
}

export function listLedger(types: LedgerTxType[], from: string | null, cursor: string | null): LedgerPage {
  const filtered = book.entries
    .filter(
      (e) => (types.length === 0 || types.includes(e.txType)) && (!from || kstDate(Date.parse(e.createdAt)) >= from),
    )
    .reverse();
  const start = cursor ? Number(cursor) : 0;
  return {
    items: filtered.slice(start, start + PAGE),
    nextCursor: start + PAGE < filtered.length ? String(start + PAGE) : null,
  };
}

/* ───────── 데모 이력 ───────── */

export function seedDemoLedger() {
  const day = (ago: number, h: number, m = 0) => {
    const d = new Date(Date.now() - ago * DAY);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  record("WALLET", "AIRDROP", new Decimal(INITIAL_GRANT), null, day(JOINED_DAYS_AGO, 10, 12));

  const trade: LedgerTrade = { tradeId: mockId("t"), side: "BUY", ...DEMO_BUY };
  const gross = new Decimal(DEMO_BUY.price).times(DEMO_BUY.quantity);
  record("WALLET", "TRADE", gross.negated(), trade, day(JOINED_DAYS_AGO - 1, 9, 31));
  record("WALLET", "FEE", gross.times("0.001").toDecimalPlaces(2).negated(), trade, day(JOINED_DAYS_AGO - 1, 9, 31));

  record("BANK", "REWARD", new Decimal(20_000), null, day(14, 21, 40));
  // 예금 이자: 연 2% 일할. 실제 금리·지급 시각은 중앙은행 배치가 정한다(SD-15)
  for (let ago = 13; ago >= 0; ago--) {
    const interest = book.balances.BANK.times("0.02").dividedBy(365).toDecimalPlaces(2);
    record("BANK", "INTEREST", interest, null, day(ago, 0, 5));
  }
}
