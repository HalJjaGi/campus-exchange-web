import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { sessionKey } from "@/shared/api/queryKeys";
import type { MyProfile, SessionUser, UpdateProfileRequest } from "@/shared/types/api";

const profileKey = ["me", "profile"] as const;

/** 프로필(SCR-06 §2) */
export function useProfile() {
  return useQuery({
    queryKey: profileKey,
    queryFn: ({ signal }) => api<MyProfile>("/api/me/profile", { signal }),
    staleTime: 60_000,
  });
}

/** 닉네임 변경. 성공하면 상단 메뉴의 닉네임도 같이 바꾼다 */
export function useUpdateNickname(onSuccess: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileRequest) => api<MyProfile>("/api/me/profile", { method: "PATCH", body }),
    onSuccess: (profile) => {
      qc.setQueryData(profileKey, profile);
      qc.setQueryData<SessionUser | null>(sessionKey, (u) => (u ? { ...u, nickname: profile.nickname } : u));
      onSuccess();
    },
  });
}
