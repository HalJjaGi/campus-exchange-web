import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useIdempotentMutation } from "./useIdempotentMutation";

function setup(fn: (vars: { q: number }, key: string) => Promise<string>) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return renderHook(() => useIdempotentMutation(fn), { wrapper });
}

it("같은 틱에 두 번 submit해도 요청은 한 번", async () => {
  const fn = vi.fn(() => new Promise<string>((r) => setTimeout(() => r("ok"), 10)));
  const { result } = setup(fn);
  act(() => {
    result.current.submit({ q: 1 });
    result.current.submit({ q: 1 });
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(fn).toHaveBeenCalledTimes(1);
});

it("실패 후 같은 입력으로 다시 보내면 같은 키, 성공 후에는 새 키", async () => {
  let fail = true;
  const keys: string[] = [];
  const fn = vi.fn(async (_v: { q: number }, key: string) => {
    keys.push(key);
    if (fail) throw new Error("network");
    return "ok";
  });
  const { result } = setup(fn);

  act(() => result.current.submit({ q: 1 }));
  await waitFor(() => expect(result.current.isError).toBe(true));
  fail = false;
  act(() => result.current.submit({ q: 1 }));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  act(() => result.current.submit({ q: 1 }));
  await waitFor(() => expect(fn).toHaveBeenCalledTimes(3));

  expect(keys[0]).toBe(keys[1]);
  expect(keys[2]).not.toBe(keys[1]);
});

it("입력이 바뀌면 새 키", async () => {
  const keys: string[] = [];
  const fn = vi.fn(async (_v: { q: number }, key: string) => {
    keys.push(key);
    throw new Error("x");
  });
  const { result } = setup(fn);
  act(() => result.current.submit({ q: 1 }));
  await waitFor(() => expect(result.current.isError).toBe(true));
  act(() => result.current.submit({ q: 2 }));
  await waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
  expect(keys[0]).not.toBe(keys[1]);
});
