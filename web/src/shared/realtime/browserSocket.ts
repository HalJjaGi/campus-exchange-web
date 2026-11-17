import type { SocketFactory, SocketLike } from "./RealtimeClient";

/** 브라우저 WebSocket을 SocketLike로 감싼다 */
export function browserSocketFactory(url: string): SocketFactory {
  return () => {
    const ws = new WebSocket(url);
    const socket: SocketLike = {
      onopen: null,
      onclose: null,
      onmessage: null,
      send: (data) => ws.send(data),
      close: () => ws.close(),
    };
    ws.onopen = () => socket.onopen?.();
    // 연결 실패도 close로 끝나므로 onerror는 따로 처리하지 않는다
    ws.onclose = () => socket.onclose?.();
    ws.onmessage = (ev: MessageEvent<string>) => socket.onmessage?.({ data: ev.data });
    return socket;
  };
}
