import { Flag, MessageSquare, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { cx } from "@/shared/lib/cx";
import { formatTime } from "@/shared/lib/format";
import type { Post, PostTag } from "@/shared/types/api";
import { VerifiedBadge } from "@/shared/ui/MarketBadges";
import { EmptyState, ErrorBlock, SkeletonRows } from "@/shared/ui/States";
import { isPrioritized } from "./feedRules";
import { useComments, useToggleReaction } from "./queries";
import { ReportDialog } from "./ReportDialog";
import s from "./community.module.css";

/** SDS가 정한 태그 표기 그대로 쓴다(DESIGN.md §8 예외) */
export const TAG_LABEL: Record<PostTag, string> = {
  ROCKET: "🚀 떡상각",
  SHORT_VIEW: "📉 떡락각·공매도",
  WATCH: "👀 관망",
};

interface Props {
  post: Post;
  now: number;
  /** 상세 화면처럼 댓글을 처음부터 펼쳐 둘 때 */
  defaultOpenComments?: boolean;
}

/**
 * 게시글 카드(SCR-04 §1). 실유저 글과 AI 참여자 글은 같은 카드를 쓴다 —
 * 이 컴포넌트에는 작성자 유형으로 갈라지는 분기가 없다.
 */
export function PostCard({ post, now, defaultOpenComments = false }: Props) {
  const toggle = useToggleReaction();
  const [commentsOpen, setCommentsOpen] = useState(defaultOpenComments);
  const [reporting, setReporting] = useState(false);
  const fresh = isPrioritized(post, now);
  const pending = toggle.isPending && toggle.variables?.id === post.id;

  return (
    <article className={cx(s.card, fresh && s.fresh)} aria-label={`${post.author.nickname}의 글`}>
      <header className={s.cardHead}>
        <span className={s.author}>{post.author.nickname}</span>
        {post.author.title && <span className={s.authorTitle}>{post.author.title}</span>}
        {post.verification !== "NONE" && <VerifiedBadge kind={post.verification} />}
        {fresh && <span className={s.freshLabel}>새 글</span>}
        <Link to={`/posts/${post.id}`} className={s.time}>
          <time className="num" dateTime={post.createdAt}>
            {formatTime(post.createdAt)}
          </time>
        </Link>
      </header>

      <p className={s.tag}>{TAG_LABEL[post.tag]}</p>
      <p className={s.content}>{post.content}</p>

      <footer className={s.cardFoot}>
        <button
          type="button"
          className={cx(s.action, post.reactedByMe && s.actionOn)}
          aria-pressed={post.reactedByMe}
          disabled={pending}
          onClick={() => toggle.mutate(post)}
        >
          <ThumbsUp size={16} aria-hidden />
          공감 <span className="num">{post.reactionCount}</span>
        </button>
        <button
          type="button"
          className={s.action}
          aria-expanded={commentsOpen}
          onClick={() => setCommentsOpen((v) => !v)}
        >
          <MessageSquare size={16} aria-hidden />
          댓글 <span className="num">{post.commentCount}</span>
        </button>
        {!post.mine && (
          <button
            type="button"
            className={cx(s.action, s.report)}
            disabled={post.reportedByMe}
            onClick={() => setReporting(true)}
          >
            <Flag size={14} aria-hidden />
            {post.reportedByMe ? "신고함" : "신고"}
          </button>
        )}
      </footer>

      {commentsOpen && <Comments postId={post.id} count={post.commentCount} />}
      {reporting && <ReportDialog post={post} onClose={() => setReporting(false)} />}
    </article>
  );
}

/** 댓글 목록. 사용자 글에는 AI 참여자의 반응 댓글이 몇 분 뒤에 달릴 수 있다(UC-11) — 표시는 똑같다 */
function Comments({ postId, count }: { postId: string; count: number }) {
  const { data, isError, refetch, isFetching } = useComments(postId, true);

  if (!data) {
    return isError ? (
      <ErrorBlock message="댓글을 불러오지 못했어요." onRetry={() => void refetch()} retrying={isFetching} />
    ) : (
      <SkeletonRows rows={Math.min(Math.max(count, 1), 3)} height={36} />
    );
  }
  if (data.length === 0) return <EmptyState message="아직 댓글이 없어요." />;

  return (
    <ul className={s.comments}>
      {data.map((c) => (
        <li key={c.id} className={s.comment}>
          <span className={s.commentHead}>
            <span className={s.author}>{c.author.nickname}</span>
            {c.author.title && <span className={s.authorTitle}>{c.author.title}</span>}
            <time className={`num ${s.time}`} dateTime={c.createdAt}>
              {formatTime(c.createdAt)}
            </time>
          </span>
          <p className={s.commentBody}>{c.content}</p>
        </li>
      ))}
    </ul>
  );
}
