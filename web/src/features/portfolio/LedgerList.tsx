import { useState } from "react";
import { Link } from "react-router-dom";
import { cx } from "@/shared/lib/cx";
import { formatPoints, formatSignedPoints, formatTime } from "@/shared/lib/format";
import type { LedgerEntry } from "@/shared/types/api";
import { Button } from "@/shared/ui/Button";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { EmptyState, ErrorBlock, SkeletonRows } from "@/shared/ui/States";
import { TX_LABEL, describeEntry, type LedgerGroup, type LedgerPeriod } from "./ledgerRules";
import { useLedger } from "./queries";
import s from "./portfolio.module.css";

const GROUPS: Array<{ value: LedgerGroup; label: string }> = [
  { value: "all", label: "전체" },
  { value: "trade", label: "매매" },
  { value: "bank", label: "이자·배당" },
  { value: "grant", label: "지급" },
];

const PERIODS: Array<{ value: LedgerPeriod; label: string }> = [
  { value: "1w", label: "1주" },
  { value: "1m", label: "1개월" },
  { value: "3m", label: "3개월" },
  { value: "all", label: "전체" },
];

const ACCOUNT_LABEL = { WALLET: "지갑", BANK: "예금" } as const;

/**
 * 예수금·거래 내역(SCR-06 §7). 서버 원장(Ledger) 그대로 보여 준다 — 화면에서 합치거나 고치지 않는다.
 * 금액은 입출금 방향일 뿐 수익·손실이 아니어서 등락색을 쓰지 않는다.
 */
export function LedgerList() {
  const [group, setGroup] = useState<LedgerGroup>("all");
  const [period, setPeriod] = useState<LedgerPeriod>("1m");
  const q = useLedger(group, period);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className={s.ledger}>
      <div className={s.filters}>
        <SegmentedControl<LedgerGroup> label="거래 유형" size="sm" value={group} onChange={setGroup} options={GROUPS} />
        <SegmentedControl<LedgerPeriod>
          label="조회 기간"
          size="sm"
          value={period}
          onChange={setPeriod}
          options={PERIODS}
        />
      </div>

      {q.data && !(q.isError && !q.isFetchNextPageError) ? (
        items.length === 0 ? (
          <EmptyState message="이 조건에 맞는 거래 내역이 없어요." />
        ) : (
          <>
            <div className={cx(s.tableWrap, q.isPlaceholderData && s.pending)} aria-busy={q.isPlaceholderData}>
              <table className={s.table}>
                <caption className="visually-hidden">거래 내역, 최신순</caption>
                <thead>
                  <tr>
                    <th>일시</th>
                    <th>구분</th>
                    <th>내용</th>
                    <th className={s.right}>금액</th>
                    <th className={s.right}>거래 후 잔액</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => (
                    <LedgerRow key={e.id} entry={e} />
                  ))}
                </tbody>
              </table>
            </div>
            {q.isFetchNextPageError && (
              <ErrorBlock
                message="다음 내역을 불러오지 못했어요."
                onRetry={() => void q.fetchNextPage()}
                retrying={q.isFetchingNextPage}
              />
            )}
            {q.hasNextPage && !q.isFetchNextPageError && (
              <div className={s.more}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void q.fetchNextPage()}
                  busy={q.isFetchingNextPage}
                >
                  이전 내역 더 보기
                </Button>
              </div>
            )}
          </>
        )
      ) : q.isError ? (
        <ErrorBlock message="거래 내역을 불러오지 못했어요." onRetry={() => void q.refetch()} retrying={q.isFetching} />
      ) : (
        <SkeletonRows rows={5} height={40} />
      )}
    </div>
  );
}

function LedgerRow({ entry: e }: { entry: LedgerEntry }) {
  return (
    <tr>
      <td className={cx("num", s.muted)}>
        <time dateTime={e.createdAt}>{formatTime(e.createdAt)}</time>
      </td>
      <td>
        <span className={s.txType}>{TX_LABEL[e.txType]}</span>
        <span className={s.account}>{ACCOUNT_LABEL[e.accountType]}</span>
      </td>
      <td className={s.wrapCell}>
        {e.trade ? (
          <Link to={`/trade/${e.trade.code}`} className={s.plainLink}>
            {describeEntry(e)}
          </Link>
        ) : (
          describeEntry(e)
        )}
        <span className={cx("num", s.txId)} title={`거래 ID ${e.id}`}>
          {e.trade ? `체결 ${e.trade.tradeId.slice(-8)}` : e.id.slice(-8)}
        </span>
      </td>
      <td className={cx("num", s.right, s.strong)}>{formatSignedPoints(e.amount)}</td>
      <td className={cx("num", s.right, s.muted)}>{formatPoints(e.balanceAfter)}</td>
    </tr>
  );
}
