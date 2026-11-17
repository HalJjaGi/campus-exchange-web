/**
 * 가짜 실시간 이벤트 통로. 시장·커뮤니티·알림 mock이 같은 소켓으로 이벤트를 보낸다.
 * 소켓이 연결되면 socket.ts가 실제 전달 함수를 끼운다. 그 전에는 버린다.
 */
export type Emit = (topic: string, payload: unknown, version?: number, id?: string) => void;

let target: Emit = () => {};

export const setEmitTarget = (fn: Emit) => {
  target = fn;
};

export const emit: Emit = (topic, payload, version, id) => target(topic, payload, version, id);

let seq = 0;
export const mockId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++seq).toString(36)}`;
