import { memo, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatQuantity } from "@/shared/lib/format";
import type { StockQuote } from "@/shared/types/api";
import { MoveReasonTag, StockStateBadge } from "@/shared/ui/MarketBadges";
import { AsOf, ChangeRate, PriceText } from "@/shared/ui/Numbers";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Sparkline } from "@/shared/ui/Sparkline";
import { EmptyState, ErrorBlock, SkeletonRows } from "@/shared/ui/States";
import { Tabs } from "@/shared/ui/Tabs";
import { useRanking } from "./queries";
import { rankStocks, reasonTagCodes, type CategoryFilter, type RankingSort } from "./ranking";
import { useFlipReorder } from "./useFlipReorder";
import s from "./dashboard.module.css";

const CATEGORIES: { value: CategoryFilter; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "DEPT", label: "학과주" },
  { value: "SCHEDULE", label: "학사일정 테마" },
  { value: "MEME", label: "교내 밈 코인" },
];

/** 종목 랭킹(SCR-02 §3~5). 1초 스냅샷마다 순위가 바뀐 행만 자리를 옮긴다 */
export function RankingTable() {
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [sort, setSort] = useState<RankingSort>("RISE");
  const { data, isError, refetch, isFetching } = useRanking();
  const body = useRef<HTMLTableSectionElement>(null);
  useFlipReorder(body);

  const rows = useMemo(() => (data ? rankStocks(data.items, category, sort) : []), [data, category, sort]);
  const reasonCodes = useMemo(() => (data ? reasonTagCodes(data.items) : new Set<string>()), [data]);

  return (
    <section className={s.ranking} aria-labelledby="ranking-title">
      <div className={s.rankingHead}>
        <h2 id="ranking-title" className={s.sectionTitle}>
          종목 랭킹
        </h2>
        <SegmentedControl<RankingSort>
          label="정렬"
          size="sm"
          value={sort}
          onChange={setSort}
          options={[
            { value: "RISE", label: "상승률" },
            { value: "FALL", label: "하락률" },
            { value: "VOLUME", label: "거래량" },
          ]}
        />
      </div>
      <Tabs<CategoryFilter>
        label="카테고리"
        idPrefix="ranking"
        items={CATEGORIES}
        value={category}
        onChange={setCategory}
      />

      <div role="tabpanel" id={`ranking-panel-${category}`} aria-labelledby={`ranking-tab-${category}`}>
        {!data ? (
          isError ? (
            <ErrorBlock message="시세를 불러오지 못했어요." onRetry={() => void refetch()} retrying={isFetching} />
          ) : (
            <SkeletonRows rows={8} height={48} />
          )
        ) : rows.length === 0 ? (
          <EmptyState message="이 카테고리에는 아직 상장된 종목이 없어요." />
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th className={s.rankCol}>순위</th>
                  <th>종목</th>
                  <th className={s.right}>현재가</th>
                  <th className={s.right}>등락률</th>
                  <th className={`${s.right} ${s.optional}`}>거래량</th>
                  <th className={s.optional}>
                    <span className="visually-hidden">당일 추이</span>
                  </th>
                </tr>
              </thead>
              <tbody ref={body}>
                {rows.map((q, i) => (
                  <RankRow key={q.code} quote={q} rank={i + 1} showReason={reasonCodes.has(q.code)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && (
        <div className={s.rankingFoot}>
          <AsOf at={data.updatedAt} />
        </div>
      )}
    </section>
  );
}

const RankRow = memo(function RankRow({
  quote: q,
  rank,
  showReason,
}: {
  quote: StockQuote;
  rank: number;
  showReason: boolean;
}) {
  const navigate = useNavigate();
  return (
    // 행 전체를 눌러도 이동하지만, 키보드·스크린리더는 종목명 링크를 쓴다
    <tr data-flip-key={q.code} className={s.row} onClick={() => navigate(`/trade/${q.code}`)}>
      <td className={`num ${s.rankCol}`}>{rank}</td>
      <td>
        <div className={s.nameCell}>
          <Link to={`/trade/${q.code}`} className={s.name} onClick={(e) => e.stopPropagation()}>
            {q.name}
          </Link>
          <StockStateBadge state={q.tradingState} exDividendToday={q.exDividendToday} />
          {showReason && <MoveReasonTag reason={q.moveReason} />}
        </div>
      </td>
      <td className={s.right}>
        <PriceText value={q.price} reference={q.prevClose} className={s.price} />
      </td>
      <td className={s.right}>
        <ChangeRate ratio={q.changeRate} className={s.rate} />
      </td>
      <td className={`num ${s.right} ${s.optional} ${s.muted}`}>{formatQuantity(q.volume, false)}</td>
      <td className={s.optional}>
        <Sparkline points={q.sparkline} reference={q.prevClose} />
      </td>
    </tr>
  );
});
