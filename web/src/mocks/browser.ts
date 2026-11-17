import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";
import { startCommunity } from "./community";
import { startMarket } from "./market";

export const worker = setupWorker(...handlers);

// 로그인 전(가입 중)에도 시장이 움직이도록 바로 시작한다. 실시간 전달은 소켓이 연결될 때 붙는다
startMarket();
startCommunity();
