#!/bin/bash

# PreToolUse 이벤트에서 TypeScript 파일 수정 감지

# $CLAUDE_TOOL_NAME: 실행될 도구 이름 (Edit, Write 등)
# $CLAUDE_TOOL_INPUT: 도구의 입력 파라미터 (JSON)

if [[ "$CLAUDE_TOOL_NAME" == "Edit" ]] || [[ "$CLAUDE_TOOL_NAME" == "Write" ]]; then
  # file_path 추출
  FILE_PATH=$(echo "$CLAUDE_TOOL_INPUT" | grep -o '"file_path":"[^"]*"' | sed 's/"file_path":"//;s/"$//')

  if [[ "$FILE_PATH" =~ \.(ts|tsx)$ ]]; then
    cat >&2 << 'EOF'

# 📝 TypeScript 파일 수정됨

파일이 수정되었습니다. 작업 완료 시점에 다음 검사가 자동으로 수행됩니다:
- ✅ TypeScript 컴파일 검사 (tsc)
- ✅ ESLint 검사
- ✅ Prettier 포매팅
- ✅ 테스트 실행
- ✅ 자동 커밋/푸시/PR 생성

**현재는 계속 작업하세요.** 모든 수정이 끝나면 자동으로 검토 프로세스가 시작됩니다.

EOF
  fi

  # console.log 감지
  if echo "$CLAUDE_TOOL_INPUT" | grep -q 'console\.\(log\|debug\|warn\|error\)'; then
    cat >&2 << 'EOF'

# ⚠️ 디버그 코드 감지

**감지된 패턴:**
- `console.log()`, `console.debug()`, `console.warn()`, `console.error()`

**주의사항:**
- 프로덕션 코드에 디버그 코드가 포함되지 않도록 주의하세요
- 의도적으로 로깅이 필요한 경우 NestJS Logger를 사용하세요

**NestJS Logger 사용 예시:**
```typescript
import { Logger } from '@nestjs/common';

export class MyService {
  private readonly logger = new Logger(MyService.name);

  someMethod() {
    this.logger.log('This is a log message');
    this.logger.error('This is an error message');
  }
}
```

EOF
  fi
fi

exit 0  # warn: 경고만 표시하고 도구 실행 허용
