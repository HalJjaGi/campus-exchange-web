import "@tanstack/react-query";

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: {
      /** true면 WS 재연결 시 다시 조회한다 (RealtimeProvider) */
      realtime?: boolean;
    };
  }
}
