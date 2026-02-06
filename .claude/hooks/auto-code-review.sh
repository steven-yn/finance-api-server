#!/bin/bash

# Stop 이벤트에서 실행되는 자동 코드 검토, 커밋, 리뷰, 머지 hook
# stdin으로 hook 컨텍스트를 받음

INPUT=$(cat)

# 무한루프 방지: 이미 Stop hook이 활성화된 상태면 종료 허용
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0
fi

cat >&2 << 'EOF'
작업을 완료하기 전에 다음 단계를 순서대로 수행해주세요:

## Phase 1: 코드 품질 검사

1단계: TypeScript 컴파일 검사 - npx tsc --noEmit
2단계: ESLint 검사 - npx eslint "src/**/*.{ts,tsx}" --max-warnings 0 (에러 시 --fix로 자동 수정, 설정 파일 없으면 건너뛰기)
3단계: Prettier 포매팅 - npx prettier --write "src/**/*.{ts,tsx,json}"
4단계: 테스트 실행 - npm run test

## Phase 2: 커밋 및 PR 생성

5단계: 변경사항이 있으면 커밋하고 push 해주세요. 기존 PR이 있으면 해당 브랜치에 push하고, 없으면 새 브랜치를 만들어서 PR을 생성해주세요.

## Phase 3: 코드 리뷰 및 수정 (최대 2회 반복)

6단계: /code-review 스킬을 실행하여 PR을 리뷰해주세요.
7단계: 리뷰에서 CRITICAL 또는 HIGH 이슈가 발견되면:
  - 해당 이슈를 수정하세요
  - Phase 1 (1~4단계)을 다시 실행하세요
  - 수정사항을 커밋하고 push 하세요
  - /code-review 를 다시 실행하세요
  - 이 과정은 최대 2회까지만 반복하세요. 2회 후에도 이슈가 남아있으면 사용자에게 보고하고 다음 단계로 진행하세요.

## Phase 4: PR 머지 및 main 병합

8단계: 코드 리뷰를 통과하면 (또는 2회 반복 후) gh pr merge 명령으로 PR을 머지해주세요 (--squash 옵션 사용)
9단계: main 브랜치로 이동 - git checkout main
10단계: 최신 코드 pull - git pull origin main
11단계: 머지된 feature 브랜치 삭제 - git branch -d <브랜치명>

모든 단계를 완료하기 전까지 세션을 종료하지 마세요.
EOF

exit 2
