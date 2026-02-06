# Finance API Server 구현 계획

## Context

`~/projects`에는 금융 데이터 수집 생태계(Python)가 있다:
- **finance-news**: 뉴스 수집 (Finnhub, RSS, SEC, FRED) → SQLite 저장 + Discord 알림
- **finance-crypto-observer (qfin)**: 암호화폐 시세 감지 (Binance WebSocket)
- **finance-notifier**: 통합 Discord 알림 시스템

API 서버는 수집된 데이터를 REST API + 실시간 스트림으로 서빙한다. Python 프로젝트와의 유일한 결합점은 **SQLite DB 파일**이므로 TypeScript + NestJS로 구현한다.

---

## 기술 스택

| 패키지 | 용도 |
|--------|------|
| **NestJS** | 모듈 기반 프레임워크, DI 컨테이너 |
| **better-sqlite3** | 동기 SQLite 드라이버 (`readonly: true`, `fileMustExist: true`) |
| **@nestjs/config** | 환경변수 관리 (`.env` 로딩) |
| **@nestjs/swagger** | OpenAPI/Swagger 자동 생성 |
| **@nestjs/terminus** | 표준 헬스체크 |
| **@nestjs/throttler** | Rate limiting (SSE 남용 방지) |
| **class-validator / class-transformer** | DTO 검증 |
| **rxjs** | SSE 스트림 (`timer` + `share` + `finalize`) |
| **helmet** | HTTP 보안 헤더 |
| **Jest + supertest** | 테스트 |

---

## 프로젝트 구조

```
finance-api-server/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
├── .env.example
├── .gitignore
├── src/
│   ├── main.ts                              # 부트스트랩
│   ├── app.module.ts                        # 루트 모듈
│   ├── common/
│   │   ├── constants/
│   │   │   └── tokens.ts                    # DI 토큰 (DATABASE_CONNECTION)
│   │   ├── decorators/
│   │   │   └── skip-response-wrap.decorator.ts
│   │   ├── exceptions/
│   │   │   └── app.exceptions.ts            # DatabaseException, ResourceNotFoundException
│   │   ├── filters/
│   │   │   └── api-exception.filter.ts      # 전역 예외 필터
│   │   └── interceptors/
│   │       └── response.interceptor.ts      # 응답 래핑 인터셉터
│   ├── database/
│   │   ├── database.module.ts               # @Global, useFactory, better-sqlite3
│   │   └── database-lifecycle.service.ts    # OnModuleDestroy -> db.close()
│   └── modules/
│       ├── news/
│       │   ├── news.module.ts
│       │   ├── news.controller.ts           # REST 5개 + SSE 1개
│       │   ├── news.service.ts              # 비즈니스 로직 (Repository 위임)
│       │   ├── news.repository.ts           # Prepared statements, 읽기 전용 쿼리
│       │   ├── news-sse.service.ts          # SSE 전담 (RxJS timer + share)
│       │   └── dto/
│       │       ├── news-query.dto.ts        # 입력: 목록/검색 쿼리 파라미터
│       │       └── news.dto.ts              # 출력: NewsDto + fromRow() 변환
│       └── health/
│           ├── health.module.ts             # TerminusModule import
│           ├── health.controller.ts         # @HealthCheck()
│           └── database.health.ts           # DatabaseHealthIndicator
├── test/
│   ├── fixtures/
│   │   └── setup-test-db.ts                 # 인메모리 SQLite + 스키마 + 시드
│   ├── unit/
│   │   ├── news.repository.spec.ts
│   │   ├── news.service.spec.ts
│   │   └── response.interceptor.spec.ts
│   └── e2e/
│       ├── jest-e2e.json
│       ├── news.e2e-spec.ts
│       └── app.e2e-spec.ts
```

---

## 핵심 설계 상세

### 1. DatabaseModule — Symbol 토큰 + useFactory

```typescript
// common/constants/tokens.ts
export const DATABASE_CONNECTION = Symbol('DATABASE_CONNECTION');
```

