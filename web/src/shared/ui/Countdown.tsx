import { useEffect, useRef, useState } from "react";
import { cx } from "@/shared/lib/cx";
import { formatRemaining } from "@/shared/lib/format";
import { msUntil } from "@/shared/lib/serverClock";
import s from "./Countdown.module.css";

const URGENT_MS = 30_000;

interface CountdownProps {
  /** 서버가 준 마감 시각. 로컬 타이머가 아니라 서버 시각 기준으로 계산한다 */
  until: string;
  onExpire?: () => void;
  className?: string;
}

export function Countdown({ until, onExpire, className }: CountdownProps) {
  const [remaining, setRemaining] = useState(() => msUntil(until));

  useEffect(() => {
    setRemaining(msUntil(until));
    const t = setInterval(() => {
      const ms = msUntil(until);
      setRemaining(ms);
      if (ms <= 0) clearInterval(t);
    }, 250);
    return () => clearInterval(t);
  }, [until]);

  const expired = remaining <= 0;
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (expired) onExpireRef.current?.();
  }, [expired]);

  return (
    <time
      className={cx(
        "num",
        s.countdown,
        !expired && remaining <= URGENT_MS && s.urgent,
        expired && s.expired,
        className,
      )}
      aria-label={expired ? "만료됨" : `남은 시간 ${formatRemaining(remaining)}`}
    >
      {formatRemaining(remaining)}
    </time>
  );
}
