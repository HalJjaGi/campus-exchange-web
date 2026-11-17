import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "@/shared/lib/cx";
import s from "./Button.module.css";

type Variant = "action" | "buy" | "sell" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** 제출 중. 클릭을 막고 스피너를 보여준다 */
  busy?: boolean;
  block?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    busy = false,
    block = false,
    icon,
    className,
    disabled,
    children,
    onClick,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx(s.button, s[variant], s[size], block && s.block, className)}
      disabled={disabled}
      aria-busy={busy || undefined}
      onClick={busy ? undefined : onClick}
      {...rest}
    >
      {busy ? <span className={s.spinner} aria-hidden /> : icon}
      <span className={cx(busy && s.busyLabel)}>{children}</span>
    </button>
  );
});
