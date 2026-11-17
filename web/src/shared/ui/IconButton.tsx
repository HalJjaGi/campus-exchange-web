import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "@/shared/lib/cx";
import s from "./IconButton.module.css";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  /** 아이콘만 있으므로 필수 */
  label: string;
  children: ReactNode;
  size?: "sm" | "md";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "md", className, children, ...rest },
  ref,
) {
  return (
    <button ref={ref} type="button" aria-label={label} className={cx(s.iconButton, s[size], className)} {...rest}>
      {children}
    </button>
  );
});
