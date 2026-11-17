import type { Disclosure, FeedItem, FeedPage, Post } from "@/shared/types/api";
import {
  applyFeedEvent,
  contentIssue,
  contentLength,
  flattenFeed,
  nextPriorityExpiry,
  orderFeed,
  setReaction,
} from "./feedRules";

const NOW = Date.parse("2026-11-16T12:00:00Z");
const at = (min: number) => new Date(NOW + min * 60_000).toISOString();

const post = (id: string, createdMin: number, over: Partial<Post> = {}): FeedItem => ({
  kind: "post",
  post: {
    id,
    stockCode: "CSE",
    author: { nickname: id, title: null },
    tag: "WATCH",
    content: id,
    verification: "NONE",
    reactionCount: 0,
    commentCount: 0,
    reactedByMe: false,
    reportedByMe: false,
    mine: false,
    priorityUntil: null,
    createdAt: at(createdMin),
    ...over,
  },
});

const disc = (id: string, min: number): FeedItem => ({
  kind: "disclosure",
  disclosure: { id, type: "EVENT", title: id, summary: "", stockCodes: ["CSE"], publishedAt: at(min) } as Disclosure,
});

const ids = (items: FeedItem[]) => items.map((it) => (it.kind === "post" ? it.post.id : it.disclosure.id));
const page = (items: FeedItem[], nextCursor: string | null = null): FeedPage => ({ items, nextCursor });

describe("orderFeed", () => {
  it("실시간: 최신순, 공시 카드도 시각 순", () => {
    expect(ids(orderFeed([post("a", -10), disc("d", -5), post("b", -1)], "latest", NOW))).toEqual(["b", "d", "a"]);
  });

  it("인기: 공감 수 내림차순, 동률은 최신 우선, 공시 제외", () => {
    const items = [
      post("a", -10, { reactionCount: 3 }),
      post("b", -5, { reactionCount: 3 }),
      post("c", -1, { reactionCount: 9 }),
      disc("d", 0),
    ];
    expect(ids(orderFeed(items, "popular", NOW))).toEqual(["c", "b", "a"]);
  });

  it("우선 노출 중인 글은 맨 위, 시간이 지나면 원래 자리", () => {
    const items = [post("old", -30, { priorityUntil: at(1) }), post("new", -1)];
    expect(ids(orderFeed(items, "latest", NOW))).toEqual(["old", "new"]);
    expect(ids(orderFeed(items, "latest", NOW + 2 * 60_000))).toEqual(["new", "old"]);
  });

  it("다음 우선 노출 종료 시각", () => {
    const items = [post("a", 0, { priorityUntil: at(5) }), post("b", 0, { priorityUntil: at(2) }), post("c", 0)];
    expect(nextPriorityExpiry(items, NOW)).toBe(NOW + 2 * 60_000);
    expect(nextPriorityExpiry(items, NOW + 10 * 60_000)).toBeNull();
  });
});

describe("flattenFeed", () => {
  it("페이지 경계에서 겹친 항목은 한 번만", () => {
    expect(ids(flattenFeed([page([post("a", 0), post("b", 0)]), page([post("b", 0), post("c", 0)])]))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("applyFeedEvent", () => {
  const pages = [page([post("a", -1)], "c1"), page([post("b", -2)])];

  it("새 글은 첫 페이지 앞에, 같은 글이 또 오면 무시", () => {
    const ev = { type: "post.created" as const, post: (post("n", 0) as { post: Post }).post };
    const once = applyFeedEvent(pages, ev);
    expect(ids(flattenFeed(once))).toEqual(["n", "a", "b"]);
    expect(applyFeedEvent(once, ev)).toBe(once);
  });

  it("공감·댓글 수 갱신", () => {
    const next = applyFeedEvent(pages, { type: "post.counts", postId: "b", reactionCount: 7, commentCount: 2 });
    const b = flattenFeed(next).find((it) => it.kind === "post" && it.post.id === "b");
    expect(b?.kind === "post" && [b.post.reactionCount, b.post.commentCount]).toEqual([7, 2]);
  });

  it("숨김·삭제된 글은 뺀다", () => {
    expect(ids(flattenFeed(applyFeedEvent(pages, { type: "post.removed", postId: "a" })))).toEqual(["b"]);
  });

  it("빈 피드에 새 공시", () => {
    const d = (disc("d", 0) as { disclosure: Disclosure }).disclosure;
    expect(ids(flattenFeed(applyFeedEvent([], { type: "disclosure.created", disclosure: d })))).toEqual(["d"]);
  });
});

it("공감 반영", () => {
  const next = setReaction([page([post("a", 0)])], "a", true, 1);
  const a = next[0]?.items[0];
  expect(a?.kind === "post" && [a.post.reactedByMe, a.post.reactionCount]).toEqual([true, 1]);
});

it("본문 길이는 글자 수(이모지 포함)로 센다", () => {
  expect(contentLength("🚀가")).toBe(2);
  expect(contentIssue("가".repeat(500))).toBeNull();
  expect(contentIssue("가".repeat(501))).toBe("500자까지 쓸 수 있어요.");
});
