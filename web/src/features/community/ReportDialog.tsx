import { useState } from "react";
import type { Post, ReportReason } from "@/shared/types/api";
import { Button } from "@/shared/ui/Button";
import { Modal } from "@/shared/ui/Modal";
import { useReportPost } from "./queries";
import s from "./community.module.css";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "SPAM", label: "도배·광고" },
  { value: "ABUSE", label: "욕설·비방" },
  { value: "FALSE_INFO", label: "허위 정보" },
  { value: "ETC", label: "기타" },
];

/** 신고(UC-09 §3). 같은 글은 한 번만 신고할 수 있다 */
export function ReportDialog({ post, onClose }: { post: Post; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const report = useReportPost();

  return (
    <Modal
      open
      onClose={onClose}
      title="이 글을 신고할까요?"
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button
            variant="action"
            disabled={!reason}
            busy={report.isPending}
            onClick={() => reason && report.mutate({ post, reason }, { onSettled: onClose })}
          >
            신고하기
          </Button>
        </>
      }
    >
      <fieldset className={s.reasons}>
        <legend className={s.reasonLegend}>신고 사유</legend>
        {REASONS.map((r) => (
          <label key={r.value} className={s.reason}>
            <input
              type="radio"
              name="report-reason"
              value={r.value}
              checked={reason === r.value}
              onChange={() => setReason(r.value)}
            />
            {r.label}
          </label>
        ))}
      </fieldset>
      <p className={s.reasonHelp}>운영진이 확인한 뒤 유지·숨김·삭제를 정해요. 신고한 사람은 공개되지 않아요.</p>
    </Modal>
  );
}
