import { useQuery } from "@tanstack/react-query";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { api } from "@/shared/api/client";
import { getNetworkControl } from "@/shared/dev/networkControl";
import { formatQuantity } from "@/shared/lib/format";
import { usePollingFallback, useRealtimeStatus, useTopic } from "@/shared/realtime/RealtimeProvider";
import type { MarketIndex, RankingSnapshot, StockQuote } from "@/shared/types/api";
import { Badge, Chip } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Countdown } from "@/shared/ui/Countdown";
import { LpMark, MarginWarningBadge, MoveReasonTag, StockStateBadge, VerifiedBadge } from "@/shared/ui/MarketBadges";
import { Modal } from "@/shared/ui/Modal";
import { AsOf, ChangeRate, Points, PriceText } from "@/shared/ui/Numbers";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Sparkline } from "@/shared/ui/Sparkline";
import { EmptyState, ErrorBlock, Skeleton, SkeletonRows } from "@/shared/ui/States";
import { Tabs } from "@/shared/ui/Tabs";
import { TextField } from "@/shared/ui/TextField";
import { toast } from "@/shared/ui/Toast";
import s from "./UiCatalogPage.module.css";

/**
 * /dev/ui — 공용 컴포넌트와 실시간 처리 확인용. 개발 모드에서만 라우팅된다.
 * 디자인 리뷰는 이 페이지를 라이트/다크 둘 다 놓고 한다.
 */
export function UiCatalogPage() {
  return (
    <div className={s.page}>
      <header className={s.head}>
        <h1 className={s.title}>컴포넌트 확인</h1>
        <ThemeSwitch />
      </header>

      <RealtimeSection />

      <Section title="버튼">
        <div className={s.row}>
          <Button variant="action">주 행동</Button>
          <Button variant="buy">매수</Button>
          <Button variant="sell">매도</Button>
          <Button variant="secondary">보조</Button>
          <Button variant="ghost">고스트</Button>
          <Button variant="action" busy>
            제출 중
          </Button>
          <Button disabled>비활성</Button>
        </div>
        <div className={s.row}>
          <Button size="sm">sm</Button>
          <Button size="md">md</Button>
          <Button size="lg" variant="buy">
            lg 매수 주문
          </Button>
        </div>
      </Section>

      <Section title="선택 컨트롤">
        <ControlsDemo />
      </Section>

      <Section title="입력">
        <div className={s.grid2}>
          <TextField label="학교 이메일" placeholder="name@school.ac.kr" hint=".ac.kr 메일만 가입할 수 있어요" />
          <TextField label="닉네임" defaultValue="새내기" success="사용할 수 있는 닉네임이에요" />
          <TextField label="인증번호" defaultValue="12345" error="인증번호가 맞지 않아요. 2회 남았어요." />
          <TextField
            label="인증번호 (카운트다운)"
            inputMode="numeric"
            trailing={<Countdown until={new Date(Date.now() + 45_000).toISOString()} />}
          />
        </div>
      </Section>

      <Section title="배지 (DESIGN.md §5.2)">
        <div className={s.row}>
          <StockStateBadge state="VI_ACTIVE" />
          <StockStateBadge state="SINGLE_PRICE" />
          <StockStateBadge state="NORMAL" exDividendToday />
          <MoveReasonTag reason="DISCLOSURE" />
          <MoveReasonTag reason="PARTICIPANT_SURGE" />
          <VerifiedBadge kind="REAL_HOLD" />
          <VerifiedBadge kind="SHORT" />
          <LpMark />
          <MarginWarningBadge ratio="1.12" />
          <Badge tone="outline">테두리</Badge>
        </div>
        <div className={s.row}>
          <Chip>정보 칩</Chip>
        </div>
      </Section>

      <Section title="숫자">
        <dl className={s.numbers}>
          <dt>상승 / 하락 / 보합</dt>
          <dd className={s.row}>
            <ChangeRate ratio="0.0321" />
            <ChangeRate ratio="-0.0105" />
            <ChangeRate ratio="0" />
          </dd>
          <dt>포인트</dt>
          <dd className={s.row}>
            <Points value="1000000" />
            <Points value="12400" signed />
            <Points value="-3000" signed />
            <Points value="1000000" stale />
          </dd>
          <dt>기준 시각</dt>
          <dd>
            <AsOf at={new Date().toISOString()} />
          </dd>
        </dl>
      </Section>

      <Section title="상태">
        <div className={s.grid2}>
          <SkeletonRows rows={3} />
          <div className={s.stack}>
            <Skeleton width="60%" height={24} />
            <Skeleton width="40%" />
          </div>
          <EmptyState message="아직 보유한 종목이 없어요." action={<Button size="sm">종목 둘러보기</Button>} />
          <ErrorBlock message="보유 종목을 불러오지 못했어요." onRetry={() => toast.show("다시 조회합니다")} />
        </div>
      </Section>

      <Section title="오버레이">
        <OverlayDemo />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={s.section}>
      <h2 className={s.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

type Theme = "system" | "light" | "dark";

function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme | undefined) ?? "system",
  );
  const apply = (t: Theme) => {
    setTheme(t);
    if (t === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  };
  return (
    <SegmentedControl
      label="테마"
      size="sm"
      value={theme}
      onChange={apply}
      options={[
        { value: "system", label: "시스템" },
        { value: "light", label: "라이트" },
        { value: "dark", label: "다크" },
      ]}
    />
  );
}

function ControlsDemo() {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [kind, setKind] = useState<"LIMIT" | "MARKET">("LIMIT");
  const [tab, setTab] = useState<"ALL" | "DEPT" | "SCHEDULE" | "MEME">("ALL");
  const [ratio, setRatio] = useState<number | null>(null);

  return (
    <div className={s.stack}>
      <div className={s.row}>
        <SegmentedControl
          label="주문 유형"
          value={side}
          onChange={setSide}
          options={[
            { value: "BUY", label: "매수", tone: "buy" },
            { value: "SELL", label: "매도", tone: "sell" },
          ]}
        />
        <SegmentedControl
          label="거래 방식"
          value={kind}
          onChange={setKind}
          options={[
            { value: "LIMIT", label: "지정가" },
            { value: "MARKET", label: "시장가" },
          ]}
        />
        <div className={s.row}>
          {[10, 25, 50, 100].map((r) => (
            <Chip key={r} selected={ratio === r} onClick={() => setRatio(r)}>
              {r === 100 ? "MAX" : `${r}%`}
            </Chip>
          ))}
        </div>
      </div>
      <Tabs
        label="카테고리"
        idPrefix="demo"
        value={tab}
        onChange={setTab}
        items={[
          { value: "ALL", label: "전체" },
          { value: "DEPT", label: "학과주" },
          { value: "SCHEDULE", label: "학사일정 테마" },
          { value: "MEME", label: "교내 밈 코인" },
        ]}
      />
    </div>
  );
}

function OverlayDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div className={s.row}>
      <Button onClick={() => setOpen(true)}>모달 열기</Button>
      <Button onClick={() => toast.success("주문이 접수됐어요")}>성공 토스트</Button>
      <Button onClick={() => toast.error("예수금이 부족해요 (부족 12,400P)")}>오류 토스트</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="주문 확인"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>취소</Button>
            <Button variant="buy" onClick={() => setOpen(false)}>
              매수 주문
            </Button>
          </>
        }
      >
        컴퓨터공학과 10주를 12,350에 매수해요.
      </Modal>
    </div>
  );
}

