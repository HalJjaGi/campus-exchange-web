import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { ApiError } from "@/shared/api/errors";
import { sessionKey } from "@/shared/api/queryKeys";
import type { SessionUser } from "@/shared/types/api";

/**
 * 로그인 상태. 401이면 null(로그아웃 상태)로 본다.
 * 다른 요청이 401을 받으면 App의 QueryCache가 이 값을 null로 바꿔 로그인 화면으로 보낸다.
 */
export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: async ({ signal }) => {
      try {
        return await api<SessionUser>("/api/auth/me", { signal });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: Infinity,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<SessionUser>("/api/auth/login", { method: "POST", body }),
    onSuccess: (user) => qc.setQueryData(sessionKey, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/api/auth/logout", { method: "POST" }),
    // 실패해도 화면에서는 로그아웃 상태로 둔다. 남은 사용자 데이터는 버린다.
    // qc.clear()는 쓰지 않는다 — 세션 쿼리까지 지우면 RequireAuth가 보고 있던 쿼리가 사라져 null 변경을 못 받는다
    onSettled: () => {
      qc.setQueryData(sessionKey, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== sessionKey[0] });
    },
  });
}
