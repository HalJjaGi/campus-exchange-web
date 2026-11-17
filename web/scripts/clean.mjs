// dist/ 비우기.
// Vite의 emptyOutDir는 fs.rmSync를 쓰는데, Windows + Node 24.12에서 경로에 한글이 있으면
// (예: 바탕화면/졸업프로젝트) 프로세스가 0xC0000409로 바로 죽는다. 비동기 fs.promises.rm은 문제가 없어 이것을 쓴다.
// Node 22 LTS를 쓰거나 영문 경로로 옮기면 이 스크립트 없이 emptyOutDir만으로 충분하다.
import { rm } from "node:fs/promises";

await rm(new URL("../dist", import.meta.url), { recursive: true, force: true });
