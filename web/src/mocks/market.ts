/**
 * 개발용 가짜 시장. 백엔드 매칭 엔진을 재현하지 않는다 — 화면이 실시간 갱신·주문·체결·취소를
 * 제대로 처리하는지 확인할 만큼만 움직인다. 프로덕션 번들에는 포함되지 않는다.
 *
 * 단순화한 점
 * - 호가는 현재가 주변에 매번 다시 만든다(잔량만 조금씩 유지·변동)
 * - 내 지정가 주문은 가격이 닿으면 일부 또는 전부 체결된 것으로 처리한다
 * - 데모 계정은 컴퓨터공학과 30주를 보유한 상태로 시작한다(이력은 ledger.ts). 새로 가입한 계정은 빈 계좌
 */
import Decimal from "decimal.js-light";
import { emit } from "./bus";
import { balanceOf, interestToday, record } from "./ledger";
import { MockError } from "./errors";
import { addNotification } from "./notifications";
import type {
  Candle,
  Disclosure,
  DisclosureDetail,
  CandleInterval,
  HoldingsSnapshot,
  CandleSeries,
  CentralBankPolicy,
  ChartEvent,
  MarketIndex,
  OpenOrder,
  OrderResult,
  OrderSide,
  OrderStatus,
  OrderUpdate,
  OrderbookLevel,
  OrderbookSnapshot,
  PlaceOrderRequest,
  RankingSnapshot,
  StockCategory,
  StockQuote,
  TradeBatch,
  TradeTick,
  TradingAccount,
  WalletSummary,
} from "@/shared/types/api";

/* ───────── 정책 ───────── */

export const policy: CentralBankPolicy = {
  baseRate: "0.035",
  depositRate: "0.02",
  lpEnabled: true,
  feeRate: "0.001",
  borrowFeeRate: "0.0005",
  marginRequirement: "1.2",
  tickRules: [
    { upTo: "1000", tick: "1" },
    { upTo: "5000", tick: "5" },
    { upTo: null, tick: "10" },
  ],
  quantityLimits: { min: 1, max: 10000 },
  updatedAt: new Date().toISOString(),
};

const FEE = new Decimal(policy.feeRate);
const tickOf = (p: number) => (p < 1000 ? 1 : p < 5000 ? 5 : 10);
const floorTick = (p: number) => Math.floor(p / tickOf(p)) * tickOf(p);

/* ───────── 종목 ───────── */

interface Seed {
  code: string;
  name: string;
  category: StockCategory;
  prevClose: number;
}

const SEEDS: Seed[] = [
  { code: "CSE", name: "컴퓨터공학과", category: "DEPT", prevClose: 12350 },
  { code: "BIZ", name: "경영학과", category: "DEPT", prevClose: 9870 },
  { code: "MECH", name: "기계공학과", category: "DEPT", prevClose: 8420 },
  { code: "DSGN", name: "디자인학부", category: "DEPT", prevClose: 6150 },
  { code: "NURS", name: "간호학과", category: "DEPT", prevClose: 10900 },
  { code: "MID", name: "중간고사 테마", category: "SCHEDULE", prevClose: 4300 },
  { code: "FEST", name: "대동제 테마", category: "SCHEDULE", prevClose: 7760 },
  { code: "REG", name: "수강신청 테마", category: "SCHEDULE", prevClose: 5520 },
  { code: "BAP", name: "학식 코인", category: "MEME", prevClose: 1240 },
  { code: "CAT", name: "본관 고양이 코인", category: "MEME", prevClose: 870 },
  { code: "BUS", name: "셔틀버스 코인", category: "MEME", prevClose: 2015 },
];

const SPARK_LEN = 30;
const DEPTH = 10;
const TAPE_LEN = 50;

let version = 1;
const nextVersion = () => ++version;
const now = () => new Date().toISOString();
let seq = 0;
const id = (p: string) => `${p}-${Date.now().toString(36)}-${(++seq).toString(36)}`;

