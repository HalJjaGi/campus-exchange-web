import { useEffect, useRef, useState } from "react";
import { cx } from "@/shared/lib/cx";
import { toDecimal, type DecimalString } from "@/shared/lib/decimal";
import {
  describeChangeRate,
  directionOf,
  formatChangeRate,
  formatPoints,
  formatPrice,
  formatSignedPoints,
  formatTime,
} from "@/shared/lib/format";
import { useRealtimeStatus } from "@/shared/realtime/RealtimeProvider";
import s from "./Numbers.module.css";

/**
 * 값이 바뀌면 직전 값 대비 방향으로 배경을 잠깐 깜빡인다.
 * 연속 변경 시 애니메이션을 처음부터 다시 재생하려고 a/b 두 키프레임을 번갈아 쓴다.
 */
function useFlash(value: DecimalString) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<{ dir: "up" | "down"; n: number } | null>(null);

  useEffect(() => {
    if (prev.current === value) return;
    const dir = toDecimal(value).gt(prev.current) ? "up" : "down";
    prev.current = value;
    setFlash((f) => ({ dir, n: (f?.n ?? 0) + 1 }));
  }, [value]);

  if (!flash) return undefined;
  return cx(flash.dir === "up" ? s.flashUp : s.flashDown, flash.n % 2 ? s.flashA : s.flashB);
}

interface PriceTextProps {
  value: DecimalString;
  /** 색을 정하는 기준(전일 종가). 없으면 중립색 */
  reference?: DecimalString;
  flash?: boolean;
  className?: string;
}

/** 가격. 색은 기준가 대비 등락, 깜빡임은 직전 값 대비 변동 */
export function PriceText({ value, reference, flash = true, className }: PriceTextProps) {
  const flashClass = useFlash(value);
  const dir = reference ? directionOf(toDecimal(value).minus(reference)) : null;
  return (
    <span className={cx("num", s.value, dir && s[dir], flash && flashClass, className)}>{formatPrice(value)}</span>
  );
}

/** +3.21% — 스크린리더는 "상승 3.21퍼센트" */
export function ChangeRate({ ratio, className }: { ratio: DecimalString; className?: string }) {
  const dir = directionOf(ratio);
  return (
    <span className={cx("num", s[dir], className)}>
      <span aria-hidden>{formatChangeRate(ratio)}</span>
      <span className="visually-hidden">{describeChangeRate(ratio)}</span>
    </span>
  );
}

interface PointsProps {
  value: DecimalString;
  /** 변동 금액처럼 부호와 색이 필요한 경우 */
  signed?: boolean;
  /** 확정 값이 아닐 수 있음(조회 실패 후 직전 값 등) */
  stale?: boolean;
  className?: string;
}

export function Points({ value, signed, stale, className }: PointsProps) {
  const dir = signed ? directionOf(value) : null;
  return (
    <span className={cx("num", dir && s[dir], stale && s.stale, className)}>
      {signed ? formatSignedPoints(value) : formatPoints(value)}
    </span>
  );
}

/**
 * "14:03:27 기준". 실시간이 끊긴 동안에는 갱신이 늦을 수 있음을 함께 알린다.
 * live=false면 연결 상태와 무관한 값(일별 스냅샷 등)이다.
 */
export function AsOf({ at, live = true, className }: { at: string; live?: boolean; className?: string }) {
  const status = useRealtimeStatus();
  const lagging = live && status === "polling";
  return (
    <span className={cx(s.asOf, className)}>
      {lagging && <span className={s.lagDot} aria-hidden />}
      <time dateTime={at} className="num">
        {formatTime(at)}
      </time>{" "}
      기준
      {lagging && <span className="visually-hidden"> (실시간 연결 재시도 중)</span>}
    </span>
  );
}
