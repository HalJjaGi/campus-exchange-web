import Decimal from "decimal.js-light";

/**
 * 서버는 DECIMAL 컬럼을 문자열로 보낸다(JS number 정밀도 손실 방지).
 * 금액 계산은 전부 이 모듈을 거친다.
 */
export type DecimalString = string;
export type DecimalInput = DecimalString | number | Decimal;

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export const toDecimal = (v: DecimalInput): Decimal => (v instanceof Decimal ? v : new Decimal(v));

export interface OrderEstimate {
  gross: Decimal;
  fee: Decimal;
  /** 매수: 필요 금액(gross + fee), 매도: 입금 예정액(gross - fee) */
  settlement: Decimal;
}

/** 예상 거래 금액·수수료·정산액. 서버 확정값이 아니라 화면 안내용이다. */
export function estimateOrder(params: {
  side: "BUY" | "SELL";
  price: DecimalInput;
  quantity: number;
  feeRate: DecimalInput;
}): OrderEstimate {
  const gross = toDecimal(params.price).times(params.quantity);
  const fee = gross.times(toDecimal(params.feeRate)).toDecimalPlaces(2);
  const settlement = params.side === "BUY" ? gross.plus(fee) : gross.minus(fee);
  return { gross, fee, settlement };
}

/** 수수료까지 포함해 살 수 있는 최대 수량(내림). */
export function maxBuyQuantity(available: DecimalInput, price: DecimalInput, feeRate: DecimalInput): number {
  const unit = toDecimal(price).times(toDecimal(feeRate).plus(1));
  if (unit.lte(0)) return 0;
  let qty = toDecimal(available).dividedBy(unit).toDecimalPlaces(0, Decimal.ROUND_DOWN).toNumber();
  // 수수료 반올림 때문에 경계에서 1주 초과될 수 있어 실제 정산액으로 한 번 더 확인한다.
  while (qty > 0 && estimateOrder({ side: "BUY", price, quantity: qty, feeRate }).settlement.gt(available)) {
    qty -= 1;
  }
  return qty;
}

/** 보유 수량의 비율(10/25/50/100%)을 정수 주로 내림. */
export const ratioOfQuantity = (quantity: number, percent: number): number => Math.floor((quantity * percent) / 100);

export { Decimal };
