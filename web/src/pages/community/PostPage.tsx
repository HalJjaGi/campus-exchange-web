import { Link, useParams } from "react-router-dom";
import { PostCard } from "@/features/community/PostCard";
import { usePost } from "@/features/community/queries";
import { ApiError, userMessageOf } from "@/shared/api/errors";
import { EmptyState, ErrorBlock, Skeleton } from "@/shared/ui/States";
import s from "./CommunityPage.module.css";

/** 게시글 상세. 알림(내 글에 달린 댓글 등)에서 들어온다 */
export function PostPage() {
  const { id = "" } = useParams();
  const q = usePost(id);

  if (!q.data) {
    if (q.error instanceof ApiError && q.error.status === 404) {
      return <EmptyState message={userMessageOf(q.error)} action={<Link to="/community">커뮤니티로 이동</Link>} />;
    }
    return (
      <div className={s.page}>
        {q.isError ? (
          <ErrorBlock message="글을 불러오지 못했어요." onRetry={() => void q.refetch()} />
        ) : (
          <Skeleton height={160} />
        )}
      </div>
    );
  }

  return (
    <div className={s.page}>
      <Link to={`/community/${q.data.stockCode}`} className={s.back}>
        ← 채널로 돌아가기
      </Link>
      <PostCard post={q.data} now={Date.now()} defaultOpenComments />
    </div>
  );
}
