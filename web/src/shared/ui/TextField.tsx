import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "@/shared/lib/cx";
import s from "./TextField.module.css";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  /** 오류 문구. 있으면 오류 상태 */
  error?: string;
  /** 성공 문구(예: 사용 가능한 닉네임이에요) */
  success?: string;
  hint?: string;
  /** 입력창 오른쪽 끝 (카운트다운, 단위 등) */
  trailing?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, success, hint, trailing, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-msg`;
  const message = error ?? success ?? hint;

  return (
    <div className={cx(s.field, className)}>
      <label htmlFor={inputId} className={s.label}>
        {label}
      </label>
      <div className={cx(s.control, error && s.invalid, !error && success && s.valid)}>
        <input
          ref={ref}
          id={inputId}
          className={s.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          {...rest}
        />
        {trailing && <span className={s.trailing}>{trailing}</span>}
      </div>
      {message && (
        <p id={messageId} className={cx(s.message, error && s.messageError, !error && success && s.messageSuccess)}>
          {message}
        </p>
      )}
    </div>
  );
});
