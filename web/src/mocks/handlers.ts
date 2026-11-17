import { http, HttpResponse, delay } from "msw";
import type {
  CandleInterval,
  CreatePostRequest,
  FeedSort,
  HistoryRange,
  LedgerTxType,
  PlaceOrderRequest,
  ReportRequest,
  SignupRequest,
  StockCategory,
  UpdateProfileRequest,
} from "@/shared/types/api";
import * as auth from "./auth";
import * as community from "./community";
import { listLedger } from "./ledger";
import { getAssetHistory } from "./portfolio";
import * as notifications from "./notifications";
import {
  MockError,
  cancelOrder,
  getCandles,
  getDisclosureDetail,
  getDisclosures,
  getHoldings,
  getIndex,
  getOpenOrders,
  getOrderbook,
  getQuote,
  getRanking,
  getTrades,
  getTradingAccount,
  getWallet,
  placeOrder,
  policy,
} from "./market";

const CATEGORIES: StockCategory[] = ["DEPT", "SCHEDULE", "MEME"];
const INTERVALS: CandleInterval[] = ["1m", "5m", "1d"];

/** 실제 네트워크처럼 약간 늦게 응답해 로딩 상태가 보이게 한다 */
const LATENCY = 200;

/** MockError → { code } 응답. 백엔드 에러 형식(계획 §6)과 같게 */
async function respond<T>(fn: () => T, status = 200) {
  await delay(LATENCY);
  try {
    return HttpResponse.json(fn() as object, { status });
  } catch (e) {
    if (e instanceof MockError) return HttpResponse.json({ code: e.code, detail: e.detail }, { status: e.status });
    throw e;
  }
}

const RANGES: HistoryRange[] = ["7d", "30d", "90d"];
const TX_TYPES: LedgerTxType[] = [
  "TRADE",
  "FEE",
  "BURN",
  "INTEREST",
  "DIVIDEND",
  "REWARD",
  "AIRDROP",
  "BID",
  "BORROW_FEE",
];

/**
 * 부분 실패 확인용(UC-14 예외 흐름). 주소에 ?fail=wallet,holdings 처럼 붙이면 그 영역 요청만 500으로 답한다.
 * 영역: profile, wallet, holdings, history, ledger. 주소에서 지우고 "다시 시도"를 누르면 복구된다.
 */
function failing(area: string) {
  return (new URLSearchParams(location.search).get("fail") ?? "").split(",").includes(area);
}

async function respondUnlessFailing<T>(area: string, fn: () => T) {
  if (failing(area)) {
    await delay(LATENCY);
    return HttpResponse.json({ code: "INTERNAL" }, { status: 500 });
  }
  return respond(fn);
}

const param = (v: string | readonly string[] | undefined) => (typeof v === "string" ? v : "");

