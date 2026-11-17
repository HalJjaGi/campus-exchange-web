import { Link, useParams } from "react-router-dom";
import { DISCLOSURE_TYPE_LABEL } from "@/shared/market/labels";
import { useDisclosure } from "@/features/community/queries";
import { ApiError, userMessageOf } from "@/shared/api/errors";
import { formatTime } from "@/shared/lib/format";
import { EmptyState, ErrorBlock, Skeleton } from "@/shared/ui/States";
import s from "./CommunityPage.module.css";

/** 공시 상세(UC-12 §4). 공시 카드·대시보드·알림에서 들어온다 */
export function DisclosurePage() {
  const { id = "" } = useParams();
  const q = useDisclosure(id);

  if (!q.data) {
    if (q.error instanceof ApiError && q.error.status === 404) {
      return <EmptyState message={userMessageOf(q.error)} action={<Link to="/">대시보드로 이동</Link>} />;
    }
    return (
      <div className={s.page}>
        {q.isError ? (
          <ErrorBlock message="공시를 불러오지 못했어요." onRetry={() => void q.refetch()} />
        ) : (
          <Skeleton height={200} />
        )}
      </div>
    );
  }

  const d = q.data;
  return (
    <article className={s.page}>
      <p className={s.detailMeta}>
        <span>공시 · {DISCLOSURE_TYPE_LABEL[d.type]}</span>
        <time className="num" dateTime={d.publishedAt}>
          {formatTime(d.publishedAt)}
        </time>
      </p>
      <h1 className={s.detailTitle}>{d.title}</h1>
      <p className={s.detailBody}>{d.body}</p>
      {d.stocks.length > 0 && (
        <section className={s.related} aria-labelledby="related-title">
          <h2 id="related-title" className={s.relatedTitle}>
            대상 종목
          </h2>
          <ul className={s.relatedList}>
            {d.stocks.map((st) => (
              <li key={st.code}>
                {st.name} — <Link to={`/trade/${st.code}`}>거래</Link> · <Link to={`/community/${st.code}`}>채널</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
