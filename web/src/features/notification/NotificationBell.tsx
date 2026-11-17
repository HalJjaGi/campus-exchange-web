import { Bell } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatCount } from "@/shared/lib/format";
import { EmptyState, ErrorBlock, SkeletonRows } from "@/shared/ui/States";
import { NotificationList } from "./NotificationList";
import { unreadCountOf, useMarkAllRead, useNotifications } from "./queries";
import s from "./notification.module.css";

const PREVIEW = 8;

/** GNB 알림 아이콘 + 미확인 수 + 최근 목록(S-07) */
export function NotificationBell() {
  const q = useNotifications();
  const readAll = useMarkAllRead();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const unread = unreadCountOf(q.data);
  const items = q.data?.pages.flatMap((p) => p.items).slice(0, PREVIEW) ?? [];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={s.bell} ref={root}>
      <button
        type="button"
        className={s.bellButton}
        aria-label={unread > 0 ? `알림, 읽지 않은 알림 ${unread}개` : "알림"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} aria-hidden />
        {unread > 0 && (
          <span className={`num ${s.count}`} aria-hidden>
            {formatCount(unread)}
          </span>
        )}
      </button>

      {open && (
        <div id={panelId} className={s.panel} role="dialog" aria-label="알림">
          <div className={s.panelHead}>
            <span className={s.panelTitle}>알림</span>
            <button
              type="button"
              className={s.textButton}
              disabled={unread === 0 || readAll.isPending}
              onClick={() => readAll.mutate()}
            >
              모두 읽음
            </button>
          </div>
          <div className={s.panelBody}>
            {!q.data ? (
              q.isError ? (
                <ErrorBlock message="알림을 불러오지 못했어요." onRetry={() => void q.refetch()} />
              ) : (
                <SkeletonRows rows={3} height={56} />
              )
            ) : items.length === 0 ? (
              <EmptyState message="아직 알림이 없어요." />
            ) : (
              <NotificationList items={items} onNavigate={() => setOpen(false)} />
            )}
          </div>
          <Link to="/notifications" className={s.panelFoot} onClick={() => setOpen(false)}>
            전체 보기
          </Link>
        </div>
      )}
    </div>
  );
}
