import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { registerNetworkControl } from "@/shared/dev/networkControl";
import { browserSocketFactory } from "@/shared/realtime/browserSocket";
import { RealtimeClient, type SocketFactory } from "@/shared/realtime/RealtimeClient";
import "@/styles/tokens.css";
import "@/styles/base.css";

/** 개발 모드 기본값은 mock. 실서버에 붙이려면 VITE_MOCK=off */
const useMock = import.meta.env.DEV && import.meta.env.VITE_MOCK !== "off";

async function boot() {
  let socketFactory: SocketFactory;

  if (useMock) {
    const [{ worker }, { createMockSocket, mockNetwork }] = await Promise.all([
      import("@/mocks/browser"),
      import("@/mocks/socket"),
    ]);
    await worker.start({ onUnhandledRequest: "bypass", quiet: true });
    socketFactory = createMockSocket;
    registerNetworkControl(mockNetwork);
  } else {
    const url = import.meta.env.VITE_WS_URL ?? `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
    socketFactory = browserSocketFactory(url);
  }

  const realtime = new RealtimeClient(socketFactory);

  const root = document.getElementById("root");
  if (!root) throw new Error("#root가 없습니다");
  createRoot(root).render(
    <StrictMode>
      <App realtime={realtime} />
    </StrictMode>,
  );
}

void boot();
