import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ApiError, userMessageOf } from "@/shared/api/errors";
import { usePollingFallback, useTopic } from "@/shared/realtime/RealtimeProvider";
import type {
  Comment,
  CreatePostRequest,
  DisclosureDetail,
  FeedEvent,
  FeedPage,
  FeedSort,
  Post,
  ReactionResult,
  ReportReason,
} from "@/shared/types/api";
import { toast } from "@/shared/ui/Toast";
import { applyFeedEvent, markReported, setReaction } from "./feedRules";

type FeedData = InfiniteData<FeedPage, unknown>;

export const communityKeys = {
  feedAll: (code: string) => ["feed", code] as const,
  feed: (code: string, sort: FeedSort) => ["feed", code, sort] as const,
  post: (id: string) => ["post", id] as const,
  comments: (id: string) => ["post", id, "comments"] as const,
  disclosure: (id: string) => ["disclosure", id] as const,
};

/** 같은 종목의 실시간·인기 캐시 둘 다에 같은 변경을 적용한다 */
function useUpdateFeeds() {
  const qc = useQueryClient();
  return (code: string, fn: (pages: FeedPage[]) => FeedPage[]) =>
    qc.setQueriesData<FeedData>({ queryKey: communityKeys.feedAll(code) }, (d) =>
      d ? { ...d, pages: fn(d.pages) } : d,
    );
}

/** 종목 채널 피드(SD-07). 실시간 이벤트를 받아 바로 반영하고, 채널을 바꾸면 구독도 바뀐다 */
export function useFeed(code: string, sort: FeedSort) {
  const update = useUpdateFeeds();
  const qc = useQueryClient();

  useTopic<FeedEvent>(`feed.${code}`, (ev) => {
    update(code, (pages) => applyFeedEvent(pages, ev));
    if (ev.type === "post.counts") {
      qc.setQueryData<Post>(communityKeys.post(ev.postId), (p) =>
        p ? { ...p, reactionCount: ev.reactionCount, commentCount: ev.commentCount } : p,
      );
      void qc.invalidateQueries({ queryKey: communityKeys.comments(ev.postId) });
    }
  });

  return useInfiniteQuery({
    queryKey: communityKeys.feed(code, sort),
    queryFn: ({ pageParam, signal }) =>
      api<FeedPage>(
        `/api/stocks/${code}/feed?sort=${sort}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
        {
          signal,
        },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // 끊긴 동안은 첫 페이지만 다시 받아 새 글을 놓치지 않는다
    refetchInterval: usePollingFallback(),
    meta: { realtime: true },
  });
}

export function useCreatePost(onCreated: (post: Post) => void) {
  const update = useUpdateFeeds();
  return useMutation({
    mutationFn: (body: CreatePostRequest) => api<Post>("/api/posts", { method: "POST", body }),
    onSuccess: (post) => {
      // WS 이벤트보다 먼저 응답이 오면 바로 넣는다. 나중에 같은 이벤트가 와도 ID로 걸러진다
      update(post.stockCode, (pages) => applyFeedEvent(pages, { type: "post.created", post }));
      if (post.verification === "REAL_HOLD") toast.success("실보유 인증 뱃지를 달았어요.");
      else if (post.verification === "SHORT") toast.success("공매도 인증 뱃지를 달았어요.");
      else if (post.tag !== "WATCH") toast.show("포지션을 확인하지 못해 인증 뱃지 없이 올렸어요.");
      else toast.show("글을 올렸어요.");
      onCreated(post);
    },
  });
}

/** 공감 토글. 먼저 화면을 바꾸고, 실패하면 되돌린다 */
export function useToggleReaction() {
  const update = useUpdateFeeds();
  const qc = useQueryClient();

  const apply = (post: Post, reacted: boolean, count: number) => {
    update(post.stockCode, (pages) => setReaction(pages, post.id, reacted, count));
    qc.setQueryData<Post>(communityKeys.post(post.id), (p) =>
      p ? { ...p, reactedByMe: reacted, reactionCount: count } : p,
    );
  };

  return useMutation({
    mutationFn: (post: Post) =>
      api<ReactionResult>(`/api/posts/${post.id}/reactions`, { method: post.reactedByMe ? "DELETE" : "POST" }),
    onMutate: (post) => {
      apply(post, !post.reactedByMe, post.reactionCount + (post.reactedByMe ? -1 : 1));
    },
    onSuccess: (r, post) => apply(post, r.reacted, r.reactionCount),
    onError: (err, post) => {
      apply(post, post.reactedByMe, post.reactionCount);
      toast.error(userMessageOf(err));
    },
  });
}

export function useReportPost() {
  const update = useUpdateFeeds();
  const qc = useQueryClient();
  const mark = (post: Post) => {
    update(post.stockCode, (pages) => markReported(pages, post.id));
    qc.setQueryData<Post>(communityKeys.post(post.id), (p) => (p ? { ...p, reportedByMe: true } : p));
  };
  return useMutation({
    mutationFn: ({ post, reason }: { post: Post; reason: ReportReason }) =>
      api<void>("/api/reports", { method: "POST", body: { targetType: "POST", targetId: post.id, reason } }),
    onSuccess: (_r, { post }) => {
      mark(post);
      toast.show("신고를 접수했어요. 운영진이 검토할게요.");
    },
    onError: (err, { post }) => {
      if (err instanceof ApiError && err.code === "ALREADY_REPORTED") mark(post);
      toast.error(userMessageOf(err));
    },
  });
}

export function useComments(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: communityKeys.comments(postId),
    queryFn: ({ signal }) => api<Comment[]>(`/api/posts/${postId}/comments`, { signal }),
    enabled,
  });
}

export function usePost(postId: string) {
  return useQuery({
    queryKey: communityKeys.post(postId),
    queryFn: ({ signal }) => api<Post>(`/api/posts/${postId}`, { signal }),
  });
}

export function useDisclosure(id: string) {
  return useQuery({
    queryKey: communityKeys.disclosure(id),
    queryFn: ({ signal }) => api<DisclosureDetail>(`/api/disclosures/${id}`, { signal }),
    staleTime: Infinity,
  });
}
