import { cx } from "@/shared/lib/cx";
import { formatPercent, formatPoints } from "@/shared/lib/format";
import { ErrorBlock, Skeleton } from "@/shared/ui/States";
import { usePortfolio } from "./queries";
import { composition, type AssetKind, type Segment } from "./valuation";
import s from "./portfolio.module.css";

const R = 42;
const CIRC = 2 * Math.PI * R;
/** 조각 사이 틈. 색이 비슷한 조각도 경계가 보이게 한다 */
const GAP = 1.5;

const SERIES: Record<AssetKind, string> = { cash: s.series1 ?? "", bank: s.series2 ?? "", stock: s.series3 ?? "" };

/** 자산 구성 도넛(SCR-06 §6). 수치는 옆 목록이 전달하고, 도넛은 비율을 눈으로 보여 주기만 한다 */
export function AssetDonut() {
  const p = usePortfolio();

  return (
    <section className={s.donutCard} aria-labelledby="composition-title">
      <h2 id="composition-title" className={s.label}>
        자산 구성
      </h2>
      {p.state === "ready" ? (
        p.totals.total.isZero() ? (
          <p className={s.muted}>아직 자산이 없어요.</p>
        ) : (
          <DonutBody segments={composition(p.totals)} />
        )
      ) : p.state === "unconfirmed" ? (
        <ErrorBlock message="자산 구성을 계산하지 못했어요." onRetry={p.retry} retrying={p.retrying} />
      ) : (
        <div className={s.donutBody}>
          <Skeleton width={120} height={120} />
          <Skeleton width={160} height={72} />
        </div>
      )}
    </section>
  );
}

function DonutBody({ segments }: { segments: Segment[] }) {
  return (
    <div className={s.donutBody}>
      <Donut segments={segments} />
      <Legend segments={segments} />
    </div>
  );
}

function Donut({ segments }: { segments: Segment[] }) {
  const visible = segments.filter((seg) => seg.ratio.gt(0));
  let offset = 0;
  return (
    <svg viewBox="0 0 100 100" className={s.donut} aria-hidden>
      <circle cx="50" cy="50" r={R} className={s.donutTrack} />
      {visible.map((seg) => {
        const len = seg.ratio.toNumber() * CIRC;
        const dash = visible.length > 1 ? Math.max(len - GAP, 0.5) : len;
        const el = (
          <circle
            key={seg.kind}
            cx="50"
            cy="50"
            r={R}
            className={cx(s.donutSegment, SERIES[seg.kind])}
            strokeDasharray={`${dash} ${CIRC - dash}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 50 50)"
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

function Legend({ segments }: { segments: Segment[] }) {
  return (
    <dl className={s.legend}>
      {segments.map((seg) => (
        <div key={seg.kind} className={s.legendRow}>
          <dt>
            <span className={cx(s.swatch, SERIES[seg.kind])} aria-hidden />
            {seg.label}
          </dt>
          <dd className="num">{formatPercent(seg.ratio, 1)}</dd>
          <dd className={cx("num", s.muted)}>{formatPoints(seg.value.toDecimalPlaces(0))}</dd>
        </div>
      ))}
    </dl>
  );
}
