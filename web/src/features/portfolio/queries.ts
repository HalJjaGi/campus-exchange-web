import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { api } from "@/shared/api/client";
import { sharedKeys } from "@/shared/api/queryKeys";
import { serverNow } from "@/shared/lib/serverClock";
import { usePollingFallback, useRealtimeClient, useTopic } from "@/shared/realtime/RealtimeProvider";
import type {
  AssetHistory,
  HistoryRange,
  HoldingsSnapshot,
  LedgerPage,
  StockQuote,
  WalletSummary,
} from "@/shared/types/api";
import { ledgerQuery, periodFrom, type LedgerGroup, type LedgerPeriod } from "./ledgerRules";
import { applyQuote, evaluate, keepNewerQuotes, totalsOf, type HoldingRow, type Totals } from "./valuation";

export const portfolioKeys = {
  wallet: sharedKeys.wallet,
  holdings: ["me", "holdings"] as const,
  history: (range: HistoryRange) => ["me", "asset-history", range] as const,
  ledgerAll: ["me", "ledger"] as const,
  ledger: (group: LedgerGroup, period: LedgerPeriod) => ["me", "ledger", group, period] as const,
};

/**
 * 잔액 요약. 확정 잔고는 이벤트 payload로 직접 고치지 않고,
 * 체결·이자 지급 이벤트를 받으면 서버에서 다시 조회한다(SD-14).
 */
export function useWallet() {
  const queryClient = useQueryClient();
  const refetchInterval = usePollingFallback();

  useTopic("user.wallet", () => {
    void queryClient.invalidateQueries({ queryKey: portfolioKeys.wallet });
  });

  return useQuery({
    queryKey: portfolioKeys.wallet,
    queryFn: ({ signal }) => api<WalletSummary>("/api/me/wallet", { signal }),
    refetchInterval,
    meta: { realtime: true },
  });
}

/**
 * 보유 종목. 시세 이벤트로는 현재가만 바꾸고, 체결 등으로 잔고가 바뀌면 목록을 다시 받는다.
 * 보유 종목마다 quote.{code}를 구독한다 — 목록이 바뀌면 구독도 바뀐다.
 */
export function useHoldings() {
  const qc = useQueryClient();
  const rt = useRealtimeClient();
  const key = portfolioKeys.holdings;

  useTopic("user.wallet", () => {
    void qc.invalidateQueries({ queryKey: key });
  });

  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const snap = await api<HoldingsSnapshot>("/api/me/holdings", { signal });
      for (const h of snap.items) rt.setBaseline(`quote.${h.code}`, h.quoteVersion);
      return keepNewerQuotes(qc.getQueryData<HoldingsSnapshot>(key), snap);
    },
    refetchInterval: usePollingFallback(),
    meta: { realtime: true },
  });

  const codes = query.data?.items.map((h) => h.code).join(",") ?? "";
  useEffect(() => {
    if (!codes) return;
    const offs = codes.split(",").map((code) =>
      rt.subscribe(`quote.${code}`, (q) => {
        qc.setQueryData<HoldingsSnapshot>(key, (snap) => (snap ? applyQuote(snap, q as StockQuote) : snap));
      }),
    );
    return () => offs.forEach((off) => off());
  }, [codes, rt, qc, key]);

  return query;
}

export type PortfolioState =
  | { state: "loading" }
  | { state: "ready"; rows: HoldingRow[]; totals: Totals }
  /** 확정 잔고나 보유 수량 중 하나라도 최신으로 확인하지 못했다. 합계를 내지 않는다(UC-14 예외) */
  | { state: "unconfirmed"; walletFailed: boolean; holdingsFailed: boolean; retry: () => void; retrying: boolean };

/** 총 평가 자산 계산에 필요한 두 영역을 합친다 */
export function usePortfolio(): PortfolioState {
  const wallet = useWallet();
  const holdings = useHoldings();
  const rows = useMemo(() => holdings.data?.items.map(evaluate) ?? [], [holdings.data]);

  if (wallet.isError || holdings.isError) {
    return {
      state: "unconfirmed",
      walletFailed: wallet.isError,
      holdingsFailed: holdings.isError,
      retry: () => {
        if (wallet.isError) void wallet.refetch();
        if (holdings.isError) void holdings.refetch();
      },
      retrying: wallet.isFetching || holdings.isFetching,
    };
  }
  if (!wallet.data || !holdings.data) return { state: "loading" };
  return { state: "ready", rows, totals: totalsOf(wallet.data, rows) };
}

/** 일별 총자산 스냅샷. 하루 한 번 쌓이는 값이라 실시간 구독은 없다 */
export function useAssetHistory(range: HistoryRange) {
  return useQuery({
    queryKey: portfolioKeys.history(range),
    queryFn: ({ signal }) => api<AssetHistory>(`/api/me/asset-history?range=${range}`, { signal }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

/** 예수금·거래 내역(확정 Ledger). 잔고가 바뀌었다는 이벤트를 받으면 다시 받는다 */
export function useLedger(group: LedgerGroup, period: LedgerPeriod) {
  const qc = useQueryClient();
  useTopic("user.wallet", () => {
    void qc.invalidateQueries({ queryKey: portfolioKeys.ledgerAll });
  });

  return useInfiniteQuery({
    queryKey: portfolioKeys.ledger(group, period),
    queryFn: ({ pageParam, signal }) =>
      api<LedgerPage>(ledgerQuery(group, periodFrom(period, serverNow()), pageParam), { signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
    meta: { realtime: true },
  });
}