```typescript
// database/database.module.ts
@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useFactory: (config: ConfigService) => {
        const dbPath = config.getOrThrow<string>('NEWS_DB_PATH');
        const db = new Database(dbPath, {
          readonly: true,
          fileMustExist: true,
        });
        db.pragma('journal_mode = WAL');
        db.pragma('busy_timeout = 5000');
        return db;
      },
      inject: [ConfigService],
    },
    DatabaseLifecycleService,
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
```

**설계 근거:**
- `@Global()` : 모든 모듈에서 `import` 없이 `@Inject(DATABASE_CONNECTION)` 사용
- `fileMustExist: true` : DB 파일 없으면 빈 DB 자동생성 방지, 앱 시작 시 즉시 실패
- `busy_timeout = 5000` : Python writer와 동시 접근 시 잠깐 대기 후 재시도
- Symbol 토큰 : 문자열 충돌 없이 타입 안전한 DI
- `DatabaseLifecycleService.onModuleDestroy()` : graceful shutdown 시 `db.close()`

### 2. NewsRepository — Prepared Statements

```typescript
// modules/news/news.repository.ts
@Injectable()
export class NewsRepository {
  private readonly stmts: Record<string, Statement>;

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database.Database) {
    this.stmts = {
      findRecent: db.prepare(
        `SELECT * FROM news
         WHERE (?1 IS NULL OR source = ?1)
         AND (?2 IS NULL OR category = ?2)
         ORDER BY published_at DESC LIMIT ?3 OFFSET ?4`
      ),
      countFiltered: db.prepare(
        `SELECT COUNT(*) as total FROM news
         WHERE (?1 IS NULL OR source = ?1)
         AND (?2 IS NULL OR category = ?2)`
      ),
      findById: db.prepare('SELECT * FROM news WHERE news_id = ?'),
      search: db.prepare(
        `SELECT * FROM news
         WHERE headline LIKE ?1 OR summary LIKE ?1
         ORDER BY published_at DESC LIMIT ?2 OFFSET ?3`
      ),
      searchCount: db.prepare(
        `SELECT COUNT(*) as total FROM news
         WHERE headline LIKE ?1 OR summary LIKE ?1`
      ),
      findAfter: db.prepare(
        'SELECT * FROM news WHERE id > ? ORDER BY id ASC'
      ),
      statsBySource: db.prepare(
        'SELECT source, COUNT(*) as cnt FROM news GROUP BY source'
      ),
      statsByCategory: db.prepare(
        'SELECT category, COUNT(*) as cnt FROM news GROUP BY category'
      ),
      statsTotal: db.prepare(
        `SELECT COUNT(*) as total,
         COUNT(CASE WHEN notified_at IS NOT NULL THEN 1 END) as notified
         FROM news`
      ),
    };
  }
}
```

**설계 근거:**
- 생성자에서 prepared statement 한 번 컴파일 : 반복 쿼리 5-10x 성능 향상
- `?1 IS NULL OR source = ?1` 패턴 : 동적 필터를 단일 statement로 처리
- 기존 Python `repository.py`의 쿼리 패턴을 그대로 참조

### 3. SSE — RxJS timer + share (메모리 안전)

```typescript
// modules/news/news-sse.service.ts 핵심 로직
private readonly newsStream$ = timer(0, 5000).pipe(
  switchMap(() => this.pollNewArticles()),
  share(),  // 단일 폴링을 모든 구독자가 공유
);

subscribe(source?: string, category?: string): Observable<MessageEvent> {
  this.subscriberCount++;
  return this.newsStream$.pipe(
    filter(event => !source || event.source === source),
    filter(event => !category || event.category === category),
    map(event => ({
      data: JSON.stringify(event),
      id: String(event.id),
      type: 'news',
    })),
    finalize(() => this.subscriberCount--),
  );
}
```

```typescript
// Controller에서 req.on('close') 처리
@Sse('stream')
@SkipResponseWrap()
stream(
  @Query() query: NewsQueryDto,
  @Req() req: Request,
): Observable<MessageEvent> {
  return new Observable(subscriber => {
    const sub = this.newsSseService
      .subscribe(query.source, query.category)
      .subscribe({
        next: v => subscriber.next(v),
        error: e => subscriber.error(e),
      });
    req.on('close', () => {
      sub.unsubscribe();
      subscriber.complete();
    });
  });
}
```

