import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// 토큰 원본은 design-system/tokens.css 하나다. 앱 쪽 복사본이 달라지면 실패한다.
it("src/styles/tokens.css가 design-system 원본과 같다", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8").replace(/\r\n/g, "\n");
  expect(read("./tokens.css")).toBe(read("../../../design-system/tokens.css"));
});
