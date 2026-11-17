import { useMemo } from "react";
import type { DecimalString } from "@/shared/lib/decimal";
import { directionOf, type Direction } from "@/shared/lib/format";
import s from "./Sparkline.module.css";

interface SparklineProps {
  points: DecimalString[];
  /** 색 기준(전일 종가). 없으면 첫 점 대비 */
  reference?: DecimalString;
  width?: number;
  height?: number;
  label?: string;
}

/** 축·점 없는 1px 선. 점이 2개 미만이면 아무것도 그리지 않는다(값을 지어내지 않음) */
export function Sparkline({ points, reference, width = 80, height = 24, label }: SparklineProps) {
  const path = useMemo(() => {
    const nums = points.map(Number);
    if (nums.length < 2) return null;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const span = max - min || 1;
    const stepX = width / (nums.length - 1);
    const pad = 1;
    return nums
      .map((v, i) => {
        const x = i * stepX;
        const y = pad + (height - pad * 2) * (1 - (v - min) / span);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [points, width, height]);

  if (!path) return <span className={s.empty} style={{ width, height }} aria-hidden />;

  const first = points[0] ?? "0";
  const last = points[points.length - 1] ?? "0";
  const dir: Direction = directionOf(Number(last) - Number(reference ?? first));

  return (
    <svg
      className={s[dir]}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
