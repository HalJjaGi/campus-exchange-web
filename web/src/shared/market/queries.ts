/**
 * 여러 화면이 함께 쓰는 시장 기준 데이터(정책·종목 목록).
 * feature끼리 import하지 않도록 shared에 둔다.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import type { CentralBankPolicy, RankingSnapshot } from "@/shared/types/api";

/**
 * 중앙은행 정책(금리·LP·수수료율·호가 단위). 화면 어디에서도 이 값을 하드코딩하지 않는다.
 * 정책은 자주 바뀌지 않으므로 1분 동안 캐시한다. 변경은 공시 이벤트로 알려진다.
 */
export function usePolicy() {
  return useQuery({
    queryKey: ["policy"],
    queryFn: ({ signal }) => api<CentralBankPolicy>("/api/policy/current", { signal }),
    staleTime: 60_000,
  });
}

/** 종목 선택 목록(이름순). 이름·코드만 쓰므로 자주 다시 받지 않는다 */
export function useStockList() {
  return useQuery({
    queryKey: ["stocks", "list"],
    queryFn: ({ signal }) => api<RankingSnapshot>("/api/market/ranking", { signal }),
    select: (r) =>
      r.items.map((q) => ({ code: q.code, name: q.name })).sort((a, b) => a.name.localeCompare(b.name, "ko")),
    staleTime: 5 * 60_000,
  });
}
