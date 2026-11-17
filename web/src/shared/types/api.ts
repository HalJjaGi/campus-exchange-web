/**
 * Web ↔ 백엔드 계약 초안 (프론트엔드_개발계획.md §6).
 * 백엔드와 합의되면 이 파일이 기준이 된다. OpenAPI가 나오면 생성 타입으로 교체한다.
 *
 * 규칙
 * - 금액·가격·비율은 DecimalString. 비율은 소수(0.0321 = 3.21%).
 * - 시각은 ISO 8601 문자열.
 * - AI 참여자 식별 필드(userType, generationMethod, modelId)는 Web 응답에 없다. 추가하지 않는다.
 */
import type { DecimalString } from "@/shared/lib/decimal";

export type ISODateTime = string;

/* ── 정책 ── */
export interface CentralBankPolicy {
  baseRate: DecimalString;
  depositRate: DecimalString;
  lpEnabled: boolean;
  feeRate: DecimalString;
  borrowFeeRate: DecimalString;
  marginRequirement: DecimalString;
  /** 가격대별 호가 단위. upTo 미만 가격에 tick 적용, 마지막 구간은 upTo=null */
  tickRules: TickRule[];
  /** 1회 주문 수량 범위 */
  quantityLimits: { min: number; max: number };
  updatedAt: ISODateTime;
}

export interface TickRule {
  upTo: DecimalString | null;
  tick: DecimalString;
}

/* ── 시장 ── */
export type StockCategory = "DEPT" | "SCHEDULE" | "MEME";
export type TradingState = "NORMAL" | "VI_ACTIVE" | "SINGLE_PRICE";
export type MoveReason = "DISCLOSURE" | "EVENT" | "PARTICIPANT_SURGE";

export interface MarketIndex {
  value: DecimalString;
  changeRate: DecimalString;
  /** 당일 분 단위 값. 데이터가 없으면 빈 배열(채워 넣지 않는다) */
  intraday: DecimalString[];
  version: number;
  updatedAt: ISODateTime;
}

export interface StockQuote {
  code: string;
  name: string;
  category: StockCategory;
  price: DecimalString;
  prevClose: DecimalString;
  changeRate: DecimalString;
  volume: number;
  tradingState: TradingState;
  exDividendToday: boolean;
  /** 서버가 근거를 갖고 붙인 사유만 온다 */
  moveReason: MoveReason | null;
  sparkline: DecimalString[];
  version: number;
  updatedAt: ISODateTime;
}

export interface RankingSnapshot {
  items: StockQuote[];
  version: number;
  updatedAt: ISODateTime;
}

/* ── 거래 (SCR-03) ── */

export interface OrderbookLevel {
  price: DecimalString;
  /** LP 물량 포함 전체 잔량 */
  quantity: number;
  /** 그중 LP 물량. 0이면 LP 표시 없음. AI 참여자 물량은 구분하지 않는다 */
  lpQuantity: number;
}

/**
 * GET /api/stocks/{code}/orderbook · WS orderbook.{code}
 * 이벤트도 10단계 전체 스냅샷으로 온다(부분 갱신 병합 실수를 피하려고).
 */
export interface OrderbookSnapshot {
  code: string;
  /** 매도 호가. 낮은 가격(최우선)부터 */
  asks: OrderbookLevel[];
  /** 매수 호가. 높은 가격(최우선)부터 */
  bids: OrderbookLevel[];
  version: number;
  updatedAt: ISODateTime;
}

export interface TradeTick {
  id: string;
  price: DecimalString;
  quantity: number;
  /** 체결을 일으킨 쪽(테이프 색) */
  side: OrderSide;
  at: ISODateTime;
}

/** GET /api/stocks/{code}/trades → 최근 체결(최신순) · WS trades.{code} → 새 체결 묶음 */
export interface TradeBatch {
  code: string;
  items: TradeTick[];
  version: number;
}

export type CandleInterval = "1m" | "5m" | "1d";

export interface Candle {
  /** 봉 시작 시각 */
  t: ISODateTime;
  o: DecimalString;
  h: DecimalString;
  l: DecimalString;
  c: DecimalString;
  v: number;
}

