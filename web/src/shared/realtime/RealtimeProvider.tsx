import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { RealtimeClient, RealtimeStatus } from "./RealtimeClient";

const Ctx = createContext<RealtimeClient | null>(null);

/** WS 폴백 시 REST 폴링 간격 (SDS SD-02) */
export const POLLING_INTERVAL_MS = 5000;

/**
 * 실시간 클라이언트를 앱에 연결한다.
 * 재연결되면 meta.realtime이 true인 Query를 전부 다시 조회해 끊긴 동안의 누락을 메운다.
 */
export function RealtimeProvider({ client, children }: { client: RealtimeClient; children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    client.connect();
    const off = client.onRecover(() => {
      void queryClient.invalidateQueries({ predicate: (q) => q.meta?.realtime === true });
    });
    return () => {
      off();
      client.disconnect();
    };
  }, [client, queryClient]);

  return <Ctx.Provider value={client}>{children}</Ctx.Provider>;
}

export function useRealtimeClient(): RealtimeClient {
  const c = useContext(Ctx);
  if (!c) throw new Error("RealtimeProvider 밖에서 useRealtimeClient를 호출했습니다");
  return c;
}

export function useRealtimeStatus(): RealtimeStatus {
  const c = useRealtimeClient();
  return useSyncExternalStore((cb) => c.onStatusChange(cb), c.getStatus, c.getStatus);
}

/** useQuery의 refetchInterval에 그대로 넣는다. WS가 끊긴 동안만 5초 폴링 */
export function usePollingFallback(): number | false {
  return useRealtimeStatus() === "polling" ? POLLING_INTERVAL_MS : false;
}

/** 토픽 구독. topic이 null이면 구독하지 않는다(종목 미선택 등) */
export function useTopic<T>(topic: string | null, handler: (payload: T) => void) {
  const c = useRealtimeClient();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });

  useEffect(() => {
    if (!topic) return;
    return c.subscribe(topic, (p) => ref.current(p as T));
  }, [c, topic]);
}
