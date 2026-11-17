import type { InfiniteData } from "@tanstack/react-query";
import type { AppNotification, NotificationPage } from "@/shared/types/api";
import { hrefOf, markRead, prependNotification, unreadCountOf } from "./queries";

const n = (id: string, read = false): AppNotification => ({
  id,
  type: "DISCLOSURE",
  title: id,
  body: "",
  link: { kind: "disclosure", disclosureId: id },
  createdAt: "2026-11-16T12:00:00Z",
  readAt: read ? "2026-11-16T12:01:00Z" : null,
});

const data = (pages: Array<{ items: AppNotification[]; unread: number }>): InfiniteData<NotificationPage, unknown> => ({
  pages: pages.map((p) => ({ items: p.items, nextCursor: null, unreadCount: p.unread })),
  pageParams: pages.map(() => null),
});

it("새 알림은 앞에 붙고 미확인 수가 오른다, 같은 ID는 무시", () => {
  const d = data([{ items: [n("a")], unread: 1 }]);
  const once = prependNotification(d, n("b"));
  expect(once.pages[0]?.items.map((x) => x.id)).toEqual(["b", "a"]);
  expect(unreadCountOf(once)).toBe(2);
  expect(prependNotification(once, n("b"))).toBe(once);
});

it("이미 읽은 알림이 들어오면 미확인 수는 그대로", () => {
  expect(unreadCountOf(prependNotification(data([{ items: [], unread: 0 }]), n("x", true)))).toBe(0);
});

it("하나 읽음: 안 읽은 것만 세서 줄인다", () => {
  const d = data([{ items: [n("a"), n("b", true)], unread: 1 }]);
  const r = markRead(d, new Set(["a", "b"]), "2026-11-16T13:00:00Z");
  expect(unreadCountOf(r)).toBe(0);
  expect(r.pages[0]?.items[0]?.readAt).toBe("2026-11-16T13:00:00Z");
  expect(r.pages[0]?.items[1]?.readAt).toBe("2026-11-16T12:01:00Z");
});

it("모두 읽음: 아직 안 받은 페이지까지 0으로", () => {
  const r = markRead(data([{ items: [n("a")], unread: 12 }]), "all", "2026-11-16T13:00:00Z");
  expect(unreadCountOf(r)).toBe(0);
});

it("링크 주소", () => {
  expect(hrefOf({ kind: "post", postId: "p1" })).toBe("/posts/p1");
  expect(hrefOf({ kind: "trade", code: "CSE" })).toBe("/trade/CSE");
});