export type DisclosureType = "DIVIDEND" | "BURN" | "EVENT" | "MONETARY";

/** 차트 마커용 공시·이벤트 요약 */
export interface ChartEvent {
  id: string;
  at: ISODateTime;
  type: DisclosureType;
  title: string;
  summary: string;
}

/** GET /api/stocks/{code}/candles?interval= */
export interface CandleSeries {
  code: string;
  interval: CandleInterval;
  candles: Candle[];
  events: ChartEvent[];
}

export type OrderSide = "BUY" | "SELL";
export type OrderKind = "LIMIT" | "MARKET";
export type OrderStatus = "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "EXPIRED" | "REJECTED";

/** GET /api/me/trading-account?code= — 주문 패널이 쓰는 내 계좌 상태 */
export interface TradingAccount {
  code: string;
  available: DecimalString;
  reserved: DecimalString;
  /** 보유 수량 − 미체결 매도에 묶인 수량 */
  sellableQuantity: number;
  holdingQuantity: number;
  avgPrice: DecimalString | null;
  updatedAt: ISODateTime;
}

/** POST /api/orders (Idempotency-Key 헤더 필수) */
export interface PlaceOrderRequest {
  code: string;
  side: OrderSide;
  kind: OrderKind;
  /** 지정가만 */
  price?: DecimalString;
  quantity: number;
}

export interface OrderResult {
  orderId: string;
  status: OrderStatus;
  quantity: number;
  filledQuantity: number;
  /** 시장가 잔량 취소분 포함, 남은 미체결 수량 */
  remainingQuantity: number;
  avgFillPrice: DecimalString | null;
  fee: DecimalString;
}

/** GET /api/orders?status=open&code= · DELETE /api/orders/{id} */
export interface OpenOrder {
  orderId: string;
  code: string;
  name: string;
  side: OrderSide;
  kind: OrderKind;
  price: DecimalString;
  quantity: number;
  filledQuantity: number;
  status: Extract<OrderStatus, "NEW" | "PARTIALLY_FILLED">;
  createdAt: ISODateTime;
}

/** WS user.orders — 내 주문 상태 변화. 이걸 받으면 계좌·미체결을 다시 조회한다 */
export interface OrderUpdate {
  orderId: string;
  code: string;
  name: string;
  status: OrderStatus;
  filledQuantity: number;
  /** 이번 이벤트에서 새로 체결된 수량(0이면 상태 변화만) */
  lastFillQuantity: number;
  lastFillPrice: DecimalString | null;
}

/* ── 자산 ── */
export interface WalletSummary {
  available: DecimalString;
  reserved: DecimalString;
  bankBalance: DecimalString;
  unrealizedPnl: DecimalString;
  interestToday: DecimalString;
  updatedAt: ISODateTime;
}

/* ── 마이페이지 (SCR-06, UC-14) ── 영역별로 따로 조회해 한 영역이 실패해도 나머지는 보인다 */

/** GET /api/me/profile · PATCH /api/me/profile { nickname } */
export interface MyProfile {
  nickname: string;
  title: string | null;
  /** 가입한 학교 메일 도메인(campus.ac.kr). 메일 주소 전체는 내려주지 않는다 */
  schoolDomain: string;
  joinedAt: ISODateTime;
  status: "ACTIVE" | "RESTRICTED";
}

export interface UpdateProfileRequest {
  nickname: string;
}

/**
 * GET /api/me/holdings — 확정 보유 수량·평균 매입가 + 서버가 평가에 쓴 시세.
 * 화면은 quote.{code} 이벤트로 price만 바꿔 다시 평가한다. 수량은 다시 조회해서만 바뀐다(SD-14).
 */
export interface Holding {
  code: string;
  name: string;
  quantity: number;
  avgPrice: DecimalString;
  price: DecimalString;
  prevClose: DecimalString;
  /** 이 price가 나온 시세 버전. 더 낮은 버전의 이벤트는 버린다 */
  quoteVersion: number;
  quoteUpdatedAt: ISODateTime;
}

