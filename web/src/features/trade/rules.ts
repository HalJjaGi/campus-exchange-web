/**
 * 주문 패널의 계산·검증 규칙. 화면 안내용이며 서버 검증을 대신하지 않는다(UC-03 §5).
 * 값(호가 단위·수량 범위·수수료율)은 전부 정책 API에서 받은 것을 인자로 받는다.
 */
import { Decimal, estimateOrder, maxBuyQuantity, toDecimal, type DecimalInput } from "@/shared/lib/decimal";
import { formatPoints, formatPrice, formatQuantity } from "@/shared/lib/format";
import type { OrderKind, OrderSide, OrderbookLevel, TickRule, TradingAccount } from "@/shared/types/api";

/* ───────── 호가 단위 ───────── */

export function tickFor(price: DecimalInput, rules: TickRule[]): Decimal {
  const p = toDecimal(price);
  const rule = rules.find((r) => r.upTo === null || p.lt(r.upTo)) ?? rules[rules.length - 1];
  return toDecimal(rule?.tick ?? 1);
}

export function isOnTick(price: DecimalInput, rules: TickRule[]): boolean {
  const p = toDecimal(price);
  return p.mod(tickFor(p, rules)).isZero();
}

/** 가장 가까운 아래쪽 호가로 내림 */
export function floorToTick(price: DecimalInput, rules: TickRule[]): Decimal {
  const p = toDecimal(price);
  const tick = tickFor(p, rules);
  return p.dividedBy(tick).toDecimalPlaces(0, Decimal.ROUND_DOWN).times(tick);
}

/**
 * ± 버튼. 구간 경계에서는 올라갈 때와 내려갈 때 단위가 다르다.
 * 예) 구간 [1,000 미만: 1, 5,000 미만: 5] 에서 1,000 − 1틱 = 999, 999 + 1틱 = 1,000
 */
export function stepPrice(price: DecimalInput, direction: 1 | -1, rules: TickRule[]): Decimal {
  const p = floorToTick(price, rules);
  if (direction === 1) return p.plus(tickFor(p, rules));
  const below = p.minus(tickFor(p.minus("0.0001"), rules));
  return below.gt(0) ? below : p;
}

/* ───────── 시장가 추정 ───────── */

export interface BookWalk {
  filledQuantity: number;
  gross: Decimal;
  /** 체결 예상 평균가. 체결 예상 수량이 0이면 null */
  avgPrice: Decimal | null;
  /** 호가 잔량이 모자라 일부만 체결될 수 있음 */
  insufficient: boolean;
}

/** 반대편 호가를 최우선부터 소진한다고 보고 예상 금액을 계산한다 */
export function walkBook(levels: OrderbookLevel[], quantity: number): BookWalk {
  let left = quantity;
  let gross = new Decimal(0);
  for (const lv of levels) {
    if (left <= 0) break;
    const take = Math.min(left, lv.quantity);
    gross = gross.plus(toDecimal(lv.price).times(take));
    left -= take;
  }
  const filled = quantity - left;
  return {
    filledQuantity: filled,
    gross,
    avgPrice: filled > 0 ? gross.dividedBy(filled) : null,
    insufficient: left > 0,
  };
}

/** 시장가 매수로 살 수 있는 최대 수량(수수료 포함, 호가 잔량 한도) */
export function maxMarketBuyQuantity(levels: OrderbookLevel[], available: DecimalInput, feeRate: DecimalInput): number {
  let budget = toDecimal(available);
  let qty = 0;
  const rate = toDecimal(feeRate).plus(1);
  for (const lv of levels) {
    const unit = toDecimal(lv.price).times(rate);
    const affordable = budget.dividedBy(unit).toDecimalPlaces(0, Decimal.ROUND_DOWN).toNumber();
    const take = Math.min(affordable, lv.quantity);
    qty += take;
    budget = budget.minus(unit.times(take));
    if (take < lv.quantity) break;
  }
  // 위 계산은 수수료를 반올림하지 않는다. 화면 검증(합계에 한 번 반올림)과 서버 정산(체결 건마다 반올림)
  // 둘 다로 실제 금액을 다시 따져 예산을 넘으면 1주씩 줄인다 — 경계에서 "부족 1P"가 뜨지 않게
  while (qty > 0 && marketBuyCost(levels, qty, feeRate).gt(available)) qty -= 1;
  return qty;
}

/** 시장가 매수 정산 예상액. 합계 반올림과 체결 건별 반올림 중 큰 쪽 */
function marketBuyCost(levels: OrderbookLevel[], quantity: number, feeRate: DecimalInput): Decimal {
  const rate = toDecimal(feeRate);
  let left = quantity;
  let gross = new Decimal(0);
  let perFillFee = new Decimal(0);
  for (const lv of levels) {
    if (left <= 0) break;
    const take = Math.min(left, lv.quantity);
    const g = toDecimal(lv.price).times(take);
    gross = gross.plus(g);
    perFillFee = perFillFee.plus(g.times(rate).toDecimalPlaces(2));
    left -= take;
  }
  const totalFee = gross.times(rate).toDecimalPlaces(2);
  return gross.plus(totalFee.gt(perFillFee) ? totalFee : perFillFee);
}

