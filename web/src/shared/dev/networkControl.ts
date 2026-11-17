/**
 * 개발 화면에서 실시간 연결 끊김을 흉내 내기 위한 연결 지점.
 * mock이 켜져 있을 때만 main.tsx가 등록한다. 실서버 모드에서는 null.
 */
export interface NetworkControl {
  isOnline(): boolean;
  goOffline(): void;
  goOnline(): void;
  subscribe(listener: () => void): () => void;
}

let control: NetworkControl | null = null;

export const registerNetworkControl = (c: NetworkControl) => {
  control = c;
};

export const getNetworkControl = () => control;
