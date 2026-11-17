import {
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/shared/lib/cx";
import { formatPrice, formatTime } from "@/shared/lib/format";
import { readTokens, useThemeVersion } from "@/shared/lib/theme";
import { DISCLOSURE_TYPE_LABEL } from "@/shared/market/labels";
import { useTopic } from "@/shared/realtime/RealtimeProvider";
import type { CandleInterval, CandleSeries, ChartEvent, TradeBatch } from "@/shared/types/api";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { EmptyState, ErrorBlock, Skeleton } from "@/shared/ui/States";
import { applyTrade, bucketStart, mergeLiveCandles, toChartTime, type Bar, type LiveCandle } from "./chartTime";
import { tradeKeys, useCandles } from "./queries";
import s from "./PriceChart.module.css";

type ChartKind = "candle" | "line";

/** 캔들/선 차트(SCR-03 §9). 공시·이벤트 시각에 마커, 마커와 아래 목록 둘 다로 요약을 연다 */
export function PriceChart({ code }: { code: string }) {
  const [interval, setChartInterval] = useState<CandleInterval>("1m");
  const [kind, setKind] = useState<ChartKind>("candle");
  const { data, isError, refetch, isFetching } = useCandles(code, interval);
  const [selected, setSelected] = useState<ChartEvent | null>(null);

  useEffect(() => setSelected(null), [code, interval]);

  return (
    <section className={s.chart} aria-label="가격 차트">
      <div className={s.toolbar}>
        <SegmentedControl<CandleInterval>
          label="차트 주기"
          size="sm"
          value={interval}
          onChange={setChartInterval}
          options={[
            { value: "1m", label: "1분" },
            { value: "5m", label: "5분" },
            { value: "1d", label: "일봉" },
          ]}
        />
        <SegmentedControl<ChartKind>
          label="차트 종류"
          size="sm"
          value={kind}
          onChange={setKind}
          options={[
            { value: "candle", label: "캔들" },
            { value: "line", label: "선" },
          ]}
        />
      </div>

      {data ? (
        data.candles.length === 0 ? (
          <EmptyState message="아직 차트 데이터가 없어요." />
        ) : (
          <ChartCanvas
            key={`${code}-${interval}-${kind}`}
            series={data}
            kind={kind}
            selectedId={selected?.id ?? null}
            onEventClick={setSelected}
          />
        )
      ) : isError ? (
        <ErrorBlock message="차트를 불러오지 못했어요." onRetry={() => void refetch()} retrying={isFetching} />
      ) : (
        <Skeleton height="var(--chart-h)" />
      )}

      {data && data.events.length > 0 && (
        <div className={s.events}>
          <ul className={s.eventList} aria-label="차트 구간의 공시·이벤트">
            {data.events.map((ev) => (
              <li key={ev.id}>
                <button
                  type="button"
                  className={cx(s.eventChip, selected?.id === ev.id && s.eventChipActive)}
                  aria-expanded={selected?.id === ev.id}
                  onClick={() => setSelected((cur) => (cur?.id === ev.id ? null : ev))}
                >
                  <span className="num">{formatTime(ev.at)}</span>
                  <span className={s.eventType}>{DISCLOSURE_TYPE_LABEL[ev.type]}</span>
                  {ev.title}
                </button>
              </li>
            ))}
          </ul>
          {selected && (
            <p className={s.summary}>
              <strong>{selected.title}</strong> {selected.summary}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

const readColors = () =>
  readTokens({
    bg: "--bg",
    text: "--text-tertiary",
    grid: "--border",
    border: "--border-strong",
    up: "--up",
    down: "--down",
    line: "--text",
    marker: "--attention",
  });

interface CanvasProps {
  series: CandleSeries;
  kind: ChartKind;
  selectedId: string | null;
  onEventClick: (ev: ChartEvent) => void;
}

function ChartCanvas({ series, kind, selectedId, onEventClick }: CanvasProps) {
  const el = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | null>(null);
  const lastBar = useRef<Bar | null>(null);
  const live = useRef(new Map<number, LiveCandle>());
  const qc = useQueryClient();
  const themeVersion = useThemeVersion();
  const onEventClickRef = useRef(onEventClick);
  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    onEventClickRef.current = onEventClick;
    selectedIdRef.current = selectedId;
  });

  const bars: Bar[] = useMemo(
    () =>
      series.candles.map((c) => ({
        time: toChartTime(Date.parse(c.t)),
        open: Number(c.o),
        high: Number(c.h),
        low: Number(c.l),
        close: Number(c.c),
      })),
    [series.candles],
  );

  /** 마커는 이벤트가 속한 봉에 붙인다. 한 봉에 여러 개면 모두 모은다. 차트 범위 밖 이벤트는 그리지 않는다 */
  const eventsByTime = useMemo(() => {
    const m = new Map<number, ChartEvent[]>();
    const first = bars[0]?.time ?? Infinity;
    const ordered = [...series.events].sort((a, b) => a.at.localeCompare(b.at));
    for (const ev of ordered) {
      const t = toChartTime(bucketStart(Date.parse(ev.at), series.interval));
      if (t >= first) m.set(t, [...(m.get(t) ?? []), ev]);
    }
    return m;
  }, [series.events, series.interval, bars]);

  // 생성·데이터
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
      rightPriceScale: { borderColor: c.border },
      // rightOffset: 마지막 봉 위 마커 글자가 오른쪽 끝에서 잘리지 않게 빈 칸을 둔다
      timeScale: {
        borderColor: c.border,
        timeVisible: series.interval !== "1d",
        secondsVisible: false,
        rightOffset: 4,
      },
      crosshair: { mode: CrosshairMode.Normal },
      localization: { priceFormatter: (p: number) => formatPrice(String(Math.round(p))) },
    });

    const ser =
      kind === "candle"
        ? chart.addCandlestickSeries({
            upColor: c.up,
            downColor: c.down,
            borderUpColor: c.up,
            borderDownColor: c.down,
            wickUpColor: c.up,
            wickDownColor: c.down,
            priceLineVisible: true,
          })
        : chart.addLineSeries({ color: c.line, lineWidth: 2, priceLineVisible: true });

    if (kind === "candle")
      (ser as ISeriesApi<"Candlestick">).setData(bars.map((b) => ({ ...b, time: b.time as UTCTimestamp })));
    else (ser as ISeriesApi<"Line">).setData(bars.map((b) => ({ time: b.time as UTCTimestamp, value: b.close })));

    const markers: SeriesMarker<Time>[] = [...eventsByTime.entries()]
      .sort(([a], [b]) => a - b)
      .map(([t, evs]) => ({
        time: t as UTCTimestamp,
        position: "aboveBar",
        color: c.marker,
        shape: "circle",
        text: `${DISCLOSURE_TYPE_LABEL[evs[0]!.type]}${evs.length > 1 ? ` +${evs.length - 1}` : ""}`,
      }));
    ser.setMarkers(markers);

    chart.subscribeClick((p) => {
      if (typeof p.time !== "number") return;
      // 한 봉에 여러 개면 누를 때마다 다음 것을 연다
      const evs = eventsByTime.get(p.time);
      if (!evs?.length) return;
      const i = evs.findIndex((e) => e.id === selectedIdRef.current);
      const next = evs[(i + 1) % evs.length];
      if (next) onEventClickRef.current(next);
    });

    chart.timeScale().fitContent();
    chartRef.current = chart;
    seriesRef.current = ser;
    lastBar.current = bars[bars.length - 1] ?? null;
    live.current = new Map(); // 새 데이터로 다시 그렸으니 이전 실시간 봉은 버린다

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [bars, eventsByTime, kind, series.interval]);

  // 내려갈 때 실시간으로 그린 봉을 캐시에 돌려 둔다. 다음에 그릴 때 최근 봉이 빠지지 않는다
  useEffect(() => {
    const ref = live;
    return () => {
      if (ref.current.size === 0) return;
      const updates = [...ref.current.values()];
      qc.setQueryData<CandleSeries>(tradeKeys.candles(series.code, series.interval), (s) =>
        s ? { ...s, candles: mergeLiveCandles(s.candles, updates) } : s,
      );
    };
  }, [qc, series.code, series.interval]);

  // 테마 변경: 차트를 다시 만들지 않고 색만 바꾼다
  useEffect(() => {
    if (themeVersion === 0) return;
    const chart = chartRef.current;
    const ser = seriesRef.current;
    if (!chart || !ser) return;
    const c = readColors();
    chart.applyOptions({
      layout: { background: { type: ColorType.Solid, color: c.bg }, textColor: c.text },
      grid: { horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border },
    });
    if (kind === "candle") {
      ser.applyOptions({
        upColor: c.up,
        downColor: c.down,
        borderUpColor: c.up,
        borderDownColor: c.down,
        wickUpColor: c.up,
        wickDownColor: c.down,
      });
    } else {
      ser.applyOptions({ color: c.line });
    }
  }, [themeVersion, kind]);

  // 실시간: 체결로 마지막 봉을 갱신한다
  useTopic<TradeBatch>(`trades.${series.code}`, (batch) => {
    const ser = seriesRef.current;
    if (!ser) return;
    const ordered = [...batch.items].sort((a, b) => a.at.localeCompare(b.at));
    for (const t of ordered) {
      const ms = bucketStart(Date.parse(t.at), series.interval);
      const next = applyTrade(lastBar.current, toChartTime(ms), Number(t.price));
      if (next === lastBar.current) continue;
      lastBar.current = next;
      const prev = live.current.get(ms);
      live.current.set(ms, { ms, bar: next, addedVolume: (prev?.addedVolume ?? 0) + t.quantity });
      if (kind === "candle") (ser as ISeriesApi<"Candlestick">).update({ ...next, time: next.time as UTCTimestamp });
      else (ser as ISeriesApi<"Line">).update({ time: next.time as UTCTimestamp, value: next.close });
    }
  });

  return (
    <div
      ref={el}
      className={s.canvas}
      role="img"
      aria-label="가격 차트. 아래 목록에서 공시·이벤트 요약을 볼 수 있어요."
    />
  );
}
