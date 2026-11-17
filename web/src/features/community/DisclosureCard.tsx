import { Link } from "react-router-dom";
import { formatTime } from "@/shared/lib/format";
import type { Disclosure } from "@/shared/types/api";
import s from "./community.module.css";

export const DISCLOSURE_TYPE_LABEL: Record<Disclosure["type"], string> = {
  DIVIDEND: "배당",
  BURN: "소각",
  EVENT: "이벤트",
  MONETARY: "통화정책",
};

/** 피드 속 공시 카드(SCR-04 §10). 게시글과 구분되는 별도 모양이고, 누르면 공시 상세로 간다 */
export function DisclosureCard({ disclosure: d }: { disclosure: Disclosure }) {
  return (
    <article className={s.disclosure} aria-label={`공시: ${d.title}`}>
      <Link to={`/disclosures/${d.id}`} className={s.disclosureLink}>
        <span className={s.disclosureMeta}>
          <span className={s.disclosureBadge}>공시</span>
          <span>{DISCLOSURE_TYPE_LABEL[d.type]}</span>
          <time className="num" dateTime={d.publishedAt}>
            {formatTime(d.publishedAt)}
          </time>
        </span>
        <span className={s.disclosureTitle}>{d.title}</span>
        <span className={s.disclosureSummary}>{d.summary}</span>
      </Link>
    </article>
  );
}
