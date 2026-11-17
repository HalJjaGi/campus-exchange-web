import type { SocketLike } from "@/shared/realtime/RealtimeClient";
import type { RealtimeClientMessage, RealtimeEnvelope } from "@/shared/types/api";
import { setEmitTarget } from "./bus";

/**
 * 브라우저 안에서 동작하는 가짜 WebSocket 서버.
 * mockNetwork.goOffline()으로 끊김을 흉내 내 폴링 폴백을 확인할 수 있다.
 */
class MockSocket implements SocketLike {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  readonly topics = new Set<string>();
  private closed = false;

  constructor() {
    setTimeout(() => {
      if (this.closed) return;
      if (!online) {
        this.close();
        return;
      }
      sockets.add(this);
      this.onopen?.();
    }, 150);
  }

  send(data: string) {
    const msg = JSON.parse(data) as RealtimeClientMessage;
    if (msg.type === "subscribe") this.topics.add(msg.topic);
    else this.topics.delete(msg.topic);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    sockets.delete(this);
    this.onclose?.();
  }

  deliver(envelope: RealtimeEnvelope) {
    if (!this.closed && this.topics.has(envelope.topic)) this.onmessage?.({ data: JSON.stringify(envelope) });
  }
}

const sockets = new Set<MockSocket>();
let online = true;
const statusListeners = new Set<() => void>();

function broadcast(topic: string, payload: unknown, version?: number, id?: string) {
  const envelope: RealtimeEnvelope = { type: "event", topic, version, id, payload };
  sockets.forEach((s) => s.deliver(envelope));
}

export function createMockSocket(): SocketLike {
  setEmitTarget(broadcast);
  return new MockSocket();
}

export const mockNetwork = {
  isOnline: () => online,
  goOffline() {
    online = false;
    [...sockets].forEach((s) => s.close());
    statusListeners.forEach((l) => l());
  },
  goOnline() {
    online = true;
    statusListeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    statusListeners.add(l);
    return () => {
      statusListeners.delete(l);
    };
  },
};
