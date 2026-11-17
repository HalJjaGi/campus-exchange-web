import { ArrowDown, ArrowUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cx } from "@/shared/lib/cx";
import { formatPoints, formatPrice, formatQuantity } from "@/shared/lib/format";
import { ChangeRate, Points, PriceText } from "@/shared/ui/Numbers";
import { EmptyState, ErrorBlock, SkeletonRows } from "@/shared/ui/States";
import { useHoldings } from "./queries";
import { evaluate, sortHoldings, type HoldingRow, type HoldingSortKey, type SortDir } from "./valuation";
import s from "./portfolio.module.css";

interface Sort {
  key: HoldingSortKey;
  dir: SortDir;
}

/**
 * 보유 종목 표(SCR-06 §4). 행을 누르면 그 종목 거래 화면으로 간다.
 * 예수금 조회가 실패해도 보유 종목은 따로 보여 준다 — 표에는 예수금이 필요 없다.
 */
export function HoldingsTable() {
  const { data, isError, isFetching, refetch } = useHoldings();
  const [sort, setSort] = useState<Sort>({ key: "value", dir: "desc" });
  const rows = useMemo(() => (data ? sortHoldings(data.items.map(evaluate), sort.key, sort.dir) : []), [data, sort]);

  // 수량을 다시 확인하지 못했으면 마지막 값을 최신처럼 두지 않는다(UC-14 예외)
  if (isError) {
    return <ErrorBlock message="보유 종목을 불러오지 못했어요." onRetry={() => void refetch()} retrying={isFetching} />;
  }
  if (!data) return <SkeletonRows rows={3} height={40} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        message="아직 보유한 종목이 없어요."
        action={
          <Link to="/" className={s.textLink}>
            종목 둘러보기
          </Link>
        }
      />
    );
  }

  const toggle = (key: HoldingSortKey) =>
    setSort((cur) =>
      cur.key === key
        ? { key, dir: cur.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );

  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <caption className="visually-hidden">보유 종목. 열 제목을 눌러 정렬할 수 있어요.</caption>
        <thead>
          <tr>
            <SortHeader label="종목" sortKey="name" sort={sort} onSort={toggle} />
            <th className={s.right}>보유 수량</th>
            <th className={s.right}>평균 매입가</th>
            <th className={s.right}>현재가</th>
            <SortHeader label="평가금액" sortKey="value" sort={sort} onSort={toggle} right />
            <SortHeader label="평가손익" sortKey="pnl" sort={sort} onSort={toggle} right />
            <SortHeader label="수익률" sortKey="returnRate" sort={sort} onSort={toggle} right />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <HoldingRowView key={r.code} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  right,
}: {
  label: string;
  sortKey: HoldingSortKey;
  sort: Sort;
  onSort: (k: HoldingSortKey) => void;
  right?: boolean;
}) {
  const active = sort.key === sortKey;
  const Icon = sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={cx(right && s.right)}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button type="button" className={cx(s.sortButton, active && s.sortActive)} onClick={() => onSort(sortKey)}>
        {label}
        {active && <Icon size={12} aria-hidden />}
      </button>
    </th>
  );
}

function HoldingRowView({ row }: { row: HoldingRow }) {
  const navigate = useNavigate();
  const to = `/trade/${row.code}`;
  return (
    <tr className={s.row} onClick={() => navigate(to)}>
      <td>
        <Link to={to} className={s.name} onClick={(e) => e.stopPropagation()}>
          {row.name}
        </Link>
      </td>
      <td className={cx("num", s.right)}>{formatQuantity(row.quantity)}</td>
      <td className={cx("num", s.right, s.muted)}>{formatPrice(row.avgPrice)}</td>
      <td className={s.right}>
        <PriceText value={row.price} reference={row.prevClose} />
      </td>
      <td className={cx("num", s.right, s.strong)}>{formatPoints(row.value)}</td>
      <td className={s.right}>
        <Points value={row.pnl.toString()} signed />
      </td>
      <td className={s.right}>
        <ChangeRate ratio={row.returnRate.toDecimalPlaces(4).toString()} />
      </td>
    </tr>
  );
}