/* ───────── 실시간 확인 ───────── */

function useNetworkOnline(): boolean | null {
  const ctrl = getNetworkControl();
  return useSyncExternalStore(
    (cb) => ctrl?.subscribe(cb) ?? (() => {}),
    () => ctrl?.isOnline() ?? null,
  );
}

function RealtimeSection() {
  const status = useRealtimeStatus();
  const online = useNetworkOnline();
  const ctrl = getNetworkControl();
  const refetchInterval = usePollingFallback();

  const index = useQuery({
    queryKey: ["dev", "index"],
    queryFn: ({ signal }) => api<MarketIndex>("/api/market/index", { signal }),
    refetchInterval,
    meta: { realtime: true },
  });
  const ranking = useQuery({
    queryKey: ["dev", "ranking"],
    queryFn: ({ signal }) => api<RankingSnapshot>("/api/market/ranking", { signal }),
    refetchInterval,
    meta: { realtime: true },
  });

  const [liveIndex, setLiveIndex] = useState<MarketIndex | null>(null);
  const [liveRanking, setLiveRanking] = useState<RankingSnapshot | null>(null);
  useTopic<MarketIndex>("index", setLiveIndex);
  useTopic<RankingSnapshot>("ranking", setLiveRanking);

  // WS가 살아 있으면 이벤트 값, 끊겼으면 폴링 값 중 더 새 버전을 쓴다
  const idx = newest(index.data, liveIndex);
  const rank = newest(ranking.data, liveRanking);

  return (
    <Section title="실시간 처리 (SD-02)">
      <div className={s.row}>
        <span className={s.meta}>
          연결 상태: <strong>{STATUS_LABEL[status]}</strong>
          {refetchInterval ? " · REST 5초 폴링 중" : ""}
        </span>
        {ctrl && (
          <Button size="sm" onClick={() => (online ? ctrl.goOffline() : ctrl.goOnline())}>
            {online ? "WS 끊기" : "WS 복구"}
          </Button>
        )}
      </div>

      {idx ? (
        <div className={s.indexCard}>
          <span className={s.meta}>종합지수</span>
          <div className={s.row}>
            <PriceText value={idx.value} reference="1000" className={s.indexValue} />
            <ChangeRate ratio={idx.changeRate} />
            <Sparkline points={idx.intraday} reference="1000" width={160} height={32} label="종합지수 당일 추이" />
          </div>
          <AsOf at={idx.updatedAt} />
        </div>
      ) : index.isError ? (
        <ErrorBlock message="지수를 불러오지 못했어요." onRetry={() => void index.refetch()} />
      ) : (
        <Skeleton height={88} />
      )}

      {rank ? (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>종목</th>
                <th className={s.right}>현재가</th>
                <th className={s.right}>등락률</th>
                <th className={s.right}>거래량</th>
                <th>추이</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {rank.items.slice(0, 6).map((q) => (
                <RankRow key={q.code} q={q} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <SkeletonRows rows={6} />
      )}
    </Section>
  );
}

function RankRow({ q }: { q: StockQuote }) {
  return (
    <tr>
      <td>{q.name}</td>
      <td className={s.right}>
        <PriceText value={q.price} reference={q.prevClose} />
      </td>
      <td className={s.right}>
        <ChangeRate ratio={q.changeRate} />
      </td>
      <td className={`${s.right} num`}>{formatQuantity(q.volume, false)}</td>
      <td>
        <Sparkline points={q.sparkline} reference={q.prevClose} />
      </td>
      <td className={s.row}>
        <StockStateBadge state={q.tradingState} exDividendToday={q.exDividendToday} />
        <MoveReasonTag reason={q.moveReason} />
      </td>
    </tr>
  );
}

const STATUS_LABEL = { idle: "대기", connecting: "연결 중", open: "실시간", polling: "끊김 (재연결 시도 중)" } as const;

function newest<T extends { version: number }>(a: T | undefined, b: T | null): T | undefined {
  if (!b) return a;
  if (!a) return b;
  return b.version >= a.version ? b : a;
}
