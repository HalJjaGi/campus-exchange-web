import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { useRef } from "react";

/**
 * 멱등성 키를 관리하는 mutation.
 * - 입력값(variables)이 같으면 같은 키를 다시 쓴다 → 네트워크 재시도·더블 클릭이 서버에서 한 건으로 처리됨
 * - 입력값이 바뀌거나 요청이 성공하면 다음 제출에 새 키를 만든다
 * - 진행 중에는 submit을 다시 호출해도 무시한다(UI 단 중복 방지)
 */
export function useIdempotentMutation<TData, TVars>(
  fn: (vars: TVars, idempotencyKey: string) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, Error, TVars>, "mutationFn">,
) {
  const keyRef = useRef<{ key: string; fingerprint: string } | null>(null);
  // isPending은 다음 렌더에야 true가 된다. 같은 틱의 두 번째 클릭(더블 클릭)을 막으려면 동기 플래그가 필요하다
  const inFlight = useRef(false);

  const mutation = useMutation<TData, Error, TVars>({
    ...options,
    mutationFn: (vars) => {
      const fingerprint = JSON.stringify(vars);
      if (!keyRef.current || keyRef.current.fingerprint !== fingerprint) {
        keyRef.current = { key: crypto.randomUUID(), fingerprint };
      }
      return fn(vars, keyRef.current.key);
    },
    onSuccess: (...args) => {
      keyRef.current = null;
      return options?.onSuccess?.(...args);
    },
    onSettled: (...args) => {
      inFlight.current = false;
      return options?.onSettled?.(...args);
    },
  });

  const submit = (vars: TVars) => {
    if (inFlight.current) return;
    inFlight.current = true;
    mutation.mutate(vars);
  };

  return { ...mutation, submit };
}
