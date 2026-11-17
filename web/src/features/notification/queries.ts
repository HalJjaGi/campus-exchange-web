import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { userMessageOf } from "@/shared/api/errors";
import { usePollingFallback, useTopic } from "@/shared/realtime/RealtimeProvider";
import type { AppNotification, NotificationLink, NotificationPage } from "@/shared/types/api";
import { toast } from "@/shared/ui/Toast";

type Data = InfiniteData<NotificationPage, unknown>;

export const notificationKey = ["notifications"] as const;

/** 새 알림을 첫 페이지 맨 앞에 넣고 미확인 수를 올린다. 같은 ID면 그대로 둔다 */
export function prependNotification(data: Data, n: AppNotification): Data {
  if (data.pages.some((p) => p.items.some((x) => x.id === n.id))) return data;
  const [first, ...rest] = data.pages;
  if (!first) return data;
  return {
    ...data,
    pages: [{ ...first, items: [n, ...first.items], unreadCount: first.unreadCount + (n.readAt ? 0 : 1) }, ...rest],
  };
}

/** 읽음 표시. 미확인 수는 첫 페이지 값이 기준이다 */
export function markRead(data: Data, ids: Set<string> | "all", at: string): Data {
  let changed = 0;
  const pages = data.pages.map((p) => ({
    ...p,
    items: p.items.map((n) => {
      if (n.readAt || (ids !== "all" && !ids.has(n.id))) return n;
      changed += 1;
      return { ...n, readAt: at };
    }),
  }));
  const [first, ...rest] = pages;
  if (!first) return data;
  const unreadCount = ids === "all" ? 0 : Math.max(0, first.unreadCount - changed);
  return { ...data, pages: [{ ...first, unreadCount }, ...rest] };
}

export const unreadCountOf = (data: Data | undefined) => data?.pages[0]?.unreadCount ?? 0;

/**
 * 알림 목록(UC-12 §5, SD-10). GNB 벨과 알림 화면이 같은 캐시를 쓴다.
 * 온라인이면 WS로 바로 받고, 끊긴 동안에는 5초 폴링으로 첫 페이지를 다시 받는다.
 */
export function useNotifications() {
  const qc = useQueryClient();
  useTopic<AppNotification>("user.notifications", (n) => {
    qc.setQueryData<Data>(notificationKey, (d) => (d ? prependNotification(d, n) : d));
  });
  return useInfiniteQuery({
    queryKey: notificationKey,
    queryFn: ({ pageParam, signal }) =>
      api<NotificationPage>(`/api/notifications${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""}`, {
        signal,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    refetchInterval: usePollingFallback(),
    meta: { realtime: true },
  });
}

/** 하나 읽음. 화면은 먼저 바꾸고 실패해도 되돌리지 않는다 — 다음 조회 때 서버 값으로 맞춰진다 */
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/notifications/${id}/read`, { method: "PATCH" }),
    onMutate: (id) =>
      qc.setQueryData<Data>(notificationKey, (d) => (d ? markRead(d, new Set([id]), new Date().toISOString()) : d)),
    onError: () => void qc.invalidateQueries({ queryKey: notificationKey }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/api/notifications/read-all", { method: "POST" }),
    onSuccess: () =>
      qc.setQueryData<Data>(notificationKey, (d) => (d ? markRead(d, "all", new Date().toISOString()) : d)),
    onError: (err) => toast.error(userMessageOf(err)),
  });
}

/** 알림을 눌렀을 때 갈 주소 */
export function hrefOf(link: NotificationLink): string {
  switch (link.kind) {
    case "post":
      return `/posts/${link.postId}`;
    case "disclosure":
      return `/disclosures/${link.disclosureId}`;
    case "trade":
      return `/trade/${link.code}`;
  }
}