**`@Interval` 대신 `timer` + `share`를 사용하는 이유:**
- 구독자 0명이면 `share()`가 소스를 자동 해제하여 불필요한 DB 폴링 없음
- `finalize()`로 구독자 카운트 자동 관리하여 메모리 누수 방지
- `req.on('close')`로 클라이언트 연결 해제 감지하여 구독 정리

### 4. ResponseInterceptor + SSE 충돌 해결

```typescript
// common/decorators/skip-response-wrap.decorator.ts
export const SKIP_RESPONSE_WRAP = 'skipResponseWrap';
export const SkipResponseWrap = () => SetMetadata(SKIP_RESPONSE_WRAP, true);

// response.interceptor.ts
intercept(context: ExecutionContext, next: CallHandler) {
  const skip = this.reflector.get<boolean>(
    SKIP_RESPONSE_WRAP, context.getHandler()
  );
  if (skip) return next.handle();
  return next.handle().pipe(
    map(data => ({
      success: true,
      data: data?.items ?? data,
      meta: data?.meta,
    })),
  );
}
```

SSE와 `@nestjs/terminus` 헬스체크에 `@SkipResponseWrap()` 데코레이터 적용.

### 5. 에러 처리 — 유형별 계층화

```
ApiExceptionFilter
  |- BadRequestException (class-validator) -> 400, VALIDATION_ERROR
  |- ResourceNotFoundException             -> 404, NOT_FOUND
  |- DatabaseException                     -> 503, DATABASE_ERROR (내부 스택 로깅만)
  |- HttpException (기타 NestJS)           -> 해당 status
  '- 미처리 예외                            -> 500, INTERNAL_ERROR (정보 노출 금지)
```

모든 에러 응답 형식: `{ success: false, error: "메시지", code: "ERROR_CODE" }`

### 6. main.ts — 글로벌 설정

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: config.get('CORS_ORIGIN', '*'),
    methods: ['GET'],
  });
  app.use(helmet());
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));

  // Swagger
  const docConfig = new DocumentBuilder()
    .setTitle('Finance API').setVersion('1.0').build();
  SwaggerModule.setup('api', app,
    SwaggerModule.createDocument(app, docConfig));

  await app.listen(config.get('PORT', 3000));
}
```

---

## API 엔드포인트

### 뉴스 (`/api/v1/news`)

| Method | Path | 설명 | 파라미터 |
|--------|------|------|----------|
| GET | `/api/v1/news` | 최근 뉴스 목록 | `limit`(1-100, 기본20), `offset`(기본0), `source?`, `category?` |
| GET | `/api/v1/news/search` | 키워드 검색 | `q`(1-200자), `limit`, `offset` |
| GET | `/api/v1/news/stats` | 소스/카테고리별 통계 | - |
| GET | `/api/v1/news/:newsId` | 뉴스 상세 | - |
| GET | `/api/v1/news/stream` | SSE 실시간 스트림 | `source?`, `category?` |

### 헬스체크 (`/api/v1/health`)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/health` | `@nestjs/terminus` 표준 헬스체크 (DB 연결 상태 포함) |

### 응답 형식

성공 (ResponseInterceptor 자동 래핑):
```json
{
  "success": true,
  "data": [...],
  "meta": { "total": 1523, "limit": 20, "offset": 0 }
}
```

에러 (ApiExceptionFilter 처리):
```json
{
  "success": false,
  "error": "뉴스를 찾을 수 없습니다",
  "code": "NOT_FOUND"
}
```

---

## 데이터 접근

- finance-news SQLite DB: `../finance-news/.data/news.db` (환경변수로 설정 가능)
- `better-sqlite3({ readonly: true, fileMustExist: true })` : 쓰기 원천 차단
- WAL 모드에서 Python writer + Node.js reader 동시 접근 안전

