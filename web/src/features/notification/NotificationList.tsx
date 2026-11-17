import { useNavigate } from "react-router-dom";
import { cx } from "@/shared/lib/cx";
import { formatTime } from "@/shared/lib/format";
import type { AppNotification } from "@/shared/types/api";
import { hrefOf, useMarkRead } from "./queries";
import s from "./notification.module.css";

const TYPE_LABEL: Record<AppNotification["type"], string> = {
  DISCLOSURE: "공시",
  POST_COMMENT: "댓글",
  POST_REACTION: "공감",
  ORDER_FILLED: "체결",
};

/** 알림 항목들. 누르면 읽음 처리 후 관련 화면으로 간다(S-07) */
export function NotificationList({ items, onNavigate }: { items: AppNotification[]; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const markRead = useMarkRead();

  return (
    <ul className={s.list}>
      {items.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            className={cx(s.item, !n.readAt && s.unread)}
            onClick={() => {
              if (!n.readAt) markRead.mutate(n.id);
              onNavigate?.();
              navigate(hrefOf(n.link));
            }}
          >
            <span className={s.itemMeta}>
              {!n.readAt && <span className={s.dot} aria-label="읽지 않음" />}
              <span className={s.type}>{TYPE_LABEL[n.type]}</span>
              <time className="num" dateTime={n.createdAt}>
                {formatTime(n.createdAt)}
              </time>
            </span>
            <span className={s.itemTitle}>{n.title}</span>
            {n.body && <span className={s.itemBody}>{n.body}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
