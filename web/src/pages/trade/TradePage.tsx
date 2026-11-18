import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { OpenOrders } from "@/features/trade/OpenOrders";
import { OrderPanel } from "@/features/trade/OrderPanel";
import { Orderbook } from "@/features/trade/Orderbook";
import { PriceChart } from "@/features/trade/PriceChart";
import { StockHeader } from "@/features/trade/StockHeader";
import { TradeTape } from "@/features/trade/TradeTape";
import { useOrderDraft } from "@/features/trade/orderDraft";
import { useOpenOrders, useQuote } from "@/features/trade/queries";
import { ApiError } from "@/shared/api/errors";
import { EmptyState, ErrorBlock, Skeleton } from "@/shared/ui/States";
import { Tabs } from "@/shared/ui/Tabs";
import s from "./TradePage.module.css";

/** 종목 없이 /trade로 들어오면 보여줄 기본 종목. 대시보드가 생기면 마지막으로 본 종목으로 바꾼다 */
const DEFAULT_CODE = "CSE";

export function TradePage() {
  const { code } = useParams();
  if (!code) return <Navigate to={`/trade/${DEFAULT_CODE}`} replace />;
  return <TradeScreen key={code} code={code} />;
}

/** S-03 거래·호가 화면. 종목이 바뀌면 key로 통째로 다시 마운트해 이전 종목 상태가 섞이지 않게 한다 */
function TradeScreen({ code }: { code: string }) {
  const quote = useQuote(code);
  const reset = useOrderDraft((st) => st.reset);

  // 종목에 처음 들어오면 주문 가격을 현재가로 채운다(한 번만)
  const firstPrice = quote.data?.price;
  useEffect(() => {
    if (firstPrice && useOrderDraft.getState().code !== code) reset(code, firstPrice);
  }, [code, firstPrice, reset]);

  if (!quote.data) {
    if (quote.error instanceof ApiError && quote.error.status === 404) {
      return (
        <EmptyState message="없는 종목이에요." action={<Link to={`/trade/${DEFAULT_CODE}`}>기본 종목으로 이동</Link>} />
      );
    }
    return quote.isError ? (
      <ErrorBlock message="종목 정보를 불러오지 못했어요." onRetry={() => void quote.refetch()} />
    ) : (
      <div className={s.layout}>
        <Skeleton height={96} className={s.header} />
      </div>
    );
  }

  const q = quote.data;

  return (
    <div className={s.layout}>
      <div className={s.header}>
        <StockHeader quote={q} />
      </div>
      <div className={s.chart}>
        <PriceChart code={code} />
      </div>
      <div className={s.book}>
        <Orderbook code={code} prevClose={q.prevClose} lastPrice={q.price} />
      </div>
      <div className={s.order}>
        <OrderPanel code={code} tradingState={q.tradingState} currentPrice={q.price} />
      </div>
      <div className={s.bottom}>
        <BottomTabs code={code} />
      </div>
    </div>
  );
}

type BottomTab = "trades" | "open" | "feed";

function BottomTabs({ code }: { code: string }) {
  const [tab, setTab] = useState<BottomTab>("trades");
  const open = useOpenOrders(code);
  const openCount = open.data?.length ?? 0;

  return (
    <section>
      <Tabs<BottomTab>
        label="거래 정보"
        idPrefix="trade-bottom"
        value={tab}
        onChange={setTab}
        items={[
          { value: "trades", label: "체결" },
          { value: "open", label: openCount > 0 ? `미체결 ${openCount}` : "미체결" },
          { value: "feed", label: "종목 피드" },
        ]}
      />
      <div
        role="tabpanel"
        id={`trade-bottom-panel-${tab}`}
        aria-labelledby={`trade-bottom-tab-${tab}`}
        className={s.panel}
      >
        {tab === "trades" && <TradeTape key={code} code={code} />}
        {tab === "open" && <OpenOrders code={code} />}
        {tab === "feed" && (
          <EmptyState
            message="이 종목 이야기는 커뮤니티에서 볼 수 있어요."
            action={<Link to={`/community/${code}`}>커뮤니티로 이동</Link>}
          />
        )}
      </div>
    </section>
  );
}
