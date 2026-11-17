import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cx } from "@/shared/lib/cx";
import { formatTime } from "@/shared/lib/format";
import type { Disclosure } from "@/shared/types/api";
import { EmptyState, ErrorBlock, SkeletonRows } from "@/shared/ui/States";
import { useLatestDisclosures } from "./queries";
import s from "./dashboard.module.css";

const TYPE_LABEL: Record<Disclosure["type"], string> = {
  DIVIDEND: "배당",
  BURN: "소각",
  EVENT: "이벤트",
  MONETARY: "통화정책",
};

/**
 * 최근 공시(SCR-02 공시 배너, UC-12). 접속 후 새로 들어온 공시는 `새 공시`로 표시한다.
 * 공시 상세 화면이 생기기 전까지는 항목을 펼쳐 요약을 본다.
 */
export function DisclosureList() {
  const { data, isError, refetch, isFetching } = useLatestDisclosures();
  const [open, setOpen] = useState<string | null>(null);
  // 첫 조회 때 이미 있던 공시는 "새 공시"가 아니다
  const initial = useRef<Set<string> | null>(null);
  if (data && !initial.current) initial.current = new Set(data.map((d) => d.id));

  return (
    <section className={s.disclosures} aria-labelledby="disclosure-title">
      <h2 id="disclosure-title" className={s.sectionTitle}>
        최근 공시
      </h2>
      {!data ? (
        isError ? (
          <ErrorBlock message="공시를 불러오지 못했어요." onRetry={() => void refetch()} retrying={isFetching} />
        ) : (
          <SkeletonRows rows={4} height={56} />
        )
      ) : data.length === 0 ? (
        <EmptyState message="아직 발행된 공시가 없어요." />
      ) : (
        <ul className={s.disclosureList}>
          {data.map((d) => {
            const fresh = !initial.current?.has(d.id);
            const expanded = open === d.id;
            return (
              <li key={d.id} className={cx(s.disclosure, fresh && s.fresh)}>
                <button
                  type="button"
                  className={s.disclosureButton}
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : d.id)}
                >
                  <span className={s.disclosureMeta}>
                    <span className={s.disclosureType}>{TYPE_LABEL[d.type]}</span>
                    {fresh && <span className={s.freshLabel}>새 공시</span>}
                    <time className="num" dateTime={d.publishedAt}>
                      {formatTime(d.publishedAt)}
                    </time>
                  </span>
                  <span className={s.disclosureTitle}>{d.title}</span>
                </button>
                {expanded && (
                  <p className={s.disclosureSummary}>
                    {d.summary} <Link to={`/disclosures/${d.id}`}>자세히</Link>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
