#!/bin/bash
# SSE 스트림 테스트 스크립트
# 사용법: ./test-sse.sh

echo "=== SSE 스트림 테스트 ==="
echo "서버가 실행 중이어야 합니다: npm run start:dev"
echo ""
echo "10초 동안 SSE 이벤트를 수신합니다..."
echo ""

timeout 10s curl -N \
  -H "Accept: text/event-stream" \
  http://localhost:3000/api/v1/news/stream

echo ""
echo ""
echo "테스트 완료!"
echo ""
echo "다른 필터 옵션:"
echo "  curl -N http://localhost:3000/api/v1/news/stream?source=finnhub"
echo "  curl -N http://localhost:3000/api/v1/news/stream?category=general"
