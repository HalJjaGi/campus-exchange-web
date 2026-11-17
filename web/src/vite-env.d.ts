/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_WS_URL?: string;
  /** "off"면 개발 모드에서도 mock을 끄고 실서버에 붙는다 */
  readonly VITE_MOCK?: string;
}