const quotes = new Map<string, StockQuote>(
  SEEDS.map((s) => [
    s.code,
    {
      code: s.code,
      name: s.name,
      category: s.category,
      price: String(s.prevClose),
      prevClose: String(s.prevClose),
      changeRate: "0",
      volume: 0,
      tradingState: "NORMAL",
      exDividendToday: s.code === "NURS",
      moveReason: null,
      sparkline: [String(s.prevClose)],
      version,
      updatedAt: now(),
    },
  ]),
);

const mustQuote = (code: string) => {
  const q = quotes.get(code);
  if (!q) throw new MockError(404, "STOCK_NOT_FOUND");
  return q;
};

export { MockError };

/* ───────── 지수 ───────── */

const INDEX_BASE = 1000;
let index: MarketIndex = { value: "1000.00", changeRate: "0", intraday: ["1000.00"], version, updatedAt: now() };

function recomputeIndex(at: string) {
  const avg = [...quotes.values()].reduce((sum, q) => sum + Number(q.price) / Number(q.prevClose), 0) / quotes.size;
  const value = new Decimal(INDEX_BASE).times(avg).toDecimalPlaces(2);
  index = {
    value: value.toFixed(2),
    changeRate: value.minus(INDEX_BASE).dividedBy(INDEX_BASE).toDecimalPlaces(4).toString(),
    intraday: [...index.intraday, value.toFixed(2)].slice(-120),
    version: nextVersion(),
    updatedAt: at,
  };
}

/* ───────── 내 계좌 ───────── */

interface Account {
  available: Decimal;
  reserved: Decimal;
  holdings: Map<string, { qty: number; avg: Decimal }>;
  orders: Map<string, MyOrder>;
}

const newAccount = (available: Decimal): Account => ({
  available,
  reserved: new Decimal(0),
  holdings: new Map(),
  orders: new Map(),
});
const accounts = new Map<string, Account>();
/** 로그인 전에도 시세가 돌 수 있게 빈 계좌를 하나 열어 둔다 */
let account: Account = newAccount(new Decimal(0));

/**
 * 계정 계좌를 연다(account.ts가 로그인할 때 부른다). 장부(openBook)를 먼저 열어야 한다 —
 * 처음 여는 계좌의 예수금은 그 장부의 지갑 잔액에서 시작한다.
 */
export function openTradingAccount(key: string, holdings: Array<{ code: string; quantity: number; price: string }>) {
  const existing = accounts.get(key);
  if (existing) {
    account = existing;
    return;
  }
  account = newAccount(balanceOf("WALLET"));
  for (const h of holdings) account.holdings.set(h.code, { qty: h.quantity, avg: new Decimal(h.price) });
  accounts.set(key, account);
}

interface MyOrder {
  orderId: string;
  code: string;
  side: OrderSide;
  kind: "LIMIT";
  price: Decimal;
  quantity: number;
  filled: number;
  status: OrderStatus;
  createdAt: string;
  /** 매수 지정가 잔량에 묶인 예수금(수수료 포함) */
  reservedCash: Decimal;
}

const idempotency = new Map<string, OrderResult>();

const lockedSellQty = (code: string) =>
  [...account.orders.values()]
    .filter((o) => o.code === code && o.side === "SELL" && isOpen(o))
    .reduce((n, o) => n + (o.quantity - o.filled), 0);

const isOpen = (o: MyOrder) => o.status === "NEW" || o.status === "PARTIALLY_FILLED";

function applyBuyFill(code: string, price: Decimal, qty: number) {
  const h = account.holdings.get(code) ?? { qty: 0, avg: new Decimal(0) };
  const total = h.avg.times(h.qty).plus(price.times(qty));
  h.qty += qty;
  h.avg = total.dividedBy(h.qty).toDecimalPlaces(2);
  account.holdings.set(code, h);
}

/** 체결 1건 = 원장 2줄(매매 금액, 수수료) */
function recordFill(
  tradeId: string,
  code: string,
  side: OrderSide,
  price: number,
  qty: number,
  fee: Decimal,
  at: string,
) {
  const trade = { tradeId, code, name: mustQuote(code).name, side, quantity: qty, price: String(price) };
  const gross = new Decimal(price).times(qty);
  record("WALLET", "TRADE", side === "BUY" ? gross.negated() : gross, trade, at);
  record("WALLET", "FEE", fee.negated(), trade, at);
}

