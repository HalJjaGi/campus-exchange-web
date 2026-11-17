/**
 * 거래 화면 데이터. 시세성 데이터(현재가·호가·체결)는 WS 이벤트로 캐시를 직접 갱신하고,
 * 확정 데이터(계좌·미체결)는 이벤트를 받으면 서버에서 다시 조회한다(SD-03, SD-14).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { keepNewer } from "@/shared/realtime/keepNewer";
import { useRealtimeClient, usePollingFallback, useTopic } from "@/shared/realtime/RealtimeProvider";
import type {
  CandleInterval,
  CandleSeries,
  OpenOrder,
  OrderbookSnapshot,
  StockQuote,
  TradeBatch,
  TradeTick,
  TradingAccount,
} from "@/shared/types/api";

export const tradeKeys = {
  quote: (code: string) => ["stock", code, "quote"] as const,
  orderbook: (code: string) => ["stock", code, "orderbook"] as const,
  trades: (code: string) => ["stock", code, "trades"] as const,
  candles: (code: string, interval: CandleInterval) => ["stock", code, "candles", interval] as const,
  account: (code: string) => ["me", "trading-account", code] as const,
  openOrders: (code: string) => ["me", "orders", "open", code] as const,
};

const TAPE_LEN = 50;

export function useQuote(code: string) {
  const qc = useQueryClient();
  const rt = useRealtimeClient();
  const key = tradeKeys.quote(code);

  useTopic<StockQuote>(`quote.${code}`, (q) => {
    qc.setQueryData<StockQuote>(key, q);
  });

  return useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const q = await api<StockQuote>(`/api/stocks/${code}`, { signal });
      rt.setBaseline(`quote.${code}`, q.version);
      return keepNewer(qc, key, q);
    },
    refetchInterval: usePollingFallback(),
    meta: { realtime: true },
  });
}

export function orderbookQuery(code: string) {
  return {
    queryKey: tradeKeys.orderbook(code),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      api<OrderbookSnapshot>(`/api/stocks/${code}/orderbook`, { signal }),
  };
}

/** 호가 구독. 화면에서 한 번만 호출하고, 다른 곳은 useQuery(orderbookQuery)로 읽기만 한다 */
export function useOrderbookFeed(code: string) {
  const qc = useQueryClient();
  const rt = useRealtimeClient();
  const key = tradeKeys.orderbook(code);

  useTopic<OrderbookSnapshot>(`orderbook.${code}`, (snap) => {
    qc.setQueryData<OrderbookSnapshot>(key, snap);
  });

  return useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const snap = await orderbookQuery(code).queryFn({ signal });
      rt.setBaseline(`orderbook.${code}`, snap.version);
      return keepNewer(qc, key, snap);
    },
    refetchInterval: usePollingFallback(),
    meta: { realtime: true },
  });
}

/** 새 체결을 위에 붙이고 ID로 중복을 거른다 */
export function mergeTrades(current: TradeTick[], incoming: TradeTick[]): TradeTick[] {
  const seen = new Set(current.map((t) => t.id));
  const fresh = incoming.filter((t) => !seen.has(t.id));
  if (fresh.length === 0) return current;
  const sorted = [...fresh].sort((a, b) => b.at.localeCompare(a.at));
  return [...sorted, ...current].slice(0, TAPE_LEN);
}

export function useTradeTape(code: string) {
  const qc = useQueryClient();
  const key = tradeKeys.trades(code);

  useTopic<TradeBatch>(`trades.${code}`, (batch) => {
    qc.setQueryData<TradeBatch>(key, (cur) =>
      cur ? { ...cur, items: mergeTrades(cur.items, batch.items), version: batch.version } : cur,
    );
  });

  return useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const fetched = await api<TradeBatch>(`/api/stocks/${code}/trades`, { signal });
      const cached = qc.getQueryData<TradeBatch>(key);
      // 폴링·재연결 보정: 서버 목록과 이미 받은 이벤트를 합친다
      return cached ? { ...fetched, items: mergeTrades(fetched.items, cached.items) } : fetched;
    },
    refetchInterval: usePollingFallback(),
    meta: { realtime: true },
  });
}

export function useCandles(code: string, interval: CandleInterval) {
  return useQuery({
    queryKey: tradeKeys.candles(code, interval),
    queryFn: ({ signal }) => api<CandleSeries>(`/api/stocks/${code}/candles?interval=${interval}`, { signal }),
    // 실시간 봉 갱신은 차트가 체결 이벤트로 직접 처리한다. 캐시는 초기 이력용
    staleTime: 60_000,
    meta: { realtime: true },
  });
}

/** 확정 데이터. 내 주문·잔고 이벤트가 오면 다시 조회한다 */
export function useTradingAccount(code: string) {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: tradeKeys.account(code) });
  useTopic("user.wallet", invalidate);
  useTopic("user.orders", invalidate);

  return useQuery({
    queryKey: tradeKeys.account(code),
    queryFn: ({ signal }) => api<TradingAccount>(`/api/me/trading-account?code=${code}`, { signal }),
    refetchInterval: usePollingFallback(),
    meta: { realtime: true },
  });
}

export function useOpenOrders(code: string) {
  const qc = useQueryClient();
  useTopic("user.orders", () => void qc.invalidateQueries({ queryKey: tradeKeys.openOrders(code) }));

  return useQuery({
    queryKey: tradeKeys.openOrders(code),
    queryFn: ({ signal }) => api<OpenOrder[]>(`/api/orders?status=open&code=${code}`, { signal }),
    refetchInterval: usePollingFallback(),
    meta: { realtime: true },
  });
}
