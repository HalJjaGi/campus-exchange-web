import type { OrderResult } from "@/shared/types/api";
import { describeOrderResult } from "./mutations";

const r = (over: Partial<OrderResult>): OrderResult => ({
  orderId: "o1",
  status: "FILLED",
  quantity: 10,
  filledQuantity: 10,
  remainingQuantity: 0,
  avgFillPrice: "12350",
  fee: "123.5",
  ...over,
});

it("전량 체결", () => {
  expect(describeOrderResult(r({}))).toBe("10주 체결됐어요 (평균 12,350)");
});

it("부분 체결 후 잔량 호가 등록", () => {
  expect(describeOrderResult(r({ status: "PARTIALLY_FILLED", filledQuantity: 4, remainingQuantity: 6 }))).toBe(
    "4주 체결됐어요 (평균 12,350). 남은 6주는 호가에 등록했어요.",
  );
});

it("시장가 잔량 취소", () => {
  expect(describeOrderResult(r({ filledQuantity: 7 }))).toBe(
    "7주 체결됐어요 (평균 12,350). 남은 3주는 호가가 없어 취소됐어요.",
  );
});

it("미체결 접수", () => {
  expect(describeOrderResult(r({ status: "NEW", filledQuantity: 0, avgFillPrice: null, remainingQuantity: 10 }))).toBe(
    "주문이 접수됐어요. 가격이 맞으면 체결돼요.",
  );
});
