import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { DATABASE_CONNECTION } from "../../src/common/constants/tokens";
import {
  createTestDatabase,
  createMockNewsData,
} from "../fixtures/setup-test-db";
import Database from "better-sqlite3";
import { ApiExceptionFilter } from "../../src/common/filters/api-exception.filter";
import { ResponseInterceptor } from "../../src/common/interceptors/response.interceptor";
import { Reflector } from "@nestjs/core";

describe("News API (e2e)", () => {
  let app: INestApplication;
  let db: Database.Database;

  beforeAll(async () => {
    // 테스트용 인메모리 DB 생성
    db = createTestDatabase(createMockNewsData(50));

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATABASE_CONNECTION)
      .useValue(db)
      .compile();

    app = moduleFixture.createNestApplication();

    // 전역 설정 적용 (main.ts와 동일)
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));

    await app.init();
  });

  afterAll(async () => {
    db.close();
    await app.close();
  });

  describe("GET /api/v1/news", () => {
    it("기본 파라미터로 최근 뉴스를 가져온다", () => {
      return request(app.getHttpServer())
        .get("/api/v1/news")
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.data.length).toBeLessThanOrEqual(20);
          expect(res.body.meta).toEqual({
            total: 50,
            limit: 20,
            offset: 0,
          });
        });
    });

    it("limit과 offset 파라미터를 적용한다", () => {
      return request(app.getHttpServer())
        .get("/api/v1/news?limit=5&offset=10")
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBeLessThanOrEqual(5);
          expect(res.body.meta).toEqual({
            total: 50,
            limit: 5,
            offset: 10,
          });
        });
    });

    it("source 필터를 적용한다", () => {
      return request(app.getHttpServer())
        .get("/api/v1/news?source=finnhub")
        .expect(200)
        .expect((res) => {
          res.body.data.forEach((news: any) => {
            expect(news.source).toBe("finnhub");
          });
        });
    });

    it("category 필터를 적용한다", () => {
      return request(app.getHttpServer())
        .get("/api/v1/news?category=general")
        .expect(200)
        .expect((res) => {
          res.body.data.forEach((news: any) => {
            expect(news.category).toBe("general");
          });
        });
    });

    it("잘못된 limit 값은 400 에러를 반환한다", () => {
      return request(app.getHttpServer())
        .get("/api/v1/news?limit=101")
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.code).toBe("VALIDATION_ERROR");
        });
    });
  });

  describe("GET /api/v1/news/search", () => {
    it("키워드로 뉴스를 검색한다", () => {
      return request(app.getHttpServer())
        .get("/api/v1/news/search?q=Test")
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeInstanceOf(Array);
        });
    });

    it("검색 키워드가 없으면 400 에러를 반환한다", () => {
      return request(app.getHttpServer())
        .get("/api/v1/news/search")
        .expect(400);
    });
  });

  describe("GET /api/v1/news/stats", () => {
    it("통계 정보를 반환한다", () => {
      return request(app.getHttpServer())
        .get("/api/v1/news/stats")
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.total).toBe(50);
          expect(res.body.data.bySource).toBeDefined();
          expect(res.body.data.byCategory).toBeDefined();
        });
    });
  });

  describe("GET /api/v1/news/:newsId", () => {
    it("존재하는 뉴스의 상세 정보를 반환한다", () => {
      return request(app.getHttpServer())
        .get("/api/v1/news/test-news-1")
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.newsId).toBe("test-news-1");
          expect(res.body.data.headline).toBeDefined();
        });
    });

    it("존재하지 않는 뉴스는 404 에러를 반환한다", () => {
      return request(app.getHttpServer())
        .get("/api/v1/news/non-existent")
        .expect(404)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.code).toBe("NOT_FOUND");
        });
    });
  });

  // SSE 스트림 테스트는 supertest로 테스트하기 어려우므로
  // unit 테스트(news-sse.service.spec.ts)에서 검증합니다.
  // 실제 동작은 수동 테스트 또는 curl로 확인할 수 있습니다:
  // curl -N http://localhost:3000/api/v1/news/stream
});
