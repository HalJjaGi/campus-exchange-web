import { CircleAlert } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/shared/lib/cx";
import { Button } from "./Button";
import s from "./States.module.css";

/** 실제 레이아웃과 같은 크기로 자리만 잡는다. shimmer 없음 */
export function Skeleton({
  width,
  height = 16,
  className,
}: {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  className?: string;
}) {
  return <span aria-hidden className={cx(s.skeleton, className)} style={{ width, height }} />;
}

export function SkeletonRows({ rows, height = 40 }: { rows: number; height?: number }) {
  return (
    <div className={s.rows} role="status" aria-label="불러오는 중">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} />
      ))}
    </div>
  );
}

/** 한 문장 + 행동 하나. 일러스트 없음 */
export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className={s.empty}>
      <p>{message}</p>
      {action}
    </div>
  );
}

/** 이 영역만 실패했음을 알린다. 다른 영역은 정상 표시를 유지한다(UC-14) */
export function ErrorBlock({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div className={s.error} role="alert">
      <CircleAlert size={18} aria-hidden className={s.errorIcon} />
      <p>{message}</p>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry} busy={retrying}>
          다시 시도
        </Button>
      )}
    </div>
  );
}