export const handlers = [
  /* ── 인증 ── */
  http.get("/api/auth/me", () => respond(auth.me)),
  http.post("/api/auth/login", async ({ request }) => {
    const b = (await request.json()) as { email: string; password: string };
    return respond(() => auth.login(b.email, b.password));
  }),
  http.post("/api/auth/logout", async () => {
    await delay(LATENCY);
    auth.logout();
    return new HttpResponse(null, { status: 204 });
  }),
  http.post("/api/auth/email/send", async ({ request }) => {
    const b = (await request.json()) as { email: string };
    return respond(() => auth.sendCode(b.email));
  }),
  http.post("/api/auth/email/verify", async ({ request }) => {
    const b = (await request.json()) as { email: string; code: string };
    return respond(() => auth.verifyCode(b.email, b.code));
  }),
  http.get("/api/auth/nickname/check", ({ request }) => {
    const n = new URL(request.url).searchParams.get("nickname") ?? "";
    return respond(() => ({ available: auth.isNicknameAvailable(n) }));
  }),
  http.post("/api/auth/signup", async ({ request }) => {
    const body = (await request.json()) as SignupRequest;
    return respond(() => auth.signup(body, request.headers.get("Idempotency-Key")), 201);
  }),
  http.get("/api/titles", () => respond(() => auth.titles)),

  /* ── 커뮤니티 ── */
  http.get("/api/stocks/:code/feed", ({ params, request }) => {
    const url = new URL(request.url);
    const sort: FeedSort = url.searchParams.get("sort") === "popular" ? "popular" : "latest";
    return respond(() => community.getFeed(param(params.code), sort, url.searchParams.get("cursor")));
  }),
  http.post("/api/posts", async ({ request }) => {
    const body = (await request.json()) as CreatePostRequest;
    return respond(() => community.createPost(body), 201);
  }),
  http.get("/api/posts/:id", ({ params }) => respond(() => community.getPost(param(params.id)))),
  http.get("/api/posts/:id/comments", ({ params }) => respond(() => community.getComments(param(params.id)))),
  http.post("/api/posts/:id/reactions", ({ params }) => respond(() => community.setReaction(param(params.id), true))),
  http.delete("/api/posts/:id/reactions", ({ params }) =>
    respond(() => community.setReaction(param(params.id), false)),
  ),
  http.post("/api/reports", async ({ request }) => {
    const body = (await request.json()) as ReportRequest;
    return respond(() => {
      community.report(body.targetId);
      return { ok: true };
    }, 201);
  }),
  http.get("/api/disclosures/:id", ({ params }) => respond(() => getDisclosureDetail(param(params.id)))),

  /* ── 알림 ── */
  http.get("/api/notifications", ({ request }) =>
    respond(() => notifications.listNotifications(new URL(request.url).searchParams.get("cursor"))),
  ),
  http.patch("/api/notifications/:id/read", ({ params }) =>
    respond(() => {
      notifications.readNotification(param(params.id));
      return { ok: true };
    }),
  ),
  http.post("/api/notifications/read-all", () =>
    respond(() => {
      notifications.readAllNotifications();
      return { ok: true };
    }),
  ),

  /* ── 시장 ── */
  http.get("/api/disclosures", ({ request }) => {
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 5);
    return respond(() => getDisclosures(limit));
  }),
  http.get("/api/policy/current", () => respond(() => policy)),
  http.get("/api/market/index", () => respond(getIndex)),

  http.get("/api/market/ranking", ({ request }) => {
    const c = new URL(request.url).searchParams.get("category");
    return respond(() => getRanking(CATEGORIES.find((x) => x === c)));
  }),

  http.get("/api/stocks/:code", ({ params }) => respond(() => getQuote(param(params.code)))),
  http.get("/api/stocks/:code/orderbook", ({ params }) => respond(() => getOrderbook(param(params.code)))),
  http.get("/api/stocks/:code/trades", ({ params }) => respond(() => getTrades(param(params.code)))),
  http.get("/api/stocks/:code/candles", ({ params, request }) => {
    const i = new URL(request.url).searchParams.get("interval");
    return respond(() => getCandles(param(params.code), INTERVALS.find((x) => x === i) ?? "1m"));
  }),

  http.get("/api/me/wallet", () => respondUnlessFailing("wallet", getWallet)),
  http.get("/api/me/holdings", () => respondUnlessFailing("holdings", getHoldings)),
  http.get("/api/me/profile", () => respondUnlessFailing("profile", auth.getProfile)),
  http.patch("/api/me/profile", async ({ request }) => {
    const b = (await request.json()) as UpdateProfileRequest;
    return respond(() => auth.updateNickname(b.nickname));
  }),
  http.get("/api/me/asset-history", ({ request }) => {
    const r = new URL(request.url).searchParams.get("range");
    return respondUnlessFailing("history", () => getAssetHistory(RANGES.find((x) => x === r) ?? "30d"));
  }),
  http.get("/api/me/ledger", ({ request }) => {
    const sp = new URL(request.url).searchParams;
    const types = (sp.get("types") ?? "").split(",").flatMap((x) => TX_TYPES.filter((t) => t === x));
    return respondUnlessFailing("ledger", () => listLedger(types, sp.get("from"), sp.get("cursor")));
  }),
  http.get("/api/me/trading-account", ({ request }) => {
    const code = new URL(request.url).searchParams.get("code") ?? "";
    return respond(() => getTradingAccount(code));
  }),

  http.get("/api/orders", ({ request }) => {
    const code = new URL(request.url).searchParams.get("code") ?? undefined;
    return respond(() => getOpenOrders(code));
  }),

  http.post("/api/orders", async ({ request }) => {
    const body = (await request.json()) as PlaceOrderRequest;
    const key = request.headers.get("Idempotency-Key");
    return respond(() => placeOrder(body, key), 201);
  }),

  http.delete("/api/orders/:id", async ({ params }) => {
    await delay(LATENCY);
    try {
      cancelOrder(param(params.id));
      return new HttpResponse(null, { status: 204 });
    } catch (e) {
      if (e instanceof MockError) return HttpResponse.json({ code: e.code, detail: e.detail }, { status: e.status });
      throw e;
    }
  }),
];
