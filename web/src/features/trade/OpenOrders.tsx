import { cx } from "@/shared/lib/cx";
import { formatPrice, formatQuantity, formatTime } from "@/shared/lib/format";
import type { OpenOrder } from "@/shared/types/api";
import { Button } from "@/shared/ui/Button";
import { EmptyState, ErrorBlock, SkeletonRows } from "@/shared/ui/States";
import { useCancelOrder } from "./mutations";
import { useOpenOrders } from "./queries";
import s from "./tables.module.css";

const STATUS_LABEL: Record<OpenOrder["status"], string> = {
  NEW: "접수",
  PARTIALLY_FILLED: "부분 체결",
};

/** 미체결 주문 목록·취소(UC-04, SD-04) */
export function OpenOrders({ code }: { code: string }) {
  const { data, isError, refetch, isFetching } = useOpenOrders(code);
  const cancel = useCancelOrder(code);

  if (!data) {
    return isError ? (
      <ErrorBlock message="미체결 주문을 불러오지 못했어요." onRetry={() => void refetch()} retrying={isFetching} />
    ) : (
      <SkeletonRows rows={3} />
    );
  }
  if (data.length === 0) return <EmptyState message="미체결 주문이 없어요." />;

  return (
    <div className={s.scroll}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>주문 시각</th>
            <th>구분</th>
            <th className={s.right}>가격</th>
            <th className={s.right}>주문</th>
            <th className={s.right}>체결</th>
            <th className={s.right}>잔량</th>
            <th>상태</th>
            <th>
              <span className="visually-hidden">취소</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((o) => {
            const pending = cancel.isPending && cancel.variables === o.orderId;
            return (
              <tr key={o.orderId}>
                <td className={cx("num", s.muted)}>{formatTime(o.createdAt)}</td>
                <td className={o.side === "BUY" ? s.up : s.down}>{o.side === "BUY" ? "매수" : "매도"}</td>
                <td className={cx("num", s.right)}>{formatPrice(o.price)}</td>
                <td className={cx("num", s.right)}>{formatQuantity(o.quantity, false)}</td>
                <td className={cx("num", s.right)}>{formatQuantity(o.filledQuantity, false)}</td>
                <td className={cx("num", s.right, s.strong)}>{formatQuantity(o.quantity - o.filledQuantity, false)}</td>
                <td className={s.muted}>{STATUS_LABEL[o.status]}</td>
                <td className={s.right}>
                  <Button
                    size="sm"
                    variant="ghost"
                    busy={pending}
                    onClick={() => cancel.mutate(o.orderId)}
                    aria-label={`${formatPrice(o.price)} ${o.side === "BUY" ? "매수" : "매도"} 주문 취소`}
                  >
                    취소
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
