/** 개발용 가짜 알림. 로그인한 한 사람 기준으로만 쌓는다 */
import type { AppNotification, NotificationPage } from "@/shared/types/api";
import { emit, mockId } from "./bus";
import { MockError } from "./errors";

const PAGE = 15;

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const items: AppNotification[] = [
  {
    id: "n-seed-2",
    type: "DISCLOSURE",
    title: "간호학과 주당 50P 배당",
    body: "오늘이 배당락일이에요.",
    link: { kind: "disclosure", disclosureId: "d-3" },
    createdAt: ago(25),
    readAt: null,
  },
  {
    id: "n-seed-1",
    type: "DISCLOSURE",
    title: "기준금리 연 3.50% 동결",
    body: "예수금 이자율도 그대로예요.",
    link: { kind: "disclosure", disclosureId: "d-2" },
    createdAt: ago(95),
    readAt: ago(90),
  },
];

/** 새 알림 저장 + 온라인이면 바로 전달(SD-10) */
export function addNotification(n: Omit<AppNotification, "id" | "createdAt" | "readAt">) {
  const full: AppNotification = { ...n, id: mockId("n"), createdAt: new Date().toISOString(), readAt: null };
  items.unshift(full);
  emit("user.notifications", full, undefined, full.id);
}

export function listNotifications(cursor: string | null): NotificationPage {
  const start = cursor ? Number(cursor) : 0;
  const slice = items.slice(start, start + PAGE);
  return {
    items: slice,
    nextCursor: start + PAGE < items.length ? String(start + PAGE) : null,
    unreadCount: items.filter((n) => !n.readAt).length,
  };
}

export function readNotification(id: string) {
  const n = items.find((x) => x.id === id);
  if (!n) throw new MockError(404, "NOTIFICATION_NOT_FOUND");
  n.readAt ??= new Date().toISOString();
}

export function readAllNotifications() {
  const at = new Date().toISOString();
  for (const n of items) n.readAt ??= at;
}
