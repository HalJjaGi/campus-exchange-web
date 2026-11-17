import { useEffect, useState } from "react";

/**
 * 모션 토큰(--dur-*)을 ms로 읽는다. prefers-reduced-motion이면 토큰이 0ms라 0이 나온다.
 * JS 애니메이션도 CSS와 같은 시간·같은 축소 규칙을 따르게 하려는 것.
 */
export function durationMs(token: `--dur-${string}`): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return 0;
  return raw.endsWith("ms") ? n : n * 1000;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** 0 → target 숫자 카운트업. 정수로 올린다 */
export function useCountUp(target: number, token: `--dur-${string}` = "--dur-count"): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const duration = durationMs(token);
    if (duration <= 0) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * easeOut(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, token]);

  return value;
}
