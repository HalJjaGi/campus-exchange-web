import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { keepNewer } from "@/shared/realtime/keepNewer";
import { usePollingFallback, useRealtimeClient, useTopic } from "@/shared/realtime/RealtimeProvider";
import type { Disclosure, MarketIndex, RankingSnapshot } from "@/shared/types/api";

export const marketKeys = {
  index: ["market", "index"] as const,
  ranking: ["market", "ranking"] as const,
  disclosures: ["disclosures", "latest"] as const,
};

/** 종합지수(SD-02). WS 이벤트로 바로 갱신, 끊기면 5초 폴링 */
export function useMarketIndex() {
  const qc = useQueryClient();
  const rt = useRealtimeClient();
  useTopic<MarketIndex>("index", (v) => {
    qc.setQueryData<MarketIndex>(marketKeys.index, v);
  });
  return useQuery({
    queryKey: marketKeys.index,
    queryFn: async ({ signal }) => {
      const v = await api<MarketIndex>("/api/market/index", { signal });
      rt.setBaseline("index", v.version);
      return keepNewer(qc, marketKeys.index, v);
    },
    refetchInterval: usePollingFallback(),
    meta: { realtime: true },
  });
}

/**
 * 전 종목 랭킹 스냅샷(1초 단위). 카테고리·정렬은 화면에서 한다 —
 * 같은 스냅샷을 나눠 보므로 탭을 바꿔도 다시 받지 않고, 순위가 탭마다 어긋나지 않는다.
 */
export function useRanking() {
  const qc = useQueryClient();
  const rt = useRealtimeClient();
  useTopic<RankingSnapshot>("ranking", (v) => {
    qc.setQueryData<RankingSnapshot>(marketKeys.ranking, v);
  });
  return useQuery({
    queryKey: marketKeys.ranking,
    queryFn: async ({ signal }) => {
      const v = await api<RankingSnapshot>("/api/market/ranking", { signal });
      rt.setBaseline("ranking", v.version);
      return keepNewer(qc, marketKeys.ranking, v);
    },
    refetchInterval: usePollingFallback(),
    meta: { realtime: true },
  });
}

const DISCLOSURE_LIMIT = 5;

/** 최근 공시. 새 공시는 WS로 받아 맨 위에 붙인다(공시 ID로 중복 제거 — UC-12 예외 흐름) */
export function useLatestDisclosures() {
  const qc = useQueryClient();
  useTopic<Disclosure>("disclosures", (d) => {
    qc.setQueryData<Disclosure[]>(marketKeys.disclosures, (cur) =>
      cur && !cur.some((x) => x.id === d.id) ? [d, ...cur].slice(0, DISCLOSURE_LIMIT) : cur,
    );
  });
  return useQuery({
    queryKey: marketKeys.disclosures,
    queryFn: ({ signal }) => api<Disclosure[]>(`/api/disclosures?limit=${DISCLOSURE_LIMIT}`, { signal }),
    refetchInterval: usePollingFallback(),
    meta: { realtime: true },
  });
}
