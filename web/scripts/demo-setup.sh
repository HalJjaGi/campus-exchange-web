#!/usr/bin/env bash
# 시연 준비(맥OS 기준). 사람이 직접 실행해도 되고, 에이전트가 /demo-setup 스킬에서 실행한다.
#
#   bash web/scripts/demo-setup.sh            # 확인 → 설치 → 검사
#   bash web/scripts/demo-setup.sh --quick    # 검사(타입·테스트) 생략
#
# 개발 서버는 띄우지 않는다. 마지막에 띄우는 명령을 알려 준다(에이전트는 백그라운드로 띄운다).
set -euo pipefail

QUICK=0
[[ "${1:-}" == "--quick" ]] && QUICK=1

cd "$(dirname "$0")/.."   # web/
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; exit 1; }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }

step "1. 환경"
command -v node >/dev/null || fail "Node가 없어요. 'brew install node@22' 또는 nvm으로 Node 22를 설치하세요."
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if (( NODE_MAJOR < 20 )); then fail "Node $(node -v)는 너무 낮아요. Node 22를 설치하세요(.nvmrc)."; fi
ok "Node $(node -v) (권장 22)"
ok "npm $(npm -v)"

step "2. 의존성 설치"
# Windows에서 복사해 온 node_modules는 맥에서 동작하지 않는다(네이티브 바이너리). 플랫폼이 다르면 지운다
if [[ -d node_modules && ! -e node_modules/@rollup/rollup-darwin-arm64 && ! -e node_modules/@rollup/rollup-darwin-x64 ]]; then
  echo "  다른 OS에서 설치된 node_modules를 지우고 다시 설치해요"
  rm -rf node_modules
fi
if [[ ! -d node_modules ]]; then
  npm ci --no-audit --no-fund || npm install --no-audit --no-fund
fi
ok "설치 완료"

if (( QUICK == 0 )); then
  step "3. 검사"
  npm run typecheck >/dev/null && ok "타입 검사"
  npx vitest run --reporter=dot >/dev/null && ok "단위 테스트"
else
  step "3. 검사 생략(--quick)"
fi

step "4. 포트"
if lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "  5173 포트를 이미 쓰는 프로세스가 있어요:"
  lsof -nP -iTCP:5173 -sTCP:LISTEN | tail -n +2 | sed 's/^/    /'
  echo "  이 프로젝트의 개발 서버라면 그대로 써도 되고, 아니면 종료하세요."
else
  ok "5173 비어 있음"
fi

step "준비 끝"
cat <<'MSG'
  서버 띄우기:   cd web && npm run demo        (브라우저가 자동으로 열려요)
  주소:          http://localhost:5173
  데모 계정:     demo@campus.ac.kr / campus2026
  잠자기 막기:   caffeinate -d   (발표 끝나면 Ctrl+C)
  시연 순서:     DEMO.md
MSG
