import { useRef } from "react";
import { cx } from "@/shared/lib/cx";
import { formatPrice, formatQuantity, formatTime } from "@/shared/lib/format";
import { EmptyState, ErrorBlock, SkeletonRows } from "@/shared/ui/States";
import { useTradeTape } from "./queries";
import s from "./tables.module.css";

/** 최근 체결(SCR-03 §2). 새 행만 한 번 깜빡인다. 첫 로드 때는 깜빡이지 않는다 */
export function TradeTape({ code }: { code: string }) {
  const { data, isError, refetch, isFetching } = useTradeTape(code);
  // 종목이 바뀌면 부모가 key로 다시 마운트하므로 여기서 초기화할 필요가 없다
  const initialIds = useRef<Set<string> | null>(null);

  if (!data) {
    return isError ? (
      <ErrorBlock message="체결 내역을 불러오지 못했어요." onRetry={() => void refetch()} retrying={isFetching} />
    ) : (
      <SkeletonRows rows={8} height={22} />
    );
  }
  if (data.items.length === 0) return <EmptyState message="아직 오늘 체결이 없어요." />;

  initialIds.current ??= new Set(data.items.map((t) => t.id));

  return (
    <div className={s.scroll}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>시각</th>
            <th className={s.right}>체결가</th>
            <th className={s.right}>수량</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((t) => (
            <tr key={t.id} className={cx(!initialIds.current?.has(t.id) && s.fresh)}>
              <td className={cx("num", s.muted)}>{formatTime(t.at)}</td>
              <td className={cx("num", s.right, t.side === "BUY" ? s.up : s.down)}>{formatPrice(t.price)}</td>
              <td className={cx("num", s.right)}>
                {formatQuantity(t.quantity, false)}
                <span className="visually-hidden">{t.side === "BUY" ? " 매수 체결" : " 매도 체결"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
