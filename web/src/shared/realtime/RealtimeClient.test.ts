import { RealtimeClient, type SocketLike } from "./RealtimeClient";

class FakeSocket implements SocketLike {
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.onclose?.();
  }
  emit(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
}

function setup() {
  const sockets: FakeSocket[] = [];
  const client = new RealtimeClient(
    () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
    { backoff: [100] },
  );
  const last = () => sockets[sockets.length - 1]!;
  return { client, sockets, last };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("연결되면 기존 구독을 서버에 보낸다", () => {
  const { client, last } = setup();
  client.subscribe("quote.CSE", () => {});
  client.connect();
  last().onopen?.();
  expect(client.getStatus()).toBe("open");
  expect(last().sent).toEqual([{ type: "subscribe", topic: "quote.CSE" }]);
});

it("같은 토픽을 두 번 구독해도 subscribe는 한 번, 마지막 해제 때만 unsubscribe", () => {
  const { client, last } = setup();
  client.connect();
  last().onopen?.();
  const off1 = client.subscribe("t", () => {});
  const off2 = client.subscribe("t", () => {});
  off1();
  expect(last().sent).toEqual([{ type: "subscribe", topic: "t" }]);
  off2();
  expect(last().sent).toEqual([
    { type: "subscribe", topic: "t" },
    { type: "unsubscribe", topic: "t" },
  ]);
});

it("이전 버전 이하 이벤트는 버린다", () => {
  const { client, last } = setup();
  const got: unknown[] = [];
  client.connect();
  last().onopen?.();
  client.subscribe("t", (p) => got.push(p));
  last().emit({ type: "event", topic: "t", version: 2, payload: "a" });
  last().emit({ type: "event", topic: "t", version: 1, payload: "old" });
  last().emit({ type: "event", topic: "t", version: 2, payload: "same" });
  last().emit({ type: "event", topic: "t", version: 3, payload: "b" });
  expect(got).toEqual(["a", "b"]);
});

it("스냅샷 기준 버전보다 오래된 이벤트도 버린다", () => {
  const { client, last } = setup();
  const got: unknown[] = [];
  client.connect();
  last().onopen?.();
  client.subscribe("t", (p) => got.push(p));
  client.setBaseline("t", 10);
  last().emit({ type: "event", topic: "t", version: 9, payload: "old" });
  last().emit({ type: "event", topic: "t", version: 11, payload: "new" });
  expect(got).toEqual(["new"]);
});

it("같은 ID 이벤트는 한 번만 전달한다", () => {
  const { client, last } = setup();
  const got: unknown[] = [];
  client.connect();
  last().onopen?.();
  client.subscribe("feed.CSE", (p) => got.push(p));
  last().emit({ type: "event", topic: "feed.CSE", id: "p1", payload: 1 });
  last().emit({ type: "event", topic: "feed.CSE", id: "p1", payload: 1 });
  last().emit({ type: "event", topic: "feed.CSE", id: "p2", payload: 2 });
  expect(got).toEqual([1, 2]);
});

it("끊기면 polling으로 바뀌고, 재연결되면 recover를 알리고 재구독한다", () => {
  const { client, sockets, last } = setup();
  const recovered = vi.fn();
  client.onRecover(recovered);
  client.subscribe("t", () => {});
  client.connect();
  last().onopen?.();

  last().onclose?.();
  expect(client.getStatus()).toBe("polling");
  expect(sockets).toHaveLength(1);

  vi.advanceTimersByTime(100);
  expect(sockets).toHaveLength(2);
  last().onopen?.();

  expect(client.getStatus()).toBe("open");
  expect(recovered).toHaveBeenCalledTimes(1);
  expect(last().sent).toEqual([{ type: "subscribe", topic: "t" }]);
});

it("최초 연결 성공은 recover가 아니다", () => {
  const { client, last } = setup();
  const recovered = vi.fn();
  client.onRecover(recovered);
  client.connect();
  last().onopen?.();
  expect(recovered).not.toHaveBeenCalled();
});

it("직접 끊으면 재연결하지 않는다", () => {
  const { client, sockets, last } = setup();
  client.connect();
  last().onopen?.();
  client.disconnect();
  vi.advanceTimersByTime(1000);
  expect(sockets).toHaveLength(1);
  expect(client.getStatus()).toBe("idle");
});