function applySellFill(code: string, qty: number) {
  const h = account.holdings.get(code);
  if (!h) return;
  h.qty -= qty;
  if (h.qty <= 0) account.holdings.delete(code);
}

/* ───────── 호가 ───────── */

/** 가격별 잔량을 기억해 매번 완전히 새 숫자가 나오지 않게 한다 */
const bookQty = new Map<string, Map<number, number>>();

function levelQty(code: string, price: number, distance: number): number {
  let m = bookQty.get(code);
  if (!m) {
    m = new Map();
    bookQty.set(code, m);
  }
  let q = m.get(price);
  if (q === undefined) {
    q = Math.round((20 + Math.random() * 180) * (1 + distance * 0.15));
    m.set(price, q);
  }
  return q;
}

function consumeLevel(code: string, price: number, qty: number) {
  const m = bookQty.get(code);
  const left = (m?.get(price) ?? 0) - qty;
  m?.set(price, Math.max(0, left));
}

function jitterBook(code: string) {
  const m = bookQty.get(code);
  if (!m) return;
  for (const [p, q] of m) {
    if (Math.random() < 0.3) m.set(p, Math.max(0, q + Math.round((Math.random() - 0.45) * 30)));
  }
}

function myRestingQty(code: string, side: OrderSide, price: number): number {
  return [...account.orders.values()]
    .filter((o) => o.code === code && o.side === side && isOpen(o) && o.price.toNumber() === price)
    .reduce((n, o) => n + (o.quantity - o.filled), 0);
}

function buildLevels(code: string, side: OrderSide): OrderbookLevel[] {
  const price = Number(mustQuote(code).price);
  const tick = tickOf(price);
  const bestBid = floorTick(price);
  const levels: OrderbookLevel[] = [];
  for (let i = 0; i < DEPTH; i++) {
    const p = side === "SELL" ? bestBid + tick * (i + 1) : bestBid - tick * i;
    if (p <= 0) break;
    const base = levelQty(code, p, i);
    // LP는 최우선에서 먼 구간의 빈 자리를 채운다
    const lp = policy.lpEnabled && base < 40 && i >= 5 ? 60 : 0;
    const mine = myRestingQty(code, side === "SELL" ? "SELL" : "BUY", p);
    const quantity = base + lp + mine;
    if (quantity > 0) levels.push({ price: String(p), quantity, lpQuantity: lp });
  }
  return levels;
}

export function getOrderbook(code: string): OrderbookSnapshot {
  mustQuote(code);
  return { code, asks: buildLevels(code, "SELL"), bids: buildLevels(code, "BUY"), version, updatedAt: now() };
}

/* ───────── 체결 테이프 ───────── */

const tapes = new Map<string, TradeTick[]>();

function recordTrade(code: string, price: number, quantity: number, side: OrderSide, at: string): TradeTick {
  const t: TradeTick = { id: id("t"), price: String(price), quantity, side, at };
  tapes.set(code, [t, ...(tapes.get(code) ?? [])].slice(0, TAPE_LEN));
  const q = mustQuote(code);
  q.volume += quantity;
  updateCandles(code, price, quantity, at);
  return t;
}

export function getTrades(code: string): TradeBatch {
  mustQuote(code);
  return { code, items: tapes.get(code) ?? [], version };
}

/* ───────── 캔들 ───────── */

const INTERVAL_MS: Record<CandleInterval, number> = { "1m": 60_000, "5m": 300_000, "1d": 86_400_000 };
const HISTORY: Record<CandleInterval, number> = { "1m": 120, "5m": 120, "1d": 60 };
const candles = new Map<string, Candle[]>();