export interface HoldingsSnapshot {
  items: Holding[];
  updatedAt: ISODateTime;
}

/** GET /api/me/asset-history?range= — 기록된 날의 스냅샷만 온다. 빈 날을 채워 보내지 않는다 */
export type HistoryRange = "7d" | "30d" | "90d";

export interface AssetSnapshot {
  /** 기준 날짜(한국 시간) YYYY-MM-DD */
  date: string;
  totalAsset: DecimalString;
  evaluatedAt: ISODateTime;
}

export interface AssetHistory {
  /** 조회 구간(포함). 차트 가로축을 이 구간으로 잡아 빈 날이 빈 채로 보이게 한다 */
  from: string;
  to: string;
  items: AssetSnapshot[];
}

/** 원장 거래 유형(SDS ledger.tx_type) */
export type LedgerTxType =
  "TRADE" | "FEE" | "BURN" | "INTEREST" | "DIVIDEND" | "REWARD" | "AIRDROP" | "BID" | "BORROW_FEE";

export type LedgerAccount = "WALLET" | "BANK";

/** 매매·수수료 기록에 붙는 체결 정보 */
export interface LedgerTrade {
  tradeId: string;
  code: string;
  name: string;
  side: OrderSide;
  quantity: number;
  price: DecimalString;
}

export interface LedgerEntry {
  id: string;
  accountType: LedgerAccount;
  txType: LedgerTxType;
  /** 부호 있는 변동 금액 */
  amount: DecimalString;
  /** 이 기록 직후 해당 계좌 잔액 */
  balanceAfter: DecimalString;
  trade: LedgerTrade | null;
  createdAt: ISODateTime;
}

/** GET /api/me/ledger?types=TRADE,FEE&from=&cursor= (최신순) */
export interface LedgerPage {
  items: LedgerEntry[];
  nextCursor: string | null;
}

/* ── 공시 (UC-12) ── */

/** GET /api/disclosures?limit= (최신순) · WS disclosures (id로 중복 제거) */
export interface Disclosure {
  id: string;
  type: DisclosureType;
  title: string;
  summary: string;
  /** 대상 종목 코드. 시장 전체 공시면 빈 배열 */
  stockCodes: string[];
  publishedAt: ISODateTime;
}

/** GET /api/disclosures/{id} — 공시 상세 */
export interface DisclosureDetail extends Disclosure {
  body: string;
  /** 대상 종목 이름(링크용) */
  stocks: Array<{ code: string; name: string }>;
}

/* ── 커뮤니티 (SCR-04) ── */

export type PostTag = "ROCKET" | "SHORT_VIEW" | "WATCH";
/** 태그와 실제 포지션이 맞을 때 서버가 붙인 인증. 맞지 않거나 확인 실패면 NONE */
export type VerificationType = "REAL_HOLD" | "SHORT" | "NONE";

export interface PostAuthor {
  nickname: string;
  title: string | null;
}

/**
 * 게시글. 작성자가 실유저인지 AI 참여자인지 나타내는 필드는 없다(SDS S-04).
 * priorityUntil: 서버가 정한 "상단 우선 노출" 종료 시각. 이 시각 전까지 `새 글`로 강조하고 위에 둔다.
 * 프론트는 이 값만 보고 판단한다 — 누가 썼는지로 판단하지 않는다.
 */
export interface Post {
  id: string;
  stockCode: string;
  author: PostAuthor;
  tag: PostTag;
  content: string;
  verification: VerificationType;
  reactionCount: number;
  commentCount: number;
  reactedByMe: boolean;
  reportedByMe: boolean;
  /** 내가 쓴 글(신고 버튼 숨김) */
  mine: boolean;
  priorityUntil: ISODateTime | null;
  createdAt: ISODateTime;
}

export type FeedItem = { kind: "post"; post: Post } | { kind: "disclosure"; disclosure: Disclosure };

export type FeedSort = "latest" | "popular";

/** GET /api/stocks/{code}/feed?sort=&cursor= */
export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
}

