/**
 * 피드 정렬·실시간 반영 규칙(UC-08, UC-09). 순수 함수라 테스트로 고정한다.
 */
import type { FeedEvent, FeedItem, FeedPage, FeedSort, Post } from "@/shared/types/api";

export const MAX_CONTENT = 500;

export const itemKey = (it: FeedItem) => (it.kind === "post" ? `p:${it.post.id}` : `d:${it.disclosure.id}`);
const itemTime = (it: FeedItem) => (it.kind === "post" ? it.post.createdAt : it.disclosure.publishedAt);

/** 우선 노출 중인 글인가. 서버가 준 priorityUntil만 본다 */
export const isPrioritized = (p: Post, now: number) => !!p.priorityUntil && Date.parse(p.priorityUntil) > now;

/** 여러 페이지를 하나로. 페이지 경계에서 같은 항목이 겹쳐도 한 번만 남긴다 */
export function flattenFeed(pages: FeedPage[]): FeedItem[] {
  const seen = new Set<string>();
  const out: FeedItem[] = [];
  for (const page of pages) {
    for (const it of page.items) {
      const k = itemKey(it);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
  }
  return out;
}

/**
 * 표시 순서.
 * - 실시간: 최신순. 공시 카드도 시각 순으로 섞인다
 * - 인기: 공감 수 내림차순, 동률은 최신 우선. 공감할 수 없는 공시 카드는 인기 탭에서 뺀다
 * - 두 정렬 모두 우선 노출 중인 글을 맨 위에 둔다(그 안에서는 최신순). 시간이 끝나면 원래 정렬로 돌아간다
 */
export function orderFeed(items: FeedItem[], sort: FeedSort, now: number): FeedItem[] {
  const list = sort === "popular" ? items.filter((it) => it.kind === "post") : [...items];
  const prioritized = (it: FeedItem) => it.kind === "post" && isPrioritized(it.post, now);

  return list.sort((a, b) => {
    const pa = prioritized(a);
    const pb = prioritized(b);
    if (pa !== pb) return pa ? -1 : 1;
    if (!pa && sort === "popular" && a.kind === "post" && b.kind === "post") {
      const diff = b.post.reactionCount - a.post.reactionCount;
      if (diff) return diff;
    }
    return itemTime(b).localeCompare(itemTime(a));
  });
}

/** 다음으로 우선 노출이 끝나는 시각(ms). 그때 다시 정렬하려고 쓴다 */
export function nextPriorityExpiry(items: FeedItem[], now: number): number | null {
  let min: number | null = null;
  for (const it of items) {
    if (it.kind !== "post" || !it.post.priorityUntil) continue;
    const t = Date.parse(it.post.priorityUntil);
    if (t > now && (min === null || t < min)) min = t;
  }
  return min;
}

const mapPosts = (pages: FeedPage[], fn: (p: Post) => Post | null): FeedPage[] =>
  pages.map((page) => ({
    ...page,
    items: page.items.flatMap((it): FeedItem[] => {
      if (it.kind !== "post") return [it];
      const next = fn(it.post);
      return next ? [{ kind: "post", post: next }] : [];
    }),
  }));

const containsKey = (pages: FeedPage[], key: string) => pages.some((p) => p.items.some((it) => itemKey(it) === key));

/** WS 이벤트를 받은 페이지 목록에 반영한다. 새 항목은 첫 페이지 맨 앞에 넣고 정렬은 orderFeed가 한다 */
export function applyFeedEvent(pages: FeedPage[], ev: FeedEvent): FeedPage[] {
  switch (ev.type) {
    case "post.created":
    case "disclosure.created": {
      const item: FeedItem =
        ev.type === "post.created"
          ? { kind: "post", post: ev.post }
          : { kind: "disclosure", disclosure: ev.disclosure };
      if (containsKey(pages, itemKey(item))) return pages;
      const [first, ...rest] = pages;
      return first ? [{ ...first, items: [item, ...first.items] }, ...rest] : [{ items: [item], nextCursor: null }];
    }
    case "post.counts":
      return mapPosts(pages, (p) =>
        p.id === ev.postId ? { ...p, reactionCount: ev.reactionCount, commentCount: ev.commentCount } : p,
      );
    case "post.removed":
      return mapPosts(pages, (p) => (p.id === ev.postId ? null : p));
  }
}

/** 공감 토글 결과(또는 낙관적 값)를 해당 글에 반영 */
export function setReaction(pages: FeedPage[], postId: string, reacted: boolean, reactionCount: number): FeedPage[] {
  return mapPosts(pages, (p) => (p.id === postId ? { ...p, reactedByMe: reacted, reactionCount } : p));
}

export function markReported(pages: FeedPage[], postId: string): FeedPage[] {
  return mapPosts(pages, (p) => (p.id === postId ? { ...p, reportedByMe: true } : p));
}

/** 본문 검사. 공백만 있으면 안 되고 500자를 넘으면 안 된다 */
export function contentIssue(content: string): string | null {
  if ([...content].length > MAX_CONTENT) return `${MAX_CONTENT}자까지 쓸 수 있어요.`;
  return null;
}

export const contentLength = (content: string) => [...content].length;
