import { useLayoutEffect, useRef, type RefObject } from "react";
import { durationMs } from "@/shared/lib/motion";

/**
 * 순위가 바뀐 행만 이전 자리에서 새 자리로 미끄러지듯 옮긴다(FLIP, DESIGN.md §7).
 * 자식 요소에 data-flip-key를 달아 둔다. 위치는 화면 좌표가 아니라 offsetTop으로 재서
 * 스크롤해도 모든 행이 움직이는 일이 없다. 모션 축소 설정이면 토큰이 0ms라 아무것도 하지 않는다.
 */
export function useFlipReorder(container: RefObject<HTMLElement>) {
  const prev = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const duration = durationMs("--dur-reorder");
    const next = new Map<string, number>();

    root.querySelectorAll<HTMLElement>("[data-flip-key]").forEach((el) => {
      const key = el.dataset.flipKey;
      if (!key) return;
      const top = el.offsetTop;
      next.set(key, top);
      const before = prev.current.get(key);
      if (duration > 0 && before !== undefined && before !== top) {
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: "translateY(0)" }], {
          duration,
          easing: "cubic-bezier(0.2, 0, 0, 1)",
        });
      }
    });

    prev.current = next;
  });
}
