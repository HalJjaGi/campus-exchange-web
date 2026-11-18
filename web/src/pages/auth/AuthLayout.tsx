import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import s from "./AuthLayout.module.css";

/** 로그인·가입 화면 틀. 장식 없이 폼만 둔다 */
export function AuthLayout({
  title,
  step,
  children,
  footer,
  action,
}: {
  title: string;
  /** "1 / 3" 같은 단계 표시 */
  step?: string;
  children: ReactNode;
  footer?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={s.page}>
      <header className={s.top}>
        <Link to="/" className={s.logo}>
          캠퍼스 거래소
        </Link>
        {action}
      </header>
      <main className={s.main}>
        {step && <p className={s.step}>{step}</p>}
        <h1 className={s.title}>{title}</h1>
        {children}
        {footer && <div className={s.footer}>{footer}</div>}
      </main>
    </div>
  );
}
