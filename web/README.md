# 캠퍼스 거래소 — Web

계획: `../프론트엔드_개발계획.md` · 디자인 규칙: `../design-system/DESIGN.md`

## 실행

```bash
npm install
npm run dev          # http://localhost:5173  (기본: 가짜 API + 가짜 실시간 시세)
npm run demo         # 시연용: 포트 고정 + 로그인 화면 자동으로 열기 (준비 절차는 ../DEMO.md)
```

- 로그인: 데모 계정 `demo@campus.ac.kr` / `campus2026`
  - 가입을 해 보려면 `/signup`. 메일은 실제로 가지 않고 **인증번호가 화면 오른쪽 위 "개발용 메일함"에 뜬다**(콘솔에도 `[mock] … 인증번호: 123456`으로 찍힌다)
  - 가입한 계정·로그인 상태는 `localStorage`(`mock.users`, `mock.session`)에 남는다. 지우면 처음 상태로 돌아간다
- 대시보드: http://localhost:5173/
- 거래 화면: http://localhost:5173/trade/CSE
  - `?stress=1`을 붙이면 호가가 초당 20회 바뀐다(주문 입력이 끊기지 않는지 확인용)
  - 가짜 시장은 컴퓨터공학과 30주를 보유한 상태로 시작한다(매도 확인용)
- 마이페이지: http://localhost:5173/me
  - 데모 계정은 21일 전 가입, 다음 날 컴퓨터공학과 30주 매수, 오락실 보상을 예금으로 받은 이력으로 시작한다. 9·8일 전은 자산 기록이 없는 날이다(차트 선이 끊기는지 확인용)
  - 부분 실패 확인: `?fail=wallet,holdings,history,ledger,profile` 중 원하는 영역을 붙이면 그 요청만 500으로 실패한다. 주소에서 지우고 `다시 시도`를 누르면 복구된다
- 컴포넌트·실시간 처리 확인: http://localhost:5173/dev/ui (개발 모드 전용)
  - `WS 끊기` 버튼으로 연결 끊김 → 5초 폴링 → 복구 흐름을 확인할 수 있다

### Node 버전

Node 22 LTS를 권장한다(`.nvmrc`). Windows + Node 24.12에서는 경로에 한글이 있으면(예: `바탕화면/졸업프로젝트`)
`fs.rmSync`가 프로세스를 바로 죽인다. 그래서 `dist/` 비우기는 Vite 대신 `scripts/clean.mjs`가 한다.
- 실서버에 붙이기: `.env.local`에 아래를 넣는다
  ```
  VITE_MOCK=off
  VITE_API_BASE=http://localhost:8080
  VITE_WS_URL=ws://localhost:8080/ws
  ```

## 검사

```bash
npm run typecheck    # tsc
npm run lint         # eslint + stylelint(원시 색상·px 금지) + prettier
npm test             # vitest
npm run build
```

## 규칙 요약

- 색·간격·글자 크기는 `src/styles/tokens.css` 토큰만 쓴다. 원본은 `design-system/tokens.css`이고, 바꾸면 복사본도 같이 바꾼다(테스트가 확인함).
- 숫자 표기는 `shared/lib/format.ts`, 금액 계산은 `shared/lib/decimal.ts`만 쓴다.
- 정책 값(금리·수수료율 등)은 하드코딩하지 않고 `usePolicy()`로 받는다.
- `src/mocks`는 `main.tsx`에서만 불러온다(eslint가 막음). 프로덕션 번들에는 포함되지 않는다.
- AI 참여자를 구분하는 필드나 분기를 만들지 않는다.