const bucketOf = (ms: number, interval: CandleInterval) => {
  if (interval !== "1d") return Math.floor(ms / INTERVAL_MS[interval]) * INTERVAL_MS[interval];
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** 현재가에서 거꾸로 걸어가며 과거 봉을 만든다(개발용 표시 데이터) */
function generateHistory(code: string, interval: CandleInterval): Candle[] {
  const end = Number(mustQuote(code).price);
  const n = HISTORY[interval];
  const step = INTERVAL_MS[interval];
  const vol = interval === "1d" ? 0.025 : interval === "5m" ? 0.006 : 0.003;
  const last = bucketOf(Date.now(), interval);
  const out: Candle[] = [];
  let close = end;
  for (let i = 0; i < n; i++) {
    const open = Math.max(1, floorTick(close * (1 + (Math.random() - 0.5) * vol * 2)));
    const high = Math.max(open, close) + tickOf(close) * Math.round(Math.random() * 3);
    const low = Math.max(1, Math.min(open, close) - tickOf(close) * Math.round(Math.random() * 3));
    out.push({
      t: new Date(last - i * step).toISOString(),
      o: String(open),
      h: String(high),
      l: String(low),
      c: String(close),
      v: Math.round(200 + Math.random() * 1500),
    });
    close = open;
  }
  return out.reverse();
}

function getCandleList(code: string, interval: CandleInterval): Candle[] {
  const key = `${code}:${interval}`;
  let list = candles.get(key);
  if (!list) {
    list = generateHistory(code, interval);
    candles.set(key, list);
  }
  return list;
}

function updateCandles(code: string, price: number, qty: number, at: string) {
  for (const interval of Object.keys(INTERVAL_MS) as CandleInterval[]) {
    const list = candles.get(`${code}:${interval}`);
    if (!list) continue;
    const b = new Date(bucketOf(Date.parse(at), interval)).toISOString();
    const last = list[list.length - 1];
    if (last && last.t === b) {
      last.h = String(Math.max(Number(last.h), price));
      last.l = String(Math.min(Number(last.l), price));
      last.c = String(price);
      last.v += qty;
    } else {
      list.push({ t: b, o: String(price), h: String(price), l: String(price), c: String(price), v: qty });
    }
  }
}

function chartEvents(code: string): ChartEvent[] {
  const name = mustQuote(code).name;
  const t = Date.now();
  return [
    {
      id: `ev-monetary`,
      at: new Date(bucketOf(t - 95 * 60_000, "1m")).toISOString(),
      type: "MONETARY",
      title: "기준금리 동결",
      summary: "중앙은행이 기준금리를 연 3.50%로 유지했어요.",
    },
    {
      id: `ev-${code}`,
      at: new Date(bucketOf(t - 35 * 60_000, "1m")).toISOString(),
      type: "EVENT",
      title: `${name} 이벤트 공지`,
      summary: `${name} 관련 교내 행사 일정이 발표됐어요.`,
    },
  ];
}

export function getCandles(code: string, interval: CandleInterval): CandleSeries {
  return { code, interval, candles: getCandleList(code, interval), events: chartEvents(code) };
}

/* ───────── 주문 ───────── */

function notifyOrder(o: MyOrder, lastFillQuantity: number, lastFillPrice: Decimal | null) {
  const u: OrderUpdate = {
    orderId: o.orderId,
    code: o.code,
    name: mustQuote(o.code).name,
    status: o.status,
    filledQuantity: o.filled,
    lastFillQuantity,
    lastFillPrice: lastFillPrice?.toString() ?? null,
  };
  emit("user.orders", u, nextVersion());
  if (lastFillQuantity > 0 && lastFillPrice) {
    addNotification({
      type: "ORDER_FILLED",
      title: `${u.name} ${lastFillQuantity}주 ${o.side === "BUY" ? "매수" : "매도"} 체결`,
      body: `체결가 ${lastFillPrice.toString()}`,
      link: { kind: "trade", code: o.code },
    });
  }
  emit("user.wallet", {}, nextVersion());
}

export function placeOrder(req: PlaceOrderRequest, idempotencyKey: string | null): OrderResult {
  if (!idempotencyKey) throw new MockError(400, "IDEMPOTENCY_KEY_REQUIRED");
  const prev = idempotency.get(idempotencyKey);
  if (prev) return prev;

  const q = mustQuote(req.code);
  if (q.tradingState !== "NORMAL") throw new MockError(409, "VI_ACTIVE");
  const { min, max } = policy.quantityLimits;
  if (!Number.isInteger(req.quantity) || req.quantity < min || req.quantity > max)
    throw new MockError(400, "INVALID_QUANTITY");

  let limit: Decimal | null = null;
  if (req.kind === "LIMIT") {
    if (!req.price) throw new MockError(400, "INVALID_TICK");
    limit = new Decimal(req.price);
    if (!limit.mod(tickOf(limit.toNumber())).isZero()) throw new MockError(400, "INVALID_TICK");
  }

  const opposite = req.side === "BUY" ? buildLevels(req.code, "SELL") : buildLevels(req.code, "BUY");
  const crosses = (p: number) => !limit || (req.side === "BUY" ? p <= limit.toNumber() : p >= limit.toNumber());

  // 체결 가능 수량 계산(서버의 예수금·수량 검증 흉내)
  let left = req.quantity;
  const fills: Array<{ price: number; qty: number }> = [];
  for (const lv of opposite) {
    const p = Number(lv.price);
    if (left <= 0 || !crosses(p)) break;
    const take = Math.min(left, lv.quantity - myRestingQty(req.code, req.side === "BUY" ? "SELL" : "BUY", p));
    if (take <= 0) continue;
    fills.push({ price: p, qty: take });
    left -= take;
  }

  // 수수료는 체결 건마다 매긴다(원장에 체결 ID별로 남는다)
  const feeOf = (f: { price: number; qty: number }) => new Decimal(f.price).times(f.qty).times(FEE).toDecimalPlaces(2);
  const fillGross = fills.reduce((s, f) => s.plus(new Decimal(f.price).times(f.qty)), new Decimal(0));
  const fillFee = fills.reduce((s, f) => s.plus(feeOf(f)), new Decimal(0));
  const restQty = req.kind === "LIMIT" ? left : 0;
  const restCash =
    limit && req.side === "BUY" ? limit.times(restQty).times(FEE.plus(1)).toDecimalPlaces(2) : new Decimal(0);

  if (req.side === "BUY" && fillGross.plus(fillFee).plus(restCash).gt(account.available))
    throw new MockError(400, "INSUFFICIENT_FUNDS");
  if (req.side === "SELL") {
    const sellable = (account.holdings.get(req.code)?.qty ?? 0) - lockedSellQty(req.code);
    if (req.quantity > sellable) throw new MockError(400, "INSUFFICIENT_QUANTITY");
  }

  const at = now();
  for (const f of fills) {
    consumeLevel(req.code, f.price, f.qty);
    const tick = recordTrade(req.code, f.price, f.qty, req.side, at);
    emitTrades(req.code, [tick]);
    if (req.side === "BUY") applyBuyFill(req.code, new Decimal(f.price), f.qty);
    else applySellFill(req.code, f.qty);
    recordFill(tick.id, req.code, req.side, f.price, f.qty, feeOf(f), at);
  }
  if (req.side === "BUY") account.available = account.available.minus(fillGross).minus(fillFee).minus(restCash);
  else account.available = account.available.plus(fillGross).minus(fillFee);
  account.reserved = account.reserved.plus(restCash);

  const filled = req.quantity - left;
  const status: OrderStatus =
    filled === req.quantity
      ? "FILLED"
      : req.kind === "MARKET"
        ? filled > 0
          ? "FILLED"
          : "CANCELED"
        : filled > 0
          ? "PARTIALLY_FILLED"
          : "NEW";

  const orderId = id("o");
  if (restQty > 0 && limit) {
    account.orders.set(orderId, {
      orderId,
      code: req.code,
      side: req.side,
      kind: "LIMIT",
      price: limit,
      quantity: req.quantity,
      filled,
      status,
      createdAt: at,
      reservedCash: restCash,
    });
  }

  const result: OrderResult = {
    orderId,
    status,
    quantity: req.quantity,
    filledQuantity: filled,
    remainingQuantity: restQty,
    avgFillPrice: filled > 0 ? fillGross.dividedBy(filled).toDecimalPlaces(2).toString() : null,
    fee: fillFee.toString(),
  };
  idempotency.set(idempotencyKey, result);
  emit("user.wallet", {}, nextVersion());
  emitBook(req.code);
  return result;
}

export function cancelOrder(orderId: string): void {
  const o = account.orders.get(orderId);
  if (!o) throw new MockError(404, "ORDER_NOT_FOUND");
  if (!isOpen(o)) throw new MockError(409, "ORDER_NOT_CANCELABLE");
  o.status = "CANCELED";
  account.available = account.available.plus(o.reservedCash);
  account.reserved = account.reserved.minus(o.reservedCash);
  o.reservedCash = new Decimal(0);
  notifyOrder(o, 0, null);
  emitBook(o.code);
}

export function getOpenOrders(code?: string): OpenOrder[] {
  return [...account.orders.values()]
    .filter((o) => isOpen(o) && (!code || o.code === code))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((o) => ({
      orderId: o.orderId,
      code: o.code,
      name: mustQuote(o.code).name,
      side: o.side,
      kind: o.kind,
      price: o.price.toString(),
      quantity: o.quantity,
      filledQuantity: o.filled,
      status: o.status as OpenOrder["status"],
      createdAt: o.createdAt,
    }));
}

/** 가격이 내 지정가에 닿으면 다른 참여자가 받아 준 것으로 보고 체결한다 */
function fillRestingOrders(code: string, at: string) {
  const price = Number(mustQuote(code).price);
  const bestBid = floorTick(price);
  const bestAsk = bestBid + tickOf(price);
  for (const o of account.orders.values()) {
    if (o.code !== code || !isOpen(o)) continue;
    const p = o.price.toNumber();
    const reachable = o.side === "BUY" ? p >= bestAsk : p <= bestBid;
    if (!reachable || Math.random() > 0.5) continue;

    const rem = o.quantity - o.filled;
    const qty = Math.max(1, Math.min(rem, Math.ceil(rem * (0.4 + Math.random() * 0.6))));
    const gross = o.price.times(qty);
    const fee = gross.times(FEE).toDecimalPlaces(2);
    if (o.side === "BUY") {
      const release = gross.plus(fee);
      o.reservedCash = o.reservedCash.minus(release);
      account.reserved = account.reserved.minus(release);
      applyBuyFill(code, o.price, qty);
    } else {
      applySellFill(code, qty);
      account.available = account.available.plus(gross).minus(fee);
    }
    o.filled += qty;
    o.status = o.filled === o.quantity ? "FILLED" : "PARTIALLY_FILLED";
    if (o.status === "FILLED" && o.reservedCash.gt(0)) {
      account.available = account.available.plus(o.reservedCash);
      account.reserved = account.reserved.minus(o.reservedCash);
      o.reservedCash = new Decimal(0);
    }
    const tick = recordTrade(code, p, qty, o.side === "BUY" ? "SELL" : "BUY", at);
    emitTrades(code, [tick]);
    recordFill(tick.id, code, o.side, p, qty, fee, at);
    notifyOrder(o, qty, o.price);
  }
}

export function getTradingAccount(code: string): TradingAccount {
  mustQuote(code);
  const h = account.holdings.get(code);
  return {
    code,
    available: account.available.toString(),
    reserved: account.reserved.toString(),
    sellableQuantity: (h?.qty ?? 0) - lockedSellQty(code),
    holdingQuantity: h?.qty ?? 0,
    avgPrice: h ? h.avg.toString() : null,
    updatedAt: now(),
  };
}

export function getWallet(): WalletSummary {
  let pnl = new Decimal(0);
  for (const [code, h] of account.holdings) {
    pnl = pnl.plus(new Decimal(mustQuote(code).price).minus(h.avg).times(h.qty));
  }
  return {
    available: account.available.toString(),
    reserved: account.reserved.toString(),
    bankBalance: balanceOf("BANK").toString(),
    unrealizedPnl: pnl.toDecimalPlaces(2).toString(),
    interestToday: interestToday().toString(),
    updatedAt: now(),
  };
}

export function getHoldings(): HoldingsSnapshot {
  return {
    items: [...account.holdings].map(([code, h]) => {
      const q = mustQuote(code);
      return {
        code,
        name: q.name,
        quantity: h.qty,
        avgPrice: h.avg.toString(),
        price: q.price,
        prevClose: q.prevClose,
        quoteVersion: q.version,
        quoteUpdatedAt: q.updatedAt,
      };
    }),
    updatedAt: now(),
  };
}

/** 총 평가 자산(지갑 + 예금 + 주식). 일별 스냅샷 mock이 기준값으로 쓴다 */
export function totalAsset(): Decimal {
  const stock = [...account.holdings].reduce(
    (s, [code, h]) => s.plus(new Decimal(mustQuote(code).price).times(h.qty)),
    new Decimal(0),
  );
  return account.available.plus(account.reserved).plus(balanceOf("BANK")).plus(stock);
}

/* ───────── 공시 ───────── */

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const disclosures: Disclosure[] = [
  {
    id: "d-3",
    type: "DIVIDEND",
    title: "간호학과 주당 50P 배당",
    summary: "오늘이 배당락일이에요. 어제까지 보유한 수량 기준으로 내일 지급돼요.",
    stockCodes: ["NURS"],
    publishedAt: minutesAgo(25),
  },
  {
    id: "d-2",
    type: "MONETARY",
    title: "기준금리 연 3.50% 동결",
    summary: "중앙은행이 기준금리와 예수금 이자율을 그대로 유지했어요.",
    stockCodes: [],
    publishedAt: minutesAgo(95),
  },
  {
    id: "d-1",
    type: "EVENT",
    title: "대동제 라인업 발표",
    summary: "대동제 테마 관련 행사 일정이 공개됐어요.",
    stockCodes: ["FEST"],
    publishedAt: minutesAgo(180),
  },
];

const DISCLOSURE_POOL: Array<Omit<Disclosure, "id" | "publishedAt">> = [
  {
    type: "EVENT",
    title: "수강신청 서버 점검 공지",
    summary: "수강신청 테마 관련 일정이 바뀌었어요.",
    stockCodes: ["REG"],
  },
  {
    type: "BURN",
    title: "학식 코인 일부 소각",
    summary: "유통량 조절을 위해 발행 수량 일부를 소각했어요.",
    stockCodes: ["BAP"],
  },
  {
    type: "EVENT",
    title: "셔틀버스 증차 확정",
    summary: "다음 학기부터 셔틀버스 배차가 늘어나요.",
    stockCodes: ["BUS"],
  },
];

export const getDisclosures = (limit: number): Disclosure[] => disclosures.slice(0, limit);

export function getDisclosureDetail(disclosureId: string): DisclosureDetail {
  const d = disclosures.find((x) => x.id === disclosureId);
  if (!d) throw new MockError(404, "DISCLOSURE_NOT_FOUND");
  return {
    ...d,
    body: `${d.summary}

이 공시는 중앙은행·운영진이 발행했어요. 적용 시각 이후의 거래와 지급에 반영돼요.`,
    stocks: d.stockCodes.map((code) => ({ code, name: mustQuote(code).name })),
  };
}

export const disclosuresFor = (code: string): Disclosure[] => disclosures.filter((d) => d.stockCodes.includes(code));

function publishDisclosure() {
  const base = DISCLOSURE_POOL[Math.floor(Math.random() * DISCLOSURE_POOL.length)];
  if (!base) return;
  const d: Disclosure = { ...base, id: id("d"), publishedAt: now() };
  disclosures.unshift(d);
  emit("disclosures", d, undefined, d.id);
  // 대상 종목 채널에 공시 카드, 받는 사람에게 알림(UC-12 §3~5)
  for (const code of d.stockCodes)
    emit(`feed.${code}`, { type: "disclosure.created", disclosure: d }, undefined, `disc-${d.id}`);
  addNotification({
    type: "DISCLOSURE",
    title: d.title,
    body: d.summary,
    link: { kind: "disclosure", disclosureId: d.id },
  });
}

/** 가입 완료 모달의 한 줄 브리핑. 실제 데이터에서만 만든다 */
export function marketHeadline(): string {
  const top = getRanking().items[0];
  if (!top || Number(top.changeRate) <= 0) return "아직 크게 오른 종목은 없어요. 랭킹에서 흐름을 살펴보세요.";
  const pct = (Number(top.changeRate) * 100).toFixed(2);
  return `지금 가장 많이 오른 종목은 ${top.name}(+${pct}%)이에요.`;
}

/* ───────── 조회 ───────── */

export const getIndex = (): MarketIndex => index;

export function getQuote(code: string): StockQuote {
  return { ...mustQuote(code) };
}

export function getRanking(category?: StockCategory): RankingSnapshot {
  const items = [...quotes.values()]
    .filter((q) => !category || q.category === category)
    .sort((a, b) => Number(b.changeRate) - Number(a.changeRate));
  return { items, version, updatedAt: now() };
}

/* ───────── 시뮬레이션 루프 ───────── */

function emitBook(code: string) {
  const snap = { ...getOrderbook(code), version: nextVersion() };
  emit(`orderbook.${code}`, snap, snap.version);
}

function emitTrades(code: string, items: TradeTick[]) {
  const v = nextVersion();
  emit(`trades.${code}`, { code, items, version: v } satisfies TradeBatch, v);
}

function stepPrices() {
  const at = now();
  for (const q of quotes.values()) {
    if (Math.random() > 0.45) continue; // 매초 절반 정도만 체결
    const price = Number(q.price);
    const prev = Number(q.prevClose);
    const tick = tickOf(price);
    const drift = q.category === "MEME" ? 6 : 2;
    const move = Math.round((Math.random() - 0.5) * drift) * tick;
    // 가격대 경계(1,000·5,000)를 넘으면 호가 단위가 바뀐다. 새 가격대 단위로 맞춘다
    const next = floorTick(Math.max(tick, price + move));
    const rate = new Decimal(next).minus(prev).dividedBy(prev).toDecimalPlaces(4);

    q.price = String(next);
    q.changeRate = rate.toString();
    q.moveReason = rate.abs().gt(0.08) ? "PARTICIPANT_SURGE" : null;
    q.sparkline = [...q.sparkline, String(next)].slice(-SPARK_LEN);

    const trades: TradeTick[] = [];
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      trades.push(recordTrade(q.code, next, 1 + Math.floor(Math.random() * 40), move >= 0 ? "BUY" : "SELL", at));
    }
    q.version = nextVersion();
    q.updatedAt = at;
    emit(`quote.${q.code}`, { ...q }, q.version);
    emitTrades(q.code, trades);
    fillRestingOrders(q.code, at);
  }
  recomputeIndex(at);
  emit("index", index, index.version);
  emit("ranking", getRanking(), nextVersion());
}

let priceTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 시세는 1초, 호가는 400ms마다 움직인다.
 * ?stress=1 이면 호가를 50ms(초당 20회)로 보내 주문 입력이 끊기지 않는지 확인할 수 있다.
 * 앱을 열자마자(로그인 전에도) 시장이 돌게 하려고 mocks/browser.ts에서 한 번 시작하고,
 * 소켓이 연결되면 그때 이벤트 전달 함수만 바꿔 끼운다.
 */
const BOOK_INTERVAL_MS = new URLSearchParams(location.search).has("stress") ? 50 : 400;

export function startMarket() {
  if (priceTimer) return;
  priceTimer = setInterval(stepPrices, 1000);
  setInterval(publishDisclosure, 45_000);
  setInterval(() => {
    for (const code of quotes.keys()) {
      jitterBook(code);
      emitBook(code);
    }
  }, BOOK_INTERVAL_MS);
}
