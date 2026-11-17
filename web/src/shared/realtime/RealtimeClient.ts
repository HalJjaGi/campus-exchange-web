import type { RealtimeClientMessage, RealtimeEnvelope } from "@/shared/types/api";

/** 브라우저 WebSocket과 mock 소켓이 공통으로 따르는 최소 인터페이스 */
export interface SocketLike {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onmessage: ((ev: { data: string }) => void) | null;
}

export type SocketFactory = () => SocketLike;

/**
 * idle: 아직 연결 안 함
 * connecting: 최초 연결 중
 * open: 실시간 수신 중
 * polling: 끊김 — 재연결을 시도하는 동안 화면은 5초 HTTP 폴링으로 갱신 (SD-02)
 */
export type RealtimeStatus = "idle" | "connecting" | "open" | "polling";

type Handler = (payload: unknown, envelope: RealtimeEnvelope) => void;

interface Options {
  /** 재연결 대기(ms). 마지막 값을 계속 반복한다 */
  backoff?: number[];
  /** 토픽별로 기억할 이벤트 ID 개수 */
  dedupeWindow?: number;
}

export class RealtimeClient {
  private socket: SocketLike | null = null;
  private status: RealtimeStatus = "idle";
  private wantConnected = false;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly handlers = new Map<string, Set<Handler>>();
  private readonly lastVersion = new Map<string, number>();
  private readonly seenIds = new Map<string, { set: Set<string>; order: string[] }>();
  private readonly statusListeners = new Set<() => void>();
  private readonly recoverListeners = new Set<() => void>();

  private readonly backoff: number[];
  private readonly dedupeWindow: number;

  constructor(
    private readonly createSocket: SocketFactory,
    opts: Options = {},
  ) {
    this.backoff = opts.backoff ?? [1000, 2000, 4000, 8000, 10000];
    this.dedupeWindow = opts.dedupeWindow ?? 500;
  }

  getStatus = () => this.status;

  connect() {
    if (this.wantConnected) return;
    this.wantConnected = true;
    this.setStatus("connecting");
    this.open();
  }

  disconnect() {
    this.wantConnected = false;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const s = this.socket;
    this.socket = null;
    s?.close();
    this.setStatus("idle");
  }

  /** 같은 토픽을 여러 컴포넌트가 구독해도 서버에는 한 번만 subscribe를 보낸다 */
  subscribe(topic: string, handler: Handler): () => void {
    let set = this.handlers.get(topic);
    if (!set) {
      set = new Set();
      this.handlers.set(topic, set);
      this.send({ type: "subscribe", topic });
    }
    set.add(handler);

    return () => {
      const current = this.handlers.get(topic);
      if (!current) return;
      current.delete(handler);
      if (current.size === 0) {
        this.handlers.delete(topic);
        this.lastVersion.delete(topic);
        this.seenIds.delete(topic);
        this.send({ type: "unsubscribe", topic });
      }
    };
  }

  /** 스냅샷을 새로 받은 토픽은 그 스냅샷의 버전부터 비교한다 */
  setBaseline(topic: string, version: number) {
    const last = this.lastVersion.get(topic);
    if (last === undefined || version > last) this.lastVersion.set(topic, version);
  }

  onStatusChange(listener: () => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /** 끊겼다가 다시 연결됐을 때. 구독자는 여기서 스냅샷을 다시 조회해 누락을 메운다 */
  onRecover(listener: () => void): () => void {
    this.recoverListeners.add(listener);
    return () => {
      this.recoverListeners.delete(listener);
    };
  }

  /* ───────── 내부 ───────── */

  private open() {
    const socket = this.createSocket();
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) return;
      const recovered = this.status === "polling";
      this.attempt = 0;
      this.setStatus("open");
      for (const topic of this.handlers.keys()) this.send({ type: "subscribe", topic });
      if (recovered) this.recoverListeners.forEach((l) => l());
    };

    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      if (!this.wantConnected) return;
      this.setStatus("polling");
      this.scheduleReconnect();
    };

    socket.onmessage = (ev) => this.handleMessage(ev.data);
  }

  private scheduleReconnect() {
    const delay = this.backoff[Math.min(this.attempt, this.backoff.length - 1)] ?? 10000;
    this.attempt += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.wantConnected) this.open();
    }, delay);
  }

  private handleMessage(raw: string) {
    let msg: RealtimeEnvelope;
    try {
      msg = JSON.parse(raw) as RealtimeEnvelope;
    } catch {
      console.warn("[realtime] JSON이 아닌 메시지를 버립니다", raw);
      return;
    }
    if (msg.type !== "event") return;

    const handlers = this.handlers.get(msg.topic);
    if (!handlers) return;
    if (this.isStale(msg) || this.isDuplicate(msg)) return;

    handlers.forEach((h) => h(msg.payload, msg));
  }

  private isStale(msg: RealtimeEnvelope): boolean {
    if (msg.version === undefined) return false;
    const last = this.lastVersion.get(msg.topic);
    if (last !== undefined && msg.version <= last) return true;
    this.lastVersion.set(msg.topic, msg.version);
    return false;
  }

  private isDuplicate(msg: RealtimeEnvelope): boolean {
    if (msg.id === undefined) return false;
    let seen = this.seenIds.get(msg.topic);
    if (!seen) {
      seen = { set: new Set(), order: [] };
      this.seenIds.set(msg.topic, seen);
    }
    if (seen.set.has(msg.id)) return true;
    seen.set.add(msg.id);
    seen.order.push(msg.id);
    if (seen.order.length > this.dedupeWindow) {
      const old = seen.order.shift();
      if (old !== undefined) seen.set.delete(old);
    }
    return false;
  }

  private send(msg: RealtimeClientMessage) {
    if (this.status !== "open" || !this.socket) return; // open 시점에 전체 재구독한다
    this.socket.send(JSON.stringify(msg));
  }

  private setStatus(next: RealtimeStatus) {
    if (this.status === next) return;
    this.status = next;
    this.statusListeners.forEach((l) => l());
  }
}
