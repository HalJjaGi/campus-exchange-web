import { useRealtimeStatus } from "@/shared/realtime/RealtimeProvider";
import s from "./ConnectionStatus.module.css";

/** 정상 연결이면 아무것도 보이지 않는다. 문제가 있을 때만 알린다 */
export function ConnectionStatus() {
  const status = useRealtimeStatus();
  if (status === "open" || status === "idle") return null;

  const text = status === "connecting" ? "실시간 연결 중" : "실시간 지연 · 5초 갱신";
  return (
    <span className={s.status} role="status">
      <span className={s.dot} aria-hidden />
      {text}
    </span>
  );
}
