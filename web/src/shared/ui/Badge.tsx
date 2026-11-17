import type { ReactNode } from "react";
import { cx } from "@/shared/lib/cx";
import s from "./Badge.module.css";

/**
 * tone은 DESIGN.md §5.2 배지 매핑표의 칸과 1:1이다.
 * 새 tone을 만들기 전에 매핑표부터 고친다.
 */
export type BadgeTone = "outline" | "attention" | "positive" | "danger" | "lp";

interface BadgeProps {
  tone: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone, icon, children, className }: BadgeProps) {
  return (
    <span className={cx(s.badge, s[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

/** 클릭 가능하면 버튼, 아니면 정보 칩 */
export function Chip({ children, selected, onClick, className }: ChipProps) {
  if (onClick) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        className={cx(s.chip, selected && s.chipSelected, className)}
        onClick={onClick}
      >
        {children}
      </button>
    );
  }
  return <span className={cx(s.chip, className)}>{children}</span>;
}
