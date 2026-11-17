import { Minus, Plus } from "lucide-react";
import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { cx } from "@/shared/lib/cx";
import { caretFor, countSignificant, groupNumber, sanitizeNumber } from "@/shared/lib/numberInput";
import s from "./NumberField.module.css";

interface NumberFieldProps {
  id?: string;
  label: string;
  /** 쉼표 없는 숫자 문자열. 비어 있을 수 있다 */
  value: string;
  onChange: (raw: string) => void;
  /** ± 버튼. 없으면 버튼을 그리지 않는다 */
  onStep?: (direction: 1 | -1) => void;
  /** 소수 입력 허용 */
  decimal?: boolean;
  /** 숫자 자릿수 상한(소수점 제외) */
  maxDigits?: number;
  unit?: string;
  disabled?: boolean;
  /** disabled일 때 숫자 대신 보여줄 문구(예: 시장가) */
  placeholderWhenDisabled?: string;
  error?: string;
  hint?: ReactNode;
  stepLabels?: { down: string; up: string };
}

/**
 * 가격·수량 입력. 입력 중에도 쉼표를 유지하고 커서는 숫자 기준으로 되돌린다.
 * (포커스 때 쉼표를 빼는 방식은 값이 바뀌면서 전체 선택이 풀려, 새로 친 숫자가 뒤에 붙는 문제가 있었다)
 * 붙여넣은 "12,350P" 같은 값은 숫자만 남긴다.
 */
export function NumberField({
  id: propId,
  label,
  value,
  onChange,
  onStep,
  decimal = false,
  maxDigits = 12,
  unit,
  disabled,
  placeholderWhenDisabled,
  error,
  hint,
  stepLabels = { down: "내리기", up: "올리기" },
}: NumberFieldProps) {
  const generatedId = useId();
  const id = propId ?? generatedId;
  const msgId = `${id}-msg`;
  const inputRef = useRef<HTMLInputElement>(null);
  /** 방금 입력에서 커서 앞에 있던 숫자 개수. 렌더 후 커서를 그 자리에 놓는다 */
  const pendingCaret = useRef<number | null>(null);

  const shown = disabled && placeholderWhenDisabled ? "" : groupNumber(value);
  const message = error ?? hint;

  useLayoutEffect(() => {
    const el = inputRef.current;
    const sig = pendingCaret.current;
    if (!el || sig === null || document.activeElement !== el) return;
    pendingCaret.current = null;
    const pos = caretFor(shown, sig);
    el.setSelectionRange(pos, pos);
  });

  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>
        {label}
      </label>
      <div className={cx(s.control, error && s.invalid, disabled && s.disabled)}>
        {onStep && (
          <button
            type="button"
            className={s.step}
            aria-label={`${label} ${stepLabels.down}`}
            disabled={disabled}
            onClick={() => onStep(-1)}
            tabIndex={-1}
          >
            <Minus size={16} aria-hidden />
          </button>
        )}
        <input
          ref={inputRef}
          id={id}
          className={cx("num", s.input)}
          inputMode={decimal ? "decimal" : "numeric"}
          autoComplete="off"
          value={shown}
          placeholder={disabled ? placeholderWhenDisabled : undefined}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? msgId : undefined}
          onChange={(e) => {
            const el = e.target;
            const caret = el.selectionStart ?? el.value.length;
            pendingCaret.current = countSignificant(el.value.slice(0, caret));
            onChange(sanitizeNumber(el.value, decimal, maxDigits));
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.currentTarget.blur();
              return;
            }
            if (!onStep) return;
            if (e.key === "ArrowUp") {
              e.preventDefault();
              onStep(1);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              onStep(-1);
            }
          }}
        />
        {unit && !disabled && <span className={s.unit}>{unit}</span>}
        {onStep && (
          <button
            type="button"
            className={s.step}
            aria-label={`${label} ${stepLabels.up}`}
            disabled={disabled}
            onClick={() => onStep(1)}
            tabIndex={-1}
          >
            <Plus size={16} aria-hidden />
          </button>
        )}
      </div>
      {message && (
        <p id={msgId} className={cx(s.message, error && s.messageError)}>
          {message}
        </p>
      )}
    </div>
  );
}
