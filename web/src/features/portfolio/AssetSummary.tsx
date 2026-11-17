import { useMemo } from "react";
import { cx } from "@/shared/lib/cx";
import { toDecimal } from "@/shared/lib/decimal";
import { formatChangeRate, formatPoints, formatSignedPoints } from "@/shared/lib/format";
import { serverNow } from "@/shared/lib/serverClock";
import { AsOf, Points } from "@/shared/ui/Numbers";
import { ErrorBlock, Skeleton } from "@/shared/ui/States";
import { useAssetHistory, useHoldings, usePortfolio, useWallet } from "./queries";
import { dayChange, kstDate, previousDate, quotedAt, type DayChange } from "./valuation";
import s from "./portfolio.module.css";

/** 총 평가 자산과 계좌별 잔액(SCR-06 §3). 확정 잔고를 확인하지 못하면 합계를 내지 않는다 */
export function AssetSummary() {
  const p = usePortfolio();
  const wallet = useWallet();
  const holdings = useHoldings();

  return (
    <section className={s.summary} aria-labelledby="total-title">
      <div className={s.totalHead}>
        <h2 id="total-title" className={s.label}>
          총 평가 자산
        </h2>
        {holdings.data && !holdings.isError && <AsOf at={quotedAt(holdings.data)} />}
      </div>

      {p.state === "ready" ? (
        <>
          <p className={cx("num", s.total)}>{formatPoints(p.totals.total)}</p>
          <DayChangeLine total={p.totals.total.toString()} />
        </>
      ) : p.state === "unconfirmed" ? (
        <ErrorBlock
          message={
            p.walletFailed
              ? "잔고를 확인하지 못해 총 평가 자산을 계산하지 않았어요."
              : "보유 종목을 확인하지 못해 총 평가 자산을 계산하지 않았어요."
          }
          onRetry={p.retry}
          retrying={p.retrying}
        />
      ) : (
        <>
          <Skeleton width={260} height="var(--leading-3xl)" />
          <Skeleton width={180} />
        </>
      )}

      <dl className={s.breakdown}>
        <div>
          <dt>예수금</dt>
          <dd>
            {wallet.data ? (
              <Points
                value={toDecimal(wallet.data.available).plus(wallet.data.reserved).toString()}
                stale={wallet.isError}
              />
            ) : (
              <Unknown failed={wallet.isError} />
            )}
          </dd>
          {wallet.data && toDecimal(wallet.data.reserved).gt(0) && (
            <dd className={s.subValue}>
              사용 가능 <span className="num">{formatPoints(wallet.data.available)}</span> · 주문 예약{" "}
              <span className="num">{formatPoints(wallet.data.reserved)}</span>
            </dd>
          )}
        </div>
        <div>
          <dt>중앙은행 예금</dt>
          <dd>
            {wallet.data ? (
              <Points value={wallet.data.bankBalance} stale={wallet.isError} />
            ) : (
              <Unknown failed={wallet.isError} />
            )}
          </dd>
        </div>
        <div>
          <dt>주식 평가</dt>
          <dd>
            {p.state === "ready" ? <Points value={p.totals.stock.toString()} /> : <Unknown failed={holdings.isError} />}
          </dd>
          {p.state === "ready" && p.rows.length > 0 && (
            <dd className={s.subValue}>
              평가손익 <Points value={p.totals.pnl.toString()} signed />
            </dd>
          )}
        </div>
      </dl>
      {wallet.data && wallet.isError && (
        <p className={s.staleNote}>잔고를 다시 확인하지 못했어요. 위 금액은 마지막으로 확인한 값이에요.</p>
      )}
    </section>
  );
}

function Unknown({ failed }: { failed: boolean }) {
  return failed ? <span className={s.unknown}>확인 필요</span> : <Skeleton width={96} />;
}

/** 전일 대비. 어제 기록이 없으면 비교한 날짜를 밝힌다 */
function DayChangeLine({ total }: { total: string }) {
  const history = useAssetHistory("7d");
  const today = kstDate(serverNow());
  const change: DayChange | null = useMemo(
    () => (history.data ? dayChange(toDecimal(total), history.data.items, today) : null),
    [history.data, total, today],
  );

  if (!history.data) {
    return history.isError ? (
      <p className={s.change}>전일 기록을 불러오지 못해 비교하지 못했어요.</p>
    ) : (
      <Skeleton width={180} />
    );
  }
  if (!change) return <p className={cx(s.change, s.muted)}>비교할 지난 기록이 아직 없어요.</p>;

  const label =
    change.base.date === previousDate(today) ? "전일 대비" : `${change.base.date.slice(5).replace("-", ".")} 대비`;
  const dir = change.amount.isZero() ? "flat" : change.amount.isPositive() ? "up" : "down";
  return (
    <p className={s.change}>
      <span className={s.muted}>{label}</span>{" "}
      <span className={cx("num", s[dir])}>
        {formatSignedPoints(change.amount)} ({formatChangeRate(change.ratio)})
      </span>
    </p>
  );
}
