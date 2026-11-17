import { toDecimal } from "@/shared/lib/decimal";
import { formatIndex } from "@/shared/lib/format";
import { AsOf, ChangeRate } from "@/shared/ui/Numbers";
import { Sparkline } from "@/shared/ui/Sparkline";
import { ErrorBlock, Skeleton } from "@/shared/ui/States";
import { useMarketIndex } from "./queries";
import s from "./dashboard.module.css";

/** 종합지수 카드(SCR-02 §1): 값·당일 변동률·당일 추이 */
export function IndexCard() {
  const { data, isError, refetch, isFetching } = useMarketIndex();

  if (!data) {
    return isError ? (
      <ErrorBlock message="종합지수를 불러오지 못했어요." onRetry={() => void refetch()} retrying={isFetching} />
    ) : (
      <Skeleton height={104} />
    );
  }

  const dir = toDecimal(data.changeRate);

  return (
    <section className={s.index} aria-labelledby="index-title">
      <div className={s.indexMain}>
        <h2 id="index-title" className={s.indexLabel}>
          종합지수
        </h2>
        <p className={s.indexValueRow}>
          <span className={`num ${s.indexValue} ${dir.gt(0) ? s.up : dir.lt(0) ? s.down : ""}`}>
            {formatIndex(data.value)}
          </span>
          <ChangeRate ratio={data.changeRate} className={s.indexRate} />
        </p>
        <AsOf at={data.updatedAt} />
      </div>
      <div className={s.indexChart}>
        <Sparkline points={data.intraday} width={360} height={64} label="종합지수 당일 추이" />
      </div>
    </section>
  );
}
