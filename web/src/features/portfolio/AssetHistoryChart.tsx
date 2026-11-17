import {
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
  type WhitespaceData,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/shared/lib/cx";
import { formatPoints, formatPrice } from "@/shared/lib/format";
import { readTokens, useThemeVersion } from "@/shared/lib/theme";
import type { HistoryRange } from "@/shared/types/api";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { EmptyState, ErrorBlock, Skeleton } from "@/shared/ui/States";
import { useAssetHistory } from "./queries";
import { dailySeries, segmentsOf, type DailyPoint } from "./valuation";
import s from "./portfolio.module.css";

const RANGES: Array<{ value: HistoryRange; label: string }> = [
  { value: "7d", label: "1주" },
  { value: "30d", label: "1개월" },
  { value: "90d", label: "3개월" },
];

const toTime = (date: string) => (Date.parse(`${date}T00:00:00Z`) / 1000) as UTCTimestamp;
const shortDate = (date: string) => `${date.slice(5, 7)}.${date.slice(8, 10)}`;

/**
 * 일별 총자산 추이(SCR-06 §6). 기록된 스냅샷만 그린다.
 * 기록 없는 날은 선을 끊고, 현재 시세로 과거를 다시 계산하지 않는다.
 */
export function AssetHistoryChart() {
  const [range, setRange] = useState<HistoryRange>("30d");
  const { data, isError, isFetching, isPlaceholderData, refetch } = useAssetHistory(range);
  const points = useMemo(() => (data ? dailySeries(data) : []), [data]);
  const recorded = points.filter((p): p is DailyPoint & { value: number } => p.value !== null);
  const hasGap = recorded.length > 0 && recorded.length < points.length;

  return (
    <section className={s.history} aria-labelledby="history-title">
      <div className={s.sectionHead}>
        <h2 id="history-title" className={s.sectionTitle}>
          일별 자산 추이
        </h2>
        <SegmentedControl<HistoryRange>
          label="조회 기간"
          size="sm"
          value={range}
          onChange={setRange}
          options={RANGES}
        />
      </div>

      {data ? (
        recorded.length === 0 ? (
          <EmptyState message="이 기간에는 기록된 자산이 없어요. 자산은 하루에 한 번 기록돼요." />
        ) : (
          <div className={cx(s.historyBody, isPlaceholderData && s.pending)} aria-busy={isPlaceholderData}>
            <HistoryCanvas key={range} points={points} />
            {hasGap && <p className={s.note}>기록이 없는 날은 선을 끊어 표시했어요.</p>}
          </div>
        )
      ) : isError ? (
        <ErrorBlock message="자산 추이를 불러오지 못했어요." onRetry={() => void refetch()} retrying={isFetching} />
      ) : (
        <Skeleton height="var(--history-h)" />
      )}
    </section>
  );
}

const readColors = () =>
  readTokens({ bg: "--bg", text: "--text-tertiary", grid: "--border", border: "--border-strong", line: "--series-1" });

function HistoryCanvas({ points }: { points: DailyPoint[] }) {
  const el = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Array<ISeriesApi<"Line">>>([]);
  const themeVersion = useThemeVersion();
  const latest = useMemo(() => [...points].reverse().find((p) => p.value !== null) ?? null, [points]);
  const [hovered, setHovered] = useState<DailyPoint | null>(null);
  const shown = hovered ?? latest;

  useEffect(() => {
    if (!el.current) return;
    const c = readColors();
    const chart = createChart(el.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: c.bg },
        textColor: c.text,
        fontFamily: getComputedStyle(document.documentElement).getPropertyValue("--font-sans"),
        fontSize: 11,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border, scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: {
        borderColor: c.border,
        tickMarkFormatter: (t: UTCTimestamp) => shortDate(new Date(t * 1000).toISOString()),
      },
      crosshair: { mode: CrosshairMode.Magnet },
      localization: {
        priceFormatter: (p: number) => formatPrice(String(Math.round(p))),
        timeFormatter: (t: UTCTimestamp) => shortDate(new Date(t * 1000).toISOString()),
      },
      handleScroll: false,
      handleScale: false,
    });
    // 선 하나는 빈 날을 건너 이어 그린다. 기록이 이어진 구간마다 선을 따로 만들어 빈 날에서 끊는다.
    // 각 선은 모든 날짜를 갖되 제 구간 밖은 빈 값으로 둬서, 가로축이 빈 날까지 포함하게 한다
    seriesRef.current = segmentsOf(points).map((seg) => {
      const ser = chart.addLineSeries({
        color: c.line,
        lineWidth: 2,
        // 앞뒤 기록이 없는 하루치 점도 보이게 한다
        pointMarkersVisible: true,
        pointMarkersRadius: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      const inSeg = new Set(seg.map((p) => p.date));
      ser.setData(
        points.map((p): LineData | WhitespaceData =>
          p.value !== null && inSeg.has(p.date) ? { time: toTime(p.date), value: p.value } : { time: toTime(p.date) },
        ),
      );
      return ser;
    });
    chart.subscribeCrosshairMove((param) => {
      const i = param.logical;
      setHovered(i === undefined ? null : (points[Math.round(i)] ?? null));
    });
    chart.timeScale().fitContent();
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = [];
    };
  }, [points]);

  useEffect(() => {
    if (themeVersion === 0) return;
    const c = readColors();
    chartRef.current?.applyOptions({
      layout: { background: { type: ColorType.Solid, color: c.bg }, textColor: c.text },
      grid: { horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border },
    });
    for (const ser of seriesRef.current) ser.applyOptions({ color: c.line });
  }, [themeVersion]);

  const values = points.flatMap((p) => (p.value === null ? [] : [p.value]));
  const summary = `${points.length}일 중 ${values.length}일 기록. 최고 ${formatPoints(Math.max(...values))}, 최저 ${formatPoints(Math.min(...values))}.`;

  return (
    <>
      <p className={s.historyReadout}>
        {shown && (
          <>
            <span className={cx("num", s.muted)}>{shortDate(shown.date)}</span>{" "}
            {shown.value === null ? (
              <span className={s.muted}>기록 없음</span>
            ) : (
              <strong className="num">{formatPoints(shown.value)}</strong>
            )}
          </>
        )}
      </p>
      <div ref={el} className={s.historyCanvas} role="img" aria-label={`일별 총자산 추이. ${summary}`} />
    </>
  );
}
