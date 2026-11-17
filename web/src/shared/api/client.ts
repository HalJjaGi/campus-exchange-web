import { syncFromDateHeader } from "@/shared/lib/serverClock";
import type { ApiErrorBody } from "@/shared/types/api";
import { ApiError } from "./errors";

const BASE = import.meta.env.VITE_API_BASE ?? "";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** 주문·입찰·가입·게임 결과 제출에만 */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: "include", // HttpOnly 쿠키 세션 (계획 §6)
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, { code: "NETWORK" });
  }

  syncFromDateHeader(res.headers.get("Date"));

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const json: unknown = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const body = isErrorBody(json) ? json : { code: res.status === 401 ? "UNAUTHORIZED" : `HTTP_${res.status}` };
    throw new ApiError(res.status, body);
  }
  return json as T;
}

function isErrorBody(v: unknown): v is ApiErrorBody {
  return typeof v === "object" && v !== null && typeof (v as { code?: unknown }).code === "string";
}
