import { useEffect, useState } from "react";

/**
 * 캔버스 차트는 CSS 변수를 직접 못 읽는다. 토큰 값을 꺼내 차트 옵션에 넘긴다.
 * 테마가 바뀌면 useThemeVersion으로 다시 읽는다.
 */
export function readTokens<K extends string>(names: Record<K, `--${string}`>): Record<K, string> {
  const cs = getComputedStyle(document.documentElement);
  const out = {} as Record<K, string>;
  for (const key of Object.keys(names) as K[]) out[key] = cs.getPropertyValue(names[key]).trim();
  return out;
}

/** OS 다크 모드나 data-theme이 바뀔 때마다 1씩 오른다. 처음은 0 */
export function useThemeVersion() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const bump = () => setN((x) => x + 1);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", bump);
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", bump);
      mo.disconnect();
    };
  }, []);
  return n;
}
