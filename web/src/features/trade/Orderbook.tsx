import { memo, useCallback, useRef, useState, type KeyboardEvent, type MutableRefObject } from "react";
import { cx } from "@/shared/lib/cx";
import { toDecimal } from "@/shared/lib/decimal";
import { directionOf, formatChangeRate, formatPrice, formatQuantity } from "@/shared/lib/format";
import type { OrderbookLevel } from "@/shared/types/api";
import { LpMark } from "@/shared/ui/MarketBadges";
import { AsOf } from "@/shared/ui/Numbers";
import { ErrorBlock, SkeletonRows } from "@/shared/ui/States";
import { useOrderDraft } from "./orderDraft";
import { useOrderbookFeed } from "./queries";
import s from "./Orderbook.module.css";

const DEPTH = 10;

interface Props {
  code: string;
  prevClose: string;
  lastPrice: string;
}

interface RowModel {
  side: "ask" | "bid";
  /** 1 = 최우선 */
  rank: number;
  level: OrderbookLevel | null;
}

/**
 * 상하 10단계 호가(SCR-03 §2). 매도 잔량 | 가격 | 매수 잔량 3열.
 * 고빈도 영역이라 aria-live를 걸지 않는다(DESIGN.md §9).
 */
export function Orderbook({ code, prevClose, lastPrice }: Props) {
  const { data, isError, refetch, isFetching } = useOrderbookFeed(code);
  const pickPrice = useOrderDraft((st) => st.pickPrice);
  const [focusIndex, setFocusIndex] = useState(DEPTH - 1); // 최우선 매도호가
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  /** 키보드 이동 순서. 행은 memo라 핸들러를 다시 받지 않으므로 최신 값을 ref로 읽는다 */
  const focusableRef = useRef<number[]>([]);

  const onRowKeyDown = useCallback((e: KeyboardEvent, index: number) => {
    const list = focusableRef.current;
    const pos = list.indexOf(index);
    let next: number | undefined;
    if (e.key === "ArrowUp") next = list[Math.max(0, pos - 1)];
    else if (e.key === "ArrowDown") next = list[Math.min(list.length - 1, pos + 1)];
    else if (e.key === "Home") next = list[0];
    else if (e.key === "End") next = list[list.length - 1];
    if (next === undefined) return;
    e.preventDefault();
    setFocusIndex(next);
    refs.current[next]?.focus();
  }, []);

  if (!data) {
    return (
      <section className={s.book} aria-label="호가">
        <header className={s.head}>호가</header>
        {isError ? (
          <ErrorBlock message="호가를 불러오지 못했어요." onRetry={() => void refetch()} retrying={isFetching} />
        ) : (
          <SkeletonRows rows={DEPTH * 2} height={22} />
        )}
      </section>
    );
  }

  // 매도는 위에서부터 10호가 → 1호가, 매수는 1호가 → 10호가
  const rows: RowModel[] = [
    ...Array.from({ length: DEPTH }, (_, i) => ({
      side: "ask" as const,
      rank: DEPTH - i,
      level: data.asks[DEPTH - 1 - i] ?? null,
    })),
    ...Array.from({ length: DEPTH }, (_, i) => ({ side: "bid" as const, rank: i + 1, level: data.bids[i] ?? null })),
  ];

  const maxQty = Math.max(1, ...data.asks.map((l) => l.quantity), ...data.bids.map((l) => l.quantity));
  const askTotal = data.asks.reduce((n, l) => n + l.quantity, 0);
  const bidTotal = data.bids.reduce((n, l) => n + l.quantity, 0);

  const focusable = rows.map((r, i) => (r.level ? i : -1)).filter((i) => i >= 0);
  focusableRef.current = focusable;
  const activeIndex = focusable.includes(focusIndex) ? focusIndex : (focusable[0] ?? -1);

  return (
    <section className={s.book} aria-label="호가">
      <header className={s.head}>
        <span>호가</span>
        <span className={s.hint}>행을 누르면 주문 가격에 들어가요</span>
      </header>

      <div className={s.colHead} aria-hidden>
        <span>매도 잔량</span>
        <span>가격</span>
        <span>매수 잔량</span>
      </div>

      <div className={s.rows}>
        {rows.map((r, i) =>
          r.level ? (
            <Row
              key={`${r.side}-${r.rank}`}
              index={i}
              buttonRefs={refs}
              side={r.side}
              rank={r.rank}
              price={r.level.price}
              quantity={r.level.quantity}
              lpQuantity={r.level.lpQuantity}
              ratio={r.level.quantity / maxQty}
              prevClose={prevClose}
              current={r.level.price === lastPrice}
              tabIndex={i === activeIndex ? 0 : -1}
              onPick={pickPrice}
              onRowKeyDown={onRowKeyDown}
              onRowFocus={setFocusIndex}
            />
          ) : (
            <div key={`${r.side}-${r.rank}`} className={cx(s.row, s.empty)} aria-hidden />
          ),
        )}
      </div>

      <footer className={s.foot}>
        <span className={cx("num", s.total)}>{formatQuantity(askTotal, false)}</span>
        <span className={s.totalLabel}>잔량 합계</span>
        <span className={cx("num", s.total)}>{formatQuantity(bidTotal, false)}</span>
      </footer>
      <div className={s.asOf}>
        <AsOf at={data.updatedAt} />
      </div>
    </section>
  );
}