/* ───────── 주문 검증 ───────── */

export interface OrderDraft {
  side: OrderSide;
  kind: OrderKind;
  /** 입력 문자열 그대로(쉼표 제거 후). 시장가면 무시 */
  price: string;
  quantity: number;
}

export interface OrderContext {
  account: TradingAccount;
  feeRate: DecimalInput;
  tickRules: TickRule[];
  quantityLimits: { min: number; max: number };
  /** 반대편 호가(매수면 asks, 매도면 bids). 시장가 추정용 */
  opposite: OrderbookLevel[];
}

export interface OrderPreview {
  gross: Decimal;
  fee: Decimal;
  /** 매수: 필요 금액, 매도: 입금 예정액 */
  settlement: Decimal;
  /** 시장가 추정치 여부 */
  estimated: boolean;
  avgPrice: Decimal | null;
  insufficientBook: boolean;
}

export type OrderIssue = { field: "price" | "quantity" | "funds"; message: string };

export interface OrderCheck {
  preview: OrderPreview | null;
  issues: OrderIssue[];
}

export function checkOrder(draft: OrderDraft, ctx: OrderContext): OrderCheck {
  const issues: OrderIssue[] = [];
  const { min, max } = ctx.quantityLimits;

  if (!Number.isInteger(draft.quantity) || draft.quantity <= 0) {
    issues.push({ field: "quantity", message: "수량을 입력해 주세요." });
  } else if (draft.quantity < min || draft.quantity > max) {
    issues.push({
      field: "quantity",
      message: `한 번에 ${formatQuantity(min)}부터 ${formatQuantity(max)}까지 주문할 수 있어요.`,
    });
  }

  let preview: OrderPreview | null = null;

  if (draft.kind === "LIMIT") {
    const price = parsePrice(draft.price);
    if (!price) {
      issues.push({ field: "price", message: "가격을 입력해 주세요." });
    } else if (!isOnTick(price, ctx.tickRules)) {
      const tick = tickFor(price, ctx.tickRules);
      issues.push({ field: "price", message: `이 가격대는 ${formatPrice(tick)} 단위로 주문할 수 있어요.` });
    } else if (draft.quantity > 0) {
      const e = estimateOrder({ side: draft.side, price, quantity: draft.quantity, feeRate: ctx.feeRate });
      preview = { ...e, estimated: false, avgPrice: price, insufficientBook: false };
    }
  } else if (draft.quantity > 0) {
    const walk = walkBook(ctx.opposite, draft.quantity);
    if (walk.avgPrice) {
      const fee = walk.gross.times(toDecimal(ctx.feeRate)).toDecimalPlaces(2);
      const settlement = draft.side === "BUY" ? walk.gross.plus(fee) : walk.gross.minus(fee);
      preview = {
        gross: walk.gross,
        fee,
        settlement,
        estimated: true,
        avgPrice: walk.avgPrice,
        insufficientBook: walk.insufficient,
      };
    } else {
      issues.push({ field: "quantity", message: "지금은 반대편 호가가 없어 시장가로 주문할 수 없어요." });
    }
  }

  if (preview && issues.length === 0) {
    if (draft.side === "BUY" && preview.settlement.gt(ctx.account.available)) {
      const short = preview.settlement.minus(ctx.account.available);
      issues.push({
        field: "funds",
        message: `예수금이 부족해요 (부족 ${formatPoints(short.toDecimalPlaces(0, Decimal.ROUND_UP))}).`,
      });
    }
    if (draft.side === "SELL" && draft.quantity > ctx.account.sellableQuantity) {
      issues.push({
        field: "quantity",
        message: `매도 가능 수량은 ${formatQuantity(ctx.account.sellableQuantity)}예요.`,
      });
    }
  }

  return { preview, issues };
}

/** 퀵 버튼(10/25/50/MAX)이 채울 수량 */
export function quickQuantity(percent: number, draft: OrderDraft, ctx: OrderContext): number {
  let max: number;
  if (draft.side === "SELL") {
    max = ctx.account.sellableQuantity;
  } else if (draft.kind === "MARKET") {
    max = maxMarketBuyQuantity(ctx.opposite, ctx.account.available, ctx.feeRate);
  } else {
    const price = parsePrice(draft.price);
    max = price ? maxBuyQuantity(ctx.account.available, price, ctx.feeRate) : 0;
  }
  max = Math.min(max, ctx.quantityLimits.max);
  return Math.floor((max * percent) / 100);
}

/** "12,350" → Decimal. 비었거나 0 이하·숫자 아님은 null */
export function parsePrice(input: string): Decimal | null {
  const cleaned = input.replace(/,/g, "").trim();
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const d = new Decimal(cleaned);
  return d.gt(0) ? d : null;
}
