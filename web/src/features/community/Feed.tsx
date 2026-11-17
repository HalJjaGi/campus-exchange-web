import { useEffect, useMemo, useState } from "react";
import type { FeedSort } from "@/shared/types/api";
import { Button } from "@/shared/ui/Button";
import { EmptyState, ErrorBlock, SkeletonRows } from "@/shared/ui/States";
import { Tabs } from "@/shared/ui/Tabs";
import { DisclosureCard } from "./DisclosureCard";
import { flattenFeed, itemKey, nextPriorityExpiry, orderFeed } from "./feedRules";
import { PostCard } from "./PostCard";
import { useFeed } from "./queries";
import s from "./community.module.css";

/** 종목 채널 피드(SCR-04 §1, §5). 실시간/인기 정렬, 아래로 더 보기 */
export function Feed({ code }: { code: string }) {
  const [sort, setSort] = useState<FeedSort>("latest");
  const q = useFeed(code, sort);
  const [now, setNow] = useState(() => Date.now());

  const items = useMemo(() => (q.data ? flattenFeed(q.data.pages) : []), [q.data]);
  const ordered = useMemo(() => orderFeed(items, sort, now), [items, sort, now]);

  // 우선 노출이 끝나는 순간에 맞춰 한 번 다시 정렬한다(매초 돌리지 않는다)
  const expiry = nextPriorityExpiry(items, now);
  useEffect(() => {
    if (expiry === null) return;
    const t = setTimeout(() => setNow(Date.now()), Math.max(0, expiry - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [expiry]);
  // 새 글이 들어오면 그 글의 우선 노출 판단도 현재 시각 기준이어야 한다
  useEffect(() => setNow(Date.now()), [items]);

  return (
    <section className={s.feed} aria-label="종목 피드">
      <Tabs<FeedSort>
        label="정렬"
        idPrefix="feed"
        value={sort}
        onChange={setSort}
        items={[
          { value: "latest", label: "실시간" },
          { value: "popular", label: "인기" },
        ]}
      />
      <div role="tabpanel" id={`feed-panel-${sort}`} aria-labelledby={`feed-tab-${sort}`} className={s.feedList}>
        {!q.data ? (
          q.isError ? (
            <ErrorBlock message="피드를 불러오지 못했어요." onRetry={() => void q.refetch()} retrying={q.isFetching} />
          ) : (
            <SkeletonRows rows={4} height={120} />
          )
        ) : ordered.length === 0 ? (
          <EmptyState message={sort === "popular" ? "아직 공감을 받은 글이 없어요." : "첫 글을 남겨 보세요."} />
        ) : (
          <>
            {ordered.map((it) =>
              it.kind === "post" ? (
                <PostCard key={itemKey(it)} post={it.post} now={now} />
              ) : (
                <DisclosureCard key={itemKey(it)} disclosure={it.disclosure} />
              ),
            )}
            {q.hasNextPage ? (
              <Button variant="secondary" block busy={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
                이전 글 더 보기
              </Button>
            ) : (
              <p className={s.feedEnd}>이 채널의 글을 모두 봤어요.</p>
            )}
            {q.isFetchNextPageError && (
              <ErrorBlock message="이전 글을 불러오지 못했어요." onRetry={() => void q.fetchNextPage()} />
            )}
          </>
        )}
      </div>
    </section>
  );
}
