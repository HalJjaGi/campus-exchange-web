import { NotificationList } from "@/features/notification/NotificationList";
import { unreadCountOf, useMarkAllRead, useNotifications } from "@/features/notification/queries";
import { Button } from "@/shared/ui/Button";
import { EmptyState, ErrorBlock, SkeletonRows } from "@/shared/ui/States";
import s from "@/features/notification/notification.module.css";

/** S-07 알림 전체 보기 */
export function NotificationsPage() {
  const q = useNotifications();
  const readAll = useMarkAllRead();
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = unreadCountOf(q.data);

  return (
    <div className={s.page}>
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>알림</h1>
        <Button size="sm" disabled={unread === 0} busy={readAll.isPending} onClick={() => readAll.mutate()}>
          모두 읽음
        </Button>
      </header>
      {!q.data ? (
        q.isError ? (
          <ErrorBlock message="알림을 불러오지 못했어요." onRetry={() => void q.refetch()} />
        ) : (
          <SkeletonRows rows={6} height={64} />
        )
      ) : items.length === 0 ? (
        <EmptyState message="아직 알림이 없어요. 가입한 뒤에 생긴 일만 알려드려요." />
      ) : (
        <div className={s.pageList}>
          <NotificationList items={items} />
          {q.hasNextPage && (
            <Button variant="secondary" block busy={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
              이전 알림 더 보기
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
