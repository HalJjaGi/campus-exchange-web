# 캠퍼스 가상 증권 거래소 — 프론트엔드

졸업 프로젝트. 이 저장소의 담당 범위는 **프론트엔드(web/)뿐**이다. 백엔드 코드는 만들지 않는다. 백엔드가 준비되기 전까지 `web/src/mocks/`의 가짜 서버(MSW)와 가짜 실시간 시장으로 동작한다.

## 문서

- `Software_Design_Specification__SDS_v1.3.md` — 설계 기준(UC·SD 번호는 여기서 온다). `Software_Design_Specification__SDS_.md`는 옛 판본
- `요구사항정의서_v1.2.md` — 화면별 상세 요구(SCR-01~06)
- `프론트엔드_개발계획.md` — 단계별 계획. 1~5단계(MVP 화면) 완료, 6단계(실서버 연동)는 백엔드 대기, 7단계(확장) 우선순위 VI → 전광판 → 이자·배당 → 공매도 → 오락실
- `design-system/DESIGN.md`, `design-system/tokens.css` — 디자인 규칙과 토큰. `web/src/styles/tokens.css`는 이 파일과 같아야 한다(테스트로 확인)
- `DEMO.md` — 발표 시연 준비·순서

## 명령 (web/ 에서)

```bash
npm run dev        # 개발 서버 + 가짜 서버 (http://localhost:5173)
npm run demo       # 시연용: 포트 고정 + 로그인 화면 자동으로 열기
npm run typecheck && npm run lint && npm test
npm run build      # 가짜 서버 코드는 빠진다 — 이걸로는 시연할 수 없다
```

## 시연 세팅을 부탁받으면

`/demo-setup` 스킬(`.claude/skills/demo-setup/SKILL.md`)을 따른다.

## 코드 규칙 (요약 — 자세한 것은 web/README.md, DESIGN.md)

- 색·간격·글자 크기는 토큰만 쓴다(stylelint가 막는다). 상승·매수 빨강, 하락·매도 파랑
- 금액은 문자열 DecimalString + decimal.js-light. 비율은 소수(0.0321)
- `features/`끼리 import하지 않는다. 여러 곳이 쓰면 `shared/`로. `pages/`는 조립만
- 가짜 서버 코드는 `main.tsx`에서만 불러온다(배포 빌드에 들어가면 안 된다)
- AI 참여자를 구분하는 필드·분기를 만들지 않는다
- 확정 잔고·수량은 이벤트 값으로 고치지 않고 서버에서 다시 조회한다(SD-14)
- 화면 문구는 해요체