### 참조할 기존 DB 스키마 (`finance-news/src/finance_news/db/schema.py`)
```sql
CREATE TABLE news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    news_id TEXT NOT NULL UNIQUE,  hash TEXT NOT NULL,
    headline TEXT NOT NULL,        summary TEXT,          url TEXT,
    source TEXT NOT NULL,          category TEXT NOT NULL,
    published_at TIMESTAMP NOT NULL,
    symbols TEXT,                  -- JSON: ["BTC","AAPL"]
    raw_data TEXT,                 -- JSON object
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notified_at TIMESTAMP
);
-- 인덱스: published_at DESC, source, category, created_at DESC, hash
```

### 참조할 기존 쿼리 패턴 (`finance-news/src/finance_news/db/repository.py`)
- `find_recent()` (:125-156) : source/category 필터 + ORDER BY published_at DESC
- `find_by_keyword()` (:158-177) : headline/summary LIKE 검색
- `get_stats()` (:216-238) : GROUP BY source/category 집계 + notified 카운트

---

## 테스트 전략

### 원칙: 인메모리 SQLite (모킹 금지)

```typescript
// test/fixtures/setup-test-db.ts
export function createTestDatabase(seedData?: NewsRow[]): Database.Database {
  const db = new Database(':memory:');
  db.exec(CREATE_TABLE_SQL);  // finance-news와 동일한 스키마
  if (seedData) { /* prepared statement로 시드 삽입 */ }
  return db;
}
```

### 테스트 계층

| 계층 | 대상 | 방식 |
|------|------|------|
| **Unit** | Repository, Service, Interceptor, Filter | 인메모리 DB 직접 주입, 순수 로직 테스트 |
| **Integration** | Controller (전체 요청/응답) | `Test.createTestingModule()` + `overrideProvider(DATABASE_CONNECTION).useValue(testDb)` |
| **E2E** | 전체 앱 | supertest + 인메모리 DB |

---

## 구현 순서

### Phase 1: 프로젝트 초기화 + 인프라
1. NestJS 프로젝트 생성 (package.json, tsconfig, nest-cli.json)
2. 의존성 설치 (better-sqlite3, @nestjs/config, swagger, terminus, throttler, helmet, class-validator)
3. `.env.example`, `.gitignore`
4. `common/` : tokens, exceptions, filter, interceptor, decorator
5. `database/` : database.module.ts, database-lifecycle.service.ts
6. `main.ts` : 글로벌 설정 (prefix, cors, helmet, pipes, filters, interceptors, swagger)
7. `app.module.ts` : ConfigModule, DatabaseModule, ThrottlerModule

### Phase 2: 뉴스 REST API (TDD)
1. `test/fixtures/setup-test-db.ts` : 인메모리 DB 헬퍼
2. `test/unit/news.repository.spec.ts` (RED)
3. `dto/news.dto.ts`, `dto/news-query.dto.ts`
4. `news.repository.ts` (GREEN) : prepared statements
5. `test/unit/news.service.spec.ts` (RED)
6. `news.service.ts` (GREEN)
7. `news.controller.ts` + `news.module.ts`
8. `test/e2e/news.e2e-spec.ts`

### Phase 3: SSE 실시간 뉴스
1. `news-sse.service.ts` : RxJS timer + share + finalize
2. Controller에 `@Sse('stream')` + `@SkipResponseWrap()` + `req.on('close')`
3. SSE 스트림 테스트

### Phase 4: 헬스체크 + 마무리
1. `health/` : TerminusModule + DatabaseHealthIndicator
2. 전체 테스트 실행 + 커버리지 80%+ 확인

---

## 검증 방법

1. `npm test` : unit + integration 테스트 통과
2. `npm run test:e2e` : e2e 테스트 통과
3. `npm run test:cov` : 커버리지 80%+
4. `npm run start:dev`로 서버 기동
5. `http://localhost:3000/api` 에서 Swagger UI 확인
6. `curl http://localhost:3000/api/v1/news?limit=5` : 뉴스 목록 반환
7. `curl http://localhost:3000/api/v1/news/search?q=bitcoin` : 검색 결과
8. `curl http://localhost:3000/api/v1/news/stats` : 통계
9. `curl -N http://localhost:3000/api/v1/news/stream` : SSE 이벤트 수신
10. `curl http://localhost:3000/api/v1/health` : 헬스체크
11. 에러 형식 검증: 404, 400(validation) 응답이 `{ success, error, code }` 형식인지 확인
