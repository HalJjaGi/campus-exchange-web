import { useRef, type KeyboardEvent } from "react";
import { cx } from "@/shared/lib/cx";
import s from "./SegmentedControl.module.css";

export interface Segment<T extends string> {
  value: T;
  label: string;
  /** 매수/매도처럼 선택 색이 의미를 갖는 경우 */
  tone?: "buy" | "sell";
}

interface Props<T extends string> {
  label: string;
  options: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  block?: boolean;
}

/** 라디오 그룹. 화살표 키로 이동한다 */
export function SegmentedControl<T extends string>({ label, options, value, onChange, size = "md", block }: Props<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    const opt = options[next];
    if (!opt) return;
    onChange(opt.value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={cx(s.group, s[size], block && s.block)}>
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={cx(s.segment, selected && s.selected, selected && opt.tone && s[opt.tone])}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
