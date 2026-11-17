import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
import { ApiError } from "@/shared/api/errors";
import { useIdempotentMutation } from "@/shared/api/useIdempotentMutation";
import type {
  AuthErrorDetail,
  EmailSendResult,
  EmailVerifyResult,
  SignupRequest,
  SignupResult,
  Title,
} from "@/shared/types/api";
import { nicknameIssue } from "./rules";

export const useSendCode = () =>
  useMutation({
    mutationFn: (email: string) => api<EmailSendResult>("/api/auth/email/send", { method: "POST", body: { email } }),
  });

export const useVerifyCode = () =>
  useMutation({
    mutationFn: (body: { email: string; code: string }) =>
      api<EmailVerifyResult>("/api/auth/email/verify", { method: "POST", body }),
  });

/** 인증 오류의 detail(남은 시도 횟수·잠금 해제 시각) */
export const authDetailOf = (err: unknown): AuthErrorDetail =>
  err instanceof ApiError ? ((err.detail ?? {}) as AuthErrorDetail) : {};

/** 초기 칭호 목록(DB 관리). 하드코딩하지 않는다 */
export const useTitles = () =>
  useQuery({
    queryKey: ["titles"],
    queryFn: ({ signal }) => api<Title[]>("/api/titles", { signal }),
    staleTime: Infinity,
  });

export type NicknameCheck =
  | { state: "idle" }
  | { state: "invalid"; message: string }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken" }
  | { state: "error" };

const DEBOUNCE_MS = 300;

/** 닉네임 중복 즉시 검사(UC-01 §3). 입력이 멈추고 300ms 뒤에 한 번 묻는다 */
export function useNicknameCheck(nickname: string): NicknameCheck {
  const value = nickname.trim();
  const issue = nicknameIssue(value);
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value]);

  const enabled = !!value && !issue && debounced === value;
  const q = useQuery({
    queryKey: ["nickname-check", debounced],
    queryFn: ({ signal }) =>
      api<{ available: boolean }>(`/api/auth/nickname/check?nickname=${encodeURIComponent(debounced)}`, { signal }),
    enabled,
    staleTime: 10_000,
    retry: false,
  });

  if (!value) return { state: "idle" };
  if (issue) return { state: "invalid", message: issue };
  if (!enabled || q.isFetching) return { state: "checking" };
  if (q.isError) return { state: "error" };
  return q.data?.available ? { state: "available" } : { state: "taken" };
}

/** 가입 요청. 다중 클릭·재시도에도 초기 자산이 한 번만 지급되도록 멱등성 키를 쓴다(SD-01) */
export const useSignup = (onSuccess: (result: SignupResult) => void) =>
  useIdempotentMutation<SignupResult, SignupRequest>(
    (body, idempotencyKey) => api<SignupResult>("/api/auth/signup", { method: "POST", body, idempotencyKey }),
    { onSuccess },
  );
