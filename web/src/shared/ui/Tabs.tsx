import { useRef, type KeyboardEvent } from "react";
import { cx } from "@/shared/lib/cx";
import s from "./Tabs.module.css";

export interface TabItem<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 탭 패널 id 접두사. 패널 쪽에 `${idPrefix}-panel-${value}`를 붙인다 */
  idPrefix: string;
}

/** 밑줄형 탭. 패널은 호출하는 쪽에서 렌더링한다 */
export function Tabs<T extends string>({ label, items, value, onChange, idPrefix }: Props<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + items.length) % items.length;
    const item = items[next];
    if (!item) return;
    onChange(item.value);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={s.list}>
      {items.map((item, i) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${idPrefix}-tab-${item.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            className={cx(s.tab, selected && s.selected)}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
