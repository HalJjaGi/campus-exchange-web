import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * 스냅샷 REST 응답이 WS 이벤트보다 늦게 도착할 수 있다.
 * 캐시에 더 새 버전이 있으면 늦게 온 응답으로 덮어쓰지 않는다.
 */
export function keepNewer<T extends { version: number }>(qc: QueryClient, key: QueryKey, fetched: T): T {
  const cached = qc.getQueryData<T>(key);
  return cached && cached.version > fetched.version ? cached : fetched;
}
