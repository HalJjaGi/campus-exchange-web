import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { sharedKeys } from "@/shared/api/queryKeys";
import { ApiError, userMessageOf } from "@/shared/api/errors";
import { useIdempotentMutation } from "@/shared/api/useIdempotentMutation";
import { formatPrice, formatQuantity } from "@/shared/lib/format";
import { useTopic } from "@/shared/realtime/RealtimeProvider";
import type { OrderResult, OrderUpdate, PlaceOrderRequest } from "@/shared/types/api";
import { toast } from "@/shared/ui/Toast";
import { tradeKeys } from "./queries";

function useInvalidateAfterOrder() {
  const qc = useQueryClient();
  return (code: string) => {
    void qc.invalidateQueries({ queryKey: tradeKeys.account(code) });
    void qc.invalidateQueries({ queryKey: tradeKeys.openOrders(code) });
    void qc.invalidateQueries({ queryKey: sharedKeys.wallet });
  };
}

/** 주문 결과 문구. 부분 체결·잔량 등록·시장가 잔량 취소를 구분한다 */
export function describeOrderResult(r: OrderResult): string {
  const filled =
    r.filledQuantity > 0 && r.avgFillPrice
      ? `${formatQuantity(r.filledQuantity)} 체결됐어요 (평균 ${formatPrice(r.avgFillPrice)})`
      : "";
  switch (r.status) {
    case "FILLED":
      return r.filledQuantity < r.quantity
        ? `${filled}. 남은 ${formatQuantity(r.quantity - r.filledQuantity)}는 호가가 없어 취소됐어요.`
        : filled;
    case "PARTIALLY_FILLED":
      return `${filled}. 남은 ${formatQuantity(r.remainingQuantity)}는 호가에 등록했어요.`;
    case "NEW":
      return "주문이 접수됐어요. 가격이 맞으면 체결돼요.";
    case "CANCELED":
      return "체결 가능한 호가가 없어 주문이 취소됐어요.";
    default:
      return "주문이 처리됐어요.";
  }
}

export function usePlaceOrder(onDone: () => void) {
  const invalidate = useInvalidateAfterOrder();
  return useIdempotentMutation<OrderResult, PlaceOrderRequest>(
    (body, idempotencyKey) => api<OrderResult>("/api/orders", { method: "POST", body, idempotencyKey }),
    {
      onSuccess: (result, vars) => {
        (result.status === "CANCELED" ? toast.show : toast.success)(describeOrderResult(result));
        invalidate(vars.code);
        onDone();
      },
      onError: (err, vars) => {
        toast.error(userMessageOf(err));
        // 서버 판단(예수금 부족 등)과 화면 값이 어긋났을 수 있으니 다시 맞춘다
        if (err instanceof ApiError) invalidate(vars.code);
      },
    },
  );
}

export function useCancelOrder(code: string) {
  const invalidate = useInvalidateAfterOrder();
  return useMutation({
    mutationFn: (orderId: string) => api<void>(`/api/orders/${orderId}`, { method: "DELETE" }),
    onSuccess: () => toast.show("주문을 취소했어요."),
    // 취소와 체결이 동시에 일어났다면 서버가 확정한 상태를 다시 받아 보여준다(SD-04)
    onError: (err) => toast.error(userMessageOf(err)),
    onSettled: () => invalidate(code),
  });
}

/**
 * 호가에 걸어 둔 주문이 나중에 체결되면 알린다. 어느 화면에 있든 받도록 앱 레이아웃에서 한 번 호출한다.
 * 주문 직후의 즉시 체결은 주문 응답으로 이미 알리므로 여기서는 lastFillQuantity > 0인 이벤트만 다룬다.
 */
export function useOrderFillNotifications() {
  const qc = useQueryClient();
  useTopic<OrderUpdate>("user.orders", (u) => {
    void qc.invalidateQueries({ queryKey: sharedKeys.wallet });
    if (u.lastFillQuantity <= 0 || !u.lastFillPrice) return;
    const tail = u.status === "FILLED" ? "전량 체결됐어요" : "체결됐어요";
    toast.success(`${u.name} ${formatQuantity(u.lastFillQuantity)} ${tail} (${formatPrice(u.lastFillPrice)})`);
  });
}