/** WS feed.{code} — 종목 채널 이벤트. created 계열은 envelope id로 중복 제거 */
export type FeedEvent =
  | { type: "post.created"; post: Post }
  | { type: "post.counts"; postId: string; reactionCount: number; commentCount: number }
  /** 신고 처리로 숨김·삭제됨 → 피드에서 뺀다 */
  | { type: "post.removed"; postId: string }
  | { type: "disclosure.created"; disclosure: Disclosure };

/** POST /api/posts */
export interface CreatePostRequest {
  code: string;
  tag: PostTag;
  content: string;
}

export interface Comment {
  id: string;
  author: PostAuthor;
  content: string;
  createdAt: ISODateTime;
}

/** POST·DELETE /api/posts/{id}/reactions */
export interface ReactionResult {
  reacted: boolean;
  reactionCount: number;
}

export type ReportReason = "SPAM" | "ABUSE" | "FALSE_INFO" | "ETC";

/** POST /api/reports */
export interface ReportRequest {
  targetType: "POST";
  targetId: string;
  reason: ReportReason;
}

/* ── 알림 (S-07) ── */

export type NotificationType = "DISCLOSURE" | "POST_COMMENT" | "POST_REACTION" | "ORDER_FILLED";

/** 알림을 눌렀을 때 갈 곳 */
export type NotificationLink =
  { kind: "post"; postId: string } | { kind: "disclosure"; disclosureId: string } | { kind: "trade"; code: string };

/** GET /api/notifications?cursor= · WS user.notifications (id로 중복 제거). 가입 이전 이벤트는 오지 않는다 */
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: NotificationLink;
  createdAt: ISODateTime;
  readAt: ISODateTime | null;
}

export interface NotificationPage {
  items: AppNotification[];
  nextCursor: string | null;
  unreadCount: number;
}

/* ── 인증·온보딩 (SCR-01) ── */

export interface Title {
  id: string;
  name: string;
}

/** GET /api/auth/me — 로그인 안 됐으면 401 */
export interface SessionUser {
  nickname: string;
  title: string | null;
}

/** POST /api/auth/email/send */
export interface EmailSendResult {
  /** 인증번호 만료 시각(발급 후 3분) */
  expiresAt: ISODateTime;
}

/** POST /api/auth/email/verify */
export interface EmailVerifyResult {
  /** 가입 요청에 실어 보내는 인증 완료 증표 */
  verificationToken: string;
}

/**
 * 인증 실패 응답의 detail. 코드별로 채워지는 필드가 다르다.
 * CODE_MISMATCH → remainingAttempts, EMAIL_LOCKED → lockedUntil
 */
export interface AuthErrorDetail {
  remainingAttempts?: number;
  lockedUntil?: ISODateTime;
}

/** POST /api/auth/signup (Idempotency-Key) */
export interface SignupRequest {
  verificationToken: string;
  nickname: string;
  password: string;
  titleId: string;
}

/** 가입 완료 모달 데이터(SD-01 5단계). 시장 데이터 조회가 실패하면 null이어도 가입은 성공이다 */
export interface WelcomeBriefing {
  policy: Pick<CentralBankPolicy, "baseRate" | "depositRate">;
  index: Pick<MarketIndex, "value" | "changeRate" | "intraday">;
  /** 한 줄 시장 브리핑 */
  headline: string;
}

export interface SignupResult {
  user: SessionUser;
  /** 초기 지급액(1,000,000P). 서버 값으로 보여준다 */
  initialGrant: DecimalString;
  welcome: WelcomeBriefing | null;
}

/* ── 공통 에러 ── */
export interface ApiErrorBody {
  code: string;
  message?: string;
  detail?: Record<string, unknown>;
}

/* ── 실시간 ── */
export interface RealtimeEnvelope<T = unknown> {
  type: "event";
  topic: string;
  /** 토픽 안에서 단조 증가. 이전 값 이하는 버린다 */
  version?: number;
  /** 게시글·공시·알림처럼 중복 제거가 필요한 이벤트의 ID */
  id?: string;
  payload: T;
}

export type RealtimeClientMessage = { type: "subscribe"; topic: string } | { type: "unsubscribe"; topic: string };