interface RowProps {
  index: number;
  buttonRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  side: "ask" | "bid";
  rank: number;
  price: string;
  quantity: number;
  lpQuantity: number;
  ratio: number;
  prevClose: string;
  current: boolean;
  tabIndex: number;
  onPick: (price: string) => void;
  onRowKeyDown: (e: KeyboardEvent, index: number) => void;
  onRowFocus: (index: number) => void;
}

/** 값(가격·잔량·비율)이 같으면 다시 그리지 않는다. 핸들러는 모두 안정적인 참조다 */
const Row = memo(
  function Row({
    index,
    buttonRefs,
    side,
    rank,
    price,
    quantity,
    lpQuantity,
    ratio,
    prevClose,
    current,
    tabIndex,
    onPick,
    onRowKeyDown,
    onRowFocus,
  }: RowProps) {
    const rate = toDecimal(price).minus(prevClose).dividedBy(prevClose);
    const dir = directionOf(rate);
    const qtyCell = (
      <span className={cx(s.qty, side === "ask" ? s.askQty : s.bidQty)}>
        <span className={cx(s.bar, side === "ask" ? s.askBar : s.bidBar)} style={{ transform: `scaleX(${ratio})` }} />
        {lpQuantity > 0 && <LpMark />}
        <span className={cx("num", s.qtyText)}>{formatQuantity(quantity, false)}</span>
      </span>
    );

    return (
      <button
        ref={(el) => {
          buttonRefs.current[index] = el;
        }}
        type="button"
        className={cx(s.row, current && s.current)}
        tabIndex={tabIndex}
        aria-label={`${side === "ask" ? "매도" : "매수"} ${rank}호가 ${formatPrice(price)}, 잔량 ${formatQuantity(quantity)}${lpQuantity > 0 ? ", LP 물량 포함" : ""}`}
        onClick={() => onPick(price)}
        onKeyDown={(e) => onRowKeyDown(e, index)}
        onFocus={() => onRowFocus(index)}
      >
        {side === "ask" ? qtyCell : <span />}
        <span className={cx(s.price, s[dir])}>
          <span className="num">{formatPrice(price)}</span>
          <span className={cx("num", s.rate)}>{formatChangeRate(rate)}</span>
        </span>
        {side === "bid" ? qtyCell : <span />}
      </button>
    );
  },
  (a, b) =>
    a.price === b.price &&
    a.quantity === b.quantity &&
    a.lpQuantity === b.lpQuantity &&
    a.ratio === b.ratio &&
    a.current === b.current &&
    a.tabIndex === b.tabIndex &&
    a.prevClose === b.prevClose,
);
