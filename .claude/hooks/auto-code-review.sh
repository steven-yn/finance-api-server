#!/bin/bash

# Stop 이벤트에서 실행되는 자동 코드 검토 및 커밋 hook
# stdin으로 hook 컨텍스트를 받음

INPUT=$(cat)

# 무한루프 방지: 이미 Stop hook이 활성화된 상태면 종료 허용
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0
fi

cat >&2 << 'EOF'
작업을 완료하기 전에 다음 단계를 순서대로 수행해주세요:

1단계: TypeScript 컴파일 검사 - npx tsc --noEmit
2단계: ESLint 검사 - npx eslint "src/**/*.{ts,tsx}" --max-warnings 0 (에러 시 --fix로 자동 수정)
3단계: Prettier 포매팅 - npx prettier --write "src/**/*.{ts,tsx,json}"
4단계: 테스트 실행 - npm run test
5단계: 모든 검사 통과 후 /commit-push-pr 스킬을 실행해주세요

모든 단계를 완료하기 전까지 세션을 종료하지 마세요.
EOF

exit 2
