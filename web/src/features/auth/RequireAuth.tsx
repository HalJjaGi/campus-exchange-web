import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ErrorBlock } from "@/shared/ui/States";
import { useSession } from "./session";
import s from "./auth.module.css";

/** 로그인이 필요한 화면. 로그아웃 상태면 지금 주소를 기억하고 로그인으로 보낸다 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) return <div className={s.gate} role="status" aria-label="로그인 상태 확인 중" />;
  if (session.isError) {
    return (
      <div className={s.gate}>
        <ErrorBlock
          message="서버에 연결하지 못했어요."
          onRetry={() => void session.refetch()}
          retrying={session.isFetching}
        />
      </div>
    );
  }
  if (!session.data) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}
