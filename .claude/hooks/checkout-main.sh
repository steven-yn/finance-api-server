#!/bin/bash

# 세션 시작 시 main 브랜치로 이동하도록 안내하는 hook
# UserPromptSubmit 이벤트에서 실행 (세션당 한 번만)

LOCK_DIR="/tmp/claude-hooks"
LOCK_FILE="${LOCK_DIR}/main-checkout-$(echo -n "$PWD" | md5 -q 2>/dev/null || echo -n "$PWD" | md5sum 2>/dev/null | cut -d' ' -f1)"

mkdir -p "$LOCK_DIR"

# lock 파일이 존재하고 1시간 이내면 건너뛰기 (세션당 한 번만 실행)
if [ -f "$LOCK_FILE" ]; then
  FILE_AGE=$(( $(date +%s) - $(stat -f %m "$LOCK_FILE" 2>/dev/null || stat -c %Y "$LOCK_FILE" 2>/dev/null) ))
  if [ "$FILE_AGE" -lt 3600 ]; then
    exit 0
  fi
fi

touch "$LOCK_FILE"

# Git 리포지토리가 아니면 건너뛰기
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  exit 0
fi

CURRENT=$(git branch --show-current 2>/dev/null)

if [ "$CURRENT" != "main" ] && [ -n "$CURRENT" ]; then
  cat >&2 << EOF
현재 '$CURRENT' 브랜치에 있습니다. 작업 시작 전 main 브랜치로 이동하고 최신 코드를 pull 받아주세요:
git checkout main && git pull origin main
EOF
  exit 2
fi

# main 브랜치인 경우 최신 코드 pull
git pull origin main > /dev/null 2>&1

exit 0
